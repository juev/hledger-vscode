/**
 * Smart cache implementation with automatic invalidation and advanced features
 * 
 * Features:
 * - Type-safe generic cache with constraints
 * - Automatic invalidation based on file dependencies
 * - LRU eviction with configurable size limits
 * - Optional compression and persistence
 * - Comprehensive metrics and validation
 * - Memory-efficient dependency tracking
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import {
    ISmartCache,
    ICacheEntry,
    CacheKey,
    FilePath,
    CacheableData,
    SmartCacheConfig,
    CacheMetrics,
    MutableCacheMetrics,
    CacheValidationResult,
    createCacheKey,
    CacheValidationError
} from './interfaces';

/**
 * Internal cache entry with access tracking
 */
interface InternalCacheEntry<T = CacheableData> extends ICacheEntry<T> {
    accessCount: number;
    lastAccessed: number;
}

/**
 * Dependency index for efficient lookup
 */
interface DependencyIndex {
    readonly fileToCacheKeys: Map<FilePath, Set<CacheKey>>;
    readonly tagToCacheKeys: Map<string, Set<CacheKey>>;
}

/**
 * Smart cache implementation with advanced features
 */
export class SmartCache<T = CacheableData> implements ISmartCache<T> {
    private readonly entries: Map<CacheKey, InternalCacheEntry<T>> = new Map();
    private readonly dependencyIndex: DependencyIndex = {
        fileToCacheKeys: new Map(),
        tagToCacheKeys: new Map()
    };
    
    private metrics: MutableCacheMetrics = {
        hitRate: 0,
        missRate: 0,
        totalHits: 0,
        totalMisses: 0,
        averageAccessTime: 0,
        memoryUsage: 0,
        entryCount: 0
    };
    
    private accessTimes: number[] = [];
    private lastCleanup: number = Date.now();
    
    constructor(
        public readonly name: string,
        public readonly config: Readonly<SmartCacheConfig<T>>
    ) {
        // Start periodic cleanup
        this.schedulePeriodicCleanup();
    }
    
    // === PUBLIC INTERFACE ===
    
    /**
     * Get cached data by key
     */
    async get(key: CacheKey): Promise<T | null> {
        const startTime = Date.now();
        
        try {
            const entry = this.entries.get(key);
            
            if (!entry) {
                this.recordMiss(Date.now() - startTime);
                return null;
            }
            
            // Check expiration
            if (this.isExpired(entry)) {
                await this.delete(key);
                this.recordMiss(Date.now() - startTime);
                return null;
            }
            
            // Validate entry if validator is provided
            if (this.config.validator && !this.config.validator(entry)) {
                await this.delete(key);
                this.recordMiss(Date.now() - startTime);
                return null;
            }
            
            // Update access tracking
            entry.accessCount++;
            entry.lastAccessed = Date.now();
            
            this.recordHit(Date.now() - startTime);
            
            // Return deserialized data if serializer is configured
            if (this.config.serializer && typeof entry.data === 'string') {
                try {
                    return this.config.serializer.deserialize(entry.data as string);
                } catch (error) {
                    console.warn(`SmartCache[${this.name}]: Deserialization failed for key ${key}:`, error);
                    await this.delete(key);
                    this.recordMiss(Date.now() - startTime);
                    return null;
                }
            }
            
            return entry.data;
        } catch (error) {
            console.error(`SmartCache[${this.name}]: Error getting key ${key}:`, error);
            this.recordMiss(Date.now() - startTime);
            return null;
        }
    }
    
    /**
     * Set cached data with dependencies
     */
    async set(
        key: CacheKey, 
        data: T, 
        dependencies: readonly FilePath[] = [], 
        tags: readonly string[] = []
    ): Promise<void> {
        try {
            // Remove existing entry to clean up dependencies
            if (this.entries.has(key)) {
                await this.delete(key);
            }
            
            // Serialize data if serializer is configured
            let processedData: T = data;
            if (this.config.serializer) {
                try {
                    const serialized = this.config.serializer.serialize(data);
                    processedData = serialized as T;
                } catch (error) {
                    throw new CacheValidationError(
                        'Failed to serialize cache data',
                        key,
                        { data, dependencies, tags },
                        error instanceof Error ? error : new Error(String(error))
                    );
                }
            }
            
            // Calculate checksum for integrity
            const checksum = this.calculateChecksum(processedData);
            
            // Create cache entry
            const entry: InternalCacheEntry<T> = {
                key,
                data: processedData,
                timestamp: Date.now(),
                expiresAt: this.config.maxAge > 0 ? Date.now() + this.config.maxAge : undefined,
                dependencies: [...dependencies],
                metadata: {
                    lastModified: Date.now(),
                    checksum,
                    size: this.calculateSize(processedData),
                    version: '1.0'
                },
                tags: [...tags],
                accessCount: 0,
                lastAccessed: Date.now()
            };
            
            // Ensure cache size limit
            await this.ensureCacheSize();
            
            // Store entry
            this.entries.set(key, entry);
            
            // Update dependency index
            this.updateDependencyIndex(key, dependencies, tags);
            
            // Update metrics
            this.updateMetrics();
            
            if (process.env.NODE_ENV !== 'test') {
                console.log(`SmartCache[${this.name}]: Set key ${key} with ${dependencies.length} dependencies, ${tags.length} tags`);
            }
        } catch (error) {
            throw new CacheValidationError(
                'Failed to set cache entry',
                key,
                { data, dependencies, tags },
                error instanceof Error ? error : new Error(String(error))
            );
        }
    }
    
