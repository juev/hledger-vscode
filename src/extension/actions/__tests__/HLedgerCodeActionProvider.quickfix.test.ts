import * as vscode from 'vscode';
import { HLedgerCodeActionProvider } from '../HLedgerCodeActionProvider';
import { HLedgerConfig } from '../../HLedgerConfig';
import { HLedgerDiagnosticCode } from '../../diagnostics/HLedgerDiagnosticsProvider';

describe('HLedgerCodeActionProvider - Quick Fixes', () => {
    let provider: HLedgerCodeActionProvider;
    let mockConfig: HLedgerConfig;
    let mockDocument: vscode.TextDocument;

    beforeEach(() => {
        mockConfig = {} as HLedgerConfig;
        provider = new HLedgerCodeActionProvider(mockConfig);

        mockDocument = {
            uri: vscode.Uri.file('/test/test.journal'),
            fileName: '/test/test.journal',
            languageId: 'hledger',
            getText: jest.fn(),
            lineAt: jest.fn(),
            lineCount: 10,
        } as unknown as vscode.TextDocument;
    });

    describe('Undefined Account Quick Fix', () => {
        test('offers quick fix for undefined account', () => {
            const lineText = '    Assets:Checking  $100.00';
            (mockDocument.lineAt as jest.Mock).mockReturnValue({
                text: lineText,
                range: new vscode.Range(5, 0, 5, lineText.length),
            });
            (mockDocument.getText as jest.Mock).mockReturnValue('Assets:Checking');

            const diagnostic = new vscode.Diagnostic(
                new vscode.Range(5, 4, 5, 19),
                "Account 'Assets:Checking' is used but not defined with 'account' directive",
                vscode.DiagnosticSeverity.Warning
            );
            diagnostic.code = HLedgerDiagnosticCode.UndefinedAccount;
            diagnostic.source = 'hledger';

            const range = new vscode.Range(5, 10, 5, 10);
            const context: vscode.CodeActionContext = {
                diagnostics: [diagnostic],
                only: undefined,
                triggerKind: vscode.CodeActionTriggerKind.Automatic,
            };

            const actions = provider.provideCodeActions(
                mockDocument,
                range,
                context,
                {} as vscode.CancellationToken
            );

            expect(actions).toBeDefined();
            const quickFix = actions?.find(a => a.kind === vscode.CodeActionKind.QuickFix);
            expect(quickFix).toBeDefined();
            expect(quickFix?.title).toBe("Define account 'Assets:Checking'");
        });

        test('inserts account directive after existing definitions', () => {
            (mockDocument.lineAt as jest.Mock).mockImplementation((line: number) => {
                const lines = [
                    'account Assets:Bank',
                    'account Expenses:Food',
                    '',
                    '2024-01-15 Test',
                    '    Assets:Checking  $100.00',
                ];
                return {
                    text: lines[line] || '',
                    range: new vscode.Range(line, 0, line, (lines[line] || '').length),
                };
            });
            (mockDocument.getText as jest.Mock).mockReturnValue('Assets:Checking');

            const diagnostic = new vscode.Diagnostic(
                new vscode.Range(4, 4, 4, 19),
                "Account 'Assets:Checking' is used but not defined",
                vscode.DiagnosticSeverity.Warning
            );
            diagnostic.code = HLedgerDiagnosticCode.UndefinedAccount;
            diagnostic.source = 'hledger';

            const range = new vscode.Range(4, 10, 4, 10);
            const context: vscode.CodeActionContext = {
                diagnostics: [diagnostic],
                only: undefined,
                triggerKind: vscode.CodeActionTriggerKind.Automatic,
            };

            const actions = provider.provideCodeActions(
                mockDocument,
                range,
                context,
                {} as vscode.CancellationToken
            );

            const quickFix = actions?.find(a => a.kind === vscode.CodeActionKind.QuickFix);
            expect(quickFix?.edit).toBeDefined();

            const edit = quickFix?.edit?.get(mockDocument.uri)?.[0];
            expect(edit).toBeDefined();
            expect(edit?.newText).toBe('account Assets:Checking\n');
            expect(edit?.range.start.line).toBe(2);
            expect(edit?.range.start.character).toBe(0);
        });

        test('inserts at start if no account directives exist', () => {
            (mockDocument.lineAt as jest.Mock).mockImplementation((line: number) => {
                const lines = [
                    '2024-01-15 Test',
                    '    Assets:Checking  $100.00',
                ];
                return {
                    text: lines[line] || '',
                    range: new vscode.Range(line, 0, line, (lines[line] || '').length),
                };
            });
            (mockDocument.getText as jest.Mock).mockReturnValue('Assets:Checking');

            const diagnostic = new vscode.Diagnostic(
                new vscode.Range(1, 4, 1, 19),
                "Account 'Assets:Checking' is used but not defined",
                vscode.DiagnosticSeverity.Warning
            );
            diagnostic.code = HLedgerDiagnosticCode.UndefinedAccount;
            diagnostic.source = 'hledger';

            const range = new vscode.Range(1, 10, 1, 10);
            const context: vscode.CodeActionContext = {
                diagnostics: [diagnostic],
                only: undefined,
                triggerKind: vscode.CodeActionTriggerKind.Automatic,
            };

            const actions = provider.provideCodeActions(
                mockDocument,
                range,
                context,
                {} as vscode.CancellationToken
            );

            const quickFix = actions?.find(a => a.kind === vscode.CodeActionKind.QuickFix);
            const edit = quickFix?.edit?.get(mockDocument.uri)?.[0];

            expect(edit?.range.start.line).toBe(0);
            expect(edit?.range.start.character).toBe(0);
            expect(edit?.newText).toBe('account Assets:Checking\n');
        });

        test('marks as preferred quick fix', () => {
            const lineText = '    Assets:Checking  $100.00';
            (mockDocument.lineAt as jest.Mock).mockReturnValue({
                text: lineText,
                range: new vscode.Range(0, 0, 0, lineText.length),
            });

            const diagnostic = new vscode.Diagnostic(
                new vscode.Range(0, 4, 0, 19),
                "Account 'Assets:Checking' is used but not defined",
                vscode.DiagnosticSeverity.Warning
            );
            diagnostic.code = HLedgerDiagnosticCode.UndefinedAccount;
            diagnostic.source = 'hledger';

            const range = new vscode.Range(0, 10, 0, 10);
            const context: vscode.CodeActionContext = {
                diagnostics: [diagnostic],
                only: undefined,
                triggerKind: vscode.CodeActionTriggerKind.Automatic,
            };

            const actions = provider.provideCodeActions(
                mockDocument,
                range,
                context,
                {} as vscode.CancellationToken
            );

            const quickFix = actions?.find(a => a.kind === vscode.CodeActionKind.QuickFix);
            expect(quickFix?.isPreferred).toBe(true);
        });

        test('extracts correct account name from diagnostic range', () => {
            const lineText = '    Expenses:Food:Groceries  $50.00';
            (mockDocument.lineAt as jest.Mock).mockReturnValue({
                text: lineText,
                range: new vscode.Range(0, 0, 0, lineText.length),
            });
            (mockDocument.getText as jest.Mock).mockReturnValue('Expenses:Food:Groceries');

            const diagnostic = new vscode.Diagnostic(
                new vscode.Range(0, 4, 0, 27),
                "Account 'Expenses:Food:Groceries' is used but not defined",
                vscode.DiagnosticSeverity.Warning
            );
            diagnostic.code = HLedgerDiagnosticCode.UndefinedAccount;
            diagnostic.source = 'hledger';

            const range = new vscode.Range(0, 10, 0, 10);
            const context: vscode.CodeActionContext = {
                diagnostics: [diagnostic],
                only: undefined,
                triggerKind: vscode.CodeActionTriggerKind.Automatic,
            };

            const actions = provider.provideCodeActions(
                mockDocument,
                range,
                context,
                {} as vscode.CancellationToken
            );

            const quickFix = actions?.find(a => a.kind === vscode.CodeActionKind.QuickFix);
            expect(quickFix?.title).toBe("Define account 'Expenses:Food:Groceries'");
        });
    });

    describe('Tag Format Quick Fix', () => {
        test('offers quick fix to add colon', () => {
            const lineText = '    Assets:Cash  $10.00  ; category';
            (mockDocument.lineAt as jest.Mock).mockReturnValue({
                text: lineText,
                range: new vscode.Range(0, 0, 0, lineText.length),
            });
            (mockDocument.getText as jest.Mock).mockReturnValue('category');

            const diagnostic = new vscode.Diagnostic(
                new vscode.Range(0, 29, 0, 37),
                "Tag 'category' should have a value",
                vscode.DiagnosticSeverity.Information
            );
            diagnostic.code = HLedgerDiagnosticCode.InvalidTagFormat;
            diagnostic.source = 'hledger';

            const range = new vscode.Range(0, 30, 0, 30);
            const context: vscode.CodeActionContext = {
                diagnostics: [diagnostic],
                only: undefined,
                triggerKind: vscode.CodeActionTriggerKind.Automatic,
            };

            const actions = provider.provideCodeActions(
                mockDocument,
                range,
                context,
                {} as vscode.CancellationToken
            );

            expect(actions).toBeDefined();
            const quickFix = actions?.find(a => a.kind === vscode.CodeActionKind.QuickFix);
            expect(quickFix).toBeDefined();
            expect(quickFix?.title).toBe("Add colon to tag 'category'");
        });

        test('replaces tag with tag:', () => {
            const lineText = '    Assets:Cash  $10.00  ; category';
            (mockDocument.lineAt as jest.Mock).mockReturnValue({
                text: lineText,
                range: new vscode.Range(0, 0, 0, lineText.length),
            });
            (mockDocument.getText as jest.Mock).mockReturnValue('category');

            const diagnostic = new vscode.Diagnostic(
                new vscode.Range(0, 29, 0, 37),
                "Tag 'category' should have a value",
                vscode.DiagnosticSeverity.Information
            );
            diagnostic.code = HLedgerDiagnosticCode.InvalidTagFormat;
            diagnostic.source = 'hledger';

            const range = new vscode.Range(0, 30, 0, 30);
            const context: vscode.CodeActionContext = {
                diagnostics: [diagnostic],
                only: undefined,
                triggerKind: vscode.CodeActionTriggerKind.Automatic,
            };

            const actions = provider.provideCodeActions(
                mockDocument,
                range,
                context,
                {} as vscode.CancellationToken
            );

            const quickFix = actions?.find(a => a.kind === vscode.CodeActionKind.QuickFix);
            const edit = quickFix?.edit?.get(mockDocument.uri)?.[0];

            expect(edit).toBeDefined();
            expect(edit?.newText).toBe('category:');
            expect(edit?.range).toEqual(new vscode.Range(0, 29, 0, 37));
        });

        test('triggers completion after applying fix', () => {
            const lineText = '    Assets:Cash  $10.00  ; category';
            (mockDocument.lineAt as jest.Mock).mockReturnValue({
                text: lineText,
                range: new vscode.Range(0, 0, 0, lineText.length),
            });
            (mockDocument.getText as jest.Mock).mockReturnValue('category');

            const diagnostic = new vscode.Diagnostic(
                new vscode.Range(0, 29, 0, 37),
                "Tag 'category' should have a value",
                vscode.DiagnosticSeverity.Information
            );
            diagnostic.code = HLedgerDiagnosticCode.InvalidTagFormat;
            diagnostic.source = 'hledger';

            const range = new vscode.Range(0, 30, 0, 30);
            const context: vscode.CodeActionContext = {
                diagnostics: [diagnostic],
                only: undefined,
                triggerKind: vscode.CodeActionTriggerKind.Automatic,
            };

            const actions = provider.provideCodeActions(
                mockDocument,
                range,
                context,
                {} as vscode.CancellationToken
            );

            const quickFix = actions?.find(a => a.kind === vscode.CodeActionKind.QuickFix);
            expect(quickFix?.command).toBeDefined();
            expect(quickFix?.command?.command).toBe('editor.action.triggerSuggest');
        });

        test('marks as preferred quick fix', () => {
            const lineText = '    Assets:Cash  $10.00  ; category';
            (mockDocument.lineAt as jest.Mock).mockReturnValue({
                text: lineText,
                range: new vscode.Range(0, 0, 0, lineText.length),
            });
            (mockDocument.getText as jest.Mock).mockReturnValue('category');

            const diagnostic = new vscode.Diagnostic(
                new vscode.Range(0, 29, 0, 37),
                "Tag 'category' should have a value",
                vscode.DiagnosticSeverity.Information
            );
            diagnostic.code = HLedgerDiagnosticCode.InvalidTagFormat;
            diagnostic.source = 'hledger';

            const range = new vscode.Range(0, 30, 0, 30);
            const context: vscode.CodeActionContext = {
                diagnostics: [diagnostic],
                only: undefined,
                triggerKind: vscode.CodeActionTriggerKind.Automatic,
            };

            const actions = provider.provideCodeActions(
                mockDocument,
                range,
                context,
                {} as vscode.CancellationToken
            );

            const quickFix = actions?.find(a => a.kind === vscode.CodeActionKind.QuickFix);
            expect(quickFix?.isPreferred).toBe(true);
        });
    });

    describe('Amount Format - No Quick Fix', () => {
        test('no quick fix offered for invalid amount', () => {
            const lineText = '    Assets:Cash  invalid';
            (mockDocument.lineAt as jest.Mock).mockReturnValue({
                text: lineText,
                range: new vscode.Range(0, 0, 0, lineText.length),
            });

            const diagnostic = new vscode.Diagnostic(
                new vscode.Range(0, 17, 0, 24),
                "Invalid amount format: 'invalid'",
                vscode.DiagnosticSeverity.Error
            );
            diagnostic.code = HLedgerDiagnosticCode.InvalidAmountFormat;
            diagnostic.source = 'hledger';

            const range = new vscode.Range(0, 20, 0, 20);
            const context: vscode.CodeActionContext = {
                diagnostics: [diagnostic],
                only: undefined,
                triggerKind: vscode.CodeActionTriggerKind.Automatic,
            };

            const actions = provider.provideCodeActions(
                mockDocument,
                range,
                context,
                {} as vscode.CancellationToken
            );

            const quickFixes = actions?.filter(a => a.kind === vscode.CodeActionKind.QuickFix) || [];
            const amountFix = quickFixes.find(a => a.diagnostics?.includes(diagnostic));
            expect(amountFix).toBeUndefined();
        });
    });

    describe('Integration with Diagnostics', () => {
        test('only processes hledger diagnostics', () => {
            const lineText = '    Assets:Cash  $10.00';
            (mockDocument.lineAt as jest.Mock).mockReturnValue({
                text: lineText,
                range: new vscode.Range(0, 0, 0, lineText.length),
            });

            const eslintDiagnostic = new vscode.Diagnostic(
                new vscode.Range(0, 0, 0, 10),
                'Some ESLint error',
                vscode.DiagnosticSeverity.Error
            );
            eslintDiagnostic.source = 'eslint';

            const range = new vscode.Range(0, 5, 0, 5);
            const context: vscode.CodeActionContext = {
                diagnostics: [eslintDiagnostic],
                only: undefined,
                triggerKind: vscode.CodeActionTriggerKind.Automatic,
            };

            const actions = provider.provideCodeActions(
                mockDocument,
                range,
                context,
                {} as vscode.CancellationToken
            );

            const quickFixes = actions?.filter(a => a.kind === vscode.CodeActionKind.QuickFix) || [];
            expect(quickFixes.length).toBe(0);
        });

        test('ignores diagnostics from other sources', () => {
            const lineText = '    Assets:Checking  $100.00';
            (mockDocument.lineAt as jest.Mock).mockReturnValue({
                text: lineText,
                range: new vscode.Range(0, 0, 0, lineText.length),
            });

            const otherDiagnostic = new vscode.Diagnostic(
                new vscode.Range(0, 4, 0, 19),
                'Some other error',
                vscode.DiagnosticSeverity.Warning
            );
            otherDiagnostic.source = 'typescript';
            otherDiagnostic.code = 'some-code';

            const range = new vscode.Range(0, 10, 0, 10);
            const context: vscode.CodeActionContext = {
                diagnostics: [otherDiagnostic],
                only: undefined,
                triggerKind: vscode.CodeActionTriggerKind.Automatic,
            };

            const actions = provider.provideCodeActions(
                mockDocument,
                range,
                context,
                {} as vscode.CancellationToken
            );

            const quickFixes = actions?.filter(a => a.kind === vscode.CodeActionKind.QuickFix) || [];
            expect(quickFixes.length).toBe(0);
        });

        test('handles multiple diagnostics in context', () => {
            (mockDocument.lineAt as jest.Mock).mockReturnValue({
                text: '    Assets:Checking  $100.00  ; category',
                range: new vscode.Range(0, 0, 0, 40),
            });
            (mockDocument.getText as jest.Mock).mockImplementation((range: vscode.Range) => {
                if (range.start.character === 4) {
                    return 'Assets:Checking';
                }
                if (range.start.character === 34) {
                    return 'category';
                }
                return '';
            });

            const accountDiagnostic = new vscode.Diagnostic(
                new vscode.Range(0, 4, 0, 19),
                "Account 'Assets:Checking' is used but not defined",
                vscode.DiagnosticSeverity.Warning
            );
            accountDiagnostic.code = HLedgerDiagnosticCode.UndefinedAccount;
            accountDiagnostic.source = 'hledger';

            const tagDiagnostic = new vscode.Diagnostic(
                new vscode.Range(0, 34, 0, 42),
                "Tag 'category' should have a value",
                vscode.DiagnosticSeverity.Information
            );
            tagDiagnostic.code = HLedgerDiagnosticCode.InvalidTagFormat;
            tagDiagnostic.source = 'hledger';

            const range = new vscode.Range(0, 10, 0, 10);
            const context: vscode.CodeActionContext = {
                diagnostics: [accountDiagnostic, tagDiagnostic],
                only: undefined,
                triggerKind: vscode.CodeActionTriggerKind.Automatic,
            };

            const actions = provider.provideCodeActions(
                mockDocument,
                range,
                context,
                {} as vscode.CancellationToken
            );

            const quickFixes = actions?.filter(a => a.kind === vscode.CodeActionKind.QuickFix) || [];
            expect(quickFixes.length).toBe(2);

            const accountFix = quickFixes.find(a => a.title.includes('Define account'));
            const tagFix = quickFixes.find(a => a.title.includes('Add colon'));
            expect(accountFix).toBeDefined();
            expect(tagFix).toBeDefined();
        });
    });
});
