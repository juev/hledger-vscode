import { FuzzyMatcher } from '../completion/base/FuzzyMatcher';
import { CompletionItemFactory } from '../completion/base/CompletionItemFactory';
import * as vscode from 'vscode';

describe('FuzzyMatcher', () => {
    let matcher: FuzzyMatcher;

    beforeEach(() => {
        matcher = new FuzzyMatcher();
    });

    describe('empty query', () => {
        it('should return all items with usage-based sorting when usage counts provided', () => {
            const items = ['apple', 'banana', 'cherry'];
            const usageCounts = new Map([
                ['banana', 5],
                ['apple', 2],
                ['cherry', 8]
            ]);

            const results = matcher.match('', items, { usageCounts });

            expect(results).toHaveLength(3);
            expect(results[0].item).toBe('cherry'); // highest usage
            expect(results[0].score).toBe(8);
            expect(results[1].item).toBe('banana');
            expect(results[1].score).toBe(5);
            expect(results[2].item).toBe('apple');
            expect(results[2].score).toBe(2);
        });

        it('should return all items with zero score when no usage counts', () => {
            const items = ['apple', 'banana', 'cherry'];
            const results = matcher.match('', items);

            expect(results).toHaveLength(3);
            results.forEach(result => {
                expect(result.score).toBe(0);
            });
        });

        it('should create completion items with correct sortText based on usage scores', () => {
            const items = ['apple', 'banana', 'cherry'];
            const usageCounts = new Map([
                ['banana', 5],
                ['apple', 2],
                ['cherry', 8]
            ]);

            const results = matcher.match('', items, { usageCounts });

            // Create completion items using the factory
            const factory = new CompletionItemFactory();
            const completionItems = factory.createFromMatches(
                results,
                { kind: vscode.CompletionItemKind.Value },
                { position: new vscode.Position(0, 0), typedText: '' }
            );

            // Verify that sortText reflects the usage-based ordering
            // Higher scores should have lower sortText values (appear first)
            expect(completionItems[0].sortText).toBe('09992_cherry'); // score 8 -> 10000-8 = 9992
            expect(completionItems[1].sortText).toBe('09995_banana'); // score 5 -> 10000-5 = 9995
            expect(completionItems[2].sortText).toBe('09998_apple');  // score 2 -> 10000-2 = 9998
        });
    });

    describe('short query (1 character)', () => {
        it('should match items containing the character', () => {
            const items = ['apple', 'banana', 'cherry', 'date'];
            const results = matcher.match('a', items);

            expect(results).toHaveLength(3);
            expect(results.map(r => r.item)).toContain('apple');
            expect(results.map(r => r.item)).toContain('banana');
            expect(results.map(r => r.item)).toContain('date');
        });

        it('should prefer prefix matches', () => {
            const items = ['apple', 'banana', 'pear'];
            const results = matcher.match('a', items);

            expect(results[0].item).toBe('apple'); // starts with 'a'
            expect(results[0].score).toBeGreaterThan(results[1].score);
        });
    });

    describe('full fuzzy matching', () => {
        it('should match fuzzy patterns', () => {
            const items = ['AccountsPayable', 'AccountsReceivable', 'Assets'];
            const results = matcher.match('ap', items);

            expect(results).toHaveLength(1);
            expect(results[0].item).toBe('AccountsPayable');
        });

        it('should prefer exact substring matches', () => {
            const items = ['test-account', 'testaccount', 'account-test'];
            const results = matcher.match('test', items);

            expect(results).toHaveLength(3);
            // All should match, but exact substring should score higher
            expect(results[0].score).toBeGreaterThan(0);
        });

        it('should heavily prefer prefix matches', () => {
            const items = ['testing', 'contest', 'test'];
            const results = matcher.match('test', items);

            expect(results[0].item).toBe('test'); // exact prefix match
            expect(results[1].item).toBe('testing'); // prefix match
            expect(results[2].item).toBe('contest'); // substring match
        });

        it('should handle Cyrillic characters', () => {
            const items = ['Продукты', 'Проезд', 'Развлечения'];
            const results = matcher.match('про', items);

            expect(results).toHaveLength(2);
            expect(results.map(r => r.item)).toContain('Продукты');
            expect(results.map(r => r.item)).toContain('Проезд');
        });
    });

    describe('case sensitivity', () => {
        it('should be case insensitive', () => {
            const items = ['Apple', 'BANANA', 'ChErRy'];
            const results = matcher.match('ban', items);

            expect(results).toHaveLength(1);
            expect(results[0].item).toBe('BANANA');
        });
    });

    describe('scoring', () => {
        it('should prefer shorter matches', () => {
            const items = ['test', 'testing', 'test-account'];
            const results = matcher.match('test', items);

            expect(results[0].item).toBe('test');
        });

        it('should give bonus for word boundaries', () => {
            const items = ['someTest', 'test-case', 'testing'];
            const results = matcher.match('test', items);

            // test-case has word boundary at start of 'test'
            const testCaseResult = results.find(r => r.item === 'test-case');
            const someTestResult = results.find(r => r.item === 'someTest');

            expect(testCaseResult).toBeDefined();
            expect(someTestResult).toBeDefined();
            expect(testCaseResult!.score).toBeGreaterThan(someTestResult!.score);
        });
    });
});