    /**
     * Check if key exists and is valid
     */
    async has(key: CacheKey): Promise<boolean> {
        const entry = this.entries.get(key);
        
        if (!entry) {
            return false;
        }
        
        // Check expiration
        if (this.isExpired(entry)) {
            await this.delete(key);
            return false;
        }
        
        // Validate entry if validator is provided
        if (this.config.validator && !this.config.validator(entry)) {
            await this.delete(key);
            return false;
        }
        
        return true;
    }
    
    /**
     * Delete specific cache entry
     */
    async delete(key: CacheKey): Promise<boolean> {
        const entry = this.entries.get(key);
        
        if (!entry) {
            return false;
        }
        
        // Remove from main storage
        const deleted = this.entries.delete(key);
        
        if (deleted) {
            // Clean up dependency index
            this.cleanupDependencyIndex(key, entry.dependencies, entry.tags);
            
            // Update metrics
            this.updateMetrics();
            
            if (process.env.NODE_ENV !== 'test') {
                console.log(`SmartCache[${this.name}]: Deleted key ${key}`);
            }
        }
        
        return deleted;
    }
    
    /**
     * Clear all cache entries
     */
    async clear(): Promise<void> {
        const entryCount = this.entries.size;
        
        this.entries.clear();
        this.dependencyIndex.fileToCacheKeys.clear();
        this.dependencyIndex.tagToCacheKeys.clear();
        
        // Reset metrics
        this.metrics = {
            hitRate: 0,
            missRate: 0,
            totalHits: 0,
            totalMisses: 0,
            averageAccessTime: 0,
            memoryUsage: 0,
            entryCount: 0
        };
        
        if (process.env.NODE_ENV !== 'test' && entryCount > 0) {
            console.log(`SmartCache[${this.name}]: Cleared ${entryCount} entries`);
        }
    }
    
    /**
     * Invalidate entries by dependencies
     */
    async invalidateByDependencies(files: readonly FilePath[]): Promise<readonly CacheKey[]> {
        const invalidatedKeys: CacheKey[] = [];
        
        for (const file of files) {
            const cacheKeys = this.dependencyIndex.fileToCacheKeys.get(file);
            
            if (cacheKeys) {
                for (const key of cacheKeys) {
                    const deleted = await this.delete(key);
                    if (deleted) {
                        invalidatedKeys.push(key);
                    }
                }
            }
        }
        
        if (process.env.NODE_ENV !== 'test' && invalidatedKeys.length > 0) {
            console.log(`SmartCache[${this.name}]: Invalidated ${invalidatedKeys.length} entries by dependencies`);
        }
        
        return invalidatedKeys;
    }
    
    /**
     * Invalidate entries by tags
     */
    async invalidateByTags(tags: readonly string[]): Promise<readonly CacheKey[]> {
        const invalidatedKeys: CacheKey[] = [];
        
        for (const tag of tags) {
            const cacheKeys = this.dependencyIndex.tagToCacheKeys.get(tag);
            
            if (cacheKeys) {
                for (const key of cacheKeys) {
                    const deleted = await this.delete(key);
                    if (deleted) {
                        invalidatedKeys.push(key);
                    }
                }
            }
        }
        
        if (process.env.NODE_ENV !== 'test' && invalidatedKeys.length > 0) {
            console.log(`SmartCache[${this.name}]: Invalidated ${invalidatedKeys.length} entries by tags`);
        }
        
        return invalidatedKeys;
    }
    
    /**
     * Get cache metrics
     */
    getMetrics(): CacheMetrics {
        return { ...this.metrics };
    }
    
    /**
     * Get all cache keys
     */
    async getKeys(): Promise<readonly CacheKey[]> {
        return Array.from(this.entries.keys());
    }
    
