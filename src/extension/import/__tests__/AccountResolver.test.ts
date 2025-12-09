import { AccountResolver } from '../AccountResolver';
import { DEFAULT_IMPORT_OPTIONS } from '../types';

describe('AccountResolver', () => {
    let resolver: AccountResolver;

    beforeEach(() => {
        resolver = new AccountResolver(DEFAULT_IMPORT_OPTIONS);
    });

    describe('category resolution', () => {
        it('should resolve from built-in category mapping', () => {
            const result = resolver.resolve('', 'Groceries');

            expect(result.account).toBe('expenses:food:groceries');
            expect(result.source).toBe('category');
            expect(result.confidence).toBeGreaterThan(0.8);
        });

        it('should resolve case-insensitively', () => {
            const result = resolver.resolve('', 'GROCERIES');

            expect(result.account).toBe('expenses:food:groceries');
            expect(result.source).toBe('category');
        });

        it('should resolve Russian category', () => {
            const result = resolver.resolve('', 'Продукты');

            expect(result.account).toBe('expenses:food:groceries');
            expect(result.source).toBe('category');
        });

        it('should resolve partial category match', () => {
            const result = resolver.resolve('', 'Food & Groceries');

            expect(result.source).toBe('category');
            expect(result.confidence).toBeGreaterThan(0.5);
        });
    });

    describe('merchant pattern matching', () => {
        it('should match Amazon', () => {
            const result = resolver.resolve('AMAZON.COM*123');

            expect(result.account).toBe('expenses:shopping:amazon');
            expect(result.source).toBe('pattern');
        });

        it('should match AMZN abbreviation', () => {
            const result = resolver.resolve('AMZN Mktp US*456');

            expect(result.account).toBe('expenses:shopping:amazon');
            expect(result.source).toBe('pattern');
        });

        it('should match Netflix', () => {
            const result = resolver.resolve('NETFLIX.COM');

            expect(result.account).toBe('expenses:subscriptions:streaming');
            expect(result.source).toBe('pattern');
        });

        it('should match Uber (not Uber Eats)', () => {
            const result = resolver.resolve('UBER TRIP');

            expect(result.account).toBe('expenses:transport:rideshare');
            expect(result.source).toBe('pattern');
        });

        it('should match Uber Eats as food delivery', () => {
            const result = resolver.resolve('UBER EATS ORDER');

            expect(result.account).toBe('expenses:food:dining:delivery');
            expect(result.source).toBe('pattern');
        });

        it('should match salary/payroll', () => {
            const result = resolver.resolve('DIRECT DEPOSIT PAYROLL');

            expect(result.account).toBe('income:salary');
            expect(result.source).toBe('pattern');
        });

        it('should match Russian merchants', () => {
            const result = resolver.resolve('ПЯТЕРОЧКА 12345');

            expect(result.account).toBe('expenses:food:groceries');
            expect(result.source).toBe('pattern');
        });

        it('should match Whole Foods', () => {
            const result = resolver.resolve('WHOLE FOODS MARKET #123');

            expect(result.account).toBe('expenses:food:groceries');
            expect(result.source).toBe('pattern');
        });
    });

    describe('amount sign heuristic', () => {
        it('should use default credit account for positive amounts', () => {
            const result = resolver.resolve('Unknown Merchant', undefined, 100);

            expect(result.account).toBe('income:unknown');
            expect(result.source).toBe('sign');
            expect(result.confidence).toBe(0.5);
        });

        it('should use default debit account for negative amounts', () => {
            const result = resolver.resolve('Unknown Merchant', undefined, -100);

            expect(result.account).toBe('expenses:unknown');
            expect(result.source).toBe('sign');
            expect(result.confidence).toBe(0.5);
        });

        it('should use default placeholder for zero amount', () => {
            const result = resolver.resolve('Unknown Merchant', undefined, 0);

            expect(result.account).toBe('TODO:account');
            expect(result.source).toBe('default');
        });
    });

    describe('priority order', () => {
        it('should prefer category over pattern', () => {
            // Category should win even if pattern also matches
            const result = resolver.resolve('AMAZON PURCHASE', 'Shopping');

            expect(result.source).toBe('category');
        });

        it('should prefer pattern over amount sign', () => {
            const result = resolver.resolve('NETFLIX.COM', undefined, -15.99);

            expect(result.source).toBe('pattern');
            expect(result.account).toBe('expenses:subscriptions:streaming');
        });

        it('should use amount sign when no other match', () => {
            const result = resolver.resolve('RANDOM UNKNOWN MERCHANT XYZ', undefined, -50);

            expect(result.source).toBe('sign');
        });
    });

    describe('default fallback', () => {
        it('should return default placeholder when no match', () => {
            const result = resolver.resolve('');

            expect(result.account).toBe('TODO:account');
            expect(result.source).toBe('default');
            expect(result.confidence).toBe(0);
        });
    });

    describe('custom configuration', () => {
        it('should use custom category mapping', () => {
            const customResolver = new AccountResolver({
                ...DEFAULT_IMPORT_OPTIONS,
                categoryMapping: {
                    'My Custom Category': 'expenses:custom',
                },
            });

            const result = customResolver.resolve('', 'My Custom Category');

            expect(result.account).toBe('expenses:custom');
            expect(result.source).toBe('category');
        });

        it('should use custom merchant patterns', () => {
            const customResolver = new AccountResolver({
                ...DEFAULT_IMPORT_OPTIONS,
                merchantPatterns: {
                    'MYSTORE': 'expenses:mystore',
                },
            });

            const result = customResolver.resolve('MYSTORE PURCHASE');

            expect(result.account).toBe('expenses:mystore');
            expect(result.source).toBe('pattern');
        });

        it('should use custom default accounts', () => {
            const customResolver = new AccountResolver({
                ...DEFAULT_IMPORT_OPTIONS,
                defaultDebitAccount: 'expenses:misc',
                defaultCreditAccount: 'income:misc',
            });

            const resultNegative = customResolver.resolve('Unknown', undefined, -100);
            expect(resultNegative.account).toBe('expenses:misc');

            const resultPositive = customResolver.resolve('Unknown', undefined, 100);
            expect(resultPositive.account).toBe('income:misc');
        });
    });

    describe('partial match caching', () => {
        it('should return same result for repeated category lookups', () => {
            const result1 = resolver.resolve('test', 'food & drinks');
            const result2 = resolver.resolve('test', 'food & drinks');

            expect(result1).toEqual(result2);
            expect(result1.source).toBe('category');
        });

        it('should cache null results for non-matching categories', () => {
            const result1 = resolver.resolve('test', 'xyznonexistent');
            const result2 = resolver.resolve('test', 'xyznonexistent');

            expect(result1.source).toBe('default');
            expect(result2.source).toBe('default');
        });

        it('should handle whitespace normalization in cache', () => {
            const result1 = resolver.resolve('test', '  food  ');
            const result2 = resolver.resolve('test', 'food');

            expect(result1.account).toBe(result2.account);
            expect(result1.source).toBe('category');
        });
    });

    describe('static helpers', () => {
        it('should describe resolution sources', () => {
            expect(AccountResolver.describeSource('category')).toBe('category column');
            expect(AccountResolver.describeSource('pattern')).toBe('merchant pattern');
            expect(AccountResolver.describeSource('sign')).toBe('amount sign');
            expect(AccountResolver.describeSource('default')).toBe('no match found');
        });

        it('should identify accounts needing review', () => {
            expect(AccountResolver.needsReview({
                account: 'TODO:account',
                confidence: 0,
                source: 'default',
            })).toBe(true);

            expect(AccountResolver.needsReview({
                account: 'expenses:unknown',
                confidence: 0.5,
                source: 'sign',
            })).toBe(true);

            expect(AccountResolver.needsReview({
                account: 'expenses:food:groceries',
                confidence: 0.95,
                source: 'category',
            })).toBe(false);
        });

        it('should format with annotation', () => {
            const resolution = {
                account: 'expenses:food:groceries',
                confidence: 0.95,
                source: 'category' as const,
            };

            const formatted = AccountResolver.formatWithAnnotation(resolution);
            expect(formatted).toContain('expenses:food:groceries');
            expect(formatted).toContain('category column');
        });
    });
});
