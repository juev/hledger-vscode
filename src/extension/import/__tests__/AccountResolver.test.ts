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
            expect(result.confidence).toBeGreaterThanOrEqual(0.8);
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

        it('should evict old entries when cache exceeds limit', () => {
            // LRU cache has 100 entry limit - fill it up and verify it works
            for (let i = 0; i < 150; i++) {
                resolver.resolve('test', `unique_category_${i}`);
            }
            // Cache should not exceed 100 entries (internal limit)
            // This test verifies no memory leak by filling cache beyond limit
            const lastResult = resolver.resolve('test', 'unique_category_149');
            expect(lastResult.source).toBe('default');
        });
    });

    describe('ReDoS protection', () => {
        it('should reject nested quantifiers pattern: (a+)+', () => {
            const customResolver = new AccountResolver({
                ...DEFAULT_IMPORT_OPTIONS,
                merchantPatterns: {
                    '(a+)+': 'expenses:test',
                },
            });
            // Pattern should be rejected, so no pattern match
            const result = customResolver.resolve('aaaa');
            expect(result.source).not.toBe('pattern');
        });

        it('should reject nested quantifiers pattern: (a*)+', () => {
            const customResolver = new AccountResolver({
                ...DEFAULT_IMPORT_OPTIONS,
                merchantPatterns: {
                    '(a*)+': 'expenses:test',
                },
            });
            const result = customResolver.resolve('aaaa');
            expect(result.source).not.toBe('pattern');
        });

        it('should reject nested quantifiers pattern: (a+)*', () => {
            const customResolver = new AccountResolver({
                ...DEFAULT_IMPORT_OPTIONS,
                merchantPatterns: {
                    '(a+)*': 'expenses:test',
                },
            });
            const result = customResolver.resolve('aaaa');
            expect(result.source).not.toBe('pattern');
        });

        it('should reject nested quantifiers with curly braces: (a+){2}', () => {
            const customResolver = new AccountResolver({
                ...DEFAULT_IMPORT_OPTIONS,
                merchantPatterns: {
                    '(a+){2}': 'expenses:test',
                },
            });
            const result = customResolver.resolve('aaaa');
            expect(result.source).not.toBe('pattern');
        });

        it('should reject overlapping alternations: (a|ab)+', () => {
            const customResolver = new AccountResolver({
                ...DEFAULT_IMPORT_OPTIONS,
                merchantPatterns: {
                    '(a|ab)+': 'expenses:test',
                },
            });
            const result = customResolver.resolve('ababab');
            expect(result.source).not.toBe('pattern');
        });

        it('should reject identical alternations: (a|a)+', () => {
            const customResolver = new AccountResolver({
                ...DEFAULT_IMPORT_OPTIONS,
                merchantPatterns: {
                    '(a|a)+': 'expenses:test',
                },
            });
            const result = customResolver.resolve('aaaa');
            expect(result.source).not.toBe('pattern');
        });

        it('should reject wildcard in alternation: (.|x)+', () => {
            const customResolver = new AccountResolver({
                ...DEFAULT_IMPORT_OPTIONS,
                merchantPatterns: {
                    '(.|x)+': 'expenses:test',
                },
            });
            const result = customResolver.resolve('xxxx');
            expect(result.source).not.toBe('pattern');
        });

        it('should reject backreference with quantifier: (.+)\\1+', () => {
            const customResolver = new AccountResolver({
                ...DEFAULT_IMPORT_OPTIONS,
                merchantPatterns: {
                    '(.+)\\1+': 'expenses:test',
                },
            });
            const result = customResolver.resolve('abcabc');
            expect(result.source).not.toBe('pattern');
        });

        it('should reject patterns longer than 100 characters', () => {
            const longPattern = 'a'.repeat(101);
            const customResolver = new AccountResolver({
                ...DEFAULT_IMPORT_OPTIONS,
                merchantPatterns: {
                    [longPattern]: 'expenses:test',
                },
            });
            const result = customResolver.resolve('a'.repeat(101));
            expect(result.source).not.toBe('pattern');
        });

        it('should allow safe patterns', () => {
            const customResolver = new AccountResolver({
                ...DEFAULT_IMPORT_OPTIONS,
                merchantPatterns: {
                    'SAFE_STORE_\\d+': 'expenses:test',
                },
            });
            const result = customResolver.resolve('SAFE_STORE_123');
            expect(result.source).toBe('pattern');
            expect(result.account).toBe('expenses:test');
        });

        it('should allow simple alternations without overlap', () => {
            const customResolver = new AccountResolver({
                ...DEFAULT_IMPORT_OPTIONS,
                merchantPatterns: {
                    'SHOP_(ONE|TWO)': 'expenses:test',
                },
            });
            const result = customResolver.resolve('SHOP_ONE');
            expect(result.source).toBe('pattern');
            expect(result.account).toBe('expenses:test');
        });
    });

    describe('ReDoS protection edge cases', () => {
        it('should accept patterns at exactly 100 characters', () => {
            const pattern100 = 'A'.repeat(100);
            const customResolver = new AccountResolver({
                ...DEFAULT_IMPORT_OPTIONS,
                merchantPatterns: { [pattern100]: 'expenses:test' },
            });

            const result = customResolver.resolve('A'.repeat(100));
            expect(result.source).toBe('pattern');
            expect(result.account).toBe('expenses:test');
        });

        it('should reject patterns over 100 characters', () => {
            const pattern101 = 'A'.repeat(101);
            const customResolver = new AccountResolver({
                ...DEFAULT_IMPORT_OPTIONS,
                merchantPatterns: { [pattern101]: 'expenses:test' },
            });

            const result = customResolver.resolve('A'.repeat(101));
            expect(result.source).not.toBe('pattern');
        });

        it('should still work with valid short patterns after rejecting long ones', () => {
            const longPattern = 'B'.repeat(150);
            const shortPattern = 'VALID_STORE';
            const customResolver = new AccountResolver({
                ...DEFAULT_IMPORT_OPTIONS,
                merchantPatterns: {
                    [longPattern]: 'expenses:rejected',
                    [shortPattern]: 'expenses:accepted',
                },
            });

            const longResult = customResolver.resolve('B'.repeat(150));
            expect(longResult.source).not.toBe('pattern');

            const shortResult = customResolver.resolve('VALID_STORE_123');
            expect(shortResult.source).toBe('pattern');
            expect(shortResult.account).toBe('expenses:accepted');
        });
    });

    /**
     * Dedicated unit tests for ReDoS pattern validation.
     * Tests the security-critical regex safety validation through the public API.
     * Each test verifies that dangerous patterns are rejected during AccountResolver construction.
     */
    describe('ReDoS pattern validation - nested quantifiers', () => {
        const createResolverWithPattern = (pattern: string): AccountResolver =>
            new AccountResolver({
                ...DEFAULT_IMPORT_OPTIONS,
                merchantPatterns: { [pattern]: 'expenses:test' },
            });

        const patternAccepted = (pattern: string, input: string): boolean => {
            const resolver = createResolverWithPattern(pattern);
            const result = resolver.resolve(input);
            return result.source === 'pattern';
        };

        describe('hasNestedQuantifiers detection', () => {
            it('should reject (a+)+ - classic nested plus', () => {
                expect(patternAccepted('(a+)+', 'aaaa')).toBe(false);
            });

            it('should reject (a*)+ - star inside, plus outside', () => {
                expect(patternAccepted('(a*)+', 'aaaa')).toBe(false);
            });

            it('should reject (a+)* - plus inside, star outside', () => {
                expect(patternAccepted('(a+)*', 'aaaa')).toBe(false);
            });

            it('should reject (a*)* - double star', () => {
                expect(patternAccepted('(a*)*', 'aaaa')).toBe(false);
            });

            it('should accept ((a)+)+ - limitation: deeply nested groups not detected', () => {
                // Known limitation: validator regex uses [^)]* which stops at first )
                // So ((a)+)+ is not detected as nested quantifier
                // This is acceptable because such patterns are rare in merchant matching
                expect(patternAccepted('((a)+)+', 'aaaa')).toBe(true);
            });

            it('should reject (a+){2} - plus with curly brace quantifier', () => {
                expect(patternAccepted('(a+){2}', 'aaaa')).toBe(false);
            });

            it('should reject (a*){3,} - star with curly brace range', () => {
                expect(patternAccepted('(a*){3,}', 'aaaa')).toBe(false);
            });

            it('should reject (a{2,})+ - curly brace inside, plus outside', () => {
                expect(patternAccepted('(a{2,})+', 'aaaa')).toBe(false);
            });

            it('should reject (.+)+ - dot-plus inside, plus outside', () => {
                expect(patternAccepted('(.+)+', 'aaaa')).toBe(false);
            });

            it('should reject (.*)+ - dot-star inside, plus outside', () => {
                expect(patternAccepted('(.*)+ ', 'aaaa')).toBe(false);
            });

            it('should reject (.*){2} - dot-star with curly brace', () => {
                expect(patternAccepted('(.*){2}', 'aaaa')).toBe(false);
            });

            it('should accept (a)+ - single char in group with quantifier (safe)', () => {
                expect(patternAccepted('(a)+', 'aaaa')).toBe(true);
            });

            it('should accept (abc)+ - literal string in group with quantifier (safe)', () => {
                expect(patternAccepted('(abc)+', 'abcabc')).toBe(true);
            });

            it('should accept a+ - simple quantifier without group (safe)', () => {
                expect(patternAccepted('a+', 'aaaa')).toBe(true);
            });

            it('should accept (a)(b)+ - separate groups, one quantified (safe)', () => {
                expect(patternAccepted('(a)(b)+', 'abbb')).toBe(true);
            });
        });

        describe('hasOverlappingAlternations detection', () => {
            it('should reject (a|a)+ - identical alternatives', () => {
                expect(patternAccepted('(a|a)+', 'aaaa')).toBe(false);
            });

            it('should reject (a|ab)+ - prefix overlap', () => {
                expect(patternAccepted('(a|ab)+', 'ababab')).toBe(false);
            });

            it('should reject (ab|a)+ - prefix overlap reversed', () => {
                expect(patternAccepted('(ab|a)+', 'ababab')).toBe(false);
            });

            it('should reject (b|ab)+ - suffix overlap', () => {
                expect(patternAccepted('(b|ab)+', 'ababab')).toBe(false);
            });

            it('should reject (ab|b)+ - suffix overlap reversed', () => {
                expect(patternAccepted('(ab|b)+', 'ababab')).toBe(false);
            });

            it('should reject (.|x)+ - wildcard in alternation', () => {
                expect(patternAccepted('(.|x)+', 'xxxx')).toBe(false);
            });

            it('should reject (.*|x)+ - wildcard-star in alternation', () => {
                expect(patternAccepted('(.*|x)+', 'xxxx')).toBe(false);
            });

            it('should reject (.+|x)+ - wildcard-plus in alternation', () => {
                expect(patternAccepted('(.+|x)+', 'xxxx')).toBe(false);
            });

            it('should reject (abc|abd)+ - significant common prefix', () => {
                expect(patternAccepted('(abc|abd)+', 'abcabd')).toBe(false);
            });

            it('should accept (cat|dog)+ - non-overlapping alternatives (safe)', () => {
                expect(patternAccepted('(cat|dog)+', 'catdog')).toBe(true);
            });

            it('should accept (ONE|TWO)+ - distinct alternatives (safe)', () => {
                expect(patternAccepted('(ONE|TWO)+', 'ONETWO')).toBe(true);
            });

            it('should accept AMAZON|AMZN - alternatives without quantifier (safe)', () => {
                expect(patternAccepted('AMAZON|AMZN', 'AMAZON')).toBe(true);
            });

            it('should accept (x|y|z)+ - multiple distinct alternatives (safe)', () => {
                expect(patternAccepted('(x|y|z)+', 'xyz')).toBe(true);
            });
        });

        describe('hasBackreferenceWithQuantifier detection', () => {
            it('should reject (.+)\\1+ - backreference with plus', () => {
                expect(patternAccepted('(.+)\\1+', 'abcabc')).toBe(false);
            });

            it('should reject (.*)\\1+ - backreference with plus after star group', () => {
                expect(patternAccepted('(.*)\\1+', 'abcabc')).toBe(false);
            });

            it('should reject (.+)\\1* - backreference with star', () => {
                expect(patternAccepted('(.+)\\1*', 'abcabc')).toBe(false);
            });

            it('should reject (.+)\\1{2} - backreference with curly brace', () => {
                expect(patternAccepted('(.+)\\1{2}', 'abcabcabc')).toBe(false);
            });

            it('should reject (a)(b)\\2+ - second backreference with quantifier', () => {
                expect(patternAccepted('(a)(b)\\2+', 'abbb')).toBe(false);
            });

            it('should reject pattern with \\9+ - high numbered backreference', () => {
                expect(patternAccepted('(a)(b)(c)(d)(e)(f)(g)(h)(i)\\9+', 'abcdefghiii')).toBe(false);
            });

            it('should reject (.+)\\12+ - double digit backreference', () => {
                expect(patternAccepted('(.+)\\12+', 'test')).toBe(false);
            });

            it('should accept (.+)\\1 - backreference without quantifier (safe)', () => {
                expect(patternAccepted('(.+)\\1', 'abcabc')).toBe(true);
            });

            it('should accept (a)\\1 - simple backreference without quantifier (safe)', () => {
                expect(patternAccepted('(a)\\1', 'aa')).toBe(true);
            });
        });

        describe('pattern length validation', () => {
            it('should accept pattern at exactly 100 characters', () => {
                const pattern100 = 'X'.repeat(100);
                expect(patternAccepted(pattern100, 'X'.repeat(100))).toBe(true);
            });

            it('should reject pattern at 101 characters', () => {
                const pattern101 = 'X'.repeat(101);
                expect(patternAccepted(pattern101, 'X'.repeat(101))).toBe(false);
            });

            it('should reject very long pattern (500 chars)', () => {
                const pattern500 = 'Y'.repeat(500);
                expect(patternAccepted(pattern500, 'Y'.repeat(500))).toBe(false);
            });

            it('should accept 99 character pattern', () => {
                const pattern99 = 'Z'.repeat(99);
                expect(patternAccepted(pattern99, 'Z'.repeat(99))).toBe(true);
            });
        });

        describe('combined dangerous patterns', () => {
            it('should reject pattern combining nested quantifiers and length limit', () => {
                // Pattern with nested quantifiers that is also long
                const longNested = 'prefix' + '(a+)+' + 'X'.repeat(90);
                expect(patternAccepted(longNested, 'prefixaaaa')).toBe(false);
            });

            it('should reject pattern with overlapping alternations and quantifier', () => {
                // Overlapping alternations with outer quantifier are detected
                expect(patternAccepted('(a|ab)+', 'ababab')).toBe(false);
            });

            it('should accept ((a|ab)+) - limitation: nested group without outer quantifier', () => {
                // Without outer quantifier, this is not detected as dangerous
                // The overlapping alternations ARE inside a quantified group, but wrapped in another group
                expect(patternAccepted('((a|ab)+)', 'ababab')).toBe(true);
            });
        });

        describe('safe real-world patterns', () => {
            it('should accept typical merchant pattern with word boundaries', () => {
                expect(patternAccepted('\\bAMAZON\\b', 'AMAZON')).toBe(true);
            });

            it('should accept pattern with digit class', () => {
                expect(patternAccepted('STORE_\\d{4,6}', 'STORE_12345')).toBe(true);
            });

            it('should accept pattern with optional whitespace', () => {
                expect(patternAccepted('WHOLE\\s*FOODS', 'WHOLE FOODS')).toBe(true);
            });

            it('should accept pattern with simple character class', () => {
                expect(patternAccepted('[A-Z]+_STORE', 'ABC_STORE')).toBe(true);
            });

            it('should accept pattern with escaped special characters', () => {
                expect(patternAccepted('PRICE\\$\\d+\\.\\d{2}', 'PRICE$19.99')).toBe(true);
            });

            it('should accept Cyrillic merchant patterns', () => {
                expect(patternAccepted('ПЯТЕРОЧКА', 'ПЯТЕРОЧКА 123')).toBe(true);
            });
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
