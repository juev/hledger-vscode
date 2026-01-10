import * as vscode from 'vscode';
import { HLedgerConfig } from '../HLedgerConfig';
import { AccountName, CommodityCode } from '../types';
import { TransactionExtractor } from '../balance/TransactionExtractor';
import { TransactionBalancer } from '../balance/TransactionBalancer';
import { NumberFormatContext } from '../balance/AmountParser';

/**
 * Diagnostic codes for hledger validation errors.
 */
export enum HLedgerDiagnosticCode {
    UndefinedAccount = 'undefined-account',
    InvalidTagFormat = 'invalid-tag-format',
    InvalidAmountFormat = 'invalid-amount-format',
    UndeclaredCommodity = 'undeclared-commodity',
    UnbalancedTransaction = 'unbalanced-transaction'
}

/**
 * Provides diagnostics for hledger files on save and open.
 * Validates account definitions, tag format, and amount format.
 */
export class HLedgerDiagnosticsProvider implements vscode.Disposable {
    /**
     * Validates amount format in hledger postings.
     * Built once at class load time for performance.
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
    private static readonly VALID_AMOUNT_PATTERN: RegExp = (() => {
        const DECIMAL_DIGITS = '\\p{Nd}';
        const GROUP_SEP = '[,. ]';

        // Number grouping patterns:
        // - Indian: 1,00,00,000 (1-2 digits, then groups of 2, optional final group of 3)
        // - Standard: 1,000,000 (1-3 digits, then groups of 3)
        // - Simple: 12345 (no grouping)
        const NUMBER_GROUPS = [
            `${DECIMAL_DIGITS}{1,2}(?:${GROUP_SEP}${DECIMAL_DIGITS}{2})+(?:${GROUP_SEP}${DECIMAL_DIGITS}{3})*`,
            `${DECIMAL_DIGITS}{1,3}(?:${GROUP_SEP}${DECIMAL_DIGITS}{3})+`,
            `${DECIMAL_DIGITS}+`
        ].join('|');

        // Full number with optional decimal and scientific notation
        const FULL_NUMBER = `(?:${NUMBER_GROUPS})(?:[.,]${DECIMAL_DIGITS}*)?(?:[eE][+-]?${DECIMAL_DIGITS}+)?`;

        // Commodity pattern (quoted or unquoted)
        const COMMODITY = `(?:"[^"]+"|[\\p{Sc}\\p{L}]*)`;

        // Sign pattern
        const SIGN = '[+-]?';

        // Amount pattern: optional sign, commodity, sign, number, commodity
        const AMOUNT = `${SIGN}\\s*${COMMODITY}\\s*${SIGN}(${FULL_NUMBER})\\s*${COMMODITY}`;

        const patternString = `^(={1,2}\\*?\\s*|:=\\s*)?${AMOUNT}(?:\\s*@{1,2}\\s*${AMOUNT})?\\s*(?:={1,2}\\*?\\s*${AMOUNT})?$`;
        return new RegExp(patternString, 'u');
    })();

    public readonly diagnosticCollection: vscode.DiagnosticCollection;
    private disposables: vscode.Disposable[] = [];
    private readonly transactionExtractor: TransactionExtractor;
    private readonly transactionBalancer: TransactionBalancer;

    constructor(private config: HLedgerConfig) {
        this.transactionExtractor = new TransactionExtractor();
        this.transactionBalancer = new TransactionBalancer();
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
        const vsconfig = vscode.workspace.getConfiguration('hledger');
        const diagnosticsEnabled = vsconfig.get<boolean>('diagnostics.enabled', true);

        if (!diagnosticsEnabled) {
            this.diagnosticCollection.delete(document.uri);
            return;
        }

        this.config.getConfigForDocument(document);

        const definedAccounts = new Set(this.config.getDefinedAccounts());
        const definedCommodities = new Set(this.config.getDefinedCommodities());
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

            const commodityDiag = this.validateCommodityDeclaration(lineText, i, definedCommodities);
            if (commodityDiag) {
                diagnostics.push(commodityDiag);
            }
        }

        const checkBalance = vsconfig.get<boolean>('diagnostics.checkBalance', true);
        if (checkBalance) {
            const balanceDiagnostics = this.validateTransactionBalance(document);
            diagnostics.push(...balanceDiagnostics);
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

        if (!HLedgerDiagnosticsProvider.VALID_AMOUNT_PATTERN.test(amountPart)) {
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

    private validateCommodityDeclaration(
        lineText: string,
        lineNumber: number,
        definedCommodities: ReadonlySet<CommodityCode>
    ): vscode.Diagnostic | undefined {
        // Only validate if commodities are explicitly defined
        if (definedCommodities.size === 0) {
            return undefined;
        }

        // Only check posting lines (indented with 2+ spaces)
        if (!/^\s{2,}/.test(lineText)) {
            return undefined;
        }

        // Skip comment lines
        if (/^\s*[;#]/.test(lineText)) {
            return undefined;
        }

        // Extract commodity from amount patterns
        // Pattern 1: "100 USD" or "100.00 EUR" (suffix with space)
        const suffixMatch = lineText.match(/\s(\d[\d.,]*)\s+([A-Z]{2,})\b/);
        if (suffixMatch?.[2]) {
            const commodity = suffixMatch[2];
            if (!definedCommodities.has(commodity as CommodityCode)) {
                const commodityIndex = lineText.lastIndexOf(commodity);
                const range = new vscode.Range(
                    lineNumber,
                    commodityIndex,
                    lineNumber,
                    commodityIndex + commodity.length
                );

                const diagnostic = new vscode.Diagnostic(
                    range,
                    `Commodity '${commodity}' is used but not declared with 'commodity' directive`,
                    vscode.DiagnosticSeverity.Warning
                );
                diagnostic.code = HLedgerDiagnosticCode.UndeclaredCommodity;
                diagnostic.source = 'hledger';
                return diagnostic;
            }
        }

        // Pattern 2: "$100" or "€100" (prefix symbol)
        const prefixMatch = lineText.match(/\s([$€£¥₽₹])(\d[\d.,]*)/);
        if (prefixMatch?.[1]) {
            const commodity = prefixMatch[1];
            if (!definedCommodities.has(commodity as CommodityCode)) {
                const commodityIndex = lineText.indexOf(prefixMatch[0]) + 1;
                const range = new vscode.Range(
                    lineNumber,
                    commodityIndex,
                    lineNumber,
                    commodityIndex + commodity.length
                );

                const diagnostic = new vscode.Diagnostic(
                    range,
                    `Commodity '${commodity}' is used but not declared with 'commodity' directive`,
                    vscode.DiagnosticSeverity.Warning
                );
                diagnostic.code = HLedgerDiagnosticCode.UndeclaredCommodity;
                diagnostic.source = 'hledger';
                return diagnostic;
            }
        }

        return undefined;
    }

    private validateTransactionBalance(document: vscode.TextDocument): vscode.Diagnostic[] {
        const diagnostics: vscode.Diagnostic[] = [];
        const content = document.getText();

        const commodityFormats = this.config.getCommodityFormats();

        // Create formatContext only if commodity formats are defined
        // Otherwise use heuristic parsing (formatContext = undefined)
        const formatContext: NumberFormatContext | undefined =
            commodityFormats && commodityFormats.size > 0
                ? {
                    commodityFormats,
                    defaultCommodity: this.config.getDefaultCommodity()
                }
                : undefined;

        const transactions = this.transactionExtractor.extractTransactions(content, formatContext);

        for (const transaction of transactions) {
            const result = this.transactionBalancer.checkBalance(transaction);

            if (result.status === 'unbalanced') {
                for (const error of result.errors) {
                    const lineText = document.lineAt(transaction.headerLineNumber).text;
                    const range = new vscode.Range(
                        transaction.headerLineNumber,
                        0,
                        transaction.headerLineNumber,
                        lineText.length
                    );

                    const diagnostic = new vscode.Diagnostic(
                        range,
                        error.message,
                        vscode.DiagnosticSeverity.Error
                    );
                    diagnostic.code = HLedgerDiagnosticCode.UnbalancedTransaction;
                    diagnostic.source = 'hledger';
                    diagnostics.push(diagnostic);
                }
            } else if (result.status === 'error') {
                const lineText = document.lineAt(transaction.headerLineNumber).text;
                const range = new vscode.Range(
                    transaction.headerLineNumber,
                    0,
                    transaction.headerLineNumber,
                    lineText.length
                );

                const diagnostic = new vscode.Diagnostic(
                    range,
                    result.message,
                    vscode.DiagnosticSeverity.Error
                );
                diagnostic.code = HLedgerDiagnosticCode.UnbalancedTransaction;
                diagnostic.source = 'hledger';
                diagnostics.push(diagnostic);
            }
        }

        return diagnostics;
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
