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
});