import * as vscode from 'vscode';

export interface FuzzyMatch {
    item: string;
    score: number;
}

export interface FuzzyMatchOptions {
    usageCounts?: Map<string, number>;
    maxResults?: number;
}

/**
 * Centralized fuzzy matching implementation for all completion providers
 */
export class FuzzyMatcher {
    /**
     * Performs fuzzy matching on a list of items
     * @param query - The search query
     * @param items - Array of items to match against
     * @param options - Optional matching configuration
     * @returns Array of matches sorted by score
     */
    match(query: string, items: string[], options: FuzzyMatchOptions = {}): FuzzyMatch[] {
        if (!query) {
            return this.handleEmptyQuery(items, options.usageCounts);
        }
        
        const queryLower = query.toLowerCase();
        
        if (query.length <= 1) {
            return this.handleShortQuery(queryLower, items);
        }
        
        return this.handleFullQuery(queryLower, items);
    }
    
    /**
     * Handles empty queries by returning items sorted by usage frequency
     */
    private handleEmptyQuery(items: string[], usageCounts?: Map<string, number>): FuzzyMatch[] {
        return items.map(item => ({
            item,
            score: usageCounts?.get(item) || 0
        })).sort((a, b) => b.score - a.score);
    }
    
    /**
     * Handles short queries (1 character) with simple substring matching
     */
    private handleShortQuery(queryLower: string, items: string[]): FuzzyMatch[] {
        const matches: FuzzyMatch[] = [];
        
        for (const item of items) {
            const itemLower = item.toLowerCase();
            if (itemLower.includes(queryLower)) {
                let score = 1000;
                
                // Bonus for prefix match
                if (itemLower.startsWith(queryLower)) {
                    score += 200;
                }
                
                // Prefer shorter items
                score -= item.length;
                
                matches.push({ item, score });
            }
        }
        
        return matches.sort((a, b) => b.score - a.score);
    }
    
    /**
     * Handles full fuzzy matching for longer queries
     */
    private handleFullQuery(queryLower: string, items: string[]): FuzzyMatch[] {
        const matches: FuzzyMatch[] = [];
        
        for (const item of items) {
            const itemLower = item.toLowerCase();
            let bestScore = 0;
            let bestMatch = false;
            
            // Try matching from each position in the item to support substring matching
            for (let startPos = 0; startPos <= itemLower.length - queryLower.length; startPos++) {
                let score = 0;
                let queryIndex = 0;
                let matchedChars = 0;
                let consecutiveBonus = 0;
                
                // Calculate fuzzy match score from this starting position
                for (let i = startPos; i < itemLower.length && queryIndex < queryLower.length; i++) {
                    if (itemLower[i] === queryLower[queryIndex]) {
                        matchedChars++;
                        
                        // Base score for character match
                        score += 10;
                        
                        // Bonus for consecutive matches
                        if (queryIndex > 0 && i > startPos && itemLower[i-1] === queryLower[queryIndex-1]) {
                            consecutiveBonus += 5;
                            score += consecutiveBonus;
                        } else {
                            consecutiveBonus = 0;
                        }
                        
                        // Bonus for word boundaries
                        if (i === 0 || itemLower[i - 1] === ' ' || itemLower[i - 1] === '-' || itemLower[i - 1] === '_') {
                            score += 30;
                        }
                        
                        // Higher score for matches at the beginning
                        if (startPos === 0) {
                            score += queryIndex === 0 ? 100 : 50;
                        }
                        
                        queryIndex++;
                    }
                }
                
                // Check if this starting position gives a complete match
                if (matchedChars === queryLower.length) {
                    // Huge bonus for exact substring matches (consecutive characters)
                    const isConsecutiveMatch = itemLower.includes(queryLower);
                    if (isConsecutiveMatch) {
                        score += 500; // Much higher bonus for exact substring
                    }
                    
                    // Even higher bonus for prefix matches (highest priority)
                    if (startPos === 0 && itemLower.startsWith(queryLower)) {
                        score += 1500; // Much higher priority for prefix matches
                    }
                    
                    // Small penalty for later starting positions to prefer earlier matches
                    score -= startPos * 2;
                    
                    if (score > bestScore) {
                        bestScore = score;
                        bestMatch = true;
                    }
                }
            }
            
            if (bestMatch) {
                // Penalty for longer strings (prefer shorter matches)
                bestScore -= item.length;
                matches.push({ item, score: bestScore });
            }
        }
        
        // Sort by score (higher score first)
        return matches.sort((a, b) => b.score - a.score);
    }
}