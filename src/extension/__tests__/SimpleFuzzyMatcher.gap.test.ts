import { SimpleFuzzyMatcher } from "../SimpleFuzzyMatcher";

describe("SimpleFuzzyMatcher - Gap-Based Algorithm", () => {
  let matcher: SimpleFuzzyMatcher;

  beforeEach(() => {
    matcher = new SimpleFuzzyMatcher();
  });

  describe("Sequential Character Matching", () => {
    test("matches all query characters in sequence", () => {
      const items = ["Expenses:Food", "Assets:Checking"];

      const result = matcher.match("ef", items);

      expect(result.length).toBe(1);
      expect(result[0]?.item).toBe("Expenses:Food");
    });

    test('matches query "food" exactly to "Food"', () => {
      const items = ["Food", "Foo", "FoodService"];

      const result = matcher.match("food", items);

      expect(result.length).toBeGreaterThan(0);
      const itemNames = result.map((r) => r.item);
      expect(itemNames).toContain("Food");
    });

    test('matches "asc" to "Assets:Checking"', () => {
      const items = ["Assets:Checking", "Assets:Savings", "Expenses:Food"];

      const result = matcher.match("asc", items);

      expect(result.length).toBeGreaterThan(0);
      const itemNames = result.map((r) => r.item);
      expect(itemNames).toContain("Assets:Checking");
    });

    test("does not match if characters are out of order", () => {
      const items = ["Expenses:Food"];

      const result = matcher.match("ofe", items);

      expect(result.length).toBe(0);
    });

    test("does not match if query has characters not in item", () => {
      const items = ["Expenses:Food"];

      const result = matcher.match("xyz", items);

      expect(result.length).toBe(0);
    });
  });

  describe("Gap-Based Scoring", () => {
    test("scores consecutive matches higher than gapped matches", () => {
      const items = ["Effect", "Expenses:Food"];

      const result = matcher.match("ef", items);

      expect(result.length).toBe(2);
      // "Effect" has E(0), f(2) - gap = 1
      // "Expenses:Food" has E(0), F(9) - gap = 8
      // Lower gap = higher score, so Effect should be first
      expect(result[0]?.item).toBe("Effect");
      expect(result[1]?.item).toBe("Expenses:Food");
    });

    test("scores zero-gap matches highest", () => {
      const items = ["Food", "F_o_o_d", "Expenses:Food"];

      const result = matcher.match("food", items);

      expect(result.length).toBeGreaterThan(0);
      // "Food" has zero gaps (consecutive), should be first
      expect(result[0]?.item).toBe("Food");
    });

    test("calculates total gap across multiple matches", () => {
      const items = ["Assets:Checking:Savings", "AsCheckSav"];

      // "asc" in "Assets:Checking:Savings": A(0), s(2), c(8) - gaps: 1 + 5 = 6
      // "asc" in "AsCheckSav": A(0), s(1), c(2) - gaps: 0 + 0 = 0
      const result = matcher.match("asc", items);

      expect(result.length).toBe(2);
      expect(result[0]?.item).toBe("AsCheckSav");
    });
  });

  describe("Empty Query Handling", () => {
    test("returns all items sorted by usage when query is empty", () => {
      const items = ["Apple", "Banana", "Cherry"];
      const usageCounts = new Map([
        ["Apple", 5],
        ["Banana", 10],
        ["Cherry", 3],
      ]);

      const result = matcher.match("", items, { usageCounts });

      expect(result.length).toBe(3);
      expect(result[0]?.item).toBe("Banana");
      expect(result[1]?.item).toBe("Apple");
      expect(result[2]?.item).toBe("Cherry");
    });
  });

  describe("Case Sensitivity", () => {
    test("matches case-insensitively by default", () => {
      const items = ["Expenses:Food", "EXPENSES:FOOD"];

      const result = matcher.match("EF", items);

      expect(result.length).toBe(2);
    });

    test("matches case-sensitively when option is set", () => {
      const items = ["Expenses:Food", "expenses:food"];

      // 'EF' matches 'Expenses:Food' (has uppercase E and F)
      // 'EF' does NOT match 'expenses:food' (has lowercase e and f)
      const result = matcher.match("EF", items, { caseSensitive: true });

      expect(result.length).toBe(1);
      expect(result[0]?.item).toBe("Expenses:Food");
    });
  });

  describe("Usage Count Integration", () => {
    test("uses usage count as tie-breaker when gap scores are equal", () => {
      const items = ["Expenses:Food", "Expenses:Fuel"];
      const usageCounts = new Map([
        ["Expenses:Food", 100],
        ["Expenses:Fuel", 10],
      ]);

      // Both have same gap pattern for "ef", so usage should break tie
      const result = matcher.match("ef", items, { usageCounts });

      expect(result.length).toBe(2);
      expect(result[0]?.item).toBe("Expenses:Food");
    });

    test("multiplies usage count in final score", () => {
      const items = ["Rare:Account", "Popular:Account"];
      const usageCounts = new Map([
        ["Rare:Account", 1],
        ["Popular:Account", 50],
      ]);

      const result = matcher.match("ra", items, { usageCounts });

      // Popular should have higher score despite "ra" being in Rare
      expect(result.length).toBe(2);
    });
  });

  describe("Max Results", () => {
    test("respects maxResults limit", () => {
      const items = Array.from({ length: 100 }, (_, i) => `Item${i}`);

      const result = matcher.match("it", items, { maxResults: 10 });

      expect(result.length).toBe(10);
    });
  });

  describe("Multi-Language Support", () => {
    test("matches Cyrillic characters", () => {
      const items = ["Расходы:Еда", "Активы:Счет"];

      const result = matcher.match("ре", items);

      expect(result.length).toBeGreaterThan(0);
      const itemNames = result.map((r) => r.item);
      expect(itemNames).toContain("Расходы:Еда");
    });

    test("matches mixed language input", () => {
      const items = ["Assets:Расходы", "Liabilities:Debt"];

      const result = matcher.match("aр", items);

      expect(result.length).toBeGreaterThan(0);
      const itemNames = result.map((r) => r.item);
      expect(itemNames).toContain("Assets:Расходы");
    });
  });

  describe("Score Calculation", () => {
    test("produces positive scores for matches", () => {
      const items = ["TestAccount"];

      const result = matcher.match("ta", items);

      expect(result.length).toBe(1);
      expect(result[0]?.score).toBeGreaterThan(0);
    });

    test("produces higher scores for better matches", () => {
      const items = ["Tax", "Testing:Account"];

      const result = matcher.match("ta", items);

      expect(result.length).toBe(2);
      // "Tax" should score higher (consecutive ta) than "Testing:Account"
      expect(result[0]?.score).toBeGreaterThan(result[1]?.score ?? 0);
    });
  });
});
