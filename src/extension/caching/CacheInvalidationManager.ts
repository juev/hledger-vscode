/**
 * Central cache invalidation manager with event processing and strategy coordination
 * 
 * This manager:
 * - Coordinates between file watchers and cache strategies
 * - Processes invalidation events with batching and debouncing
 * - Maintains statistics and metrics for monitoring
 * - Provides graceful error handling and recovery
 * - Manages multiple cache instances with type safety
 */

import * as vscode from 'vscode';
import {
    ICacheInvalidationManager,
    CacheInvalidationConfig,
    InvalidationEvent,
    InvalidationResult,
    InvalidationStats,
    MutableInvalidationStats,
    ISmartCache,
    CacheKey,
    InvalidationStrategy,
    InvalidationContext,
    InvalidationEventType,
    FilePath,
    createFilePath,
    InvalidationEventId,
    InvalidationError,
    CacheableData,
    FileSystemEvent
} from './interfaces';
import { InvalidationStrategyRegistry, defaultStrategyRegistry } from './InvalidationStrategies';
import { IFileWatcher } from './interfaces';
import { createFileWatcher, DEFAULT_HLEDGER_WATCHER_CONFIG } from './FileWatcher';

/**
 * Batched invalidation event for processing multiple events together
 */
interface InvalidationBatch {
    readonly events: readonly InvalidationEvent[];
    readonly timestamp: number;
    readonly batchId: string;
}

/**
 * Cache reference with metadata for management
 */
interface ManagedCache<T = CacheableData> {
    readonly cache: ISmartCache<T>;
    readonly registrationTime: number;
    readonly lastInvalidation: number;
}

/**
 * Main cache invalidation manager implementation
 */
export class CacheInvalidationManager implements ICacheInvalidationManager {
    private readonly strategyRegistry: InvalidationStrategyRegistry;
    private readonly fileWatcher: IFileWatcher;
    private readonly managedCaches: Map<string, ManagedCache<any>> = new Map();
    private readonly eventQueue: InvalidationEvent[] = [];
    private readonly disposables: vscode.Disposable[] = [];
    
    private config: CacheInvalidationConfig | null = null;
    private isInitialized: boolean = false;
    private processingBatch: boolean = false;
    private batchTimeout: NodeJS.Timeout | null = null;
    
    // Statistics tracking
    private stats: MutableInvalidationStats = {
        totalInvalidations: 0,
        partialInvalidations: 0,
        fullInvalidations: 0,
        cascadeInvalidations: 0,
        averageExecutionTime: 0,
        errorCount: 0,
        lastInvalidation: 0
    };
    
    private executionTimes: number[] = [];
    
    constructor(
        strategyRegistry?: InvalidationStrategyRegistry,
        fileWatcher?: IFileWatcher
    ) {
        this.strategyRegistry = strategyRegistry || defaultStrategyRegistry;
        this.fileWatcher = fileWatcher || createFileWatcher();
    }
    
    // === PUBLIC INTERFACE ===
    
    /**
     * Initialize the invalidation manager
     */
    async initialize(config: CacheInvalidationConfig): Promise<void> {
        if (this.isInitialized) {
            await this.dispose();
        }
        
        try {
            this.config = config;
            
            // Initialize file watcher if enabled
            if (config.enableSmartInvalidation) {
                await this.initializeFileWatcher();
            }
            
            this.isInitialized = true;
            
            if (process.env.NODE_ENV !== 'test') {
                console.log('CacheInvalidationManager: Initialized with config:', config);
            }
        } catch (error) {
            throw new InvalidationError(
                'Failed to initialize cache invalidation manager',
                {} as InvalidationEvent,
                { config },
                error instanceof Error ? error : new Error(String(error))
            );
        }
    }
    
    /**
     * Process an invalidation event
     */
    async processEvent(event: InvalidationEvent): Promise<InvalidationResult> {
        if (!this.isInitialized || !this.config) {
            throw new InvalidationError(
                'Cache invalidation manager not initialized',
                event
            );
        }
        
        try {
            // Add event to queue for batching
            this.eventQueue.push(event);
            
            // Process immediately if queue is full or for critical events
            if (this.shouldProcessImmediately(event)) {
                return await this.processBatch();
            }
            
            // Schedule batch processing with debouncing
            this.scheduleBatchProcessing();
            
            // Return preliminary result for non-critical events
            return {
                strategy: InvalidationStrategy.PARTIAL,
                invalidatedKeys: [],
                cascadedFiles: [],
                executionTimeMs: 0,
                errors: []
            };
        } catch (error) {
            this.stats.errorCount++;
            throw new InvalidationError(
                'Failed to process invalidation event',
                event,
                {},
                error instanceof Error ? error : new Error(String(error))
            );
        }
    }
    
