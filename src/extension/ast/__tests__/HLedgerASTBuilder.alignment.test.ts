// HLedgerASTBuilder.alignment.test.ts - Tests for formatting profile and alignment calculation
import { HLedgerASTBuilder } from '../HLedgerASTBuilder';
import { HLedgerLexer } from '../../lexer/HLedgerLexer';

describe('HLedgerASTBuilder - FormattingProfile', () => {
    let builder: HLedgerASTBuilder;
    let lexer: HLedgerLexer;

    beforeEach(() => {
        builder = new HLedgerASTBuilder();
        lexer = new HLedgerLexer();
    });

    describe('alignment column calculation', () => {
        it('should use default alignment column 40 for empty content', () => {
            const tokens = lexer.tokenizeContent('');
            const data = builder.buildFromTokens(tokens);

            expect(data.formattingProfile).toBeDefined();
            expect(data.formattingProfile.amountAlignmentColumn).toBe(40);
            expect(data.formattingProfile.maxAccountNameLength).toBe(0);
            expect(data.formattingProfile.isDefaultAlignment).toBe(true);
        });

        it('should calculate alignment from max account name length', () => {
            const content = `
2024-12-24 Test
    Expenses:Food:Groceries    $50.00
    Assets:Cash
`;
            const tokens = lexer.tokenizeContent(content);
            const data = builder.buildFromTokens(tokens);

            // 4 (indent) + 23 ("Expenses:Food:Groceries") + 2 (min spacing) = 29
            // But minimum is 40, so should be 40
            expect(data.formattingProfile).toBeDefined();
            expect(data.formattingProfile.amountAlignmentColumn).toBe(40);
            expect(data.formattingProfile.isDefaultAlignment).toBe(false);
        });

        it('should extend alignment for long account names', () => {
            const content = `
2024-12-24 Test
    Expenses:Food:Restaurants:FastFood:McDonalds    $50.00
    Assets:Cash
`;
            const tokens = lexer.tokenizeContent(content);
            const data = builder.buildFromTokens(tokens);

            // "Expenses:Food:Restaurants:FastFood:McDonalds" = 44 chars
            // 4 (indent) + 44 + 2 (min spacing) = 50
            expect(data.formattingProfile).toBeDefined();
            expect(data.formattingProfile.amountAlignmentColumn).toBe(50);
            expect(data.formattingProfile.maxAccountNameLength).toBe(44);
            expect(data.formattingProfile.isDefaultAlignment).toBe(false);
        });

        it('should use maximum account length across all transactions', () => {
            const content = `
2024-12-24 Shop A
    Expenses:Short    $10.00
    Assets:Cash

2024-12-25 Shop B
    Expenses:This:Is:A:Very:Long:Account:Name:For:Testing    $20.00
    Assets:Bank
`;
            const tokens = lexer.tokenizeContent(content);
            const data = builder.buildFromTokens(tokens);

            // "Expenses:This:Is:A:Very:Long:Account:Name:For:Testing" = 53 chars
            // 4 + 53 + 2 = 59
            expect(data.formattingProfile).toBeDefined();
            expect(data.formattingProfile.amountAlignmentColumn).toBe(59);
        });

        it('should handle Unicode account names correctly', () => {
            const content = `
2024-12-24 Магазин
    Расходы:Продукты:Молочные:Сыр:Российский    500 RUB
    Активы:Наличные
`;
            const tokens = lexer.tokenizeContent(content);
            const data = builder.buildFromTokens(tokens);

            // "Расходы:Продукты:Молочные:Сыр:Российский" = 40 chars
            // 4 + 40 + 2 = 46, which is > 40, so use 46
            expect(data.formattingProfile).toBeDefined();
            expect(data.formattingProfile.amountAlignmentColumn).toBe(46);
            expect(data.formattingProfile.isDefaultAlignment).toBe(false);
        });
    });

    describe('data merging', () => {
        it('should merge formatting profiles keeping larger alignment', () => {
            const content1 = `
2024-12-24 Shop
    Expenses:Short    $10.00
    Assets:Cash
`;
            const content2 = `
2024-12-25 Shop
    Expenses:This:Is:A:Very:Long:Account:Name    $20.00
    Assets:Bank
`;
            const tokens1 = lexer.tokenizeContent(content1);
            const tokens2 = lexer.tokenizeContent(content2);

            const data1 = builder.buildFromTokens(tokens1);
            const data2 = builder.buildFromTokens(tokens2);

            const mutableData1 = builder.createMutableFromReadonly(data1);
            builder.mergeData(mutableData1, data2);
            const mergedData = builder.toReadonlyData(mutableData1);

            // Should use the larger alignment from data2
            // "Expenses:This:Is:A:Very:Long:Account:Name" = 41 chars
            // 4 + 41 + 2 = 47
            expect(mergedData.formattingProfile.amountAlignmentColumn).toBe(47);
        });
    });
});