    /**
     * Validate cache integrity
     */
    async validate(): Promise<CacheValidationResult> {
        const invalidatedKeys: CacheKey[] = [];
        const issues: string[] = [];
        
        try {
            for (const [key, entry] of this.entries.entries()) {
                // Check expiration
                if (this.isExpired(entry)) {
                    await this.delete(key);
                    invalidatedKeys.push(key);
                    continue;
                }
                
                // Validate checksum if available
                if (entry.metadata.checksum) {
                    const currentChecksum = this.calculateChecksum(entry.data);
                    if (currentChecksum !== entry.metadata.checksum) {
                        issues.push(`Checksum mismatch for key ${key}`);
                        await this.delete(key);
                        invalidatedKeys.push(key);
                        continue;
                    }
                }
                
                // Validate with custom validator
                if (this.config.validator && !this.config.validator(entry)) {
                    issues.push(`Custom validation failed for key ${key}`);
                    await this.delete(key);
                    invalidatedKeys.push(key);
                    continue;
                }
                
                // Check file dependencies exist
                for (const dep of entry.dependencies) {
                    try {
                        await fs.promises.access(dep);
                    } catch {
                        issues.push(`Missing dependency ${dep} for key ${key}`);
                        await this.delete(key);
                        invalidatedKeys.push(key);
                        break;
                    }
                }
            }
            
            const isValid = issues.length === 0;
            const reason = issues.length > 0 ? issues.join('; ') : undefined;
            
            return {
                isValid,
                reason,
                invalidatedKeys,
                suggestedStrategy: invalidatedKeys.length > this.entries.size * 0.5 
                    ? 'full' as any : 'partial' as any
            };
        } catch (error) {
            return {
                isValid: false,
                reason: `Validation error: ${error}`,
                invalidatedKeys,
                suggestedStrategy: 'full' as any
            };
        }
    }
    
    // === PRIVATE IMPLEMENTATION ===
    
    /**
     * Check if entry is expired
     */
    private isExpired(entry: InternalCacheEntry<T>): boolean {
        return entry.expiresAt !== undefined && Date.now() > entry.expiresAt;
    }
    
    /**
     * Ensure cache doesn't exceed size limit
     */
    private async ensureCacheSize(): Promise<void> {
        if (this.entries.size < this.config.maxSize) {
            return;
        }
        
        // Sort entries by LRU (least recently used first)
        const sortedEntries = Array.from(this.entries.entries())
            .sort(([, a], [, b]) => {
                // First by access count (ascending)
                if (a.accessCount !== b.accessCount) {
                    return a.accessCount - b.accessCount;
                }
                // Then by last accessed time (ascending)
                return a.lastAccessed - b.lastAccessed;
            });
        
        // Remove oldest entries until we're under the limit
        const entriesToRemove = Math.max(1, Math.floor(this.config.maxSize * 0.1)); // Remove 10%
        
        for (let i = 0; i < entriesToRemove && sortedEntries.length > 0; i++) {
            const [key] = sortedEntries[i];
            await this.delete(key);
        }
    }
    
    /**
     * Update dependency index for a cache entry
     */
    private updateDependencyIndex(key: CacheKey, dependencies: readonly FilePath[], tags: readonly string[]): void {
        // Index by file dependencies
        for (const dep of dependencies) {
            if (!this.dependencyIndex.fileToCacheKeys.has(dep)) {
                this.dependencyIndex.fileToCacheKeys.set(dep, new Set());
            }
            this.dependencyIndex.fileToCacheKeys.get(dep)!.add(key);
        }
        
        // Index by tags
        for (const tag of tags) {
            if (!this.dependencyIndex.tagToCacheKeys.has(tag)) {
                this.dependencyIndex.tagToCacheKeys.set(tag, new Set());
            }
            this.dependencyIndex.tagToCacheKeys.get(tag)!.add(key);
        }
    }
    
    /**
     * Clean up dependency index for a cache entry
     */
    private cleanupDependencyIndex(key: CacheKey, dependencies: readonly FilePath[], tags: readonly string[]): void {
        // Clean up file dependencies
        for (const dep of dependencies) {
            const keySet = this.dependencyIndex.fileToCacheKeys.get(dep);
            if (keySet) {
                keySet.delete(key);
                if (keySet.size === 0) {
                    this.dependencyIndex.fileToCacheKeys.delete(dep);
                }
            }
        }
        
        // Clean up tags
        for (const tag of tags) {
            const keySet = this.dependencyIndex.tagToCacheKeys.get(tag);
            if (keySet) {
                keySet.delete(key);
                if (keySet.size === 0) {
                    this.dependencyIndex.tagToCacheKeys.delete(tag);
                }
            }
        }
    }
    
