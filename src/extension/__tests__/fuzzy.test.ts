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

    test('should match substring (not fuzzy)', () => {
        // SimpleFuzzyMatcher uses substring matching, not fuzzy
        const results = fuzzyMatch('as', payees);
        expect(results.length).toBeGreaterThan(0);
        // Should match "Gas Station" (contains "as")
        const items = results.map(r => r.item);
        expect(items).toContain('Gas Station');
    });

    test('should match partial substring', () => {
        const results = fuzzyMatch('cDon', payees);
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
        expect(results.length).toBeGreaterThan(0);
        expect(results[0].item).toBe('Amazon'); // Should be first due to exact prefix match
    });

    test('should match substring patterns', () => {
        const results = fuzzyMatch('gle', payees);
        expect(results.length).toBeGreaterThan(0); 
        // Should match "Google Play" (contains "gle")
        const items = results.map(r => r.item);
        expect(items).toContain('Google Play');
    });

    test('should handle case insensitive matching', () => {
        const results = fuzzyMatch('amazon', payees);
        expect(results.length).toBeGreaterThan(0);
        expect(results[0].item).toBe('Amazon');
    });

    test('should support substring matching', () => {
        const results = fuzzyMatch('zin', ['Grocery Store', 'Magazine', 'Amazing Store']);
        expect(results.length).toBeGreaterThan(0);
        const items = results.map(r => r.item);
        expect(items).toContain('Magazine'); // Should match "ма**ga**zin**e"
        expect(items).toContain('Amazing Store'); // Should match "ama**zin**g"
    });

    test('should handle cyrillic substring matching', () => {
        const cyrillicPayees = ['Магазин', 'Супермагазин', 'Мегамолл'];
        const results = fuzzyMatch('зин', cyrillicPayees);
        expect(results.length).toBeGreaterThan(0);
        const items = results.map(r => r.item);
        expect(items).toContain('Магазин'); // Should match "мага**зин**"
        expect(items).toContain('Супермагазин'); // Should match "супермага**зин**"
    });

    test('should prioritize prefix matches over substring matches', () => {
        const testItems = ['Amazing', 'Magazine', 'Amazonia'];
        const results = fuzzyMatch('ama', testItems);
        expect(results.length).toBeGreaterThan(0);
        // Prefix matches should score higher than substring matches
        expect(results[0].item).toBe('Amazing'); // Starts with "ama"
    });
});