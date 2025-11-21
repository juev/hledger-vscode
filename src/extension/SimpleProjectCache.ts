import * as fs from 'fs';
import { ParsedHLedgerData } from './HLedgerParser';

/**
 * Simple file-based cache with modification time checking.
 * Caches parsed hledger data and invalidates when files change.
 */
export class SimpleProjectCache {
    private cache = new Map<string, ParsedHLedgerData>();
    private modTimes = new Map<string, number>();
    
    /**
     * Get cached data for a file path, checking modification time
     */
    get(key: string): ParsedHLedgerData | null {
        try {
            const stats = fs.statSync(key);
            const cached = this.cache.get(key);
            const lastModTime = this.modTimes.get(key);

            if (cached && lastModTime && stats.mtimeMs <= lastModTime) {
                return cached;
            }

            return null;
        } catch {
            // File doesn't exist or can't be accessed (e.g., in tests)
            // Return cached data if available (for test scenarios)
            return this.cache.get(key) ?? null;
        }
    }

    /**
     * Cache parsed data for a file path with current modification time
     */
    set(key: string, value: ParsedHLedgerData): void {
        try {
            const stats = fs.statSync(key);
            this.cache.set(key, value);
            this.modTimes.set(key, stats.mtimeMs);
        } catch {
            // If we can't get stats (e.g., in tests), cache anyway with current timestamp
            // This allows tests to populate the cache without requiring real file paths
            this.cache.set(key, value);
            this.modTimes.set(key, Date.now());
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
     */
    delete(key: string): boolean {
        const deleted = this.cache.delete(key);
        this.modTimes.delete(key);
        return deleted;
    }

    /**
     * Check if we have cached data for a path
     */
    has(key: string): boolean {
        return this.cache.has(key);
    }

    /**
     * Get current cache size
     */
    size(): number {
        return this.cache.size;
    }
}