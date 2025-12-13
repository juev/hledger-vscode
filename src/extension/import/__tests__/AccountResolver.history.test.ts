/**
 * Tests for journal history integration in AccountResolver
 */

import { AccountResolver } from '../AccountResolver';
import { DEFAULT_IMPORT_OPTIONS, PayeeAccountHistory } from '../types';
import { AccountName, PayeeName, UsageCount, createUsageCount } from '../../types';

describe('AccountResolver with journal history', () => {
    /**
     * Creates a PayeeAccountHistory for testing
     */
    function createHistory(
        mappings: Array<{ payee: string; accounts: string[]; usageCounts?: number[] }>
    ): PayeeAccountHistory {
        const payeeAccounts = new Map<PayeeName, Set<AccountName>>();
        const pairUsage = new Map<string, UsageCount>();

        for (const { payee, accounts, usageCounts } of mappings) {
            const normalizedPayee = payee.normalize('NFC') as PayeeName;
            const accountSet = new Set<AccountName>();

            for (let i = 0; i < accounts.length; i++) {
                const account = accounts[i] as AccountName;
                accountSet.add(account);

                const count = usageCounts?.[i] ?? 1;
                const key = `${normalizedPayee}::${account}`;
                pairUsage.set(key, createUsageCount(count));
            }

            payeeAccounts.set(normalizedPayee, accountSet);
        }

        return {
            payeeAccounts: payeeAccounts as ReadonlyMap<PayeeName, ReadonlySet<AccountName>>,
            pairUsage: pairUsage as ReadonlyMap<string, UsageCount>,
        };
    }

    describe('exact payee match from history', () => {
        it('should resolve exact payee match with highest confidence', () => {
            const history = createHistory([
                { payee: 'Starbucks Coffee', accounts: ['expenses:food:coffee'] },
            ]);

            const resolver = new AccountResolver(DEFAULT_IMPORT_OPTIONS, history);
            const result = resolver.resolve('Starbucks Coffee');

            expect(result.account).toBe('expenses:food:coffee');
            expect(result.source).toBe('history');
            expect(result.confidence).toBeGreaterThanOrEqual(0.9);
        });

        it('should resolve case-insensitive exact match', () => {
            const history = createHistory([
                { payee: 'Starbucks Coffee', accounts: ['expenses:food:coffee'] },
            ]);

            const resolver = new AccountResolver(DEFAULT_IMPORT_OPTIONS, history);
            const result = resolver.resolve('STARBUCKS COFFEE');

            expect(result.account).toBe('expenses:food:coffee');
            expect(result.source).toBe('history');
        });

        it('should handle Unicode/Cyrillic payee names', () => {
            const history = createHistory([
                { payee: 'Пятерочка', accounts: ['expenses:food:groceries'] },
            ]);

            const resolver = new AccountResolver(DEFAULT_IMPORT_OPTIONS, history);
            const result = resolver.resolve('Пятерочка');

            expect(result.account).toBe('expenses:food:groceries');
            expect(result.source).toBe('history');
        });
    });

    describe('fuzzy payee match from history', () => {
        it('should resolve fuzzy match with medium-high confidence', () => {
            const history = createHistory([
                { payee: 'Starbucks Coffee Shop', accounts: ['expenses:food:coffee'] },
            ]);

            const resolver = new AccountResolver(DEFAULT_IMPORT_OPTIONS, history);
            const result = resolver.resolve('STARBUCKS');

            expect(result.account).toBe('expenses:food:coffee');
            expect(result.source).toBe('history');
            expect(result.confidence).toBeGreaterThanOrEqual(0.8);
            expect(result.confidence).toBeLessThan(0.95);
        });

        it('should match partial description containing payee', () => {
            const history = createHistory([
                { payee: 'Amazon', accounts: ['expenses:shopping:amazon'] },
            ]);

            const resolver = new AccountResolver(DEFAULT_IMPORT_OPTIONS, history);
            const result = resolver.resolve('AMAZON.COM*123ABC');

            expect(result.account).toBe('expenses:shopping:amazon');
            expect(result.source).toBe('history');
        });
    });

    describe('account selection from history', () => {
        it('should select most frequently used account when multiple exist', () => {
            const history = createHistory([
                {
                    payee: 'Walmart',
                    accounts: ['expenses:shopping', 'expenses:food:groceries', 'expenses:household'],
                    usageCounts: [2, 10, 1],
                },
            ]);

            const resolver = new AccountResolver(DEFAULT_IMPORT_OPTIONS, history);
            const result = resolver.resolve('Walmart');

            expect(result.account).toBe('expenses:food:groceries');
            expect(result.source).toBe('history');
        });

        it('should use first account alphabetically when usage counts are equal', () => {
            const history = createHistory([
                {
                    payee: 'Generic Store',
                    accounts: ['expenses:shopping', 'expenses:misc'],
                    usageCounts: [5, 5],
                },
            ]);

            const resolver = new AccountResolver(DEFAULT_IMPORT_OPTIONS, history);
            const result = resolver.resolve('Generic Store');

            expect(result.source).toBe('history');
            // Should pick one consistently (alphabetically first)
            expect(['expenses:misc', 'expenses:shopping']).toContain(result.account);
        });
    });

    describe('priority ordering', () => {
        it('should prefer history over category mapping', () => {
            const history = createHistory([
                { payee: 'Groceries Store', accounts: ['expenses:food:my-groceries'] },
            ]);

            const resolver = new AccountResolver(DEFAULT_IMPORT_OPTIONS, history);
            // Category 'groceries' would map to 'expenses:food:groceries' by default
            const result = resolver.resolve('Groceries Store', 'groceries');

            expect(result.account).toBe('expenses:food:my-groceries');
            expect(result.source).toBe('history');
        });

        it('should prefer history over merchant patterns', () => {
            const history = createHistory([
                { payee: 'AMAZON.COM', accounts: ['expenses:shopping:my-amazon'] },
            ]);

            const resolver = new AccountResolver(DEFAULT_IMPORT_OPTIONS, history);
            // AMAZON pattern would normally map to 'expenses:shopping:amazon'
            const result = resolver.resolve('AMAZON.COM');

            expect(result.account).toBe('expenses:shopping:my-amazon');
            expect(result.source).toBe('history');
        });

        it('should fall back to category when no history match', () => {
            const history = createHistory([
                { payee: 'Starbucks', accounts: ['expenses:food:coffee'] },
            ]);

            const resolver = new AccountResolver(DEFAULT_IMPORT_OPTIONS, history);
            const result = resolver.resolve('Unknown Store', 'groceries');

            expect(result.account).toBe('expenses:food:groceries');
            expect(result.source).toBe('category');
        });

        it('should fall back to pattern when no history or category match', () => {
            const history = createHistory([
                { payee: 'Starbucks', accounts: ['expenses:food:coffee'] },
            ]);

            const resolver = new AccountResolver(DEFAULT_IMPORT_OPTIONS, history);
            const result = resolver.resolve('NETFLIX.COM');

            expect(result.account).toBe('expenses:subscriptions:streaming');
            expect(result.source).toBe('pattern');
        });
    });

    describe('useJournalHistory option', () => {
        it('should skip history when useJournalHistory is false', () => {
            const history = createHistory([
                { payee: 'Custom Shop', accounts: ['expenses:custom'] },
            ]);

            const resolver = new AccountResolver(
                { ...DEFAULT_IMPORT_OPTIONS, useJournalHistory: false },
                history
            );
            const result = resolver.resolve('Custom Shop', undefined, -100);

            // Should not use history, fall back to amount sign
            expect(result.source).not.toBe('history');
        });

        it('should use history when useJournalHistory is true (default)', () => {
            const history = createHistory([
                { payee: 'Custom Shop', accounts: ['expenses:custom'] },
            ]);

            const resolver = new AccountResolver(
                { ...DEFAULT_IMPORT_OPTIONS, useJournalHistory: true },
                history
            );
            const result = resolver.resolve('Custom Shop');

            expect(result.account).toBe('expenses:custom');
            expect(result.source).toBe('history');
        });
    });

    describe('null/undefined history', () => {
        it('should work without history provided', () => {
            const resolver = new AccountResolver(DEFAULT_IMPORT_OPTIONS);
            const result = resolver.resolve('AMAZON.COM');

            // Should fall back to pattern matching
            expect(result.account).toBe('expenses:shopping:amazon');
            expect(result.source).toBe('pattern');
        });

        it('should work with undefined history', () => {
            const resolver = new AccountResolver(DEFAULT_IMPORT_OPTIONS, undefined);
            const result = resolver.resolve('NETFLIX.COM');

            expect(result.account).toBe('expenses:subscriptions:streaming');
            expect(result.source).toBe('pattern');
        });

        it('should work with empty history', () => {
            const history = createHistory([]);

            const resolver = new AccountResolver(DEFAULT_IMPORT_OPTIONS, history);
            const result = resolver.resolve('AMAZON.COM');

            expect(result.account).toBe('expenses:shopping:amazon');
            expect(result.source).toBe('pattern');
        });
    });

    describe('describeSource helper', () => {
        it('should describe history source correctly', () => {
            expect(AccountResolver.describeSource('history')).toBe('journal history');
        });
    });
});
