// HLedgerASTBuilder.transactionTemplates.test.ts - Tests for transaction template extraction
import { HLedgerASTBuilder } from '../HLedgerASTBuilder';
import { HLedgerLexer } from '../../lexer/HLedgerLexer';
import { PayeeName, AccountName, TemplateKey } from '../../types';

describe('HLedgerASTBuilder - Transaction Templates', () => {
    let builder: HLedgerASTBuilder;
    let lexer: HLedgerLexer;

    beforeEach(() => {
        builder = new HLedgerASTBuilder();
        lexer = new HLedgerLexer();
    });

    describe('basic template extraction', () => {
        it('should extract transaction template from single transaction', () => {
            const content = `
2024-12-24 Grocery Store
    Expenses:Food    $50.00
    Assets:Cash
`;
            const tokens = lexer.tokenizeContent(content);
            const data = builder.buildFromTokens(tokens);

            expect(data.transactionTemplates).toBeDefined();
            const payeeTemplates = data.transactionTemplates.get('Grocery Store' as PayeeName);
            expect(payeeTemplates).toBeDefined();
            expect(payeeTemplates!.size).toBe(1);

            const template = Array.from(payeeTemplates!.values())[0];
            expect(template).toBeDefined();
            expect(template!.payee).toBe('Grocery Store');
            expect(template!.postings.length).toBe(2);
            expect(template!.usageCount).toBe(1);
        });

        it('should track usage count for repeated transactions', () => {
            const content = `
2024-12-20 Coffee Shop
    Expenses:Food:Coffee    $5.00
    Assets:Cash

2024-12-21 Coffee Shop
    Expenses:Food:Coffee    $4.50
    Assets:Cash

2024-12-22 Coffee Shop
    Expenses:Food:Coffee    $5.50
    Assets:Cash
`;
            const tokens = lexer.tokenizeContent(content);
            const data = builder.buildFromTokens(tokens);

            const payeeTemplates = data.transactionTemplates.get('Coffee Shop' as PayeeName);
            expect(payeeTemplates).toBeDefined();
            expect(payeeTemplates!.size).toBe(1);

            const template = Array.from(payeeTemplates!.values())[0];
            expect(template!.usageCount).toBe(3);
        });

        it('should preserve last used amount for each account', () => {
            const content = `
2024-12-20 Coffee Shop
    Expenses:Food:Coffee    5.00 USD
    Assets:Cash

2024-12-22 Coffee Shop
    Expenses:Food:Coffee    6.00 USD
    Assets:Cash
`;
            const tokens = lexer.tokenizeContent(content);
            const data = builder.buildFromTokens(tokens);

            const payeeTemplates = data.transactionTemplates.get('Coffee Shop' as PayeeName);
            const template = Array.from(payeeTemplates!.values())[0];

            const expensePosting = template!.postings.find(p => p.account === 'Expenses:Food:Coffee');
            expect(expensePosting?.amount).toBe('6.00USD');
        });

        it('should group templates by account combination', () => {
            const content = `
2024-12-20 Grocery Store
    Expenses:Food    $50.00
    Assets:Cash

2024-12-21 Grocery Store
    Expenses:Food    $30.00
    Assets:Bank:Checking
`;
            const tokens = lexer.tokenizeContent(content);
            const data = builder.buildFromTokens(tokens);

            const payeeTemplates = data.transactionTemplates.get('Grocery Store' as PayeeName);
            expect(payeeTemplates).toBeDefined();
            expect(payeeTemplates!.size).toBe(2);
        });

        it('should limit templates per payee to MAX_TEMPLATES_PER_PAYEE', () => {
            const content = `
2024-12-01 Payee1
    Account1    $10.00
    Account2

2024-12-02 Payee1
    Account3    $10.00
    Account4

2024-12-03 Payee1
    Account5    $10.00
    Account6

2024-12-04 Payee1
    Account7    $10.00
    Account8

2024-12-05 Payee1
    Account9    $10.00
    Account10

2024-12-06 Payee1
    Account11    $10.00
    Account12

2024-12-07 Payee1
    Account13    $10.00
    Account14
`;
            const tokens = lexer.tokenizeContent(content);
            const data = builder.buildFromTokens(tokens);

            const payeeTemplates = data.transactionTemplates.get('Payee1' as PayeeName);
            expect(payeeTemplates).toBeDefined();
            expect(payeeTemplates!.size).toBeLessThanOrEqual(5);
        });
    });

    describe('edge cases', () => {
        it('should skip transactions with fewer than 2 postings', () => {
            const content = `
2024-12-24 Single Posting
    Expenses:Food    $50.00
`;
            const tokens = lexer.tokenizeContent(content);
            const data = builder.buildFromTokens(tokens);

            const payeeTemplates = data.transactionTemplates.get('Single Posting' as PayeeName);
            expect(payeeTemplates).toBeUndefined();
        });

        it('should handle transactions with no amount (inferred)', () => {
            const content = `
2024-12-24 Test Payee
    Expenses:Food    $50.00
    Assets:Cash
`;
            const tokens = lexer.tokenizeContent(content);
            const data = builder.buildFromTokens(tokens);

            const payeeTemplates = data.transactionTemplates.get('Test Payee' as PayeeName);
            const template = Array.from(payeeTemplates!.values())[0];

            const cashPosting = template!.postings.find(p => p.account === 'Assets:Cash');
            expect(cashPosting?.amount).toBeNull();
        });

        it('should normalize payee names with Unicode NFC', () => {
            const content = `
2024-12-24 Caf\u0065\u0301
    Expenses:Food    $5.00
    Assets:Cash
`;
            const tokens = lexer.tokenizeContent(content);
            const data = builder.buildFromTokens(tokens);

            const payeeTemplates = data.transactionTemplates.get('Caf\u00e9' as PayeeName);
            expect(payeeTemplates).toBeDefined();
        });

        it('should track lastUsedDate', () => {
            const content = `
2024-12-20 Test Payee
    Expenses:Food    $50.00
    Assets:Cash

2024-12-24 Test Payee
    Expenses:Food    $60.00
    Assets:Cash
`;
            const tokens = lexer.tokenizeContent(content);
            const data = builder.buildFromTokens(tokens);

            const payeeTemplates = data.transactionTemplates.get('Test Payee' as PayeeName);
            const template = Array.from(payeeTemplates!.values())[0];
            expect(template!.lastUsedDate).toBe('2024-12-24');
        });
    });

    describe('template key generation', () => {
        it('should generate consistent template key for same accounts', () => {
            const content = `
2024-12-20 Payee A
    Expenses:Food    $50.00
    Assets:Cash

2024-12-21 Payee A
    Assets:Cash
    Expenses:Food    $30.00
`;
            const tokens = lexer.tokenizeContent(content);
            const data = builder.buildFromTokens(tokens);

            const payeeTemplates = data.transactionTemplates.get('Payee A' as PayeeName);
            expect(payeeTemplates!.size).toBe(1);
            expect(Array.from(payeeTemplates!.values())[0]!.usageCount).toBe(2);
        });
    });

    describe('data merging', () => {
        it('should merge transaction templates from multiple sources', () => {
            const content1 = `
2024-12-20 Coffee Shop
    Expenses:Food:Coffee    $5.00
    Assets:Cash
`;
            const content2 = `
2024-12-21 Coffee Shop
    Expenses:Food:Coffee    $4.50
    Assets:Cash
`;
            const tokens1 = lexer.tokenizeContent(content1);
            const tokens2 = lexer.tokenizeContent(content2);

            const data1 = builder.buildFromTokens(tokens1);
            const data2 = builder.buildFromTokens(tokens2);

            const mutableData1 = builder.createMutableFromReadonly(data1);
            builder.mergeData(mutableData1, data2);
            const mergedData = builder.toReadonlyData(mutableData1);

            const payeeTemplates = mergedData.transactionTemplates.get('Coffee Shop' as PayeeName);
            const template = Array.from(payeeTemplates!.values())[0];
            expect(template!.usageCount).toBe(2);
        });
    });
});
