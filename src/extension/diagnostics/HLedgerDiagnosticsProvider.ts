import * as vscode from 'vscode';
import { HLedgerConfig } from '../HLedgerConfig';
import { AccountName } from '../types';

/**
 * Diagnostic codes for hledger validation errors.
 */
export enum HLedgerDiagnosticCode {
    UndefinedAccount = 'undefined-account',
    InvalidTagFormat = 'invalid-tag-format',
    InvalidAmountFormat = 'invalid-amount-format'
}

/**
 * Provides diagnostics for hledger files on save and open.
 * Validates account definitions, tag format, and amount format.
 */
export class HLedgerDiagnosticsProvider implements vscode.Disposable {
    public readonly diagnosticCollection: vscode.DiagnosticCollection;
    private disposables: vscode.Disposable[] = [];

    constructor(private config: HLedgerConfig) {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('hledger');

        this.disposables.push(
            vscode.workspace.onDidSaveTextDocument(doc => {
                if (doc.languageId === 'hledger') {
                    this.validateDocument(doc);
                }
            })
        );

        this.disposables.push(
            vscode.workspace.onDidOpenTextDocument(doc => {
                if (doc.languageId === 'hledger') {
                    this.validateDocument(doc);
                }
            })
        );
    }

    private validateDocument(document: vscode.TextDocument): void {
        this.config.getConfigForDocument(document);

        const definedAccounts = new Set(this.config.getDefinedAccounts());
        const diagnostics: vscode.Diagnostic[] = [];

        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            const lineText = line.text;

            const accountDiag = this.validateAccountDefinition(lineText, i, definedAccounts);
            if (accountDiag) {
                diagnostics.push(accountDiag);
            }

            const tagDiag = this.validateTagFormat(lineText, i);
            if (tagDiag) {
                diagnostics.push(tagDiag);
            }

            const amountDiag = this.validateAmountFormat(lineText, i);
            if (amountDiag) {
                diagnostics.push(amountDiag);
            }
        }

