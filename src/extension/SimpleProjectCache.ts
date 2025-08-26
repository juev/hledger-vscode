import * as fs from 'fs';
import { ParsedHLedgerData } from './HLedgerParser';
import { ISimpleCache, CacheKey, CacheStats, createCacheKey } from './types';

/**
 * Enhanced file-based cache with modification time checking and type safety.
 * Implements modern cache interface with branded types for better reliability.
 * 
 * Enhanced version with type safety and better error handling
 */
export class SimpleProjectCache implements ISimpleCache<CacheKey, ParsedHLedgerData> {
    private cache = new Map<CacheKey, ParsedHLedgerData>();
    private modTimes = new Map<CacheKey, number>();
    private hitCount = 0;
    private missCount = 0;
    
    /**
     * Get cached config for a file path, checking modification time
     * Enhanced with better error handling and statistics tracking
     */
    get(key: CacheKey): ParsedHLedgerData | null {
        try {
            const stats = fs.statSync(key);
            const cached = this.cache.get(key);
            const lastModTime = this.modTimes.get(key);
            
            if (cached && lastModTime && stats.mtimeMs <= lastModTime) {
                this.hitCount++;
                return cached;
            }
            
            this.missCount++;
            return null;
        } catch (error) {
            // File doesn't exist or can't be accessed
            this.missCount++;
            return null;
        }
    }
    
    /**
     * Cache config data for a file path with current modification time
     * Enhanced with better error handling
     */
    set(key: CacheKey, value: ParsedHLedgerData): void {
        try {
            const stats = fs.statSync(key);
            this.cache.set(key, value);
            this.modTimes.set(key, stats.mtimeMs);
        } catch (error) {
            // If we can't get stats, don't cache
            // This prevents caching of non-existent files
        }
    }
    
    /**
     * Clear all cached data
     */
    clear(): void {
        this.cache.clear();
        this.modTimes.clear();
    }
    
    /**
     * Remove specific file from cache
     * Enhanced with return value for better API
     */
    delete(key: CacheKey): boolean {
        const deleted = this.cache.delete(key);
        this.modTimes.delete(key);
        return deleted;
    }
    
    /**
     * Get or create config for a project directory
     * Enhanced with better type safety
     */
    getOrCreateProjectConfig(projectPath: string): ParsedHLedgerData | null {
        const key = createCacheKey(projectPath);
        const cached = this.get(key);
        if (cached) {
            return cached;
        }
        
        // Cannot create new data without parser
        // This method should be used through HLedgerConfig
        return null;
    }
    
    /**
     * Check if we have cached data for a path
     */
    has(key: CacheKey): boolean {
        return this.cache.has(key);
    }
    
    /**
     * Get current cache size
     */
    size(): number {
        return this.cache.size;
    }

    /**
     * Get enhanced cache statistics for debugging and monitoring
     */
    getStats(): CacheStats {
        const totalRequests = this.hitCount + this.missCount;
        return {
            size: this.cache.size,
            hitCount: this.hitCount,
            missCount: this.missCount,
            hitRate: totalRequests > 0 ? this.hitCount / totalRequests : 0,
            evictionCount: 0 // No evictions in this simple cache
        };
    }
}