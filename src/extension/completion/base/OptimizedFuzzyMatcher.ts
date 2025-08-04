/**
 * Optimized fuzzy matcher with pre-indexing and advanced algorithms
 * Provides significant performance improvements over the original O(n*m*k) implementation
 */

import { FuzzyMatch, FuzzyMatchOptions } from './FuzzyMatcher';

export interface OptimizedFuzzyMatchOptions extends FuzzyMatchOptions {
    /** Enable pre-indexing for better performance */
    enableIndexing?: boolean;
    /** Threshold for index rebuilding (default: 100) */
    indexRebuildThreshold?: number;
    /** Enable result caching */
    cacheResults?: boolean;
    /** Maximum cache size (default: 1000) */
    maxCacheSize?: number;
}

/** Internal interface for indexed items with pre-computed data */
export interface IndexedItem {
    readonly item: string;
    readonly lowerCase: string;
    readonly length: number;
    readonly charMap: ReadonlyMap<string, readonly number[]>;
    readonly wordBoundaries: readonly number[];
    readonly usage: number;
}

/** Internal interface for search results with match positions */
export interface SearchResult {
    readonly item: string;
    readonly score: number;
    readonly matches: readonly number[];
}

/** Interface that ensures compatibility with base FuzzyMatcher */
export interface IFuzzyMatcher {
    match(query: string, items: string[], options?: FuzzyMatchOptions): FuzzyMatch[];
}

/**
 * High-performance fuzzy matcher with indexing and caching
 * Implements both base interface and extended optimizations
 */
export class OptimizedFuzzyMatcher implements IFuzzyMatcher {
    private index: IndexedItem[] = [];
    private indexValid = false;
    private resultCache = new Map<string, FuzzyMatch[]>();
    private options: OptimizedFuzzyMatchOptions & {
        maxResults: number;
        enableIndexing: boolean;
        indexRebuildThreshold: number;
        cacheResults: boolean;
        maxCacheSize: number;
    };
    
    constructor(options: OptimizedFuzzyMatchOptions = {}) {
        this.options = {
            usageCounts: options.usageCounts,
            maxResults: 50,
            enableIndexing: true,
            indexRebuildThreshold: 100,
            cacheResults: true,
            maxCacheSize: 1000,
            ...options
        };
    }
    
    /**
     * Main matching method with automatic indexing
     */
    match(query: string, items: string[], options: OptimizedFuzzyMatchOptions = {}): FuzzyMatch[] {
        const mergedOptions = { ...this.options, ...options };
        
        if (!query) {
            return this.handleEmptyQuery(items, mergedOptions.usageCounts);
        }
        
        // Check cache first
        const cacheKey = this.getCacheKey(query, items, mergedOptions);
        if (mergedOptions.cacheResults && this.resultCache.has(cacheKey)) {
            return this.resultCache.get(cacheKey)!;
        }
        
        // Build or update index if needed
        if (mergedOptions.enableIndexing) {
            this.buildIndex(items, mergedOptions.usageCounts);
        }
        
        const results = mergedOptions.enableIndexing
            ? this.searchIndexed(query, mergedOptions)
            : this.searchLinear(query, items, mergedOptions);
        
        // Cache results
        if (mergedOptions.cacheResults) {
            if (this.resultCache.size >= mergedOptions.maxCacheSize) {
                // Simple LRU: clear half the cache
                const entries = Array.from(this.resultCache.entries());
                entries.slice(0, Math.floor(entries.length / 2)).forEach(([key]) => {
                    this.resultCache.delete(key);
                });
            }
            this.resultCache.set(cacheKey, results);
        }
        
        return results.slice(0, mergedOptions.maxResults);
    }
    
    /**
     * Build search index for items
     */
    private buildIndex(items: string[], usageCounts?: Map<string, number>): void {
        // Check if rebuild is needed
        if (this.indexValid && 
            this.index.length === items.length &&
            Math.abs(this.index.length - items.length) < this.options.indexRebuildThreshold) {
            return;
        }
        
        this.index = items.map(item => this.indexItem(item, usageCounts?.get(item) || 0));
        this.indexValid = true;
    }
    
    /**
     * Create index entry for a single item
     */
    private indexItem(item: string, usage: number): IndexedItem {
        const lowerCase = item.toLowerCase();
        const charMap = new Map<string, number[]>();
        const wordBoundaries: number[] = [];
        
        // Build character position map and word boundaries
        for (let i = 0; i < lowerCase.length; i++) {
            const char = lowerCase[i];
            
            if (!charMap.has(char)) {
                charMap.set(char, []);
            }
            charMap.get(char)!.push(i);
            
            // Mark word boundaries
            if (i === 0 || 
                lowerCase[i - 1] === ' ' || 
                lowerCase[i - 1] === '-' || 
                lowerCase[i - 1] === '_' ||
                lowerCase[i - 1] === ':') {
                wordBoundaries.push(i);
            }
        }
        
        return {
            item,
            lowerCase,
            length: item.length,
            charMap,
            wordBoundaries,
            usage
        };
    }
    
