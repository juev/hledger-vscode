import * as vscode from 'vscode';
import { HLedgerDiagnosticsProvider } from '../HLedgerDiagnosticsProvider';
import { HLedgerConfig } from '../../HLedgerConfig';
import { MockTextDocument } from '../../../__mocks__/vscode';

describe('HLedgerDiagnosticsProvider', () => {
    let config: HLedgerConfig;
    let provider: HLedgerDiagnosticsProvider;

    beforeEach(() => {
        config = new HLedgerConfig();
        provider = new HLedgerDiagnosticsProvider(config);
    });

    afterEach(() => {
        provider.dispose();
    });

    describe('Account Definition Validation', () => {
        test('warns about undefined account when definitions exist', () => {
            const content = `
account Assets:Cash
account Expenses:Food

2024-01-01 Test
    Expenses:Food  $10.00
    Assets:Bank  -$10.00
`;
            config.parseContent(content, '/test/test.journal');

            const document = new MockTextDocument(content.split('\n'), {
                uri: vscode.Uri.file('/test/test.journal'),
                languageId: 'hledger'
            });

            provider['validateDocument'](document);

            const diagnostics = provider.diagnosticCollection.get(document.uri);

            expect(diagnostics).toBeDefined();
            expect(diagnostics?.length).toBeGreaterThan(0);

            const undefinedAccountDiag = diagnostics?.find(d => d.message.includes('Assets:Bank'));
            expect(undefinedAccountDiag).toBeDefined();
            expect(undefinedAccountDiag?.severity).toBe(vscode.DiagnosticSeverity.Warning);
        });

        test('no warning when no accounts are explicitly defined', () => {
            const content = `
2024-01-01 Test
    Expenses:Food  $10.00
    Assets:Cash  -$10.00
`;
            config.parseContent(content, '/test/test.journal');

            const document = new MockTextDocument(content.split('\n'), {
                uri: vscode.Uri.file('/test/test.journal'),
                languageId: 'hledger'
            });

            provider['validateDocument'](document);

            const diagnostics = provider.diagnosticCollection.get(document.uri);
            const undefinedAccountDiags = diagnostics?.filter(d => d.message.includes('not defined')) ?? [];
            expect(undefinedAccountDiags.length).toBe(0);
        });

        test('no warning for defined accounts', () => {
            const content = `
account Assets:Cash
account Expenses:Food

2024-01-01 Test
    Expenses:Food  $10.00
    Assets:Cash  -$10.00
`;
            config.parseContent(content, '/test/test.journal');

            const document = new MockTextDocument(content.split('\n'), {
                uri: vscode.Uri.file('/test/test.journal'),
                languageId: 'hledger'
            });

            provider['validateDocument'](document);

            const diagnostics = provider.diagnosticCollection.get(document.uri);
            const undefinedAccountDiags = diagnostics?.filter(d => d.message.includes('not defined')) ?? [];
            expect(undefinedAccountDiags.length).toBe(0);
        });

        test('handles Unicode account names', () => {
            const content = `
account Активы:Наличные
account Расходы:Еда

2024-01-01 Test
    Расходы:Еда  $10.00
    Активы:Банк  -$10.00
`;
            config.parseContent(content, '/test/test.journal');

            const document = new MockTextDocument(content.split('\n'), {
                uri: vscode.Uri.file('/test/test.journal'),
                languageId: 'hledger'
            });

            provider['validateDocument'](document);

            const diagnostics = provider.diagnosticCollection.get(document.uri);
            const undefinedAccountDiag = diagnostics?.find(d => d.message.includes('Активы:Банк'));
            expect(undefinedAccountDiag).toBeDefined();
            expect(undefinedAccountDiag?.severity).toBe(vscode.DiagnosticSeverity.Warning);
        });
    });

    describe('Tag Format Validation', () => {
        test('suggests adding value to orphan tags', () => {
            const content = `
2024-01-01 Test  ; project
    Expenses:Food  $10.00
    Assets:Cash  -$10.00
`;
            config.parseContent(content, '/test/test.journal');

            const document = new MockTextDocument(content.split('\n'), {
                uri: vscode.Uri.file('/test/test.journal'),
                languageId: 'hledger'
            });

            provider['validateDocument'](document);

            const diagnostics = provider.diagnosticCollection.get(document.uri);
            const tagDiag = diagnostics?.find(d => d.message.includes('project'));
            expect(tagDiag).toBeDefined();
            expect(tagDiag?.severity).toBe(vscode.DiagnosticSeverity.Information);
            expect(tagDiag?.message).toContain('tag:value');
        });

        test('accepts tags with values', () => {
            const content = `
2024-01-01 Test  ; project:work
    Expenses:Food  $10.00
    Assets:Cash  -$10.00
`;
            config.parseContent(content, '/test/test.journal');

            const document = new MockTextDocument(content.split('\n'), {
                uri: vscode.Uri.file('/test/test.journal'),
                languageId: 'hledger'
            });

            provider['validateDocument'](document);

            const diagnostics = provider.diagnosticCollection.get(document.uri);
            const tagDiags = diagnostics?.filter(d => d.message.includes('tag:value')) ?? [];
            expect(tagDiags.length).toBe(0);
        });

        test('ignores note text (not tags)', () => {
            const content = `
2024-01-01 Test  ; note: this is a memo
    Expenses:Food  $10.00
    Assets:Cash  -$10.00
`;
            config.parseContent(content, '/test/test.journal');

            const document = new MockTextDocument(content.split('\n'), {
                uri: vscode.Uri.file('/test/test.journal'),
                languageId: 'hledger'
            });

            provider['validateDocument'](document);

            const diagnostics = provider.diagnosticCollection.get(document.uri);
            const tagDiags = diagnostics?.filter(d => d.message.includes('tag:value')) ?? [];
            expect(tagDiags.length).toBe(0);
        });

        test('handles multiple tags in comment', () => {
            const content = `
2024-01-01 Test  ; project:work, category, priority:high
    Expenses:Food  $10.00
    Assets:Cash  -$10.00
`;
            config.parseContent(content, '/test/test.journal');

            const document = new MockTextDocument(content.split('\n'), {
                uri: vscode.Uri.file('/test/test.journal'),
                languageId: 'hledger'
            });

            provider['validateDocument'](document);

            const diagnostics = provider.diagnosticCollection.get(document.uri);
            const tagDiag = diagnostics?.find(d => d.message.includes('category'));
            expect(tagDiag).toBeDefined();
            expect(tagDiag?.severity).toBe(vscode.DiagnosticSeverity.Information);
        });

        test('handles Unicode tags', () => {
            const content = `
2024-01-01 Test  ; проект
    Expenses:Food  $10.00
    Assets:Cash  -$10.00
`;
            config.parseContent(content, '/test/test.journal');

            const document = new MockTextDocument(content.split('\n'), {
                uri: vscode.Uri.file('/test/test.journal'),
                languageId: 'hledger'
            });

            provider['validateDocument'](document);

            const diagnostics = provider.diagnosticCollection.get(document.uri);
            const tagDiag = diagnostics?.find(d => d.message.includes('проект'));
            expect(tagDiag).toBeDefined();
        });
    });

    describe('Amount Format Validation', () => {
        test('accepts valid amounts with commodity prefix', () => {
            const content = `
2024-01-01 Test
    Expenses:Food  $10.00
    Assets:Cash
`;
            config.parseContent(content, '/test/test.journal');

            const document = new MockTextDocument(content.split('\n'), {
                uri: vscode.Uri.file('/test/test.journal'),
                languageId: 'hledger'
            });

            provider['validateDocument'](document);

            const diagnostics = provider.diagnosticCollection.get(document.uri);
            const amountDiags = diagnostics?.filter(d => d.message.includes('amount')) ?? [];
            expect(amountDiags.length).toBe(0);
        });

        test('accepts valid amounts with commodity suffix', () => {
            const content = `
2024-01-01 Test
    Expenses:Food  10.00 USD
    Assets:Cash
`;
            config.parseContent(content, '/test/test.journal');

            const document = new MockTextDocument(content.split('\n'), {
                uri: vscode.Uri.file('/test/test.journal'),
                languageId: 'hledger'
            });

            provider['validateDocument'](document);

            const diagnostics = provider.diagnosticCollection.get(document.uri);
            const amountDiags = diagnostics?.filter(d => d.message.includes('amount')) ?? [];
            expect(amountDiags.length).toBe(0);
        });

        test('accepts negative amounts', () => {
            const content = `
2024-01-01 Test
    Expenses:Food  -$10.00
    Assets:Cash
`;
            config.parseContent(content, '/test/test.journal');

            const document = new MockTextDocument(content.split('\n'), {
                uri: vscode.Uri.file('/test/test.journal'),
                languageId: 'hledger'
            });

            provider['validateDocument'](document);

            const diagnostics = provider.diagnosticCollection.get(document.uri);
            const amountDiags = diagnostics?.filter(d => d.message.includes('amount')) ?? [];
            expect(amountDiags.length).toBe(0);
        });

        test('accepts amounts with commas', () => {
            const content = `
2024-01-01 Test
    Expenses:Food  $1,000.00
    Assets:Cash
`;
            config.parseContent(content, '/test/test.journal');

            const document = new MockTextDocument(content.split('\n'), {
                uri: vscode.Uri.file('/test/test.journal'),
                languageId: 'hledger'
            });

            provider['validateDocument'](document);

            const diagnostics = provider.diagnosticCollection.get(document.uri);
            const amountDiags = diagnostics?.filter(d => d.message.includes('amount')) ?? [];
            expect(amountDiags.length).toBe(0);
        });

        test('flags malformed amounts', () => {
            const content = `
2024-01-01 Test
    Expenses:Food  $10$50
    Assets:Cash
`;
            config.parseContent(content, '/test/test.journal');

            const document = new MockTextDocument(content.split('\n'), {
                uri: vscode.Uri.file('/test/test.journal'),
                languageId: 'hledger'
            });

            provider['validateDocument'](document);

            const diagnostics = provider.diagnosticCollection.get(document.uri);
            const amountDiag = diagnostics?.find(d => d.severity === vscode.DiagnosticSeverity.Error);
            expect(amountDiag).toBeDefined();
            expect(amountDiag?.message).toContain('amount');
        });

        test('accepts elided amounts (empty)', () => {
            const content = `
2024-01-01 Test
    Expenses:Food  $10.00
    Assets:Cash
`;
            config.parseContent(content, '/test/test.journal');

            const document = new MockTextDocument(content.split('\n'), {
                uri: vscode.Uri.file('/test/test.journal'),
                languageId: 'hledger'
            });

            provider['validateDocument'](document);

            const diagnostics = provider.diagnosticCollection.get(document.uri);
            const amountDiags = diagnostics?.filter(d => d.message.includes('amount')) ?? [];
            expect(amountDiags.length).toBe(0);
        });

        test('handles Unicode commodities', () => {
            const content = `
2024-01-01 Test
    Expenses:Food  ₽100.00
    Assets:Cash
`;
            config.parseContent(content, '/test/test.journal');

            const document = new MockTextDocument(content.split('\n'), {
                uri: vscode.Uri.file('/test/test.journal'),
                languageId: 'hledger'
            });

            provider['validateDocument'](document);

            const diagnostics = provider.diagnosticCollection.get(document.uri);
            const amountDiags = diagnostics?.filter(d => d.message.includes('amount')) ?? [];
            expect(amountDiags.length).toBe(0);
        });
    });

    describe('Document Events', () => {
        test('validates on document save', () => {
            const saveHandler = (vscode.workspace.onDidSaveTextDocument as jest.Mock).mock.calls[0]?.[0];
            expect(saveHandler).toBeDefined();

            const content = `
account Assets:Cash

2024-01-01 Test
    Expenses:Food  $10.00
    Assets:Bank  -$10.00
`;
            config.parseContent(content, '/test/test.journal');

            const document = new MockTextDocument(content.split('\n'), {
                uri: vscode.Uri.file('/test/test.journal'),
                languageId: 'hledger'
            });

            saveHandler(document);

            const diagnostics = provider.diagnosticCollection.get(document.uri);
            expect(diagnostics).toBeDefined();
        });

        test('validates on document open', () => {
            const openHandler = (vscode.workspace.onDidOpenTextDocument as jest.Mock).mock.calls[0]?.[0];
            expect(openHandler).toBeDefined();

            const content = `
account Assets:Cash

2024-01-01 Test
    Expenses:Food  $10.00
    Assets:Bank  -$10.00
`;
            config.parseContent(content, '/test/test.journal');

            const document = new MockTextDocument(content.split('\n'), {
                uri: vscode.Uri.file('/test/test.journal'),
                languageId: 'hledger'
            });

            openHandler(document);

            const diagnostics = provider.diagnosticCollection.get(document.uri);
            expect(diagnostics).toBeDefined();
        });

        test('only validates hledger language files', () => {
            const saveHandler = (vscode.workspace.onDidSaveTextDocument as jest.Mock).mock.calls[0]?.[0];

            const document = new MockTextDocument(['test content'], {
                uri: vscode.Uri.file('/test/test.txt'),
                languageId: 'plaintext'
            });

            saveHandler(document);

            const diagnostics = provider.diagnosticCollection.get(document.uri);
            expect(diagnostics).toBeUndefined();
        });
    });

    describe('Diagnostic Management', () => {
        test('clearDiagnostics removes diagnostics for document', () => {
            const content = `
2024-01-01 Test  ; project
    Expenses:Food  $10.00
    Assets:Cash
`;
            config.parseContent(content, '/test/test.journal');

            const document = new MockTextDocument(content.split('\n'), {
                uri: vscode.Uri.file('/test/test.journal'),
                languageId: 'hledger'
            });

            provider['validateDocument'](document);
            let diagnostics = provider.diagnosticCollection.get(document.uri);
            expect(diagnostics?.length).toBeGreaterThan(0);

            provider.clearDiagnostics(document);
            diagnostics = provider.diagnosticCollection.get(document.uri);
            expect(diagnostics).toBeUndefined();
        });

        test('clearAll removes all diagnostics', () => {
            const content = `
2024-01-01 Test  ; project
    Expenses:Food  $10.00
    Assets:Cash
`;
            config.parseContent(content, '/test/test.journal');

            const doc1 = new MockTextDocument(content.split('\n'), {
                uri: vscode.Uri.file('/test/test1.journal'),
                languageId: 'hledger'
            });

            const doc2 = new MockTextDocument(content.split('\n'), {
                uri: vscode.Uri.file('/test/test2.journal'),
                languageId: 'hledger'
            });

            provider['validateDocument'](doc1);
            provider['validateDocument'](doc2);

            expect(provider.diagnosticCollection.get(doc1.uri)).toBeDefined();
            expect(provider.diagnosticCollection.get(doc2.uri)).toBeDefined();

            provider.clearAll();

            expect(provider.diagnosticCollection.get(doc1.uri)).toBeUndefined();
            expect(provider.diagnosticCollection.get(doc2.uri)).toBeUndefined();
        });
    });
});
