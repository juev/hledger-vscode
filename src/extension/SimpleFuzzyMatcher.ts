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
     * Match query against items using simple prefix and component filtering.
     * Enhanced with type safety and better performance.
     * 
     * @template T - String type extending base string, typically a branded type
     * @param query - Search query string
     * @param items - Readonly array of items to search through
     * @param options - Optional matching configuration with type constraints
     * @returns Array of FuzzyMatch results with up to maxResults (default 100)
     */
    match<T extends string>(query: string, items: readonly T[], options: FuzzyMatchOptions<T> = {}): FuzzyMatch<T>[] {
        const lowerQuery = query.toLocaleLowerCase();
        const maxResults = options.maxResults || 100;
        const caseSensitive = options.caseSensitive || false;
        
        // Handle empty query
        if (!query) {
            return items.map(item => ({
                item,
                score: createCompletionScore(options.usageCounts?.get(item) || 0)
            })).sort((a, b) => b.score - a.score).slice(0, maxResults);
        }
        
        return items
            .filter(item => {
                if (caseSensitive) {
                    // For case-sensitive matching, check for prefix match or component match
                    return item.startsWith(query) || item.includes(':' + query);
                } else {
                    // For case-insensitive matching, check for prefix match or component match
                    const lowerItem = item.toLocaleLowerCase();
                    return lowerItem.startsWith(lowerQuery) || lowerItem.includes(':' + lowerQuery);
                }
            })
            .sort((a, b) => {
                // Enhanced sorting: exact match first, then prefix match, then component match, then usage
                let aExact, bExact, aStarts, bStarts, aComponent, bComponent;
                
                if (caseSensitive) {
                    aExact = a === query;
                    bExact = b === query;
                    aStarts = a.startsWith(query);
                    bStarts = b.startsWith(query);
                    aComponent = a.includes(':' + query);
                    bComponent = b.includes(':' + query);
                } else {
                    const aLower = a.toLocaleLowerCase();
                    const bLower = b.toLocaleLowerCase();
                    const queryLower = lowerQuery;
                    aExact = aLower === queryLower;
                    bExact = bLower === queryLower;
                    aStarts = aLower.startsWith(queryLower);
                    bStarts = bLower.startsWith(queryLower);
                    aComponent = aLower.includes(':' + queryLower);
                    bComponent = bLower.includes(':' + queryLower);
                }
                
                // Exact matches first
                if (aExact && !bExact) return -1;
                if (!aExact && bExact) return 1;
                
                // Then prefix matches
                if (aStarts && !bStarts) return -1;
                if (!aStarts && bStarts) return 1;
                
                // Then component matches (accounts where query appears after a colon)
                if (aComponent && !bComponent) return -1;
                if (!aComponent && bComponent) return 1;
                
                // Then by usage count if available
                if (options.usageCounts) {
                    const aUsage = options.usageCounts.get(a) || 0;
                    const bUsage = options.usageCounts.get(b) || 0;
                    if (aUsage !== bUsage) return bUsage - aUsage;
                }
                
                // Finally alphabetically with proper Unicode collation
                return a.localeCompare(b, undefined, { numeric: true, caseFirst: 'lower' });
            })
            .slice(0, maxResults)
            .map(item => ({
                item,
                score: this.calculateScore(item, query, options, caseSensitive)
            }));
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
    private calculateScore<T extends string>(item: T, query: string, options: FuzzyMatchOptions<T>, caseSensitive: boolean): CompletionScore {
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
            score += options.exactMatchBonus || 200;
        }
        // Prefix match gets high score
        else if (itemToCompare.startsWith(queryToCompare)) {
            score += options.prefixMatchBonus || 100;
        }
        // Component match (contains :query) gets medium score
        else if (itemToCompare.includes(':' + queryToCompare)) {
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