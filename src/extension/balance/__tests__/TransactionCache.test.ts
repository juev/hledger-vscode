import { TransactionCache } from '../TransactionCache';
import { ParsedTransaction } from '../types';

describe('TransactionCache', () => {
    let cache: TransactionCache;

    beforeEach(() => {
        cache = new TransactionCache();
    });

    afterEach(() => {
        cache.clear();
    });

    const createSimpleContent = (transactions: string[]): string => {
        return transactions.join('\n\n');
    };

    describe('first parse', () => {
        it('should return parsed transactions on first call', () => {
            const content = createSimpleContent([
                '2024-01-01 Grocery Store\n    Expenses:Food  $50\n    Assets:Cash',
                '2024-01-02 Gas Station\n    Expenses:Transport  $30\n    Assets:Cash',
            ]);

            const result = cache.getTransactions('test://doc1', content);

            expect(result).toHaveLength(2);
            expect(result[0]!.date).toBe('2024-01-01');
            expect(result[0]!.description).toBe('Grocery Store');
            expect(result[1]!.date).toBe('2024-01-02');
            expect(result[1]!.description).toBe('Gas Station');
        });

        it('should track line numbers correctly', () => {
            const content = createSimpleContent([
                '2024-01-01 First\n    Expenses:A  $10\n    Assets:B',
                '2024-01-02 Second\n    Expenses:C  $20\n    Assets:D',
            ]);

            const result = cache.getTransactions('test://doc1', content);

            expect(result[0]!.headerLineNumber).toBe(0);
            expect(result[1]!.headerLineNumber).toBe(4); // After blank line
        });
    });

    describe('no changes', () => {
        it('should return cached transactions when content unchanged', () => {
            const content = '2024-01-01 Test\n    Expenses:A  $50\n    Assets:B';

            const result1 = cache.getTransactions('test://doc1', content);
            const result2 = cache.getTransactions('test://doc1', content);

            expect(result1).toBe(result2); // Same reference = cached
            expect(result1).toHaveLength(1);
        });

        it('should handle multiple documents independently', () => {
            const content1 = '2024-01-01 Doc1\n    Expenses:A  $50\n    Assets:B';
            const content2 = '2024-01-02 Doc2\n    Expenses:C  $30\n    Assets:D';

            const result1a = cache.getTransactions('test://doc1', content1);
            const result2a = cache.getTransactions('test://doc2', content2);
            const result1b = cache.getTransactions('test://doc1', content1);
            const result2b = cache.getTransactions('test://doc2', content2);

            expect(result1a).toBe(result1b);
            expect(result2a).toBe(result2b);
            expect(result1a[0]!.description).toBe('Doc1');
            expect(result2a[0]!.description).toBe('Doc2');
        });
    });

    describe('single transaction change', () => {
        it('should re-parse only changed transaction', () => {
            const content1 = createSimpleContent([
                '2024-01-01 First\n    Expenses:A  $10\n    Assets:B',
                '2024-01-02 Second\n    Expenses:C  $20\n    Assets:D',
                '2024-01-03 Third\n    Expenses:E  $30\n    Assets:F',
            ]);

            const result1 = cache.getTransactions('test://doc1', content1);
            expect(result1).toHaveLength(3);

            // Change only the second transaction
            const content2 = createSimpleContent([
                '2024-01-01 First\n    Expenses:A  $10\n    Assets:B',
                '2024-01-02 Modified\n    Expenses:C  $25\n    Assets:D',
                '2024-01-03 Third\n    Expenses:E  $30\n    Assets:F',
            ]);

            const result2 = cache.getTransactions('test://doc1', content2);

            expect(result2).toHaveLength(3);
            expect(result2[0]!.description).toBe('First');
            expect(result2[1]!.description).toBe('Modified');
            expect(result2[2]!.description).toBe('Third');
        });

        it('should re-parse when posting amount changes', () => {
            const content1 = '2024-01-01 Test\n    Expenses:A  $50\n    Assets:B';
            const content2 = '2024-01-01 Test\n    Expenses:A  $100\n    Assets:B';

            cache.getTransactions('test://doc1', content1);
            const result2 = cache.getTransactions('test://doc1', content2);

            expect(result2).toHaveLength(1);
            expect(result2[0]!.postings[0]!.amount!.value).toBe(100);
        });
    });

    describe('transaction added', () => {
        it('should handle new transaction at end', () => {
            const content1 = '2024-01-01 First\n    Expenses:A  $10\n    Assets:B';

            cache.getTransactions('test://doc1', content1);

            const content2 = createSimpleContent([
                '2024-01-01 First\n    Expenses:A  $10\n    Assets:B',
                '2024-01-02 Second\n    Expenses:C  $20\n    Assets:D',
            ]);

            const result2 = cache.getTransactions('test://doc1', content2);

            expect(result2).toHaveLength(2);
            expect(result2[0]!.description).toBe('First');
            expect(result2[1]!.description).toBe('Second');
        });

        it('should handle new transaction at beginning', () => {
            const content1 = '2024-01-02 Second\n    Expenses:C  $20\n    Assets:D';

            cache.getTransactions('test://doc1', content1);

            const content2 = createSimpleContent([
                '2024-01-01 First\n    Expenses:A  $10\n    Assets:B',
                '2024-01-02 Second\n    Expenses:C  $20\n    Assets:D',
            ]);

            const result2 = cache.getTransactions('test://doc1', content2);

            expect(result2).toHaveLength(2);
            expect(result2[0]!.description).toBe('First');
            expect(result2[1]!.description).toBe('Second');
        });

        it('should handle new transaction in middle', () => {
            const content1 = createSimpleContent([
                '2024-01-01 First\n    Expenses:A  $10\n    Assets:B',
                '2024-01-03 Third\n    Expenses:E  $30\n    Assets:F',
            ]);

            cache.getTransactions('test://doc1', content1);

            const content2 = createSimpleContent([
                '2024-01-01 First\n    Expenses:A  $10\n    Assets:B',
                '2024-01-02 Second\n    Expenses:C  $20\n    Assets:D',
                '2024-01-03 Third\n    Expenses:E  $30\n    Assets:F',
            ]);

            const result2 = cache.getTransactions('test://doc1', content2);

            expect(result2).toHaveLength(3);
            expect(result2[1]!.description).toBe('Second');
        });
    });

    describe('transaction deleted', () => {
        it('should handle deleted transaction', () => {
            const content1 = createSimpleContent([
                '2024-01-01 First\n    Expenses:A  $10\n    Assets:B',
                '2024-01-02 Second\n    Expenses:C  $20\n    Assets:D',
                '2024-01-03 Third\n    Expenses:E  $30\n    Assets:F',
            ]);

            cache.getTransactions('test://doc1', content1);

            const content2 = createSimpleContent([
                '2024-01-01 First\n    Expenses:A  $10\n    Assets:B',
                '2024-01-03 Third\n    Expenses:E  $30\n    Assets:F',
            ]);

            const result2 = cache.getTransactions('test://doc1', content2);

            expect(result2).toHaveLength(2);
            expect(result2[0]!.description).toBe('First');
            expect(result2[1]!.description).toBe('Third');
        });
    });

    describe('multiple changes', () => {
        it('should handle multiple transactions changed', () => {
            const content1 = createSimpleContent([
                '2024-01-01 First\n    Expenses:A  $10\n    Assets:B',
                '2024-01-02 Second\n    Expenses:C  $20\n    Assets:D',
                '2024-01-03 Third\n    Expenses:E  $30\n    Assets:F',
            ]);

            cache.getTransactions('test://doc1', content1);

            // Change first and third
            const content2 = createSimpleContent([
                '2024-01-01 Modified1\n    Expenses:A  $15\n    Assets:B',
                '2024-01-02 Second\n    Expenses:C  $20\n    Assets:D',
                '2024-01-03 Modified3\n    Expenses:E  $35\n    Assets:F',
            ]);

            const result2 = cache.getTransactions('test://doc1', content2);

            expect(result2).toHaveLength(3);
            expect(result2[0]!.description).toBe('Modified1');
            expect(result2[1]!.description).toBe('Second');
            expect(result2[2]!.description).toBe('Modified3');
        });
    });

    describe('line shifts', () => {
        it('should adjust line numbers after insertion', () => {
            const content1 = createSimpleContent([
                '2024-01-01 First\n    Expenses:A  $10\n    Assets:B',
                '2024-01-02 Second\n    Expenses:C  $20\n    Assets:D',
            ]);

            cache.getTransactions('test://doc1', content1);

            // Insert transaction at beginning
            const content2 = createSimpleContent([
                '2024-01-00 New\n    Expenses:X  $5\n    Assets:Y',
                '2024-01-01 First\n    Expenses:A  $10\n    Assets:B',
                '2024-01-02 Second\n    Expenses:C  $20\n    Assets:D',
            ]);

            const result2 = cache.getTransactions('test://doc1', content2);

            expect(result2).toHaveLength(3);
            expect(result2[0]!.headerLineNumber).toBe(0);
            expect(result2[1]!.headerLineNumber).toBe(4);
            expect(result2[2]!.headerLineNumber).toBe(8);
        });
    });

    describe('cache invalidation', () => {
        it('should fully re-parse after invalidate()', () => {
            const content = '2024-01-01 Test\n    Expenses:A  $50\n    Assets:B';

            const result1 = cache.getTransactions('test://doc1', content);
            cache.invalidate('test://doc1');
            const result2 = cache.getTransactions('test://doc1', content);

            // After invalidation, should return new parsed result (different reference)
            expect(result1).not.toBe(result2);
            expect(result2).toHaveLength(1);
        });

        it('should only invalidate specified document', () => {
            const content1 = '2024-01-01 Doc1\n    Expenses:A  $50\n    Assets:B';
            const content2 = '2024-01-02 Doc2\n    Expenses:C  $30\n    Assets:D';

            const result1a = cache.getTransactions('test://doc1', content1);
            const result2a = cache.getTransactions('test://doc2', content2);

            cache.invalidate('test://doc1');

            const result1b = cache.getTransactions('test://doc1', content1);
            const result2b = cache.getTransactions('test://doc2', content2);

            expect(result1a).not.toBe(result1b); // Re-parsed
            expect(result2a).toBe(result2b); // Still cached
        });
    });

    describe('clear', () => {
        it('should clear all cached data', () => {
            const content1 = '2024-01-01 Doc1\n    Expenses:A  $50\n    Assets:B';
            const content2 = '2024-01-02 Doc2\n    Expenses:C  $30\n    Assets:D';

            const result1a = cache.getTransactions('test://doc1', content1);
            const result2a = cache.getTransactions('test://doc2', content2);

            cache.clear();

            const result1b = cache.getTransactions('test://doc1', content1);
            const result2b = cache.getTransactions('test://doc2', content2);

            expect(result1a).not.toBe(result1b);
            expect(result2a).not.toBe(result2b);
        });
    });

    describe('edge cases', () => {
        it('should handle empty content', () => {
            const result = cache.getTransactions('test://doc1', '');
            expect(result).toEqual([]);
        });

        it('should handle content with only comments', () => {
            const content = '; This is a comment\n# Another comment';
            const result = cache.getTransactions('test://doc1', content);
            expect(result).toEqual([]);
        });

        it('should handle content with only directives', () => {
            const content = 'account Assets:Cash\ncommodity USD';
            const result = cache.getTransactions('test://doc1', content);
            expect(result).toEqual([]);
        });

        it('should handle transaction with no postings', () => {
            // This is invalid in hledger, but parser should handle it
            const content = '2024-01-01 Empty Transaction';
            const result = cache.getTransactions('test://doc1', content);
            // Parser returns empty array for transaction without postings
            expect(result).toEqual([]);
        });

        it('should handle very long transaction', () => {
            const postings = Array.from({ length: 100 }, (_, i) =>
                `    Account${i}  $${i}`
            ).join('\n');
            const content = `2024-01-01 Many Postings\n${postings}`;

            const result = cache.getTransactions('test://doc1', content);
            expect(result).toHaveLength(1);
            expect(result[0]!.postings.length).toBe(100);
        });
    });
});