    /**
     * Search using pre-built index
     */
    private searchIndexed(query: string, options: OptimizedFuzzyMatchOptions): FuzzyMatch[] {
        const queryLower = query.toLowerCase();
        const results: SearchResult[] = [];
        
        // Early termination for impossible matches
        const queryChars = new Set(queryLower);
        
        for (const indexed of this.index) {
            // Quick character set check
            let hasAllChars = true;
            for (const char of queryChars) {
                if (!indexed.charMap.has(char)) {
                    hasAllChars = false;
                    break;
                }
            }
            
            if (!hasAllChars) {
                continue;
            }
            
            const result = this.scoreItem(queryLower, indexed);
            if (result) {
                results.push(result);
            }
        }
        
        // Sort by score (descending)
        results.sort((a, b) => b.score - a.score);
        
        return results.map(r => ({ item: r.item, score: r.score }));
    }
    
    /**
     * Score a single item against query using dynamic programming
     */
    private scoreItem(query: string, indexed: IndexedItem): SearchResult | null {
        const { lowerCase, charMap, wordBoundaries, usage } = indexed;
        
        // Try different matching strategies
        const prefixScore = this.scorePrefixMatch(query, indexed);
        if (prefixScore !== null) {
            return prefixScore;
        }
        
        const substringScore = this.scoreSubstringMatch(query, indexed);
        if (substringScore !== null) {
            return substringScore;
        }
        
        const fuzzyScore = this.scoreFuzzyMatch(query, indexed);
        return fuzzyScore;
    }
    
    /**
     * Score prefix match (highest priority)
     */
    private scorePrefixMatch(query: string, indexed: IndexedItem): SearchResult | null {
        if (indexed.lowerCase.startsWith(query)) {
            const score = 1000 + (1000 / indexed.length) + (indexed.usage * 10);
            return {
                item: indexed.item,
                score,
                matches: Array.from({ length: query.length }, (_, i) => i)
            };
        }
        return null;
    }
    
    /**
     * Score substring match (high priority)
     */
    private scoreSubstringMatch(query: string, indexed: IndexedItem): SearchResult | null {
        const index = indexed.lowerCase.indexOf(query);
        if (index >= 0) {
            let score = 800 + (500 / indexed.length) + (indexed.usage * 8);
            
            // Bonus for word boundary match
            if (indexed.wordBoundaries.includes(index)) {
                score += 200;
            }
            
            // Penalty for later position
            score -= index * 2;
            
            return {
                item: indexed.item,
                score,
                matches: Array.from({ length: query.length }, (_, i) => index + i)
            };
        }
        return null;
    }
    
    /**
     * Score fuzzy match using dynamic programming (optimized)
     */
    private scoreFuzzyMatch(query: string, indexed: IndexedItem): SearchResult | null {
        const { lowerCase, charMap, wordBoundaries, usage } = indexed;
        
        // Use dynamic programming for optimal fuzzy matching
        const dp = new Array(query.length + 1).fill(null).map(() => 
            new Array(lowerCase.length + 1).fill(-Infinity)
        );
        
        // Base case
        dp[0][0] = 0;
        for (let j = 1; j <= lowerCase.length; j++) {
            dp[0][j] = 0; // Can match empty query at any position
        }
        
        // Fill DP table
        for (let i = 1; i <= query.length; i++) {
            for (let j = 1; j <= lowerCase.length; j++) {
                // Option 1: Don't match current character
                dp[i][j] = dp[i][j - 1];
                
                // Option 2: Match current character
                if (query[i - 1] === lowerCase[j - 1]) {
                    let matchScore = dp[i - 1][j - 1] + 10;
                    
                    // Bonus for word boundary
                    if (wordBoundaries.includes(j - 1)) {
                        matchScore += 30;
                    }
                    
                    // Bonus for consecutive matches
                    if (i > 1 && j > 1 && query[i - 2] === lowerCase[j - 2]) {
                        matchScore += 20;
                    }
                    
                    dp[i][j] = Math.max(dp[i][j], matchScore);
                }
            }
        }
        
        const finalScore = dp[query.length][lowerCase.length];
        if (finalScore > 0) {
            // Add usage bonus
            const totalScore = finalScore + (usage * 5) - (indexed.length * 0.5);
            
            // Reconstruct matches (simplified)
            const matches = this.reconstructMatches(query, indexed);
            
            return {
                item: indexed.item,
                score: totalScore,
                matches
            };
        }
        
        return null;
    }
    
    /**
     * Reconstruct match positions (simplified greedy approach)
     */
    private reconstructMatches(query: string, indexed: IndexedItem): number[] {
        const matches: number[] = [];
        let queryIndex = 0;
        
        for (let i = 0; i < indexed.lowerCase.length && queryIndex < query.length; i++) {
            if (indexed.lowerCase[i] === query[queryIndex]) {
                matches.push(i);
                queryIndex++;
            }
        }
        
        return matches;
    }
    
