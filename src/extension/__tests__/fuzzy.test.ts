import { fuzzyMatch } from '../main';

describe('Fuzzy Matching', () => {
  const payees = [
    'Grocery Store',
    'Gas Station',
    'Amazon',
    'Google Play',
    "McDonald's",
    'Starbucks',
    'Target',
    'Walmart',
    'Apple Store',
    'Netflix',
  ];

  test('should match exact prefix', () => {
    const results = fuzzyMatch('Gro', payees);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.item).toBe('Grocery Store');
  });

  test('should match prefix (not substring)', () => {
    // SimpleFuzzyMatcher uses prefix matching, not substring matching
    const results = fuzzyMatch('Gas', payees);
    expect(results.length).toBeGreaterThan(0);
    // Should match "Gas Station" (starts with "Gas")
    const items = results.map((r) => r.item);
    expect(items).toContain('Gas Station');
  });

  test('should match exact prefix with partial match', () => {
    const results = fuzzyMatch('McD', payees);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.item).toBe("McDonald's");
  });

  test('should handle cyrillic characters', () => {
    const cyrillicPayees = ['Магазин', 'Магнит', 'Пятёрочка'];
    const results = fuzzyMatch('Маг', cyrillicPayees);
    expect(results.length).toBe(2);
    expect(results.map((r) => r.item)).toContain('Магазин');
    expect(results.map((r) => r.item)).toContain('Магнит');
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
    expect(results[0]!.item).toBe('Amazon'); // Should be first due to exact prefix match
  });

  test('should match prefix patterns', () => {
    const results = fuzzyMatch('Goog', payees);
    expect(results.length).toBeGreaterThan(0);
    // Should match "Google Play" (starts with "Goog")
    const items = results.map((r) => r.item);
    expect(items).toContain('Google Play');
  });

  test('should handle case insensitive matching', () => {
    const results = fuzzyMatch('amazon', payees);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.item).toBe('Amazon');
  });

  test('should support sequential character matching', () => {
    const results = fuzzyMatch('Mag', ['Grocery Store', 'Magazine', 'Amazing Store']);
    expect(results.length).toBeGreaterThan(0);
    const items = results.map((r) => r.item);
    expect(items).toContain('Magazine'); // "Mag" at start - best score
    expect(items).toContain('Amazing Store'); // "m-a-...-g" found sequentially
    // Magazine should rank higher (fewer gaps)
    expect(items[0]).toBe('Magazine');
  });

  test('should handle cyrillic sequential matching', () => {
    const cyrillicPayees = ['Магазин', 'Супермагазин', 'Мегамолл'];
    const results = fuzzyMatch('Маг', cyrillicPayees);
    expect(results.length).toBeGreaterThan(0);
    const items = results.map((r) => r.item);
    expect(items).toContain('Магазин'); // "Маг" at start - best score
    expect(items).toContain('Супермагазин'); // "м-а-г" found sequentially
    // Магазин should rank higher (fewer gaps)
    expect(items[0]).toBe('Магазин');
  });

  test('should prioritize exact matches over prefix matches', () => {
    const testItems = ['Amazing', 'Magazine', 'Amazonia'];
    const results = fuzzyMatch('Amazing', testItems);
    expect(results.length).toBeGreaterThan(0);
    // Exact matches should score higher than prefix matches
    expect(results[0]!.item).toBe('Amazing'); // Exact match
  });
});
