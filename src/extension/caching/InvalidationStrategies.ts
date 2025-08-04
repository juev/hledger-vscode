/**
 * Cache invalidation strategies with intelligent decision-making
 * 
 * This module implements different invalidation strategies:
 * - PartialInvalidationStrategy: Granular invalidation of specific data
 * - CascadeInvalidationStrategy: Invalidates dependent data recursively
 * - FullInvalidationStrategy: Complete cache clear for critical changes
 * - SmartInvalidationStrategy: AI-like decision making based on context
 */

import * as path from 'path';
import * as vscode from 'vscode';
import { SyncSingleton, SingletonLifecycleManager } from '../core/SingletonManager';
import {
    ICacheInvalidationStrategy,
    InvalidationContext,
    InvalidationResult,
    InvalidationStrategy,
    InvalidationEventType,
    FilePath,
    CacheKey,
    createCacheKey,
    InvalidationError
} from './interfaces';

/**
 * Base abstract strategy class with common functionality
 */
abstract class BaseInvalidationStrategy implements ICacheInvalidationStrategy {
    constructor(
        public readonly name: string,
        public readonly priority: number
    ) {}
    
    abstract canHandle(context: InvalidationContext): boolean;
    abstract execute(context: InvalidationContext): Promise<InvalidationResult>;
    
    /**
     * Generate cache keys for files with HLedger-specific patterns
     */
    protected generateCacheKeys(files: readonly FilePath[]): CacheKey[] {
        const keys: CacheKey[] = [];
        
        for (const file of files) {
            // Base file key
            keys.push(createCacheKey(`file:${file}`));
            
            // Directory-based keys for hierarchical invalidation
            const dir = path.dirname(file);
            keys.push(createCacheKey(`dir:${dir}`));
            
            // Extension-based keys
            const ext = path.extname(file);
            if (['.journal', '.hledger', '.ledger'].includes(ext)) {
                keys.push(createCacheKey(`hledger:${file}`));
            }
            
            // Project-based keys
            const projectKey = this.findProjectKey(file);
            if (projectKey) {
                keys.push(createCacheKey(`project:${projectKey}`));
            }
        }
        
        return keys;
    }
    
    /**
     * Find project key for a file path
     */
    protected findProjectKey(filePath: FilePath): string | null {
        const parts = filePath.split(path.sep);
        
        // Look for common project indicators
        for (let i = parts.length - 1; i >= 0; i--) {
            const part = parts[i];
            if (part === 'src' || part === 'data' || part.includes('hledger') || part.includes('journal')) {
                return parts.slice(0, i + 1).join(path.sep);
            }
        }
        
        return null;
    }
    
    /**
     * Check if file is a main journal file (higher impact)
     */
    protected isMainJournalFile(filePath: FilePath): boolean {
        const filename = path.basename(filePath).toLowerCase();
        return filename === 'journal' || 
               filename === 'main.journal' || 
               filename === 'index.journal' ||
               filename.startsWith('main.');
    }
    
    /**
     * Calculate invalidation impact score
     */
    protected calculateImpactScore(context: InvalidationContext): number {
        let score = 0;
        
        // Event type impact
        switch (context.event.type) {
            case InvalidationEventType.FILE_DELETED:
                score += 10;
                break;
            case InvalidationEventType.FILE_CREATED:
                score += 5;
                break;
            case InvalidationEventType.FILE_MODIFIED:
                score += 3;
                break;
            case InvalidationEventType.FILE_RENAMED:
                score += 7;
                break;
            case InvalidationEventType.CONFIG_CHANGED:
                score += 15;
                break;
            default:
                score += 1;
        }
        
        // File importance factor
        if (context.event.filePath && this.isMainJournalFile(context.event.filePath)) {
            score *= 2;
        }
        
        // Cache size factor
        if (context.cacheSize > 1000) {
            score += 5;
        }
        
        // Dependency count factor
        const dependencyCount = context.dependencyGraph.size;
        if (dependencyCount > 10) {
            score += Math.min(dependencyCount / 10, 10);
        }
        
        return score;
    }
}

/**
 * Partial invalidation strategy - only invalidates specific affected data
 */
export class PartialInvalidationStrategy extends BaseInvalidationStrategy {
    constructor() {
        super('partial', 100);
    }
    
    canHandle(context: InvalidationContext): boolean {
        const impactScore = this.calculateImpactScore(context);
        
        // Use partial invalidation for low-impact changes
        return impactScore < 10 && 
               context.event.type === InvalidationEventType.FILE_MODIFIED &&
               context.affectedFiles.length <= 5;
    }
    
    async execute(context: InvalidationContext): Promise<InvalidationResult> {
        const startTime = Date.now();
        const errors: Error[] = [];
        
        try {
            // Generate keys only for directly affected files
            const invalidatedKeys = this.generateCacheKeys(context.affectedFiles);
            
            if (process.env.NODE_ENV !== 'test') {
                console.log(`PartialInvalidationStrategy: Invalidating ${invalidatedKeys.length} keys for ${context.affectedFiles.length} files`);
            }
            
            return {
                strategy: InvalidationStrategy.PARTIAL,
                invalidatedKeys,
                cascadedFiles: [], // No cascading in partial strategy
                executionTimeMs: Date.now() - startTime,
                errors
            };
        } catch (error) {
            errors.push(error instanceof Error ? error : new Error(String(error)));
            
            return {
                strategy: InvalidationStrategy.PARTIAL,
                invalidatedKeys: [],
                cascadedFiles: [],
                executionTimeMs: Date.now() - startTime,
                errors
            };
        }
    }
}