    /**
     * Linear search fallback (optimized)
     */
    private searchLinear(query: string, items: string[], options: OptimizedFuzzyMatchOptions): FuzzyMatch[] {
        const queryLower = query.toLowerCase();
        const results: FuzzyMatch[] = [];
        
        for (const item of items) {
            const itemLower = item.toLowerCase();
            
            // Quick filters
            if (query.length > 1) {
                // Check if all query characters exist in item
                let hasAllChars = true;
                for (const char of queryLower) {
                    if (itemLower.indexOf(char) === -1) {
                        hasAllChars = false;
                        break;
                    }
                }
                if (!hasAllChars) continue;
            }
            
            const score = this.calculateLinearScore(queryLower, itemLower, options.usageCounts?.get(item) || 0);
            if (score > 0) {
                results.push({ item, score });
            }
        }
        
        return results.sort((a, b) => b.score - a.score);
    }
    
    /**
     * Calculate score for linear search
     */
    private calculateLinearScore(query: string, itemLower: string, usage: number): number {
        // Prefix match
        if (itemLower.startsWith(query)) {
            return 1000 + (1000 / itemLower.length) + (usage * 10);
        }
        
        // Substring match
        const index = itemLower.indexOf(query);
        if (index >= 0) {
            return 800 - (index * 2) + (500 / itemLower.length) + (usage * 8);
        }
        
        // Fuzzy match (simple)
        let score = 0;
        let queryIndex = 0;
        let consecutiveBonus = 0;
        
        for (let i = 0; i < itemLower.length && queryIndex < query.length; i++) {
            if (itemLower[i] === query[queryIndex]) {
                score += 10;
                
                if (queryIndex > 0 && i > 0 && itemLower[i-1] === query[queryIndex-1]) {
                    consecutiveBonus += 5;
                    score += consecutiveBonus;
                } else {
                    consecutiveBonus = 0;
                }
                
                // Word boundary bonus
                if (i === 0 || itemLower[i-1] === ' ' || itemLower[i-1] === '-' || itemLower[i-1] === '_') {
                    score += 30;
                }
                
                queryIndex++;
            }
        }
        
        if (queryIndex === query.length) {
            return score + (usage * 5) - itemLower.length;
        }
        
        return 0;
    }
    
    /**
     * Handle empty query
     */
    private handleEmptyQuery(items: string[], usageCounts?: Map<string, number>): FuzzyMatch[] {
        return items
            .map(item => ({
                item,
                score: usageCounts?.get(item) || 0
            }))
            .sort((a, b) => b.score - a.score);
    }
    
    /**
     * Generate cache key
     */
    private getCacheKey(query: string, items: string[], options: OptimizedFuzzyMatchOptions): string {
        const itemsHash = this.hashArray(items);
        const usageHash = options.usageCounts ? this.hashMap(options.usageCounts) : '';
        return `${query}:${itemsHash}:${usageHash}:${options.maxResults}`;
    }
    
    /**
     * Simple hash function for arrays
     */
    private hashArray(arr: string[]): string {
        let hash = 0;
        for (const str of arr) {
            for (let i = 0; i < str.length; i++) {
                hash = ((hash << 5) - hash + str.charCodeAt(i)) & 0xffffffff;
            }
        }
        return hash.toString(36);
    }
    
    /**
     * Simple hash function for maps
     */
    private hashMap(map: Map<string, number>): string {
        let hash = 0;
        for (const [key, value] of map) {
            for (let i = 0; i < key.length; i++) {
                hash = ((hash << 5) - hash + key.charCodeAt(i) + value) & 0xffffffff;
            }
        }
        return hash.toString(36);
    }
    
    /**
     * Clear internal caches
     */
    clearCache(): void {
        this.resultCache.clear();
        this.indexValid = false;
        this.index = [];
    }
    
    /**
     * Get cache statistics
     */
    getCacheStats(): { resultCacheSize: number; indexSize: number; indexValid: boolean } {
        return {
            resultCacheSize: this.resultCache.size,
            indexSize: this.index.length,
            indexValid: this.indexValid
        };
    }
    
    /**
     * Benchmark different matching strategies
     */
    benchmark(query: string, items: string[], iterations: number = 100): {
        linear: number;
        indexed: number;
        speedup: number;
    } {
        // Warmup
        this.match(query, items, { enableIndexing: false, cacheResults: false });
        this.match(query, items, { enableIndexing: true, cacheResults: false });
        
        // Benchmark linear search
        const linearStart = performance.now();
        for (let i = 0; i < iterations; i++) {
            this.match(query, items, { enableIndexing: false, cacheResults: false });
        }
        const linearTime = performance.now() - linearStart;
        
        // Clear index for fair comparison
        this.clearCache();
        
        // Benchmark indexed search
        const indexedStart = performance.now();
        for (let i = 0; i < iterations; i++) {
            this.match(query, items, { enableIndexing: true, cacheResults: false });
        }
        const indexedTime = performance.now() - indexedStart;
        
        return {
            linear: linearTime,
            indexed: indexedTime,
            speedup: linearTime / indexedTime
        };
    }
}