    /**
     * Calculate checksum for data integrity
     */
    private calculateChecksum(data: T): string {
        const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
        return crypto.createHash('sha256').update(dataStr).digest('hex').substring(0, 16);
    }
    
    /**
     * Calculate approximate size of data
     */
    private calculateSize(data: T): number {
        if (typeof data === 'string') {
            return Buffer.byteLength(data, 'utf8');
        }
        
        try {
            return Buffer.byteLength(JSON.stringify(data), 'utf8');
        } catch {
            return 0;
        }
    }
    
    /**
     * Record cache hit and update metrics
     */
    private recordHit(accessTime: number): void {
        this.metrics.totalHits++;
        this.recordAccessTime(accessTime);
        this.updateHitRates();
    }
    
    /**
     * Record cache miss and update metrics
     */
    private recordMiss(accessTime: number): void {
        this.metrics.totalMisses++;
        this.recordAccessTime(accessTime);
        this.updateHitRates();
    }
    
    /**
     * Record access time for performance metrics
     */
    private recordAccessTime(accessTime: number): void {
        this.accessTimes.push(accessTime);
        if (this.accessTimes.length > 100) {
            this.accessTimes.shift(); // Keep only last 100 measurements
        }
        
        this.metrics.averageAccessTime = this.accessTimes.reduce((a, b) => a + b, 0) / this.accessTimes.length;
    }
    
    /**
     * Update hit/miss rate calculations
     */
    private updateHitRates(): void {
        const total = this.metrics.totalHits + this.metrics.totalMisses;
        if (total > 0) {
            this.metrics.hitRate = this.metrics.totalHits / total;
            this.metrics.missRate = this.metrics.totalMisses / total;
        }
    }
    
    /**
     * Update general cache metrics
     */
    private updateMetrics(): void {
        this.metrics.entryCount = this.entries.size;
        
        // Calculate approximate memory usage
        let memoryUsage = 0;
        for (const entry of this.entries.values()) {
            memoryUsage += entry.metadata.size || 0;
        }
        this.metrics.memoryUsage = memoryUsage;
    }
    
    /**
     * Schedule periodic cleanup of expired entries
     */
    private schedulePeriodicCleanup(): void {
        // Clean up every 5 minutes
        const cleanupInterval = setInterval(async () => {
            try {
                await this.performPeriodicCleanup();
            } catch (error) {
                console.error(`SmartCache[${this.name}]: Error during periodic cleanup:`, error);
            }
        }, 5 * 60 * 1000);
        
        // Clean up the interval when cache is garbage collected
        // This is a weak reference pattern for cleanup
        if (typeof globalThis !== 'undefined' && 'FinalizationRegistry' in globalThis && typeof (globalThis as any).FinalizationRegistry === 'function') {
            try {
                const FinalizationRegistryConstructor = (globalThis as any).FinalizationRegistry as new (callback: (heldValue: any) => void) => {
                    register(target: any, heldValue: any): void;
                };
                const registry = new FinalizationRegistryConstructor(() => {
                    clearInterval(cleanupInterval);
                });
                registry.register(this, null);
            } catch (error) {
                // FinalizationRegistry not available, fallback to manual cleanup
                console.debug(`SmartCache[${this.name}]: FinalizationRegistry not available, using manual cleanup`);
            }
        }
    }
    
    /**
     * Perform periodic cleanup of expired entries
     */
    private async performPeriodicCleanup(): Promise<void> {
        const now = Date.now();
        
        // Only run cleanup if enough time has passed
        if (now - this.lastCleanup < 4 * 60 * 1000) { // 4 minutes minimum
            return;
        }
        
        this.lastCleanup = now;
        const keysToDelete: CacheKey[] = [];
        
        // Find expired entries
        for (const [key, entry] of this.entries.entries()) {
            if (this.isExpired(entry)) {
                keysToDelete.push(key);
            }
        }
        
        // Delete expired entries
        for (const key of keysToDelete) {
            await this.delete(key);
        }
        
        if (process.env.NODE_ENV !== 'test' && keysToDelete.length > 0) {
            console.log(`SmartCache[${this.name}]: Periodic cleanup removed ${keysToDelete.length} expired entries`);
        }
    }
}

/**
 * Factory function to create a configured SmartCache instance
 */
export function createSmartCache<T extends CacheableData>(
    name: string,
    config: Partial<SmartCacheConfig<T>> = {}
): ISmartCache<T> {
    const fullConfig: SmartCacheConfig<T> = {
        maxSize: 1000,
        maxAge: 300000, // 5 minutes
        enableCompression: false,
        enablePersistence: false,
        ...config
    };
    
    return new SmartCache(name, fullConfig);
}