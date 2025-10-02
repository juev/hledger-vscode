// AmountAligner.test.ts - Unit tests for amount alignment functionality

import { AmountAligner, createAmountAligner, PostingLine, TransactionBlock, isPostingLine, isTransactionBlock } from '../AmountAligner';
import { NumberFormatService } from '../services/NumberFormatService';

describe('AmountAligner', () => {
    let aligner: AmountAligner;
    let numberFormatService: NumberFormatService;

    beforeEach(() => {
        numberFormatService = new NumberFormatService();
        aligner = new AmountAligner({}, numberFormatService);
    });

    describe('Basic parsing', () => {
        it('should parse simple transaction with postings', () => {
            const content = `2025-01-15 * Test transaction
    Assets:Bank        100 USD
    Expenses:Food     -50 USD
`;

            const result = aligner.parseTransactions(content);
            expect(result.success).toBe(true);

            if (result.success) {
                const transactions = result.data;
                expect(transactions).toHaveLength(1);
                expect(transactions[0].postings).toHaveLength(2);
                expect(transactions[0].headerLine).toContain('2025-01-15 * Test transaction');
            }
        });

        it('should handle transaction without amounts', () => {
            const content = `2025-01-15 * Auto-balancing transaction
    Assets:Bank
    Expenses:Food
`;

            const result = aligner.parseTransactions(content);
            expect(result.success).toBe(true);

            if (result.success) {
                const transactions = result.data;
                expect(transactions).toHaveLength(1);
                expect(transactions[0].postings).toHaveLength(2);
                expect(transactions[0].postings[0].hasAmount).toBe(false);
                expect(transactions[0].postings[1].hasAmount).toBe(false);
            }
        });

        it('should parse multiple transactions', () => {
            const content = `2025-01-15 * First transaction
    Assets:Bank        100 USD
    Expenses:Food     -50 USD

2025-01-16 * Second transaction
    Assets:Cash       20 EUR
    Expenses:Transport -10 EUR
`;

            const result = aligner.parseTransactions(content);
            expect(result.success).toBe(true);

            if (result.success) {
                const transactions = result.data;
                expect(transactions).toHaveLength(2);
                expect(transactions[0].postings).toHaveLength(2);
                expect(transactions[1].postings).toHaveLength(2);
            }
        });

        it('should handle empty content', () => {
            const result = aligner.parseTransactions('');
            expect(result.success).toBe(true);

            if (result.success === true) {
                expect((result as any).data).toHaveLength(0);
            }
        });

        it('should handle content with only directives', () => {
            const content = `account Assets:Bank
account Expenses:Food
commodity USD
`;

            const result = aligner.parseTransactions(content);
            expect(result.success).toBe(true);

            if (result.success) {
                expect(result.data).toHaveLength(0);
            }
        });
    });

    describe('Posting line parsing', () => {
        it('should parse posting with amount', () => {
            const content = `2025-01-15 * Test
    Assets:Bank        100 USD
`;

            const result = aligner.parseTransactions(content);
            expect(result.success).toBe(true);

            if (result.success === true) {
                const posting = (result as any).data[0].postings[0];
                expect(posting.accountName).toBe('Assets:Bank');
                expect(posting.amountPart).toBe('100 USD');
                expect(posting.hasAmount).toBe(true);
                expect(posting.parsedAmount).toBeDefined();
                expect(posting.parsedAmount?.value).toBe(100);
            }
        });

        it('should parse posting with negative amount', () => {
            const content = `2025-01-15 * Test
    Expenses:Food     -50 USD
`;

            const result = aligner.parseTransactions(content);
            expect(result.success).toBe(true);

            if (result.success === true) {
                const posting = (result as any).data[0].postings[0];
                expect(posting.accountName).toBe('Expenses:Food');
                expect(posting.amountPart).toBe('-50 USD');
                expect(posting.hasAmount).toBe(true);
                expect(posting.parsedAmount?.value).toBe(-50);
            }
        });

        it('should parse posting with decimal amount', () => {
            const content = `2025-01-15 * Test
    Assets:Bank        123.45 USD
`;

            const result = aligner.parseTransactions(content);
            expect(result.success).toBe(true);

            if (result.success) {
                const posting = result.data[0].postings[0];
                expect(posting.accountName).toBe('Assets:Bank');
                expect(posting.amountPart).toBe('123.45 USD');
                expect(posting.hasAmount).toBe(true);
                expect(posting.parsedAmount?.value).toBe(123.45);
            }
        });

        it('should parse posting with comma decimal', () => {
            const content = `2025-01-15 * Test
    Assets:Bank        123,45 EUR
`;

            const result = aligner.parseTransactions(content);
            expect(result.success).toBe(true);

            if (result.success) {
                const posting = result.data[0].postings[0];
                expect(posting.accountName).toBe('Assets:Bank');
                expect(posting.amountPart).toBe('123,45 EUR');
                expect(posting.hasAmount).toBe(true);
            }
        });

        it('should parse posting with symbol before amount', () => {
            const content = `2025-01-15 * Test
    Assets:Bank        $100.00
`;

            const result = aligner.parseTransactions(content);
            expect(result.success).toBe(true);

            if (result.success) {
                const posting = result.data[0].postings[0];
                expect(posting.accountName).toBe('Assets:Bank');
                expect(posting.amountPart).toBe('$100.00');
                expect(posting.hasAmount).toBe(true);
            }
        });

        it('should parse posting without amount', () => {
            const content = `2025-01-15 * Test
    Assets:Bank
`;

            const result = aligner.parseTransactions(content);
            expect(result.success).toBe(true);

            if (result.success) {
                const posting = result.data[0].postings[0];
                expect(posting.accountName).toBe('Assets:Bank');
                expect(posting.amountPart).toBe('');
                expect(posting.hasAmount).toBe(false);
                expect(posting.parsedAmount).toBeUndefined();
            }
        });

        it('should parse posting with tab separation', () => {
            const content = `2025-01-15 * Test
	Assets:Bank\t100 USD
`;

            const result = aligner.parseTransactions(content);
            expect(result.success).toBe(true);

            if (result.success) {
                const posting = result.data[0].postings[0];
                expect(posting.accountName).toBe('Assets:Bank');
                expect(posting.amountPart).toBe('100 USD');
                expect(posting.hasAmount).toBe(true);
            }
        });

        it('should parse posting with comment', () => {
            const content = `2025-01-15 * Test
    Assets:Bank        100 USD    ; Initial deposit
`;

            const result = aligner.parseTransactions(content);
            expect(result.success).toBe(true);

            if (result.success) {
                const posting = result.data[0].postings[0];
                expect(posting.accountName).toBe('Assets:Bank');
                expect(posting.amountPart).toBe('100 USD    ; Initial deposit');
                expect(posting.hasAmount).toBe(true);
            }
        });
    });

    describe('Alignment calculation', () => {
        it('should calculate alignment for simple postings', () => {
            const content = `2025-01-15 * Test
    Assets:Bank        100 USD
    Expenses:Food     -50 USD
`;

            const result = aligner.parseTransactions(content);
            expect(result.success).toBe(true);

            if (result.success) {
                const transaction = result.data[0];
                expect(transaction.alignmentColumn).toBeGreaterThan(0);
                // Should align based on the longer account name
                expect(transaction.alignmentColumn).toBeGreaterThan(20);
            }
        });

        it('should handle different account name lengths', () => {
            const content = `2025-01-15 * Test
    A                 100 USD
    Very:Long:Account:Name    -50 USD
    B                 25 USD
`;

            const result = aligner.parseTransactions(content);
            expect(result.success).toBe(true);

            if (result.success) {
                const transaction = result.data[0];
                expect(transaction.alignmentColumn).toBeGreaterThan(
                    'Very:Long:Account:Name'.length + 2
                );
            }
        });

        it('should handle postings without amounts in alignment', () => {
            const content = `2025-01-15 * Test
    Assets:Bank        100 USD
    Expenses:Food
    Liabilities:Credit    -100 USD
`;

            const result = aligner.parseTransactions(content);
            expect(result.success).toBe(true);

            if (result.success) {
                const transaction = result.data[0];
                // Should only consider postings with amounts for alignment
                expect(transaction.alignmentColumn).toBeGreaterThan(
                    'Liabilities:Credit'.length + 2
                );
            }
        });
    });

    describe('Content formatting', () => {
        it('should format simple transaction', () => {
            const content = `2025-01-15 * Test transaction
    Assets:Bank        100 USD
    Expenses:Food     -50 USD
`;

            const result = aligner.formatContent(content);
            expect(result.success).toBe(true);

            if (result.success) {
                const formatted = result.data;
                const lines = formatted.split('\n');

                // Lines should be properly aligned
                const posting1 = lines[1];
                const posting2 = lines[2];

                // Find amount positions
                const amount1Pos = posting1.indexOf('100 USD');
                const amount2Pos = posting2.indexOf('-50 USD');

                expect(amount1Pos).toBe(amount2Pos);
            }
        });

        it('should preserve non-posting lines', () => {
            const content = `account Assets:Bank
account Expenses:Food

2025-01-15 * Test transaction
    Assets:Bank        100 USD
    Expenses:Food     -50 USD

D 1000.00 USD
`;

            const result = aligner.formatContent(content);
            expect(result.success).toBe(true);

            if (result.success) {
                const formatted = result.data;
                const lines = formatted.split('\n');

                // Non-posting lines should remain exactly as they were
                expect(lines[0]).toBe('account Assets:Bank');
                expect(lines[1]).toBe('account Expenses:Food');
                expect(lines[2]).toBe('');
                expect(lines[3]).toBe('2025-01-15 * Test transaction');
                expect(lines[6]).toBe('');
                expect(lines[7]).toBe('D 1000.00 USD');

                // Posting lines should be formatted (but exact format may vary)
                expect(lines[4]).toContain('Assets:Bank');
                expect(lines[4]).toContain('100 USD');
                expect(lines[5]).toContain('Expenses:Food');
                expect(lines[5]).toContain('-50 USD');

                // Amounts should be aligned
                const amount1Pos = lines[4].indexOf('100 USD');
                const amount2Pos = lines[5].indexOf('-50 USD');
                expect(amount1Pos).toBe(amount2Pos);
            }
        });

        it('should handle transaction without amounts', () => {
            const content = `2025-01-15 * Auto-balancing
    Assets:Bank
    Expenses:Food
`;

            const result = aligner.formatContent(content);
            expect(result.success).toBe(true);

            if (result.success) {
                expect(result.data).toBe(content); // Should be unchanged
            }
        });

        it('should use document-wide alignment for consistent formatting', () => {
            const content = `2025-01-15 * Transaction with short account names
    Assets     1000.00 USD
    Cash       -500.00 USD

2025-01-16 * Transaction with very long account names
    Expenses:Food:Groceries:Weekly Shopping     200.00 USD
    Income:Salary:Monthly Bonus                -200.00 USD

2025-01-17 * Mixed transaction
    Bank       300.00 USD
    Expenses   -300.00 USD
`;

            const result = aligner.formatContent(content);
            expect(result.success).toBe(true);

            if (result.success) {
                const formatted = result.data;
                const lines = formatted.split('\n');

                
                // Find the lines with amounts and extract positions
                const positions = [];

                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    if (line.includes('1000.00 USD') || line.includes('-500.00 USD') ||
                        line.includes('200.00 USD') || line.includes('-200.00 USD') ||
                        line.includes('300.00 USD') || line.includes('-300.00 USD')) {

                        if (line.includes('1000.00 USD')) positions.push(line.indexOf('1000.00 USD'));
                        else if (line.includes('-500.00 USD')) positions.push(line.indexOf('-500.00 USD'));
                        else if (line.includes('200.00 USD')) positions.push(line.indexOf('200.00 USD'));
                        else if (line.includes('-200.00 USD')) positions.push(line.indexOf('-200.00 USD'));
                        else if (line.includes('300.00 USD')) positions.push(line.indexOf('300.00 USD'));
                        else if (line.includes('-300.00 USD')) positions.push(line.indexOf('-300.00 USD'));
                    }
                }

                
                // All positions should be the same or very close (document-wide alignment)
                expect(positions.length).toBe(6); // Should find all 6 amounts

                // Check that all positions are within 1 character of each other (accounting for different amount lengths)
                const firstPos = positions[0];
                positions.forEach(pos => {
                    expect(Math.abs(pos - firstPos)).toBeLessThanOrEqual(1);
                });

                // The alignment should accommodate the longest account name
                expect(firstPos).toBeGreaterThanOrEqual(45); // Should accommodate "Expenses:Food:Groceries:Weekly Shopping"
            }
        });

        it('should calculate document-wide optimal alignment correctly', () => {
            const content = `2025-01-15 * Test
    Short    100 USD
    A        -50 USD

2025-01-16 * Another test
    Very:Long:Account:Name    200 EUR
    B                          -100 EUR
`;

            const parseResult = aligner.parseTransactions(content);
            expect(parseResult.success).toBe(true);

            if (parseResult.success) {
                const transactions = parseResult.data;
                const alignmentColumn = aligner.calculateDocumentOptimalAlignment(transactions);

                // The alignment should accommodate the longest account name + min spacing
                // "Very:Long:Account:Name" is 25 characters, with account position 4 = 29
                // + min spacing (2) = 31, so alignment should be at least 31 or the minimum (40)
                expect(alignmentColumn).toBeGreaterThanOrEqual(40);
            }
        });
    });

    describe('Error handling', () => {
        it('should handle null/undefined content', () => {
            const result1 = aligner.parseTransactions(null as any);
            expect(result1.success).toBe(false);
            if (result1.success === false) {
                expect((result1 as any).error.message).toContain('string');
            }

            const result2 = aligner.parseTransactions(undefined as any);
            expect(result2.success).toBe(false);
            if (result2.success === false) {
                expect((result2 as any).error.message).toContain('string');
            }
        });

        it('should handle non-string content', () => {
            const result = aligner.parseTransactions(123 as any);
            expect(result.success).toBe(false);
            if (result.success === false) {
                expect((result as any).error.message).toContain('string');
            }
        });

        it('should handle empty string', () => {
            const result = aligner.parseTransactions('');
            expect(result.success).toBe(true);
            if (result.success === true) {
                expect((result as any).data).toHaveLength(0);
            }
        });

        it('should handle whitespace-only string', () => {
            const result = aligner.parseTransactions('   \n  \n   ');
            expect(result.success).toBe(true);
            if (result.success === true) {
                expect((result as any).data).toHaveLength(0);
            }
        });
    });

    describe('Complex scenarios', () => {
        it('should handle mixed indentation', () => {
            const content = `2025-01-15 * Test
    Assets:Bank        100 USD
\tExpenses:Food     -50 USD
        Assets:Cash    25 USD
`;

            const result = aligner.parseTransactions(content);
            expect(result.success).toBe(true);

            if (result.success) {
                const transaction = result.data[0];
                expect(transaction.postings).toHaveLength(3);
                expect(transaction.postings.every(p => p.hasAmount)).toBe(true);
            }
        });

        it('should handle Unicode account names', () => {
            const content = `2025-01-15 * Тестовая транзакция
    Активы:Банк        100 USD
    Расходы:Еда     -50 USD
`;

            const result = aligner.parseTransactions(content);
            expect(result.success).toBe(true);

            if (result.success) {
                const transaction = result.data[0];
                expect(transaction.postings).toHaveLength(2);
                expect(transaction.postings[0].accountName).toBe('Активы:Банк');
                expect(transaction.postings[1].accountName).toBe('Расходы:Еда');
            }
        });

        it('should handle various commodity formats', () => {
            const content = `2025-01-15 * Test
    Assets:Bank        $100.00
    Assets:Cash        €200.50
    Assets:Crypto      0.001 BTC
    Assets:Gold        1.5 XAU
`;

            const result = aligner.parseTransactions(content);
            expect(result.success).toBe(true);

            if (result.success) {
                const transaction = result.data[0];
                expect(transaction.postings).toHaveLength(4);

                const commodities = transaction.postings.map(p => p.amountPart.trim());
                expect(commodities).toEqual(['$100.00', '€200.50', '0.001 BTC', '1.5 XAU']);
            }
        });

        it('should handle grouped numbers', () => {
            const content = `2025-01-15 * Test
    Assets:Bank        1,234.56 USD
    Assets:Cash        1 234,56 EUR
    Assets:Other       1.234,56 BRL
`;

            const result = aligner.parseTransactions(content);
            expect(result.success).toBe(true);

            if (result.success) {
                const transaction = result.data[0];
                expect(transaction.postings).toHaveLength(3);
                expect(transaction.postings.every(p => p.hasAmount)).toBe(true);
            }
        });
    });

    describe('Formatting options', () => {
        it('should respect custom minimum spacing', () => {
            const customAligner = new AmountAligner({ minSpacing: 4 });
            const content = `2025-01-15 * Test
    Assets:Bank        100 USD
    Expenses:Food     -50 USD
`;

            const result = customAligner.formatContent(content);
            expect(result.success).toBe(true);

            if (result.success) {
                const lines = result.data.split('\n');
                const account1End = lines[1].indexOf('Assets:Bank') + 'Assets:Bank'.length;
                const amount1Start = lines[1].indexOf('100 USD');
                const spacing = amount1Start - account1End;
                expect(spacing).toBeGreaterThanOrEqual(4);
            }
        });

        it('should handle preserve existing alignment option', () => {
            const customAligner = new AmountAligner({ preserveExistingAlignment: false });
            const content = `2025-01-15 * Test
    Assets:Bank        100 USD
    Expenses:Food     -50 USD
`;

            const result = customAligner.formatContent(content);
            expect(result.success).toBe(true);

            if (result.success) {
                // Should reformat even if already aligned
                expect(result.data).toContain('Assets:Bank');
                expect(result.data).toContain('Expenses:Food');
            }
        });
    });
});

