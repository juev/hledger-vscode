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

        if (!definedAccounts.has(accountName)) {
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

        const noteWords = /\b(note|memo|description)\b/i;
        if (noteWords.test(commentContent)) {
            return undefined;
        }

        const orphanTagPattern = /(?<![:\p{L}\p{N}_-])([\p{L}\p{N}_-]+)(?=\s*[,]|\s*$)/gu;
        const matches = Array.from(commentContent.matchAll(orphanTagPattern));

        if (matches.length > 0) {
            const firstMatch = matches[0];
            if (!firstMatch) {
                return undefined;
            }
            const firstCapture = firstMatch[1];
            if (firstMatch.index !== undefined && firstCapture) {
                const startPos = commentMatch.index + commentMatch[0].indexOf(commentContent) + firstMatch.index;
                const endPos = startPos + firstCapture.length;

                const range = new vscode.Range(lineNumber, startPos, lineNumber, endPos);

                const diagnostic = new vscode.Diagnostic(
                    range,
                    `Tag '${firstCapture}' should have a value (use 'tag:value' format)`,
                    vscode.DiagnosticSeverity.Information
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
        const postingMatch = /^\s{2,}([\p{L}\p{N}:_\s-]+?)\s{2,}(.+)$/u.exec(lineText);
        if (!postingMatch || !postingMatch[2]) {
            return undefined;
        }

        const amountPart = postingMatch[2].trim();
        if (!amountPart) {
            return undefined;
        }

        // Valid amount patterns:
        // -$10.00, $-10.00, $10.00, 10.00 USD, -10.00 USD, 10.00, ₽100.00, 1,000.00
        // Allows: optional minus before or after commodity, digits with , and ., optional commodity before/after
        const validAmountPattern = /^-?[\p{Sc}\p{L}]*\s*-?[\p{N},.]+\s*[\p{Sc}\p{L}]*(\s*[@=].*)?$/u;
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
