// Simple fuzzy matching implementation
import { CompletionScore, UsageCount, createCompletionScore } from './types';

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
     * Match query against items using simple substring filtering.
     * Enhanced with type safety and better performance.
     * 
     * @template T - String type extending base string, typically a branded type
     * @param query - Search query string
     * @param items - Readonly array of items to search through
     * @param options - Optional matching configuration with type constraints
     * @returns Array of FuzzyMatch results with up to maxResults (default 100)
     */
    match<T extends string>(query: string, items: readonly T[], options: FuzzyMatchOptions<T> = {}): FuzzyMatch<T>[] {
        const lowerQuery = query.toLowerCase();
        const maxResults = options.maxResults || 100;
        
        // Handle empty query
        if (!query) {
            return items.map(item => ({
                item,
                score: createCompletionScore(options.usageCounts?.get(item) || 0)
            })).sort((a, b) => b.score - a.score).slice(0, maxResults);
        }
        
        return items
            .filter(item => options.caseSensitive ? item.includes(query) : item.toLowerCase().includes(lowerQuery))
            .sort((a, b) => {
                // Enhanced sorting: exact match first, then prefix match, then usage
                const aLower = a.toLowerCase();
                const bLower = b.toLowerCase();
                const aExact = aLower === lowerQuery;
                const bExact = bLower === lowerQuery;
                const aStarts = aLower.startsWith(lowerQuery);
                const bStarts = bLower.startsWith(lowerQuery);
                
                // Exact matches first
                if (aExact && !bExact) return -1;
                if (!aExact && bExact) return 1;
                
                // Then prefix matches
                if (aStarts && !bStarts) return -1;
                if (!aStarts && bStarts) return 1;
                
                // Then by usage count if available
                if (options.usageCounts) {
                    const aUsage = options.usageCounts.get(a) || 0;
                    const bUsage = options.usageCounts.get(b) || 0;
                    if (aUsage !== bUsage) return bUsage - aUsage;
                }
                
                // Finally alphabetically
                return a.localeCompare(b);
            })
            .slice(0, maxResults)
            .map(item => ({
                item,
                score: this.calculateScore(item, lowerQuery, options)
            }));
    }
    
    /**
     * Calculate enhanced score with better type safety and performance.
     * 
     * @template T - String type extending base string, typically a branded type
     * @param item - Item to score
     * @param query - Normalized query string (lowercase)
     * @param options - Matching options with usage counts and bonuses
     * @returns Branded CompletionScore with validation
     */
    private calculateScore<T extends string>(item: T, query: string, options: FuzzyMatchOptions<T>): CompletionScore {
        let score = 0;
        const itemLower = item.toLowerCase();
        const queryLower = query.toLowerCase();
        
        // Exact match gets highest score
        if (itemLower === queryLower) {
            score += options.exactMatchBonus || 200;
        }
        // Prefix match gets high score
        else if (itemLower.startsWith(queryLower)) {
            score += options.prefixMatchBonus || 100;
        }
        // Substring match gets medium score
        else if (itemLower.includes(queryLower)) {
            score += 50;
        }
        
        // Add usage count bonus
        if (options.usageCounts) {
            const usageCount = options.usageCounts.get(item) || 0;
            score += usageCount * 5;
        }
        
        // Bonus for shorter items (more specific)
        score += Math.max(0, 100 - item.length);
        
        return createCompletionScore(Math.max(0, score));
    }
}