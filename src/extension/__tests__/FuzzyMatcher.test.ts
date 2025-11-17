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
            expect(results[0]!).toHaveProperty('item');
            expect(results[0]!).toHaveProperty('score');
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
        const items = ['Assets:Cash', 'assets:checking', 'Expenses:Food', 'Income:Assets:Investment'];
        const results = matcher.match('Ass', items, { caseSensitive: true });
        
        // Should match items that START with 'Ass' or contain ':Ass' (case-sensitive)
        // 'Assets:Cash' starts with 'Ass', so it should match
        // 'Income:Assets:Investment' contains ':Ass', so it should also match
        expect(results.length).toBe(2);
        expect(results.some(r => r.item === 'Assets:Cash')).toBe(true);
        expect(results.some(r => r.item === 'Income:Assets:Investment')).toBe(true);
        
        const results2 = matcher.match('Assets', items, { caseSensitive: true });
        // Should match items that START with 'Assets' or contain ':Assets' (case-sensitive)
        // 'Assets:Cash' starts with 'Assets', so it should match
        // 'Income:Assets:Investment' contains ':Assets', so it should also match
        expect(results2.length).toBe(2);
        expect(results2.some(r => r.item === 'Assets:Cash')).toBe(true);
        expect(results2.some(r => r.item === 'Income:Assets:Investment')).toBe(true);
        
        const results3 = matcher.match('assets', items, { caseSensitive: true });
        // Should match 'assets:checking' as it starts with 'assets' exactly
        expect(results3.length).toBe(1);
        expect(results3[0]!.item).toBe('assets:checking');
        
        // Test component matching
        const results4 = matcher.match('Cash', items, { caseSensitive: true });
        // Should match 'Assets:Cash' because it contains ':Cash'
        expect(results4.length).toBe(1);
        expect(results4[0]!.item).toBe('Assets:Cash');
        
        // Test that it doesn't match wrong case
        const results5 = matcher.match('ass', items, { caseSensitive: true });
        // Should only match items that START with 'ass' or contain ':ass' exactly
        // Only 'assets:checking' starts with 'ass', so should return 1 item
        expect(results5.length).toBe(1);
        expect(results5[0]!.item).toBe('assets:checking');
    });

    it('should perform case-insensitive matching when caseSensitive is false or not specified', () => {
        const items = ['Assets:Cash', 'assets:checking', 'Expenses:Food', 'Income:Assets:Investment'];
        const results = matcher.match('ass', items, { caseSensitive: false });
        
        // Should match items that START with 'ass' or contain ':ass' (case-insensitive)
        // 'Assets:Cash' matches (prefix 'ass' case-insensitive)
        // 'assets:checking' matches (prefix 'ass' case-insensitive)  
        // 'Income:Assets:Investment' matches (component ':ass' case-insensitive)
        expect(results.length).toBe(3);
        expect(results.some(r => r.item === 'Assets:Cash')).toBe(true);
        expect(results.some(r => r.item === 'assets:checking')).toBe(true);
        expect(results.some(r => r.item === 'Income:Assets:Investment')).toBe(true);
        
        // Default behavior should also be case-insensitive
        const results2 = matcher.match('ass', items);
        expect(results2.length).toBe(3);
        
        // Test component matching
        const results3 = matcher.match('cash', items);
        // Should match 'Assets:Cash' because it contains ':Cash' (case-insensitive)
        expect(results3.length).toBe(1);
        expect(results3[0]!.item).toBe('Assets:Cash');
        
        // Test with a more specific prefix
        const results4 = matcher.match('assets:', items);
        // Should match items that START with 'assets:' or contain ':assets:' (case-insensitive)
        // 'Assets:Cash' starts with 'assets:' (case-insensitive)
        // 'assets:checking' starts with 'assets:' (case-insensitive)
        // 'Income:Assets:Investment' contains ':assets:' (case-insensitive)
        expect(results4.length).toBe(3);
        expect(results4.some(r => r.item === 'Assets:Cash')).toBe(true);
        expect(results4.some(r => r.item === 'assets:checking')).toBe(true);
        expect(results4.some(r => r.item === 'Income:Assets:Investment')).toBe(true);
    });
});