    /**
     * Register a cache for management
     */
    registerCache<T = CacheableData>(cache: ISmartCache<T>): void {
        const managedCache: ManagedCache<T> = {
            cache,
            registrationTime: Date.now(),
            lastInvalidation: 0
        };
        
        this.managedCaches.set(cache.name, managedCache);
        
        if (process.env.NODE_ENV !== 'test') {
            console.log(`CacheInvalidationManager: Registered cache '${cache.name}'`);
        }
    }
    
    /**
     * Unregister a cache
     */
    unregisterCache<T = CacheableData>(cache: ISmartCache<T>): void {
        const removed = this.managedCaches.delete(cache.name);
        
        if (removed && process.env.NODE_ENV !== 'test') {
            console.log(`CacheInvalidationManager: Unregistered cache '${cache.name}'`);
        }
    }
    
    /**
     * Manual invalidation trigger
     */
    async invalidate(
        keys: readonly CacheKey[], 
        strategy: InvalidationStrategy = InvalidationStrategy.SMART
    ): Promise<InvalidationResult> {
        const startTime = Date.now();
        const errors: Error[] = [];
        let invalidatedKeys: CacheKey[] = [];
        const cascadedFiles: FilePath[] = [];
        
        try {
            if (keys.length === 0) {
                return {
                    strategy,
                    invalidatedKeys: [],
                    cascadedFiles: [],
                    executionTimeMs: 0,
                    errors: []
                };
            }
            
            // Process invalidation for each managed cache
            for (const managedCache of this.managedCaches.values()) {
                try {
                    if (keys.includes('*' as CacheKey)) {
                        // Full cache clear
                        await managedCache.cache.clear();
                        invalidatedKeys.push('*' as CacheKey);
                    } else {
                        // Selective invalidation
                        for (const key of keys) {
                            const deleted = await managedCache.cache.delete(key);
                            if (deleted) {
                                invalidatedKeys.push(key);
                            }
                        }
                    }
                } catch (error) {
                    errors.push(error instanceof Error ? error : new Error(String(error)));
                }
            }
            
            // Update statistics
            this.updateStats(strategy, Date.now() - startTime, errors.length === 0);
            
            return {
                strategy,
                invalidatedKeys,
                cascadedFiles,
                executionTimeMs: Date.now() - startTime,
                errors
            };
        } catch (error) {
            errors.push(error instanceof Error ? error : new Error(String(error)));
            this.stats.errorCount++;
            
            return {
                strategy,
                invalidatedKeys,
                cascadedFiles,
                executionTimeMs: Date.now() - startTime,
                errors
            };
        }
    }
    
    /**
     * Get invalidation statistics
     */
    getStats(): InvalidationStats {
        return { ...this.stats };
    }
    
    /**
     * Dispose and cleanup resources
     */
    async dispose(): Promise<void> {
        try {
            // Clear batch timeout
            if (this.batchTimeout) {
                clearTimeout(this.batchTimeout);
                this.batchTimeout = null;
            }
            
            // Process any remaining events
            if (this.eventQueue.length > 0) {
                await this.processBatch();
            }
            
            // Stop file watcher
            if (this.fileWatcher.isActive) {
                await this.fileWatcher.stop();
            }
            
            // Dispose all disposables
            for (const disposable of this.disposables) {
                disposable.dispose();
            }
            this.disposables.length = 0;
            
            // Clear managed caches
            this.managedCaches.clear();
            
            this.isInitialized = false;
            this.config = null;
            
            if (process.env.NODE_ENV !== 'test') {
                console.log('CacheInvalidationManager: Disposed and cleaned up');
            }
        } catch (error) {
            console.error('CacheInvalidationManager: Error during disposal:', error);
        }
    }
    
    // === PRIVATE IMPLEMENTATION ===
    