        if (diagnostics.length > 0) {
            this.diagnosticCollection.set(document.uri, diagnostics);
        } else {
            this.diagnosticCollection.delete(document.uri);
        }
    }

    private validateAccountDefinition(
        lineText: string,
        lineNumber: number,
        definedAccounts: ReadonlySet<AccountName>
    ): vscode.Diagnostic | undefined {
        if (definedAccounts.size === 0) {
            return undefined;
        }

        const postingMatch = /^\s{2,}([\p{L}\p{N}:_\s-]+?)\s{2,}/u.exec(lineText);
        if (!postingMatch) {
            return undefined;
        }

        const accountName = postingMatch[1]?.trim() as AccountName;
        if (!accountName) {
            return undefined;
        }

        if (!this.isAccountDefinedOrHasDefinedParent(accountName, definedAccounts)) {
            const matchStart = postingMatch.index ?? 0;
            const matchLength = postingMatch[1]?.length ?? accountName.length;
            const range = new vscode.Range(
                lineNumber,
                matchStart,
                lineNumber,
                matchStart + matchLength
            );

            const diagnostic = new vscode.Diagnostic(
                range,
                `Account '${accountName}' is used but not defined with 'account' directive`,
                vscode.DiagnosticSeverity.Warning
            );
            diagnostic.code = HLedgerDiagnosticCode.UndefinedAccount;
            diagnostic.source = 'hledger';
            return diagnostic;
        }

        return undefined;
    }

    /**
     * Checks if an account is defined or has a defined parent account.
     * For example, if 'Assets' is defined, then 'Assets:Bank:Cash' is considered valid.
     */
    private isAccountDefinedOrHasDefinedParent(
        accountName: AccountName,
        definedAccounts: ReadonlySet<AccountName>
    ): boolean {
        // Check exact match first
        if (definedAccounts.has(accountName)) {
            return true;
        }

        // Check if any parent account is defined
        // For 'Assets:Bank:Cash', check 'Assets:Bank' and 'Assets'
        const parts = accountName.split(':');
        for (let i = parts.length - 1; i > 0; i--) {
            const parentAccount = parts.slice(0, i).join(':') as AccountName;
            if (definedAccounts.has(parentAccount)) {
                return true;
            }
        }

        return false;
    }

    private validateTagFormat(
        lineText: string,
        lineNumber: number
    ): vscode.Diagnostic | undefined {
        const commentMatch = /[;#]\s*(.*)$/.exec(lineText);
        if (!commentMatch) {
            return undefined;
        }

        const commentContent = commentMatch[1];
        if (!commentContent) {
            return undefined;
        }

        // In hledger, a tag is defined as: word followed by colon (tag: or tag:value)
        // Words without colons are just comments, not tags
        // Special tags like date: and date2: MUST have a value
        const specialTagPattern = /\b(date2?):(\s*)(?=[,\s]|$)/g;
        const matches = Array.from(commentContent.matchAll(specialTagPattern));

        if (matches.length > 0) {
            const firstMatch = matches[0];
            if (!firstMatch) {
                return undefined;
            }
            const tagName = firstMatch[1];
            const tagValue = firstMatch[2];

            // date: and date2: tags must have a value
            if (tagName && (!tagValue || tagValue.trim() === '')) {
                const commentStartIndex = commentMatch.index ?? 0;
                const commentPrefixLength = commentMatch[0].indexOf(commentContent);
                const startPos = commentStartIndex + commentPrefixLength + (firstMatch.index ?? 0);
                const matchLength = firstMatch[0].length;

                const range = new vscode.Range(lineNumber, startPos, lineNumber, startPos + matchLength);

                const diagnostic = new vscode.Diagnostic(
                    range,
                    `Tag '${tagName}:' requires a value (e.g., '${tagName}:2024-01-01')`,
                    vscode.DiagnosticSeverity.Warning
                );
                diagnostic.code = HLedgerDiagnosticCode.InvalidTagFormat;
                diagnostic.source = 'hledger';
                return diagnostic;
            }
        }

        return undefined;
    }

    private validateAmountFormat(
        lineText: string,
        lineNumber: number
    ): vscode.Diagnostic | undefined {
        const postingMatch = /^\s{2,}([\p{L}\p{N}:_\s-]+?)\s{2,}(.+?)(;.*)?$/u.exec(lineText);
        if (!postingMatch || !postingMatch[2]) {
            return undefined;
        }

        const amountPart = postingMatch[2].trim();
        if (!amountPart) {
            return undefined;
        }

/**
         * Validates amount format in hledger postings.
         *
         * Supported patterns:
         * - Basic amounts: -$10.00, $-10.00, $10.00, +$10.00, $+10.00, 10.00 USD, -10.00 USD, +10.00 USD, 10.00
         * - Unicode currencies: ₽100.00, €50.00
         * - Grouped numbers: 1,000.00 (with , or . or space as group separator)
         * - Scientific notation: 1E-6, 1E3, EUR 1E3 (E/e followed by optional single sign and digits)
         * - Quoted commodities: 3 "green apples", "Indian rupee" 10
         * - Balance assertions without amount: =$500, = $500, ==$500, =* $500, ==* $500
         * - Balance assignment: := $500
         * - Amount with balance assertion: $100 = $500
         * - Amount with cost: 10 AAPL @ $150
         * - Indian numbering systems
         * - Space as grouping character
         *
         * Number structure requires at least one digit. Scientific notation must follow
         * the pattern: E or e, optional single sign (+/-), then digits.
         * Sign can be + or - and can appear before or after the commodity symbol.
         */
        const validAmountPattern = /^(={1,2}\*?\s*|:=\s*)?[+-]?\s*("[^"]+"|[\p{Sc}\p{L}]*)\s*[+-]?((?:\p{Nd}{1,2}(?:[,. ]\p{Nd}{2})+(?:[,. ]\p{Nd}{3})*|\p{Nd}{1,3}(?:[,. ]\p{Nd}{3})+|\p{Nd}+)(?:[.,]\p{Nd}*)?(?:[eE][+-]?\p{Nd}+)?)\s*("[^"]+"|[\p{Sc}\p{L}]*)(?:\s*@{1,2}\s*[+-]?\s*("[^"]+"|[\p{Sc}\p{L}]*)\s*[+-]?((?:\p{Nd}{1,2}(?:[,. ]\p{Nd}{2})+(?:[,. ]\p{Nd}{3})*|\p{Nd}{1,3}(?:[,. ]\p{Nd}{3})+|\p{Nd}+)(?:[.,]\p{Nd}*)?(?:[eE][+-]?\p{Nd}+)?)\s*("[^"]+"|[\p{Sc}\p{L}]*))?\s*(?:={1,2}\*?\s*[+-]?\s*("[^"]+"|[\p{Sc}\p{L}]*)\s*[+-]?((?:\p{Nd}{1,2}(?:[,. ]\p{Nd}{2})+(?:[,. ]\p{Nd}{3})*|\p{Nd}{1,3}(?:[,. ]\p{Nd}{3})+|\p{Nd}+)(?:[.,]\p{Nd}*)?(?:[eE][+-]?\p{Nd}+)?)\s*("[^"]+"|[\p{Sc}\p{L}]*))?$/u;
        if (!validAmountPattern.test(amountPart)) {
            const amountStartPos = lineText.indexOf(amountPart);
            const range = new vscode.Range(
                lineNumber,
                amountStartPos,
                lineNumber,
                amountStartPos + amountPart.length
            );

            const diagnostic = new vscode.Diagnostic(
                range,
                `Invalid amount format: '${amountPart}'`,
                vscode.DiagnosticSeverity.Error
            );
            diagnostic.code = HLedgerDiagnosticCode.InvalidAmountFormat;
            diagnostic.source = 'hledger';
            return diagnostic;
        }

        return undefined;
    }

    public clearDiagnostics(document: vscode.TextDocument): void {
        this.diagnosticCollection.delete(document.uri);
    }

    public clearAll(): void {
        this.diagnosticCollection.clear();
    }

    dispose(): void {
        this.diagnosticCollection.dispose();
        this.disposables.forEach(d => d.dispose());
    }
}
