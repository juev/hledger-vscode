import { fuzzyMatch } from '../main';

describe('Fuzzy Matching', () => {
    const payees = [
        'Grocery Store',
        'Gas Station',
        'Amazon',
        'Google Play',
        'McDonald\'s',
        'Starbucks',
        'Target',
        'Walmart',
        'Apple Store',
        'Netflix'
    ];

    test('should match exact prefix', () => {
        const results = fuzzyMatch('Gro', payees);
        expect(results.length).toBeGreaterThan(0);
        expect(results[0].item).toBe('Grocery Store');
    });

    test('should match fuzzy characters in order', () => {
        const results = fuzzyMatch('GS', payees);
        expect(results.length).toBeGreaterThan(0);
        // Should match "Gas Station" and "Grocery Store"
        const items = results.map(r => r.item);
        expect(items).toContain('Gas Station');
        expect(items).toContain('Grocery Store');
    });

    test('should match partial fuzzy', () => {
        const results = fuzzyMatch('McD', payees);
        expect(results.length).toBeGreaterThan(0);
        expect(results[0].item).toBe('McDonald\'s');
    });

    test('should handle cyrillic characters', () => {
        const cyrillicPayees = ['Магазин', 'Магнит', 'Пятёрочка'];
        const results = fuzzyMatch('Маг', cyrillicPayees);
        expect(results.length).toBe(2);
        expect(results.map(r => r.item)).toContain('Магазин');
        expect(results.map(r => r.item)).toContain('Магнит');
    });

    test('should return empty array for no matches', () => {
        const results = fuzzyMatch('xyz', payees);
        expect(results.length).toBe(0);
    });

    test('should return all items for empty query', () => {
        const results = fuzzyMatch('', payees);
        expect(results.length).toBe(payees.length);
    });

    test('should score exact prefix matches higher', () => {
        const results = fuzzyMatch('A', payees);
        expect(results[0].item).toBe('Amazon'); // Should be first due to exact prefix match
    });

    test('should maintain character order requirement', () => {
        const results = fuzzyMatch('ePl', payees);
        expect(results.length).toBeGreaterThan(0); // 'e', 'P', 'l' can appear in order in multiple items
        // Both "Google Play" and "Apple Store" could match 'ePl'
        const items = results.map(r => r.item);
        expect(items).toContain('Google Play'); // o-g-le Play -> e-P-l (Google has e, Play starts with P, has l)
    });

    test('should handle case insensitive matching', () => {
        const results = fuzzyMatch('amazon', payees);
        expect(results.length).toBeGreaterThan(0);
        expect(results[0].item).toBe('Amazon');
    });
});