    /**
     * Initialize file watcher with event handlers
     */
    private async initializeFileWatcher(): Promise<void> {
        if (!this.config) return;
        
        // Setup file watcher with HLedger-specific configuration
        const watcherConfig = {
            ...DEFAULT_HLEDGER_WATCHER_CONFIG,
            debounceMs: this.config.debounceMs
        };
        
        await this.fileWatcher.start(watcherConfig);
        
        // Register event handler
        const disposable = this.fileWatcher.onFileSystemEvent(async (fsEvent: FileSystemEvent) => {
            try {
                const invalidationEvent: InvalidationEvent = {
                    id: this.generateEventId(),
                    type: fsEvent.type,
                    timestamp: fsEvent.timestamp,
                    filePath: createFilePath(fsEvent.uri.fsPath),
                    strategy: InvalidationStrategy.SMART
                };
                
                await this.processEvent(invalidationEvent);
            } catch (error) {
                console.error('CacheInvalidationManager: Error processing file system event:', error);
            }
        });
        
        this.disposables.push(disposable);
    }
    
    /**
     * Check if event should be processed immediately
     */
    private shouldProcessImmediately(event: InvalidationEvent): boolean {
        if (!this.config) return true;
        
        // Process immediately for critical events
        const criticalEvents = [
            InvalidationEventType.CONFIG_CHANGED,
            InvalidationEventType.MANUAL_INVALIDATION
        ];
        
        if (criticalEvents.includes(event.type)) {
            return true;
        }
        
        // Process if queue is full
        if (this.eventQueue.length >= this.config.maxBatchSize) {
            return true;
        }
        
        return false;
    }
    
    /**
     * Schedule batch processing with debouncing
     */
    private scheduleBatchProcessing(): void {
        if (!this.config || this.batchTimeout) {
            return;
        }
        
        this.batchTimeout = setTimeout(async () => {
            this.batchTimeout = null;
            await this.processBatch();
        }, this.config.debounceMs);
    }
    
    /**
     * Process batched events
     */
    private async processBatch(): Promise<InvalidationResult> {
        if (this.processingBatch || this.eventQueue.length === 0) {
            return {
                strategy: InvalidationStrategy.PARTIAL,
                invalidatedKeys: [],
                cascadedFiles: [],
                executionTimeMs: 0,
                errors: []
            };
        }
        
        this.processingBatch = true;
        const startTime = Date.now();
        
        try {
            // Create batch from current queue
            const batch: InvalidationBatch = {
                events: [...this.eventQueue],
                timestamp: Date.now(),
                batchId: this.generateBatchId()
            };
            
            // Clear queue
            this.eventQueue.length = 0;
            
            // Process the batch
            const result = await this.processBatchEvents(batch);
            
            // Update statistics
            this.updateStats(result.strategy, result.executionTimeMs, result.errors.length === 0);
            
            return result;
        } catch (error) {
            this.stats.errorCount++;
            return {
                strategy: InvalidationStrategy.PARTIAL,
                invalidatedKeys: [],
                cascadedFiles: [],
                executionTimeMs: Date.now() - startTime,
                errors: [error instanceof Error ? error : new Error(String(error))]
            };
        } finally {
            this.processingBatch = false;
        }
    }
    
    /**
     * Process events in a batch
     */
    private async processBatchEvents(batch: InvalidationBatch): Promise<InvalidationResult> {
        const errors: Error[] = [];
        let allInvalidatedKeys: CacheKey[] = [];
        let allCascadedFiles: FilePath[] = [];
        let totalExecutionTime = 0;
        let finalStrategy = InvalidationStrategy.PARTIAL;
        
        try {
            // Group events by file and type for efficient processing
            const groupedEvents = this.groupEvents(batch.events);
            
            for (const [key, events] of groupedEvents.entries()) {
                try {
                    const context = await this.createInvalidationContext(events);
                    const strategy = this.strategyRegistry.findBestStrategy(context);
                    const result = await strategy.execute(context);
                    
                    // Merge results
                    allInvalidatedKeys.push(...result.invalidatedKeys);
                    allCascadedFiles.push(...result.cascadedFiles);
                    totalExecutionTime += result.executionTimeMs;
                    errors.push(...result.errors);
                    
                    // Use highest priority strategy as final
                    if (this.getStrategyPriority(result.strategy) > this.getStrategyPriority(finalStrategy)) {
                        finalStrategy = result.strategy;
                    }
                    
                    // Apply invalidation to managed caches
                    await this.applyInvalidation(result);
                    
                } catch (error) {
                    errors.push(error instanceof Error ? error : new Error(String(error)));
                }
            }
            
            if (process.env.NODE_ENV !== 'test') {
                console.log(`CacheInvalidationManager: Processed batch with ${batch.events.length} events, ${allInvalidatedKeys.length} keys invalidated`);
            }
            
            return {
                strategy: finalStrategy,
                invalidatedKeys: allInvalidatedKeys,
                cascadedFiles: allCascadedFiles,
                executionTimeMs: totalExecutionTime,
                errors
            };
        } catch (error) {
            errors.push(error instanceof Error ? error : new Error(String(error)));
            return {
                strategy: InvalidationStrategy.PARTIAL,
                invalidatedKeys: allInvalidatedKeys,
                cascadedFiles: allCascadedFiles,
                executionTimeMs: totalExecutionTime,
                errors
            };
        }
    }
    
