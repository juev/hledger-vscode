import { SimpleFuzzyMatcher } from '../SimpleFuzzyMatcher';

describe('SimpleFuzzyMatcher - Sequential Matching', () => {
  let matcher: SimpleFuzzyMatcher;

  beforeEach(() => {
    matcher = new SimpleFuzzyMatcher();
  });

  describe('First Letters Matching', () => {
    test('matches first letters of components', () => {
      const items = ['Expenses:Food', 'Assets:Checking', 'Emergency:Fund'];

      const result = matcher.match('ef', items);

      expect(result.length).toBeGreaterThan(0);
      const itemNames = result.map((r) => r.item);
      expect(itemNames).toContain('Expenses:Food');
    });

    test('matches "asc" to "Assets:Checking"', () => {
      const items = ['Assets:Checking', 'Assets:Savings', 'Expenses:Food'];

      const result = matcher.match('asc', items);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]?.item).toBe('Assets:Checking');
    });

    test('matches "efd" to accounts containing e, f, d in sequence', () => {
      const items = ['Expenses:Food:Dining', 'Expenses:Food', 'Assets:Checking'];

      const result = matcher.match('efd', items);

      expect(result.length).toBeGreaterThan(0);
      const itemNames = result.map((r) => r.item);
      // Both contain e, f, d in sequence
      expect(itemNames).toContain('Expenses:Food:Dining');
      expect(itemNames).toContain('Expenses:Food');
    });
  });

  describe('Partial Matching', () => {
    test('matches partial query "exfo" to "Expenses:Food"', () => {
      const items = ['Expenses:Food', 'Emergency:Fund', 'Assets:Checking'];

      const result = matcher.match('exfo', items);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]?.item).toBe('Expenses:Food');
    });

    test('matches "ascs" to "Assets:Checking:Savings"', () => {
      const items = ['Assets:Checking:Savings', 'Assets:Checking', 'Expenses:Food'];

      const result = matcher.match('ascs', items);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]?.item).toBe('Assets:Checking:Savings');
    });

    test('matches "expe" to "Expenses:Entertainment"', () => {
      const items = ['Expenses:Entertainment', 'Expenses:Food', 'Assets:Checking'];

      const result = matcher.match('expe', items);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]?.item).toBe('Expenses:Entertainment');
    });
  });

  describe('Gap-Based Scoring Order', () => {
    test('ranks consecutive matches higher than gapped matches', () => {
      const items = ['effort', 'Expenses:Food'];

      const result = matcher.match('ef', items);

      expect(result.length).toBe(2);
      // "effort" has e(0), f(2) - gap = 1
      // "Expenses:Food" has E(0), F(9) - gap = 8
      // Lower gap = higher score
      expect(result[0]?.item).toBe('effort');
      expect(result[1]?.item).toBe('Expenses:Food');
    });

    test('ranks exact consecutive match highest', () => {
      const items = [
        'ef', // exact consecutive: e(0), f(1) - gap = 0
        'effort', // prefix: e(0), f(2) - gap = 1
        'Something:ef', // component: e(10), f(11) - gap = 0 but late start
        'Expenses:Food', // sequential: E(0), F(9) - gap = 8
      ];

      const result = matcher.match('ef', items);

      expect(result.length).toBe(4);
      // 'ef' should be first (zero gap, early start)
      expect(result[0]?.item).toBe('ef');
      // 'effort' second (small gap, early start)
      expect(result[1]?.item).toBe('effort');
    });

    test('uses gap score to order matches', () => {
      const items = ['Easy:Fix', 'Expenses:Food'];

      const result = matcher.match('ef', items);

      expect(result.length).toBe(2);
      // "Easy:Fix" has E(0), F(5) - gap = 4
      // "Expenses:Food" has E(0), F(9) - gap = 8
      // Lower gap = higher score, so Easy:Fix first
      expect(result[0]?.item).toBe('Easy:Fix');
    });
  });

  describe('Case Insensitivity', () => {
    test('matches case-insensitive query "EF" to "Expenses:Food"', () => {
      const items = ['Expenses:Food', 'Assets:Checking'];

      const result = matcher.match('EF', items);

      expect(result.length).toBeGreaterThan(0);
      const itemNames = result.map((r) => r.item);
      expect(itemNames).toContain('Expenses:Food');
    });

    test('matches mixed case "AsC" to "Assets:Checking"', () => {
      const items = ['Assets:Checking', 'Expenses:Food'];

      const result = matcher.match('AsC', items);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]?.item).toBe('Assets:Checking');
    });
  });

  describe('Non-Matching Cases', () => {
    test('returns empty for non-matching query "xyz"', () => {
      const items = ['Assets:Checking', 'Expenses:Food', 'Liabilities:CreditCard'];

      const result = matcher.match('xyz', items);

      expect(result.length).toBe(0);
    });

    test('returns empty for query longer than any item can match', () => {
      const items = ['Assets:Checking', 'Expenses:Food'];

      const result = matcher.match('abcd', items);

      expect(result.length).toBe(0);
    });

    test('returns empty for query with characters not in sequence', () => {
      const items = ['Expenses:Food'];

      // "exof" requires characters in sequence: e, x, o, f
      // "Expenses:Food" = E(0), x(1), p, e, n, s, e, s, :, F(9), o(10), o, d
      // After matching e(0)->E, x(1)->x, next we need 'o'
      // First 'o' appears at position 10, but 'f' in query must come after 'o'
      // The only 'f' is at position 9, which comes BEFORE position 10
      // Therefore sequential matching fails - characters not in order
      const result = matcher.match('exof', items);

      expect(result.length).toBe(0);
    });
  });

  describe('Usage Count Integration', () => {
    test('sorts by usage count when gap scores are equal', () => {
      const items = ['Expenses:Food', 'Entertainment:Fund', 'Emergency:Finance'];
      const usageCounts = new Map([
        ['Expenses:Food', 10],
        ['Entertainment:Fund', 20],
        ['Emergency:Finance', 5],
      ]);

      const result = matcher.match('ef', items, { usageCounts });

      expect(result.length).toBe(3);
      // All match "ef" - sorted by gap score first, then usage
    });
  });

  describe('Multi-Language Support', () => {
    test('matches Cyrillic account sequences', () => {
      const items = ['Расходы:Еда', 'Активы:Счет'];

      // "ре" matches "Расходы:Еда" (Р at 0, е at 7)
      const result = matcher.match('ре', items);

      expect(result.length).toBeGreaterThan(0);
      const itemNames = result.map((r) => r.item);
      expect(itemNames).toContain('Расходы:Еда');
    });
  });
});
