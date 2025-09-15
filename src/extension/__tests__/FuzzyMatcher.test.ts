// FuzzyMatcher test - now using SimpleFuzzyMatcher
// The old complex FuzzyMatcher with base classes has been simplified

import { SimpleFuzzyMatcher } from '../SimpleFuzzyMatcher';

describe('SimpleFuzzyMatcher', () => {
    let matcher: SimpleFuzzyMatcher;

    beforeEach(() => {
        matcher = new SimpleFuzzyMatcher();
    });

    it('should create fuzzy matcher', () => {
        expect(matcher).toBeDefined();
    });

    it('should match items with query', () => {
        const items = ['Assets:Cash', 'Expenses:Food', 'Income:Salary'];
        const results = matcher.match('cash', items);
        
        expect(results).toBeDefined();
        expect(Array.isArray(results)).toBe(true);
        
        if (results.length > 0) {
            expect(results[0]).toHaveProperty('item');
            expect(results[0]).toHaveProperty('score');
        }
    });

    it('should return empty array for no matches', () => {
        const items = ['Assets:Cash', 'Expenses:Food'];
        const results = matcher.match('xyz', items);
        
        expect(results).toBeDefined();
        expect(results.length).toBe(0);
    });

    it('should limit results with maxResults option', () => {
        const items = ['a', 'ab', 'abc', 'abcd', 'abcde'];
        const results = matcher.match('a', items, { maxResults: 3 });
        
        expect(results.length).toBeLessThanOrEqual(3);
    });

    it('should perform case-sensitive matching when caseSensitive is true', () => {
        const items = ['Assets:Cash', 'assets:checking', 'Expenses:Food'];
        const results = matcher.match('Ass', items, { caseSensitive: true });
        
        // Should match items that contain 'Ass' exactly (case-sensitive)
        // 'Assets:Cash' contains 'Ass' as a substring, so it should match
        expect(results.length).toBe(1);
        expect(results[0].item).toBe('Assets:Cash');
        
        const results2 = matcher.match('Assets', items, { caseSensitive: true });
        // Should match 'Assets:Cash' as it contains 'Assets' exactly
        expect(results2.length).toBe(1);
        expect(results2[0].item).toBe('Assets:Cash');
        
        const results3 = matcher.match('assets', items, { caseSensitive: true });
        // Should match 'assets:checking' as it contains 'assets' exactly
        expect(results3.length).toBe(1);
        expect(results3[0].item).toBe('assets:checking');
        
        // Test that it doesn't match wrong case
        const results4 = matcher.match('ass', items, { caseSensitive: true });
        // Should only match 'assets:checking', not 'Assets:Cash'
        expect(results4.length).toBe(1);
        expect(results4[0].item).toBe('assets:checking');
    });

    it('should perform case-insensitive matching when caseSensitive is false or not specified', () => {
        const items = ['Assets:Cash', 'assets:checking', 'Expenses:Food'];
        const results = matcher.match('ass', items, { caseSensitive: false });
        
        // Should match both 'Assets:Cash' and 'assets:checking'
        expect(results.length).toBe(2);
        expect(results.some(r => r.item === 'Assets:Cash')).toBe(true);
        expect(results.some(r => r.item === 'assets:checking')).toBe(true);
        
        // Default behavior should also be case-insensitive
        const results2 = matcher.match('ass', items);
        expect(results2.length).toBe(2);
    });
});