    /**
     * Group events by file and type for efficient processing
     */
    private groupEvents(events: readonly InvalidationEvent[]): Map<string, InvalidationEvent[]> {
        const groups = new Map<string, InvalidationEvent[]>();
        
        for (const event of events) {
            const key = `${event.filePath || 'global'}:${event.type}`;
            const existing = groups.get(key) || [];
            existing.push(event);
            groups.set(key, existing);
        }
        
        return groups;
    }
    
    /**
     * Create invalidation context from events
     */
    private async createInvalidationContext(events: InvalidationEvent[]): Promise<InvalidationContext> {
        const affectedFiles = events
            .map(e => e.filePath)
            .filter((f): f is FilePath => f !== undefined);
        
        const uniqueFiles = [...new Set(affectedFiles)];
        
        // Build dependency graph (simplified for now)
        const dependencyGraph = new Map<FilePath, readonly FilePath[]>();
        
        // Calculate cache size
        let totalCacheSize = 0;
        for (const managedCache of this.managedCaches.values()) {
            const metrics = managedCache.cache.getMetrics();
            totalCacheSize += metrics.entryCount;
        }
        
        return {
            event: events[0], // Use first event as representative
            affectedFiles: uniqueFiles,
            cacheSize: totalCacheSize,
            lastInvalidation: this.stats.lastInvalidation,
            dependencyGraph
        };
    }
    
    /**
     * Apply invalidation result to managed caches
     */
    private async applyInvalidation(result: InvalidationResult): Promise<void> {
        const errors: Error[] = [];
        
        for (const managedCache of this.managedCaches.values()) {
            try {
                if (result.invalidatedKeys.includes('*' as CacheKey)) {
                    // Full cache clear
                    await managedCache.cache.clear();
                } else {
                    // Selective invalidation
                    for (const key of result.invalidatedKeys) {
                        await managedCache.cache.delete(key);
                    }
                }
            } catch (error) {
                errors.push(error instanceof Error ? error : new Error(String(error)));
            }
        }
        
        if (errors.length > 0 && process.env.NODE_ENV !== 'test') {
            console.warn('CacheInvalidationManager: Errors during cache invalidation:', errors);
        }
    }
    
    /**
     * Update invalidation statistics
     */
    private updateStats(strategy: InvalidationStrategy, executionTime: number, success: boolean): void {
        this.stats.totalInvalidations++;
        this.stats.lastInvalidation = Date.now();
        
        if (!success) {
            this.stats.errorCount++;
        }
        
        // Update strategy-specific counters
        switch (strategy) {
            case InvalidationStrategy.PARTIAL:
                this.stats.partialInvalidations++;
                break;
            case InvalidationStrategy.CASCADE:
                this.stats.cascadeInvalidations++;
                break;
            case InvalidationStrategy.FULL:
                this.stats.fullInvalidations++;
                break;
        }
        
        // Update execution time statistics
        this.executionTimes.push(executionTime);
        if (this.executionTimes.length > 100) {
            this.executionTimes.shift(); // Keep only last 100 measurements
        }
        
        this.stats.averageExecutionTime = this.executionTimes.reduce((a, b) => a + b, 0) / this.executionTimes.length;
    }
    
    /**
     * Get strategy priority for comparison
     */  
    private getStrategyPriority(strategy: InvalidationStrategy): number {
        switch (strategy) {
            case InvalidationStrategy.FULL: return 300;
            case InvalidationStrategy.CASCADE: return 200;
            case InvalidationStrategy.SMART: return 1000;
            case InvalidationStrategy.PARTIAL: return 100;
            default: return 0;
        }
    }
    
    /**
     * Generate unique event ID
     */
    private generateEventId(): InvalidationEventId {
        return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` as InvalidationEventId;
    }
    
    /**
     * Generate unique batch ID
     */
    private generateBatchId(): string {
        return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

/**
 * Factory function to create a configured cache invalidation manager
 */
export function createCacheInvalidationManager(
    strategyRegistry?: InvalidationStrategyRegistry,
    fileWatcher?: IFileWatcher
): ICacheInvalidationManager {
    return new CacheInvalidationManager(strategyRegistry, fileWatcher);
}