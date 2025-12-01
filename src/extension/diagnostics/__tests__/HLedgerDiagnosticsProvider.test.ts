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
            config.parseContent(content, '/test');

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
            config.parseContent(content, '/test');

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
            config.parseContent(content, '/test');

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
            config.parseContent(content, '/test');

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

        test('no warning for sub-accounts when parent account is defined', () => {
            const content = `
account Assets
account Expenses

2024-01-01 Test
    Expenses:Food:Lunch  $10.00
    Assets:Bank:Cash  -$10.00
`;
            config.parseContent(content, '/test');

            const document = new MockTextDocument(content.split('\n'), {
                uri: vscode.Uri.file('/test/test.journal'),
                languageId: 'hledger'
            });

            provider['validateDocument'](document);

            const diagnostics = provider.diagnosticCollection.get(document.uri);
            const undefinedAccountDiags = diagnostics?.filter(d => d.message.includes('not defined')) ?? [];
            expect(undefinedAccountDiags.length).toBe(0);
        });

        test('warns about sub-accounts when only sibling parent is defined', () => {
            const content = `
account Assets:Bank

2024-01-01 Test
    Assets:Bank:Cash     $10.00
    Liabilities:Card  -$10.00
`;
            config.parseContent(content, '/test');

            const document = new MockTextDocument(content.split('\n'), {
                uri: vscode.Uri.file('/test/test.journal'),
                languageId: 'hledger'
            });

            provider['validateDocument'](document);

            const diagnostics = provider.diagnosticCollection.get(document.uri);

            // Assets:Bank:Cash should be valid (parent Assets:Bank is defined)
            const cashDiag = diagnostics?.find(d => d.message.includes('Assets:Bank:Cash'));
            expect(cashDiag).toBeUndefined();

            // Liabilities:Card should be undefined
            const cardDiag = diagnostics?.find(d => d.message.includes('Liabilities:Card'));
            expect(cardDiag).toBeDefined();
            expect(cardDiag?.severity).toBe(vscode.DiagnosticSeverity.Warning);
        });

        test('handles deep nested accounts with root parent defined', () => {
            const content = `
account Assets

2024-01-01 Test
    Assets:Bank:Checking:Main     $10.00
    Assets:Cash:Wallet:Personal  -$10.00
`;
            config.parseContent(content, '/test');

            const document = new MockTextDocument(content.split('\n'), {
                uri: vscode.Uri.file('/test/test.journal'),
                languageId: 'hledger'
            });

            provider['validateDocument'](document);

            const diagnostics = provider.diagnosticCollection.get(document.uri);
            const undefinedAccountDiags = diagnostics?.filter(d => d.message.includes('not defined')) ?? [];
            expect(undefinedAccountDiags.length).toBe(0);
        });
    });

    describe('Tag Format Validation', () => {
        // In hledger, a tag is word+colon (tag: or tag:value)
        // Words without colons are just comments, not tags

        test('no warning for plain comments without tags', () => {
            const content = `
2024-01-01 Test  ; project
    Expenses:Food  $10.00
    Assets:Cash  -$10.00
`;
            config.parseContent(content, '/test');

            const document = new MockTextDocument(content.split('\n'), {
                uri: vscode.Uri.file('/test/test.journal'),
                languageId: 'hledger'
            });

            provider['validateDocument'](document);

            const diagnostics = provider.diagnosticCollection.get(document.uri);
            const tagDiags = diagnostics?.filter(d => d.code === 'invalid-tag-format') ?? [];
            // 'project' is just a comment, not a tag (no colon)
            expect(tagDiags.length).toBe(0);
        });

        test('no warning for date comments like ;; 01-03', () => {
            const content = `
;; 01-03
2024-01-01 Test
    Expenses:Food  $10.00
    Assets:Cash  -$10.00
`;
            config.parseContent(content, '/test');

            const document = new MockTextDocument(content.split('\n'), {
                uri: vscode.Uri.file('/test/test.journal'),
                languageId: 'hledger'
            });

            provider['validateDocument'](document);

            const diagnostics = provider.diagnosticCollection.get(document.uri);
            const tagDiags = diagnostics?.filter(d => d.code === 'invalid-tag-format') ?? [];
            // '01-03' is just a comment, not a tag
            expect(tagDiags.length).toBe(0);
        });

        test('accepts tags with values', () => {
            const content = `
2024-01-01 Test  ; project:work
    Expenses:Food  $10.00
    Assets:Cash  -$10.00
`;
            config.parseContent(content, '/test');

            const document = new MockTextDocument(content.split('\n'), {
                uri: vscode.Uri.file('/test/test.journal'),
                languageId: 'hledger'
            });

            provider['validateDocument'](document);

            const diagnostics = provider.diagnosticCollection.get(document.uri);
            const tagDiags = diagnostics?.filter(d => d.code === 'invalid-tag-format') ?? [];
            expect(tagDiags.length).toBe(0);
        });

        test('warns about date: tag without value', () => {
            const content = `
2024-01-01 Test  ; date:
    Expenses:Food  $10.00
    Assets:Cash  -$10.00
`;
            config.parseContent(content, '/test');

            const document = new MockTextDocument(content.split('\n'), {
                uri: vscode.Uri.file('/test/test.journal'),
                languageId: 'hledger'
            });

            provider['validateDocument'](document);

            const diagnostics = provider.diagnosticCollection.get(document.uri);
            const tagDiag = diagnostics?.find(d => d.message.includes("date:"));
            expect(tagDiag).toBeDefined();
            expect(tagDiag?.severity).toBe(vscode.DiagnosticSeverity.Warning);
            expect(tagDiag?.message).toContain('requires a value');
        });

        test('warns about date2: tag without value', () => {
            const content = `
2024-01-01 Test  ; date2:
    Expenses:Food  $10.00
    Assets:Cash  -$10.00
`;
            config.parseContent(content, '/test');

            const document = new MockTextDocument(content.split('\n'), {
                uri: vscode.Uri.file('/test/test.journal'),
                languageId: 'hledger'
            });

            provider['validateDocument'](document);

            const diagnostics = provider.diagnosticCollection.get(document.uri);
            const tagDiag = diagnostics?.find(d => d.message.includes("date2:"));
            expect(tagDiag).toBeDefined();
            expect(tagDiag?.severity).toBe(vscode.DiagnosticSeverity.Warning);
        });

        test('accepts date: tag with value', () => {
            const content = `
2024-01-01 Test  ; date:2024-01-15
    Expenses:Food  $10.00
    Assets:Cash  -$10.00
`;
            config.parseContent(content, '/test');

            const document = new MockTextDocument(content.split('\n'), {
                uri: vscode.Uri.file('/test/test.journal'),
                languageId: 'hledger'
            });

            provider['validateDocument'](document);

            const diagnostics = provider.diagnosticCollection.get(document.uri);
            const tagDiags = diagnostics?.filter(d => d.code === 'invalid-tag-format') ?? [];
            expect(tagDiags.length).toBe(0);
        });

        test('no warning for regular tags without values', () => {
            // Regular tags (not date/date2) can be without value
            const content = `
2024-01-01 Test  ; project:
    Expenses:Food  $10.00
    Assets:Cash  -$10.00
`;
            config.parseContent(content, '/test');

            const document = new MockTextDocument(content.split('\n'), {
                uri: vscode.Uri.file('/test/test.journal'),
                languageId: 'hledger'
            });

            provider['validateDocument'](document);

            const diagnostics = provider.diagnosticCollection.get(document.uri);
            const tagDiags = diagnostics?.filter(d => d.code === 'invalid-tag-format') ?? [];
            expect(tagDiags.length).toBe(0);
        });

        test('handles multiple tags in comment', () => {
            const content = `
2024-01-01 Test  ; project:work, category, priority:high
    Expenses:Food  $10.00
    Assets:Cash  -$10.00
`;
            config.parseContent(content, '/test');

            const document = new MockTextDocument(content.split('\n'), {
                uri: vscode.Uri.file('/test/test.journal'),
                languageId: 'hledger'
            });

            provider['validateDocument'](document);

            const diagnostics = provider.diagnosticCollection.get(document.uri);
            const tagDiags = diagnostics?.filter(d => d.code === 'invalid-tag-format') ?? [];
            // 'category' without colon is just a comment, not a tag - no warning
            expect(tagDiags.length).toBe(0);
        });

        test('no warning for Unicode comments without colon', () => {
            const content = `
2024-01-01 Test  ; проект
    Expenses:Food  $10.00
    Assets:Cash  -$10.00
`;
            config.parseContent(content, '/test');

            const document = new MockTextDocument(content.split('\n'), {
                uri: vscode.Uri.file('/test/test.journal'),
                languageId: 'hledger'
            });

            provider['validateDocument'](document);

            const diagnostics = provider.diagnosticCollection.get(document.uri);
            const tagDiags = diagnostics?.filter(d => d.code === 'invalid-tag-format') ?? [];
            // 'проект' without colon is just a comment, not a tag - no warning
            expect(tagDiags.length).toBe(0);
        });
    });

    describe('Amount Format Validation', () => {
        test('accepts valid amounts with commodity prefix', () => {
            const content = `
2024-01-01 Test
    Expenses:Food  $10.00
    Assets:Cash
`;
            config.parseContent(content, '/test');

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
            config.parseContent(content, '/test');

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
            config.parseContent(content, '/test');

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
            config.parseContent(content, '/test');

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
            config.parseContent(content, '/test');

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
            config.parseContent(content, '/test');

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
            config.parseContent(content, '/test');

            const document = new MockTextDocument(content.split('\n'), {
                uri: vscode.Uri.file('/test/test.journal'),
                languageId: 'hledger'
            });

            provider['validateDocument'](document);

            const diagnostics = provider.diagnosticCollection.get(document.uri);
            const amountDiags = diagnostics?.filter(d => d.message.includes('amount')) ?? [];
            expect(amountDiags.length).toBe(0);
        });

        test('accepts balance assertion only (compact format)', () => {
            const content = `
2024-01-01 Test
    Assets:Checking  =$500
    Income:Salary
`;
            config.parseContent(content, '/test');

            const document = new MockTextDocument(content.split('\n'), {
                uri: vscode.Uri.file('/test/test.journal'),
                languageId: 'hledger'
            });

            provider['validateDocument'](document);

            const diagnostics = provider.diagnosticCollection.get(document.uri);
            const amountDiags = diagnostics?.filter(d => d.message.includes('amount')) ?? [];
            expect(amountDiags.length).toBe(0);
        });

        test('accepts balance assertion only (with space)', () => {
            const content = `
2024-01-01 Test
    Assets:Checking  = $500
    Income:Salary
`;
            config.parseContent(content, '/test');

            const document = new MockTextDocument(content.split('\n'), {
                uri: vscode.Uri.file('/test/test.journal'),
                languageId: 'hledger'
            });

            provider['validateDocument'](document);

            const diagnostics = provider.diagnosticCollection.get(document.uri);
            const amountDiags = diagnostics?.filter(d => d.message.includes('amount')) ?? [];
            expect(amountDiags.length).toBe(0);
        });

        test('accepts balance assertion with negative amount', () => {
            const content = `
2024-01-01 Test
    Assets:Checking  =$-1775.30
    Expenses:Food
`;
            config.parseContent(content, '/test');

            const document = new MockTextDocument(content.split('\n'), {
                uri: vscode.Uri.file('/test/test.journal'),
                languageId: 'hledger'
            });

            provider['validateDocument'](document);

            const diagnostics = provider.diagnosticCollection.get(document.uri);
            const amountDiags = diagnostics?.filter(d => d.message.includes('amount')) ?? [];
            expect(amountDiags.length).toBe(0);
        });

        test('accepts amount with balance assertion', () => {
            const content = `
2024-01-01 Test
    Assets:Checking  $100 = $500
    Expenses:Food
`;
            config.parseContent(content, '/test');

            const document = new MockTextDocument(content.split('\n'), {
                uri: vscode.Uri.file('/test/test.journal'),
                languageId: 'hledger'
            });

            provider['validateDocument'](document);

            const diagnostics = provider.diagnosticCollection.get(document.uri);
            const amountDiags = diagnostics?.filter(d => d.message.includes('amount')) ?? [];
            expect(amountDiags.length).toBe(0);
        });

        test('accepts total balance assertion (double equals)', () => {
            const content = `
2024-01-01 Test
    Assets:Checking  == $500
    Income:Salary
`;
            config.parseContent(content, '/test');

            const document = new MockTextDocument(content.split('\n'), {
                uri: vscode.Uri.file('/test/test.journal'),
                languageId: 'hledger'
            });

            provider['validateDocument'](document);

            const diagnostics = provider.diagnosticCollection.get(document.uri);
            const amountDiags = diagnostics?.filter(d => d.message.includes('amount')) ?? [];
            expect(amountDiags.length).toBe(0);
        });

        test('accepts inclusive balance assertion', () => {
            const content = `
2024-01-01 Test
    Assets:Checking  =* $500
    Income:Salary
`;
            config.parseContent(content, '/test');

            const document = new MockTextDocument(content.split('\n'), {
                uri: vscode.Uri.file('/test/test.journal'),
                languageId: 'hledger'
            });

            provider['validateDocument'](document);

            const diagnostics = provider.diagnosticCollection.get(document.uri);
            const amountDiags = diagnostics?.filter(d => d.message.includes('amount')) ?? [];
            expect(amountDiags.length).toBe(0);
        });

        test('accepts total inclusive balance assertion', () => {
            const content = `
2024-01-01 Test
    Assets:Checking  ==* $500
    Income:Salary
`;
            config.parseContent(content, '/test');

            const document = new MockTextDocument(content.split('\n'), {
                uri: vscode.Uri.file('/test/test.journal'),
                languageId: 'hledger'
            });

            provider['validateDocument'](document);

            const diagnostics = provider.diagnosticCollection.get(document.uri);
            const amountDiags = diagnostics?.filter(d => d.message.includes('amount')) ?? [];
            expect(amountDiags.length).toBe(0);
        });

        test('accepts amount with cost notation', () => {
            const content = `
2024-01-01 Test
    Assets:Stocks  10 AAPL @ $150
    Assets:Checking
`;
            config.parseContent(content, '/test');

            const document = new MockTextDocument(content.split('\n'), {
                uri: vscode.Uri.file('/test/test.journal'),
                languageId: 'hledger'
            });

            provider['validateDocument'](document);

            const diagnostics = provider.diagnosticCollection.get(document.uri);
            const amountDiags = diagnostics?.filter(d => d.message.includes('amount')) ?? [];
            expect(amountDiags.length).toBe(0);
        });

        test('accepts balance assignment syntax', () => {
            const content = `
2024-01-01 Test
    Assets:Checking  := $500
    Equity:Opening
`;
            config.parseContent(content, '/test');

            const document = new MockTextDocument(content.split('\n'), {
                uri: vscode.Uri.file('/test/test.journal'),
                languageId: 'hledger'
            });

            provider['validateDocument'](document);

            const diagnostics = provider.diagnosticCollection.get(document.uri);
            const amountDiags = diagnostics?.filter(d => d.message.includes('amount')) ?? [];
            expect(amountDiags.length).toBe(0);
        });

        test('accepts scientific notation amounts', () => {
            const content = `
2024-01-01 Test
    Assets:Micro  1E-6 BTC
    Assets:Large  1E3 EUR
    Assets:Cash
`;
            config.parseContent(content, '/test');

            const document = new MockTextDocument(content.split('\n'), {
                uri: vscode.Uri.file('/test/test.journal'),
                languageId: 'hledger'
            });

            provider['validateDocument'](document);

            const diagnostics = provider.diagnosticCollection.get(document.uri);
            const amountDiags = diagnostics?.filter(d => d.message.includes('amount')) ?? [];
            expect(amountDiags.length).toBe(0);
        });

        test('accepts all sign placement variants', () => {
            const content = `
2024-01-01 Test
    Expenses:Food  -$100
    Expenses:Drinks  $-50
    Expenses:Other  -50 USD
    Assets:Cash
`;
            config.parseContent(content, '/test');

            const document = new MockTextDocument(content.split('\n'), {
                uri: vscode.Uri.file('/test/test.journal'),
                languageId: 'hledger'
            });

            provider['validateDocument'](document);

            const diagnostics = provider.diagnosticCollection.get(document.uri);
            const amountDiags = diagnostics?.filter(d => d.message.includes('amount')) ?? [];
            expect(amountDiags.length).toBe(0);
        });

        test('accepts quoted commodities', () => {
            const content = `
2024-01-01 Test
    Assets:Food  3 "green apples"
    Assets:Cash
`;
            config.parseContent(content, '/test');

            const document = new MockTextDocument(content.split('\n'), {
                uri: vscode.Uri.file('/test/test.journal'),
                languageId: 'hledger'
            });

            provider['validateDocument'](document);

            const diagnostics = provider.diagnosticCollection.get(document.uri);
            const amountDiags = diagnostics?.filter(d => d.message.includes('amount')) ?? [];
            expect(amountDiags.length).toBe(0);
        });

        test('accepts Indian number format', () => {
            const content = `
2024-01-01 Test
    Assets:Bank  ₹1,00,00,000.00
    Assets:Cash  INR 1,00,000.00
    Expenses:Tax
`;
            config.parseContent(content, '/test');

            const document = new MockTextDocument(content.split('\n'), {
                uri: vscode.Uri.file('/test/test.journal'),
                languageId: 'hledger'
            });

            provider['validateDocument'](document);

            const diagnostics = provider.diagnosticCollection.get(document.uri);
            const amountDiags = diagnostics?.filter(d => d.message.includes('amount')) ?? [];
            expect(amountDiags.length).toBe(0);
        });

        test('accepts balance assertion with space before negative amount', () => {
            const content = `
2024-01-01 Test
    Assets:Checking  = -$500
    Income:Salary
`;
            config.parseContent(content, '/test');

            const document = new MockTextDocument(content.split('\n'), {
                uri: vscode.Uri.file('/test/test.journal'),
                languageId: 'hledger'
            });

            provider['validateDocument'](document);

            const diagnostics = provider.diagnosticCollection.get(document.uri);
            const amountDiags = diagnostics?.filter(d => d.message.includes('amount')) ?? [];
            expect(amountDiags.length).toBe(0);
        });

        test('rejects balance assertion with explicit positive sign in non-scientific notation', () => {
            // Explicit + is only valid in scientific notation (E+3), not regular amounts
            const content = `
2024-01-01 Test
    Assets:Checking  =$+500
    Income:Salary
`;
            config.parseContent(content, '/test');

            const document = new MockTextDocument(content.split('\n'), {
                uri: vscode.Uri.file('/test/test.journal'),
                languageId: 'hledger'
            });

            provider['validateDocument'](document);

            const diagnostics = provider.diagnosticCollection.get(document.uri);
            const amountDiag = diagnostics?.find(d => d.message.includes('amount'));
            expect(amountDiag).toBeDefined();
            expect(amountDiag?.severity).toBe(vscode.DiagnosticSeverity.Error);
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
            config.parseContent(content, '/test');

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
            config.parseContent(content, '/test');

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
            // Use content that generates diagnostics (undefined account)
            const content = `
account Assets:Cash

2024-01-01 Test
    Expenses:Food  $10.00
    Assets:Cash
`;
            config.parseContent(content, '/test');

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
            // Use content that generates diagnostics (undefined account)
            const content = `
account Assets:Cash

2024-01-01 Test
    Expenses:Food  $10.00
    Assets:Cash
`;
            config.parseContent(content, '/test');

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