describe('Utility functions', () => {
    describe('createAmountAligner', () => {
        it('should create AmountAligner with default options', () => {
            const aligner = createAmountAligner();
            expect(aligner).toBeInstanceOf(AmountAligner);
        });

        it('should create AmountAligner with custom options', () => {
            const aligner = createAmountAligner({ minSpacing: 5 });
            expect(aligner).toBeInstanceOf(AmountAligner);
        });
    });

    describe('isPostingLine', () => {
        it('should identify valid PostingLine objects', () => {
            const validPosting = {
                originalLine: '    Assets:Bank        100 USD',
                accountName: 'Assets:Bank',
                amountPart: '100 USD',
                hasAmount: true
            };

            expect(isPostingLine(validPosting)).toBe(true);
        });

        it('should reject invalid objects', () => {
            expect(isPostingLine(null)).toBe(false);
            expect(isPostingLine({})).toBe(false);
            expect(isPostingLine({ originalLine: 'test' })).toBe(false);
            expect(isPostingLine({
                originalLine: 'test',
                accountName: 'test',
                amountPart: 'test',
                hasAmount: 'not boolean'
            })).toBe(false);
        });
    });

    describe('isTransactionBlock', () => {
        it('should identify valid TransactionBlock objects', () => {
            const validTransaction = {
                headerLine: '2025-01-15 * Test',
                postings: [{
                    originalLine: '    Assets:Bank        100 USD',
                    accountName: 'Assets:Bank',
                    amountPart: '100 USD',
                    hasAmount: true
                }]
            };

            expect(isTransactionBlock(validTransaction)).toBe(true);
        });

        it('should reject invalid objects', () => {
            expect(isTransactionBlock(null)).toBe(false);
            expect(isTransactionBlock({})).toBe(false);
            expect(isTransactionBlock({
                headerLine: 'test',
                postings: 'not array'
            })).toBe(false);
            expect(isTransactionBlock({
                headerLine: 'test',
                postings: [{ originalLine: 'test' }] // Invalid posting
            })).toBe(false);
        });
    });
});