/**
 * Cascade invalidation strategy - invalidates dependent data recursively
 */
export class CascadeInvalidationStrategy extends BaseInvalidationStrategy {
    constructor() {
        super('cascade', 200);
    }
    
    canHandle(context: InvalidationContext): boolean {
        const impactScore = this.calculateImpactScore(context);
        
        // Use cascade for changes with dependencies, regardless of impact score
        // This is more appropriate for cascade strategy - if there are dependencies, we should cascade
        return context.dependencyGraph.size > 0 && 
               (impactScore >= 3 || context.event.type === InvalidationEventType.FILE_MODIFIED);
    }
    
    async execute(context: InvalidationContext): Promise<InvalidationResult> {
        const startTime = Date.now();
        const errors: Error[] = [];
        const cascadedFiles: FilePath[] = [];
        
        try {
            // Find all dependent files recursively
            const allAffectedFiles = new Set(context.affectedFiles);
            
            // Recursive dependency resolution
            const visitedFiles = new Set<FilePath>();
            const queue = [...context.affectedFiles];
            
            while (queue.length > 0) {
                const currentFile = queue.shift()!;
                
                if (visitedFiles.has(currentFile)) {
                    continue;
                }
                visitedFiles.add(currentFile);
                
                // Find dependencies for current file
                const dependencies = context.dependencyGraph.get(currentFile) || [];
                
                for (const dep of dependencies) {
                    if (!allAffectedFiles.has(dep)) {
                        allAffectedFiles.add(dep);
                        cascadedFiles.push(dep);
                        queue.push(dep);
                    }
                }
                
                // Also find files that depend on current file (reverse dependencies)
                for (const [file, deps] of context.dependencyGraph.entries()) {
                    if (deps.includes(currentFile) && !allAffectedFiles.has(file)) {
                        allAffectedFiles.add(file);
                        cascadedFiles.push(file);
                        queue.push(file);
                    }
                }
            }
            
            // Generate keys for all affected files
            const invalidatedKeys = this.generateCacheKeys([...allAffectedFiles]);
            
            if (process.env.NODE_ENV !== 'test') {
                console.log(`CascadeInvalidationStrategy: Invalidating ${invalidatedKeys.length} keys for ${allAffectedFiles.size} files (${cascadedFiles.length} cascaded)`);
            }
            
            return {
                strategy: InvalidationStrategy.CASCADE,
                invalidatedKeys,
                cascadedFiles,
                executionTimeMs: Date.now() - startTime,
                errors
            };
        } catch (error) {
            errors.push(error instanceof Error ? error : new Error(String(error)));
            
            return {
                strategy: InvalidationStrategy.CASCADE,
                invalidatedKeys: [],
                cascadedFiles,
                executionTimeMs: Date.now() - startTime,
                errors
            };
        }
    }
}

/**
 * Full invalidation strategy - clears entire cache for critical changes
 */
export class FullInvalidationStrategy extends BaseInvalidationStrategy {
    constructor() {
        super('full', 300);
    }
    
    canHandle(context: InvalidationContext): boolean {
        const impactScore = this.calculateImpactScore(context);
        
        // Use full invalidation for high-impact changes
        return impactScore >= 20 || 
               context.event.type === InvalidationEventType.CONFIG_CHANGED ||
               context.cacheSize > 10000 || // Large caches are easier to fully invalidate
               (context.event.filePath !== undefined && this.isMainJournalFile(context.event.filePath));
    }
    
    async execute(context: InvalidationContext): Promise<InvalidationResult> {
        const startTime = Date.now();
        const errors: Error[] = [];
        
        try {
            // Generate wildcard key for full cache clear
            const invalidatedKeys = [createCacheKey('*')];
            
            if (process.env.NODE_ENV !== 'test') {
                console.log('FullInvalidationStrategy: Full cache invalidation triggered');
            }
            
            return {
                strategy: InvalidationStrategy.FULL,
                invalidatedKeys,
                cascadedFiles: [...context.affectedFiles], // All files are considered cascaded
                executionTimeMs: Date.now() - startTime,
                errors
            };
        } catch (error) {
            errors.push(error instanceof Error ? error : new Error(String(error)));
            
            return {
                strategy: InvalidationStrategy.FULL,
                invalidatedKeys: [createCacheKey('*')],
                cascadedFiles: [],
                executionTimeMs: Date.now() - startTime,
                errors
            };
        }
    }
}

/**
 * Smart invalidation strategy - uses heuristics to determine best approach
 */
export class SmartInvalidationStrategy extends BaseInvalidationStrategy {
    private readonly partialStrategy = new PartialInvalidationStrategy();
    private readonly cascadeStrategy = new CascadeInvalidationStrategy();
    private readonly fullStrategy = new FullInvalidationStrategy();
    
