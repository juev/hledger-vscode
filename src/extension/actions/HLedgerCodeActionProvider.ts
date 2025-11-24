import * as vscode from 'vscode';
import type { HLedgerConfig } from '../HLedgerConfig';
import { HLedgerDiagnosticCode } from '../diagnostics/HLedgerDiagnosticsProvider';

interface PostingInfo {
    account: string;
    amount: string;
    commodity: string;
    hasAssertion: boolean;
}

export class HLedgerCodeActionProvider implements vscode.CodeActionProvider {
    public static readonly providedCodeActionKinds = [
        vscode.CodeActionKind.Refactor,
        vscode.CodeActionKind.QuickFix,
    ];

    constructor(private config: HLedgerConfig) {}

    provideCodeActions(
        document: vscode.TextDocument,
        range: vscode.Range | vscode.Selection,
        context: vscode.CodeActionContext,
        token: vscode.CancellationToken
    ): vscode.CodeAction[] | undefined {
        const actions: vscode.CodeAction[] = [];

        const balanceAction = this.createBalanceAssertionAction(document, range);
        if (balanceAction) {
            actions.push(balanceAction);
        }

        for (const diagnostic of context.diagnostics) {
            if (diagnostic.source !== 'hledger') {
                continue;
            }

            const quickFix = this.createQuickFixForDiagnostic(document, diagnostic);
            if (quickFix) {
                actions.push(quickFix);
            }
        }

        return actions.length > 0 ? actions : undefined;
    }

    private createBalanceAssertionAction(
        document: vscode.TextDocument,
        range: vscode.Range | vscode.Selection
    ): vscode.CodeAction | undefined {
        const line = document.lineAt(range.start.line);
        const lineText = line.text;

        const postingInfo = this.parsePostingLine(lineText);
        if (!postingInfo || postingInfo.hasAssertion) {
            return undefined;
        }

        const action = new vscode.CodeAction(
            'Add balance assertion',
            vscode.CodeActionKind.Refactor
        );

        const edit = new vscode.WorkspaceEdit();
        const assertionText = this.buildAssertionText(
            postingInfo.amount,
            postingInfo.commodity
        );

        const insertPosition = new vscode.Position(
            range.start.line,
            lineText.length
        );

        edit.insert(document.uri, insertPosition, assertionText);
        action.edit = edit;

        return action;
    }

    private parsePostingLine(lineText: string): PostingInfo | null {
        if (lineText.trim().startsWith(';')) {
            return null;
        }

        const postingPattern = /^\s{2,}([\p{L}\p{N}:_\s-]+?)\s{2,}([\p{Sc}])?(-?[\p{N}][\p{N},.]*)\s*(\p{Sc}|[A-Z]{3,})?(\s*=\s*)?/u;
        const match = lineText.match(postingPattern);

        if (!match) {
            return null;
        }

        const account = match[1]?.trim();
        const commodityPrefix = match[2] || '';
        const amount = match[3];
        const commoditySuffix = match[4] || '';
        const hasAssertion = match[5] !== undefined;

        if (!account || !amount) {
            return null;
        }

        const commodity = commodityPrefix || commoditySuffix;

        return {
            account,
            amount,
            commodity,
            hasAssertion,
        };
    }

    private buildAssertionText(amount: string, commodity: string): string {
        if (commodity.match(/[\p{Sc}]/u)) {
            return ` = ${commodity}${amount}`;
        } else if (commodity) {
            return ` = ${amount} ${commodity}`;
        } else {
            return ` = ${amount}`;
        }
    }

    private createQuickFixForDiagnostic(
        document: vscode.TextDocument,
        diagnostic: vscode.Diagnostic
    ): vscode.CodeAction | undefined {
        switch (diagnostic.code) {
            case HLedgerDiagnosticCode.UndefinedAccount:
                return this.createDefineAccountQuickFix(document, diagnostic);

            case HLedgerDiagnosticCode.InvalidTagFormat:
                return this.createFixTagFormatQuickFix(document, diagnostic);

            case HLedgerDiagnosticCode.InvalidAmountFormat:
                return undefined;

            default:
                return undefined;
        }
    }

    private createDefineAccountQuickFix(
        document: vscode.TextDocument,
        diagnostic: vscode.Diagnostic
    ): vscode.CodeAction {
        const accountName = document.getText(diagnostic.range);

        const action = new vscode.CodeAction(
            `Define account '${accountName}'`,
            vscode.CodeActionKind.QuickFix
        );

        action.edit = new vscode.WorkspaceEdit();

        const insertLine = this.findAccountDirectiveInsertionPoint(document);
        const insertPosition = new vscode.Position(insertLine, 0);

        const accountDirective = `account ${accountName}\n`;
        action.edit.insert(document.uri, insertPosition, accountDirective);

        action.diagnostics = [diagnostic];
        action.isPreferred = true;
        return action;
    }

    private findAccountDirectiveInsertionPoint(document: vscode.TextDocument): number {
        let lastAccountLine = -1;

        for (let i = 0; i < document.lineCount; i++) {
            const lineText = document.lineAt(i).text;
            if (/^account\s+/.test(lineText)) {
                lastAccountLine = i;
            }
        }

        return lastAccountLine >= 0 ? lastAccountLine + 1 : 0;
    }

    private createFixTagFormatQuickFix(
        document: vscode.TextDocument,
        diagnostic: vscode.Diagnostic
    ): vscode.CodeAction {
        const tagName = document.getText(diagnostic.range);

        const action = new vscode.CodeAction(
            `Add colon to tag '${tagName}'`,
            vscode.CodeActionKind.QuickFix
        );

        action.edit = new vscode.WorkspaceEdit();

        action.edit.replace(
            document.uri,
            diagnostic.range,
            `${tagName}:`
        );

        action.command = {
            command: 'editor.action.triggerSuggest',
            title: 'Trigger Suggest',
            arguments: []
        };

        action.diagnostics = [diagnostic];
        action.isPreferred = true;
        return action;
    }
}
