// Simple fuzzy matching implementation
import { CompletionScore, UsageCount, createCompletionScore } from "./types";

/**
 * Enhanced FuzzyMatch interface with branded types for type safety.
 * @template T - String type extending base string, typically a branded type
 */
export interface FuzzyMatch<T extends string = string> {
  readonly item: T;
  readonly score: CompletionScore;
}

/**
 * Enhanced FuzzyMatchOptions with generic type safety and constraints.
 * @template T - String type extending base string, typically a branded type
 */
export interface FuzzyMatchOptions<T extends string = string> {
  readonly usageCounts?: ReadonlyMap<T, UsageCount>;
  readonly maxResults?: number;
  readonly caseSensitive?: boolean;
  readonly exactMatchBonus?: number;
  readonly prefixMatchBonus?: number;
}

/**
 * Simple fuzzy matcher following REFACTORING.md Phase F specification.
 * Replaces OptimizedFuzzyMatcher and FuzzyMatcher with minimal substring matching.
 *
 * Features:
 * - Type-safe generic matching with branded types
 * - Usage-based scoring with frequency tracking
 * - Configurable scoring bonuses for exact/prefix matches
 * - Memory-efficient implementation with early termination
 */
export class SimpleFuzzyMatcher {
  /**
   * Match query against items using prefix, component, and abbreviation matching.
   * Enhanced with type safety and better performance.
   *
   * Abbreviation matching matches first letters of components (e.g., "ef" matches "Expenses:Food").
   * Priority: exact > prefix > component > abbreviation > usage count
   *
   * @template T - String type extending base string, typically a branded type
   * @param query - Search query string
   * @param items - Readonly array of items to search through
   * @param options - Optional matching configuration with type constraints
   * @returns Array of FuzzyMatch results with up to maxResults (default 100)
   */
  match<T extends string>(
    query: string,
    items: readonly T[],
    options: FuzzyMatchOptions<T> = {},
  ): FuzzyMatch<T>[] {
    const lowerQuery = query.toLocaleLowerCase();
    const maxResults = options.maxResults ?? 100;
    const caseSensitive = options.caseSensitive ?? false;

    // Handle empty query
    if (!query) {
      return items
        .map((item) => ({
          item,
          score: createCompletionScore(options.usageCounts?.get(item) ?? 0),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, maxResults);
    }

    return items
      .filter((item) => {
        const itemToCheck = caseSensitive ? item : item.toLocaleLowerCase();
        const queryToCheck = caseSensitive ? query : lowerQuery;

        // Exact match
        if (itemToCheck === queryToCheck) return true;
        // Prefix match
        if (itemToCheck.startsWith(queryToCheck)) return true;
        // Component match (":query")
        if (itemToCheck.includes(":" + queryToCheck)) return true;
        // Abbreviation match (first letters of components)
        if (this.matchesAbbreviation(itemToCheck, queryToCheck)) return true;

        return false;
      })
      .sort((a, b) => {
        const aLower = caseSensitive ? a : a.toLocaleLowerCase();
        const bLower = caseSensitive ? b : b.toLocaleLowerCase();
        const queryToCheck = caseSensitive ? query : lowerQuery;

        // Exact matches first
        const aExact = aLower === queryToCheck;
        const bExact = bLower === queryToCheck;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;

        // Then prefix matches
        const aStarts = aLower.startsWith(queryToCheck);
        const bStarts = bLower.startsWith(queryToCheck);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;

        // Then component matches (accounts where query appears after a colon)
        const aComponent = aLower.includes(":" + queryToCheck);
        const bComponent = bLower.includes(":" + queryToCheck);
        if (aComponent && !bComponent) return -1;
        if (!aComponent && bComponent) return 1;

        // Then abbreviation matches
        const aAbbr = this.matchesAbbreviation(aLower, queryToCheck);
        const bAbbr = this.matchesAbbreviation(bLower, queryToCheck);
        if (aAbbr && !bAbbr) return -1;
        if (!aAbbr && bAbbr) return 1;

        // For abbreviation matches, prefer items with more components (more specific)
        if (aAbbr && bAbbr) {
          const aComponentCount = aLower.split(":").length;
          const bComponentCount = bLower.split(":").length;
          if (aComponentCount !== bComponentCount)
            return bComponentCount - aComponentCount;
        }

        // Then by usage count if available
        if (options.usageCounts) {
          const aUsage = options.usageCounts.get(a) ?? 0;
          const bUsage = options.usageCounts.get(b) ?? 0;
          if (aUsage !== bUsage) return bUsage - aUsage;
        }

        // Finally alphabetically with proper Unicode collation
        return a.localeCompare(b, undefined, {
          numeric: true,
          caseFirst: "lower",
        });
      })
      .slice(0, maxResults)
      .map((item) => ({
        item,
        score: this.calculateScore(item, query, options, caseSensitive),
      }));
  }

  /**
   * Check if query matches as abbreviation of item components.
   * Abbreviation matching only applies to hierarchical items with colons (like accounts).
   * For items without colons, abbreviation matching is not used.
   *
   * Examples (all case-insensitive):
   * - "ef" matches "expenses:food" (E, F from each component)
   * - "asc" matches "assets:checking" (A from assets, S and C from checking)
   * - "exfo" matches "expenses:food" (E, X from exPense + F + O skips "d")
   *
   * @param item - Item text (should be lowercased if case-insensitive matching)
   * @param query - Query text (should be lowercased if case-insensitive matching)
   * @returns true if query matches as abbreviation
   */
  private matchesAbbreviation(item: string, query: string): boolean {
    if (!query || !item) return false;

    // Only apply abbreviation matching to hierarchical items with colons
    if (!item.includes(":")) {
      return false;
    }

    // Split by colon to get components
    const components = item.split(":");

    let queryIndex = 0;

    for (const component of components) {
      if (queryIndex >= query.length) {
        return true;
      }

      // Try to match query characters within this component
      for (let i = 0; i < component.length && queryIndex < query.length; i++) {
        if (component[i] === query[queryIndex]) {
          queryIndex++;
        }
      }
    }

    return queryIndex === query.length;
  }

  /**
   * Calculate enhanced score with better type safety and performance.
   *
   * @template T - String type extending base string, typically a branded type
   * @param item - Item to score
   * @param query - Query string (preserved case)
   * @param options - Matching options with usage counts and bonuses
   * @param caseSensitive - Whether to perform case-sensitive matching
   * @returns Branded CompletionScore with validation
   */
  private calculateScore<T extends string>(
    item: T,
    query: string,
    options: FuzzyMatchOptions<T>,
    caseSensitive: boolean,
  ): CompletionScore {
    let score = 0;
    let itemToCompare, queryToCompare;

    if (caseSensitive) {
      itemToCompare = item;
      queryToCompare = query;
    } else {
      itemToCompare = item.toLocaleLowerCase();
      queryToCompare = query.toLocaleLowerCase();
    }

    // Exact match gets highest score
    if (itemToCompare === queryToCompare) {
      score += options.exactMatchBonus ?? 200;
    }
    // Prefix match gets high score
    else if (itemToCompare.startsWith(queryToCompare)) {
      score += options.prefixMatchBonus ?? 100;
    }
    // Component match (contains :query) gets medium score
    else if (itemToCompare.includes(":" + queryToCompare)) {
      score += 50;
    }
    // Abbreviation match gets lower score
    else if (this.matchesAbbreviation(itemToCompare, queryToCompare)) {
      score += 25;
    }

    // Add usage count bonus - higher multiplier to prioritize frequency over length
    if (options.usageCounts) {
      const usageCount = options.usageCounts.get(item) ?? 0;
      score += usageCount * 20;
    }

    // Small bonus for shorter items (tie-breaker only, max 50 points)
    score += Math.max(0, Math.min(50, 50 - item.length / 2));

    return createCompletionScore(Math.max(0, score));
  }
}