    constructor() {
        super('smart', 1000); // Highest priority
    }
    
    canHandle(context: InvalidationContext): boolean {
        // Smart strategy can handle any context
        return true;
    }
    
    async execute(context: InvalidationContext): Promise<InvalidationResult> {
        const startTime = Date.now();
        
        try {
            // Analyze context and choose best strategy
            const bestStrategy = this.chooseBestStrategy(context);
            
            if (process.env.NODE_ENV !== 'test') {
                console.log(`SmartInvalidationStrategy: Delegating to ${bestStrategy.name} strategy`);
            }
            
            // Execute chosen strategy
            const result = await bestStrategy.execute(context);
            
            // Override strategy name to indicate smart choice
            return {
                ...result,
                strategy: InvalidationStrategy.SMART,
                executionTimeMs: Date.now() - startTime
            };
        } catch (error) {
            return {
                strategy: InvalidationStrategy.SMART,
                invalidatedKeys: [],
                cascadedFiles: [],
                executionTimeMs: Date.now() - startTime,
                errors: [error instanceof Error ? error : new Error(String(error))]
            };
        }
    }
    
    /**
     * Choose the best strategy based on context analysis
     */
    private chooseBestStrategy(context: InvalidationContext): ICacheInvalidationStrategy {
        const impactScore = this.calculateImpactScore(context);
        const timeSinceLastInvalidation = Date.now() - context.lastInvalidation;
        
        // If we just invalidated recently, prefer partial
        if (timeSinceLastInvalidation < 5000) { // 5 seconds
            return this.partialStrategy;
        }
        
        // Check for include file changes (these usually need cascade)
        if (context.event.filePath && this.isIncludeFile(context.event.filePath)) {
            return this.cascadeStrategy;
        }
        
        // Use strategies based on their ability to handle context
        const strategies = [this.fullStrategy, this.cascadeStrategy, this.partialStrategy];
        
        for (const strategy of strategies) {
            if (strategy.canHandle(context)) {
                return strategy;
            }
        }
        
        // Fallback to partial if nothing else works
        return this.partialStrategy;
    }
    
    /**
     * Check if file is an include file
     */
    private isIncludeFile(filePath: FilePath): boolean {
        const filename = path.basename(filePath).toLowerCase();
        return filename.includes('include') || 
               filename.includes('import') ||
               filename.startsWith('common.') ||
               filename.startsWith('shared.');
    }
}

/**
 * Strategy registry for managing all available strategies
 */
export class InvalidationStrategyRegistry extends SyncSingleton {
    private readonly strategies: Map<string, ICacheInvalidationStrategy> = new Map();
    
    constructor() {
        super();
    }

    protected getSingletonKey(): string {
        return 'InvalidationStrategyRegistry';
    }

    protected initialize(): void {
        // Register default strategies
        this.register(new PartialInvalidationStrategy());
        this.register(new CascadeInvalidationStrategy());  
        this.register(new FullInvalidationStrategy());
        this.register(new SmartInvalidationStrategy());

        // Register with lifecycle manager
        SingletonLifecycleManager.register(this);
    }
    
    /**
     * Register a new invalidation strategy
     */
    register(strategy: ICacheInvalidationStrategy): void {
        this.strategies.set(strategy.name, strategy);
    }
    
    /**
     * Get strategy by name
     */
    getStrategy(name: string): ICacheInvalidationStrategy | null {
        return this.strategies.get(name) || null;
    }
    
    /**
     * Find best strategy for given context
     */
    findBestStrategy(context: InvalidationContext): ICacheInvalidationStrategy {
        const candidates = Array.from(this.strategies.values())
            .filter(strategy => strategy.canHandle(context))
            .sort((a, b) => b.priority - a.priority);
        
        if (candidates.length === 0) {
            throw new InvalidationError(
                'No suitable invalidation strategy found',
                context.event,
                { availableStrategies: Array.from(this.strategies.keys()) }
            );
        }
        
        return candidates[0];
    }
    
    /**
     * Get all registered strategies
     */
    getAllStrategies(): readonly ICacheInvalidationStrategy[] {
        return Array.from(this.strategies.values());
    }
    
    /**
     * Get strategy names sorted by priority
     */
    getStrategyNames(): readonly string[] {
        return Array.from(this.strategies.values())
            .sort((a, b) => b.priority - a.priority)
            .map(s => s.name);
    }


    /**
     * Reset singleton for testing
     */
    public static resetInstance(): void {
        const instances = SyncSingleton.getActiveInstances();
        const instance = instances.get('InvalidationStrategyRegistry');
        if (instance) {
            instance.reset();
        }
    }

    /**
     * Override dispose to cleanup resources properly
     */
    public dispose(): void {
        this.strategies.clear();
        super.dispose();
    }
}

/**
 * Default strategy registry instance
 * @deprecated Use InvalidationStrategyRegistry.getInstance() instead
 */
export const defaultStrategyRegistry = InvalidationStrategyRegistry.getInstance();