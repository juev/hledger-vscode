// Simple fuzzy matching implementation using fzf-style gap-based algorithm
import { CompletionScore, UsageCount, createCompletionScore } from './types';

/**
 * FuzzyMatch result with branded types for type safety.
 * @template T - String type extending base string, typically a branded type
 */
export interface FuzzyMatch<T extends string = string> {
  readonly item: T;
  readonly score: CompletionScore;
}

/**
 * FuzzyMatchOptions with generic type safety.
 * @template T - String type extending base string, typically a branded type
 */
export interface FuzzyMatchOptions<T extends string = string> {
  readonly usageCounts?: ReadonlyMap<T, UsageCount>;
  readonly maxResults?: number;
  readonly caseSensitive?: boolean;
}

/**
 * Result of gap-based fuzzy scoring.
 */
interface GapScoreResult {
  readonly matches: boolean;
  readonly score: number;
}

/**
 * Simple fuzzy matcher using fzf-style gap-based scoring.
 *
 * Algorithm: Sequential character matching with gap penalty.
 * - Characters must appear in order in the item
 * - Fewer gaps between matched characters = higher score
 * - Early start position gives bonus points
 */
export class SimpleFuzzyMatcher {
  /**
   * Match query against items using sequential character matching with gap penalty.
   *
   * @template T - String type extending base string, typically a branded type
   * @param query - Search query string
   * @param items - Readonly array of items to search through
   * @param options - Optional matching configuration
   * @returns Array of FuzzyMatch results with up to maxResults (default 100)
   */
  match<T extends string>(
    query: string,
    items: readonly T[],
    options: FuzzyMatchOptions<T> = {}
  ): FuzzyMatch<T>[] {
    const maxResults = options.maxResults ?? 100;
    const caseSensitive = options.caseSensitive ?? false;

    const lowerQuery = caseSensitive ? query : query.toLocaleLowerCase();

    // Empty query: return all items sorted by usage
    if (!lowerQuery) {
      return items
        .map((item) => ({
          item,
          score: createCompletionScore(options.usageCounts?.get(item) ?? 0),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, maxResults);
    }

    // Match and collect results with gap scores
    const matches: Array<{ item: T; gapScore: number }> = [];

    for (const item of items) {
      const itemToMatch = caseSensitive ? item : item.toLocaleLowerCase();
      const result = this.fuzzyScore(lowerQuery, itemToMatch);

      if (result.matches) {
        matches.push({ item, gapScore: result.score });
      }
    }

    // Sort by usage, then gap score, then alphabetically
    return matches
      .sort((a, b) => {
        // Higher usage count first
        const aUsage = options.usageCounts?.get(a.item) ?? 0;
        const bUsage = options.usageCounts?.get(b.item) ?? 0;
        if (aUsage !== bUsage) {
          return bUsage - aUsage;
        }

        // Then by gap score (higher = fewer gaps = better match)
        if (a.gapScore !== b.gapScore) {
          return b.gapScore - a.gapScore;
        }

        // Then alphabetically
        return a.item.localeCompare(b.item);
      })
      .slice(0, maxResults)
      .map(({ item, gapScore }) => ({
        item,
        score: this.calculateFinalScore(gapScore, options.usageCounts?.get(item) ?? 0),
      }));
  }

  /**
   * Calculate gap-based fuzzy score.
   *
   * Matches query characters sequentially in item, calculating total gaps.
   * Score = 1000 - totalGap + startBonus
   *
   * @param query - Query string (already case-normalized)
   * @param item - Item string (already case-normalized)
   * @returns Match result with score (higher is better)
   */
  private fuzzyScore(query: string, item: string): GapScoreResult {
    let queryIdx = 0;
    let totalGap = 0;
    let lastMatchPos = -1;
    let firstMatchPos = -1;

    for (let i = 0; i < item.length && queryIdx < query.length; i++) {
      if (item[i] === query[queryIdx]) {
        if (firstMatchPos === -1) {
          firstMatchPos = i;
        }
        if (lastMatchPos >= 0) {
          totalGap += i - lastMatchPos - 1;
        }
        lastMatchPos = i;
        queryIdx++;
      }
    }

    // Not all query characters found
    if (queryIdx < query.length) {
      return { matches: false, score: 0 };
    }

    // Early start bonus: matches starting at position 0-9 get bonus points
    const startBonus = Math.max(0, 10 - firstMatchPos);

    // Score: base - gap penalty + start bonus (floor at 0 for very long gaps)
    const score = Math.max(0, 1000 - totalGap + startBonus);

    return { matches: true, score };
  }

  /**
   * Calculate final score combining gap score and usage count.
   *
   * @param gapScore - Gap-based match score
   * @param usageCount - Usage frequency count
   * @returns Branded CompletionScore
   */
  private calculateFinalScore(gapScore: number, usageCount: number): CompletionScore {
    // Usage multiplier of 20 ensures frequency has significant impact
    // Cap at 9999 to prevent overflow in sortText (see AccountCompleter.getSortText)
    const rawScore = gapScore + usageCount * 20;
    return createCompletionScore(Math.min(rawScore, 9999));
  }
}
