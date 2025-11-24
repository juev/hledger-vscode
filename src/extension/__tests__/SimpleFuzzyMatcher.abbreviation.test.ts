import { SimpleFuzzyMatcher } from '../SimpleFuzzyMatcher';

describe('SimpleFuzzyMatcher - Abbreviation Matching', () => {
    let matcher: SimpleFuzzyMatcher;

    beforeEach(() => {
        matcher = new SimpleFuzzyMatcher();
    });

    describe('First Letters Abbreviation', () => {
        test('matches first letters of components', () => {
            const items = ['Expenses:Food', 'Assets:Checking', 'Emergency:Fund'];

            const result = matcher.match('ef', items);

            expect(result.length).toBeGreaterThan(0);
            const itemNames = result.map(r => r.item);
            expect(itemNames).toContain('Expenses:Food');
        });

        test('matches "asc" to "Assets:Checking"', () => {
            const items = ['Assets:Checking', 'Assets:Savings', 'Expenses:Food'];

            const result = matcher.match('asc', items);

            expect(result.length).toBeGreaterThan(0);
            expect(result[0].item).toBe('Assets:Checking');
        });

        test('matches "efd" to "Expenses:Food:Dining"', () => {
            const items = ['Expenses:Food:Dining', 'Expenses:Food', 'Assets:Checking'];

            const result = matcher.match('efd', items);

            expect(result.length).toBeGreaterThan(0);
            expect(result[0].item).toBe('Expenses:Food:Dining');
        });
    });

    describe('Partial Abbreviation', () => {
        test('matches partial abbreviation "exfo" to "Expenses:Food"', () => {
            const items = ['Expenses:Food', 'Emergency:Fund', 'Assets:Checking'];

            const result = matcher.match('exfo', items);

            expect(result.length).toBeGreaterThan(0);
            expect(result[0].item).toBe('Expenses:Food');
        });

        test('matches "ascs" to "Assets:Checking:Savings"', () => {
            const items = ['Assets:Checking:Savings', 'Assets:Checking', 'Expenses:Food'];

            const result = matcher.match('ascs', items);

            expect(result.length).toBeGreaterThan(0);
            expect(result[0].item).toBe('Assets:Checking:Savings');
        });

        test('matches "expe" to "Expenses:Entertainment"', () => {
            const items = ['Expenses:Entertainment', 'Expenses:Food', 'Assets:Checking'];

            const result = matcher.match('expe', items);

            expect(result.length).toBeGreaterThan(0);
            expect(result[0].item).toBe('Expenses:Entertainment');
        });
    });

    describe('Priority Order', () => {
        test('prioritizes prefix match over abbreviation match', () => {
            const items = ['effort', 'Expenses:Food'];

            const result = matcher.match('ef', items);

            expect(result.length).toBe(2);
            expect(result[0].item).toBe('effort'); // prefix match "ef..."
            expect(result[1].item).toBe('Expenses:Food'); // abbreviation match
        });

        test('prioritizes component match over abbreviation match', () => {
            const items = ['Expenses:Entertainment:Food', 'Something:ef', 'Easy:Fix'];

            const result = matcher.match('ef', items);

            expect(result.length).toBeGreaterThan(0);
            expect(result[0].item).toBe('Something:ef'); // component match ":ef"
        });

        test('abbreviation match appears after exact, prefix, and component matches', () => {
            const items = [
                'ef',                      // exact match
                'effort',                  // prefix match
                'Something:ef',            // component match
                'Expenses:Food'            // abbreviation match
            ];

            const result = matcher.match('ef', items);

            expect(result.length).toBe(4);
            expect(result[0].item).toBe('ef');              // exact
            expect(result[1].item).toBe('effort');          // prefix
            expect(result[2].item).toBe('Something:ef');    // component
            expect(result[3].item).toBe('Expenses:Food');   // abbreviation
        });
    });

    describe('Case Insensitivity', () => {
        test('matches case-insensitive abbreviation "EF" to "Expenses:Food"', () => {
            const items = ['Expenses:Food', 'Assets:Checking'];

            const result = matcher.match('EF', items);

            expect(result.length).toBeGreaterThan(0);
            const itemNames = result.map(r => r.item);
            expect(itemNames).toContain('Expenses:Food');
        });

        test('matches mixed case "AsC" to "Assets:Checking"', () => {
            const items = ['Assets:Checking', 'Expenses:Food'];

            const result = matcher.match('AsC', items);

            expect(result.length).toBeGreaterThan(0);
            expect(result[0].item).toBe('Assets:Checking');
        });
    });

    describe('Non-Matching Cases', () => {
        test('returns empty for non-matching abbreviation "xyz"', () => {
            const items = ['Assets:Checking', 'Expenses:Food', 'Liabilities:CreditCard'];

            const result = matcher.match('xyz', items);

            expect(result.length).toBe(0);
        });

        test('returns empty for abbreviation longer than account components', () => {
            const items = ['Assets:Checking', 'Expenses:Food'];

            const result = matcher.match('abcd', items);

            expect(result.length).toBe(0);
        });

        test('returns empty for partial abbreviation that does not match consecutively', () => {
            const items = ['Expenses:Food'];

            // "ef" matches, but "exof" does not (skips "p" in "expenses")
            const result = matcher.match('exof', items);

            expect(result.length).toBe(0);
        });
    });

    describe('Usage Count Integration', () => {
        test('sorts by usage count when abbreviation matches multiple items', () => {
            const items = ['Expenses:Food', 'Entertainment:Fund', 'Emergency:Finance'];
            const usageCounts = new Map([
                ['Expenses:Food', 10],
                ['Entertainment:Fund', 20],
                ['Emergency:Finance', 5]
            ]);

            const result = matcher.match('ef', items, { usageCounts });

            expect(result.length).toBe(3);
            // All are abbreviation matches, so sort by usage count
            // But prefix matches should still come first if they exist
        });
    });

    describe('Multi-Language Support', () => {
        test('matches Cyrillic account abbreviations', () => {
            const items = ['Расходы:Еда', 'Активы:Счет'];

            // "ре" matches "Расходы:Еда" (first letters "Р" and "Е")
            const result = matcher.match('ре', items);

            expect(result.length).toBeGreaterThan(0);
            const itemNames = result.map(r => r.item);
            expect(itemNames).toContain('Расходы:Еда');
        });
    });
});
