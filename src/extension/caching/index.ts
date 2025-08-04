/**
 * Central caching system module with feature flags and configuration management
 * 
 * This module provides:
 * - Feature flag management for gradual rollout
 * - Configuration management for the caching system
 * - Factory functions for creating configured components
 * - Integration with VS Code settings
 * - Migration utilities for existing caches
 */

import * as vscode from 'vscode';
import {
    CacheSystemConfig,
    CacheFeatureFlags,
    DEFAULT_CACHE_SYSTEM_CONFIG,
    DEFAULT_FEATURE_FLAGS,
    ICacheInvalidationManager,
    ISmartCache,
    CacheableData,
    InvalidationEventType,
    InvalidationStrategy,
    createFilePath,
    createProjectPath,
    createWorkspacePath,
    IEnhancedProjectCache,
    IEnhancedWorkspaceCache,
    PartialSmartCacheConfig,
    ICacheDiagnostics,
    InvalidationEventId
} from './interfaces';
import { createCacheInvalidationManager } from './CacheInvalidationManager';
import { createSmartCache } from './SmartCache';
import { createEnhancedProjectCache, createEnhancedWorkspaceCache } from './EnhancedCaches';
import { createFileWatcher } from './FileWatcher';
import { defaultStrategyRegistry } from './InvalidationStrategies';

/**
 * Central caching system manager
 */
export class CachingSystem {
    private static instance: CachingSystem | null = null;
    
    private invalidationManager: ICacheInvalidationManager | null = null;
    private enhancedProjectCache: IEnhancedProjectCache | null = null;
    private enhancedWorkspaceCache: IEnhancedWorkspaceCache | null = null;
    private disposables: vscode.Disposable[] = [];
    private config: CacheSystemConfig = DEFAULT_CACHE_SYSTEM_CONFIG;
    private isInitialized: boolean = false;
    
    private constructor() {}
    
    /**
     * Get singleton instance
     */
    static getInstance(): CachingSystem {
        if (!CachingSystem.instance) {
            CachingSystem.instance = new CachingSystem();
        }
        return CachingSystem.instance;
    }
    
    /**
     * Initialize the caching system with VS Code integration
     */
    async initialize(context: vscode.ExtensionContext): Promise<void> {
        if (this.isInitialized) {
            return;
        }
        
        try {
            // Load configuration from VS Code settings
            await this.loadConfiguration();
            
            // Initialize invalidation manager if features are enabled
            if (this.shouldInitializeInvalidationManager()) {
                await this.initializeInvalidationManager();
            }
            
            // Initialize enhanced caches if features are enabled
            if (this.shouldInitializeEnhancedCaches()) {
                await this.initializeEnhancedCaches();
            }
            
            // Setup configuration change listener
            this.setupConfigurationListener();
            
            // Register for cleanup
            context.subscriptions.push(new vscode.Disposable(() => {
                this.dispose();
            }));
            
            this.isInitialized = true;
            
            if (process.env.NODE_ENV !== 'test') {
                console.log('CachingSystem: Initialized with features:', this.getEnabledFeatures());
            }
        } catch (error) {
            console.error('CachingSystem: Failed to initialize:', error);
            throw error;
        }
    }
    
    /**
     * Get enhanced project cache (backward compatible)
     */
    getProjectCache(): IEnhancedProjectCache | null {
        if (!this.config.features.smartInvalidation) {
            // Return null to use legacy cache
            return null;
        }
        
        if (!this.enhancedProjectCache) {
            this.enhancedProjectCache = createEnhancedProjectCache(this.invalidationManager || undefined);
        }
        
        return this.enhancedProjectCache;
    }
    
    /**
     * Get enhanced workspace cache (backward compatible)
     */
    getWorkspaceCache(): IEnhancedWorkspaceCache | null {
        if (!this.config.features.smartInvalidation) {
            // Return null to use legacy cache
            return null;
        }
        
        if (!this.enhancedWorkspaceCache) {
            this.enhancedWorkspaceCache = createEnhancedWorkspaceCache(this.invalidationManager || undefined);
        }
        
        return this.enhancedWorkspaceCache;
    }
    
    /**
     * Create a new smart cache instance
     */
    createSmartCache<T extends CacheableData>(
        name: string, 
        config: PartialSmartCacheConfig<T> = {}
    ): ISmartCache<T> | null {
        if (!this.config.features.smartInvalidation) {
            return null;
        }
        
        const cache = createSmartCache<T>(name, {
            ...this.config.smartCache,
            ...config
        });
        
        // Register with invalidation manager if available
        if (this.invalidationManager) {
            this.invalidationManager.registerCache(cache);
        }
        
        return cache;
    }
    
    /**
     * Get invalidation manager
     */
    getInvalidationManager(): ICacheInvalidationManager | null {
        return this.invalidationManager;
    }
    
    /**
     * Manually trigger cache invalidation
     */
    async invalidateCache(reason: string = 'manual'): Promise<void> {
        if (!this.invalidationManager) {
            if (process.env.NODE_ENV !== 'test') {
                console.log('CachingSystem: Invalidation manager not available, skipping invalidation');
            }
            return;
        }
        
        try {
            await this.invalidationManager.processEvent({
                id: `manual_${Date.now()}` as InvalidationEventId,
                type: InvalidationEventType.MANUAL_INVALIDATION,
                timestamp: Date.now(),
                strategy: InvalidationStrategy.FULL,
                metadata: { reason }
            });
            
            if (process.env.NODE_ENV !== 'test') {
                console.log(`CachingSystem: Manual cache invalidation completed (${reason})`);
            }
        } catch (error) {
            console.error('CachingSystem: Error during manual invalidation:', error);
        }
    }
    
    /**
     * Get system diagnostics
     */
    getDiagnostics(): ICacheDiagnostics {
        return {
            isInitialized: this.isInitialized,
            enabledFeatures: this.getEnabledFeatures(),
            invalidationStats: this.invalidationManager?.getStats() || null,
            projectCacheMetrics: this.enhancedProjectCache?.getMetrics() || null,
            workspaceCacheMetrics: this.enhancedWorkspaceCache?.getMetrics() || null
        };
    }
    
    /**
     * Dispose and cleanup resources
     */
    dispose(): void {
        try {
            // Dispose invalidation manager
            if (this.invalidationManager) {
                this.invalidationManager.dispose();
                this.invalidationManager = null;
            }
            
            // Clear enhanced caches
            if (this.enhancedProjectCache) {
                this.enhancedProjectCache.clear();
                this.enhancedProjectCache = null;
            }
            
            if (this.enhancedWorkspaceCache) {
                this.enhancedWorkspaceCache.clear();
                this.enhancedWorkspaceCache = null;
            }
            
            // Dispose all disposables
            for (const disposable of this.disposables) {
                disposable.dispose();
            }
            this.disposables.length = 0;
            
            this.isInitialized = false;
            
            if (process.env.NODE_ENV !== 'test') {
                console.log('CachingSystem: Disposed and cleaned up');
            }
        } catch (error) {
            console.error('CachingSystem: Error during disposal:', error);
        }
    }
    
    // === PRIVATE IMPLEMENTATION ===
    
    /**
     * Load configuration from VS Code settings
     */
    private async loadConfiguration(): Promise<void> {
        const hledgerConfig = vscode.workspace.getConfiguration('hledger');
        
        // Load feature flags
        const features: CacheFeatureFlags = {
            smartInvalidation: hledgerConfig.get<boolean>('cache.smartInvalidation', DEFAULT_FEATURE_FLAGS.smartInvalidation),
            cascadeInvalidation: hledgerConfig.get<boolean>('cache.cascadeInvalidation', DEFAULT_FEATURE_FLAGS.cascadeInvalidation),
            fileWatching: hledgerConfig.get<boolean>('cache.fileWatching', DEFAULT_FEATURE_FLAGS.fileWatching),
            compressionEnabled: hledgerConfig.get<boolean>('cache.compressionEnabled', DEFAULT_FEATURE_FLAGS.compressionEnabled),
            persistentCache: hledgerConfig.get<boolean>('cache.persistentCache', DEFAULT_FEATURE_FLAGS.persistentCache),
            metricsCollection: hledgerConfig.get<boolean>('cache.metricsCollection', DEFAULT_FEATURE_FLAGS.metricsCollection),
            debugLogging: hledgerConfig.get<boolean>('cache.debugLogging', DEFAULT_FEATURE_FLAGS.debugLogging)
        };
        
        // Load invalidation config
        const invalidationConfig = {
            debounceMs: hledgerConfig.get<number>('cache.debounceMs', DEFAULT_CACHE_SYSTEM_CONFIG.invalidation.debounceMs),
            maxBatchSize: hledgerConfig.get<number>('cache.maxBatchSize', DEFAULT_CACHE_SYSTEM_CONFIG.invalidation.maxBatchSize),
            enableSmartInvalidation: features.smartInvalidation,
            enableCascading: features.cascadeInvalidation,
            maxCacheAge: hledgerConfig.get<number>('cache.maxAge', DEFAULT_CACHE_SYSTEM_CONFIG.invalidation.maxCacheAge),
            compressionEnabled: features.compressionEnabled,
            persistentCache: features.persistentCache
        };
        
        // Load file watcher config
        const fileWatcherConfig = {
            patterns: hledgerConfig.get<string[]>('cache.watchPatterns', [...DEFAULT_CACHE_SYSTEM_CONFIG.fileWatcher.patterns]),
            excludePatterns: hledgerConfig.get<string[]>('cache.excludePatterns', [...DEFAULT_CACHE_SYSTEM_CONFIG.fileWatcher.excludePatterns]),
            debounceMs: invalidationConfig.debounceMs,
            maxEvents: hledgerConfig.get<number>('cache.maxEvents', DEFAULT_CACHE_SYSTEM_CONFIG.fileWatcher.maxEvents),
            enableRecursive: hledgerConfig.get<boolean>('cache.recursiveWatch', DEFAULT_CACHE_SYSTEM_CONFIG.fileWatcher.enableRecursive)
        };
        
        // Load smart cache config
        const smartCacheConfig = {
            defaultMaxSize: hledgerConfig.get<number>('cache.maxSize', DEFAULT_CACHE_SYSTEM_CONFIG.smartCache.defaultMaxSize),
            defaultMaxAge: invalidationConfig.maxCacheAge,
            enableCompression: features.compressionEnabled
        };
        
        this.config = {
            features,
            invalidation: invalidationConfig,
            fileWatcher: fileWatcherConfig,
            smartCache: smartCacheConfig
        };
    }
    
    /**
     * Check if invalidation manager should be initialized
     */
    private shouldInitializeInvalidationManager(): boolean {
        return this.config.features.smartInvalidation || 
               this.config.features.fileWatching ||
               this.config.features.cascadeInvalidation;
    }
    
    /**
     * Check if enhanced caches should be initialized
     */
    private shouldInitializeEnhancedCaches(): boolean {
        return this.config.features.smartInvalidation;
    }
    
    /**
     * Initialize invalidation manager
     */
    private async initializeInvalidationManager(): Promise<void> {
        this.invalidationManager = createCacheInvalidationManager();
        await this.invalidationManager.initialize(this.config.invalidation);
        
        if (process.env.NODE_ENV !== 'test') {
            console.log('CachingSystem: Invalidation manager initialized');
        }
    }
    
    /**
     * Initialize enhanced caches
     */
    private async initializeEnhancedCaches(): Promise<void> {
        this.enhancedProjectCache = createEnhancedProjectCache(this.invalidationManager || undefined);
        this.enhancedWorkspaceCache = createEnhancedWorkspaceCache(this.invalidationManager || undefined);
        
        if (process.env.NODE_ENV !== 'test') {
            console.log('CachingSystem: Enhanced caches initialized');
        }
    }
    
    /**
     * Setup configuration change listener
     */
    private setupConfigurationListener(): void {
        const disposable = vscode.workspace.onDidChangeConfiguration(async (event) => {
            if (event.affectsConfiguration('hledger.cache')) {
                try {
                    if (process.env.NODE_ENV !== 'test') {
                        console.log('CachingSystem: Configuration changed, reinitializing...');
                    }
                    
                    // Dispose current components
                    this.dispose();
                    
                    // Reload configuration
                    await this.loadConfiguration();
                    
                    // Reinitialize based on new configuration
                    if (this.shouldInitializeInvalidationManager()) {
                        await this.initializeInvalidationManager();
                    }
                    
                    if (this.shouldInitializeEnhancedCaches()) {
                        await this.initializeEnhancedCaches();
                    }
                    
                    this.isInitialized = true;
                    
                    if (process.env.NODE_ENV !== 'test') {
                        console.log('CachingSystem: Reinitialized with new configuration');
                    }
                } catch (error) {
                    console.error('CachingSystem: Error reinitializing after configuration change:', error);
                }
            }
        });
        
        this.disposables.push(disposable);
    }
    
    /**
     * Get list of enabled features
     */
    private getEnabledFeatures(): string[] {
        const features: string[] = [];
        
        for (const [key, value] of Object.entries(this.config.features)) {
            if (value) {
                features.push(key);
            }
        }
        
        return features;
    }
}

// === EXPORTED FUNCTIONS ===

/**
 * Initialize the caching system
 */
export async function initializeCaching(context: vscode.ExtensionContext): Promise<void> {
    const cachingSystem = CachingSystem.getInstance();
    await cachingSystem.initialize(context);
}

/**
 * Get the caching system instance
 */
export function getCachingSystem(): CachingSystem {
    return CachingSystem.getInstance();
}

/**
 * Create a smart cache (convenience function)
 */
export function createCache<T extends CacheableData>(
    name: string, 
    config: PartialSmartCacheConfig<T> = {}
): ISmartCache<T> | null {
    return getCachingSystem().createSmartCache<T>(name, config);
}

/**
 * Manual cache invalidation (convenience function)
 */
export async function invalidateCache(reason: string = 'manual'): Promise<void> {
    await getCachingSystem().invalidateCache(reason);
}

/**
 * Get system diagnostics (convenience function)
 */
export function getCacheDiagnostics(): ICacheDiagnostics {
    return getCachingSystem().getDiagnostics();
}

// === RE-EXPORTS ===

// Export all interfaces and types
export * from './interfaces';

// Export main components
export { SmartCache, createSmartCache } from './SmartCache';
export { CacheInvalidationManager, createCacheInvalidationManager } from './CacheInvalidationManager';
export { FileWatcher, createFileWatcher } from './FileWatcher';
export { 
    EnhancedProjectCache, 
    EnhancedWorkspaceCache,
    createEnhancedProjectCache,
    createEnhancedWorkspaceCache 
} from './EnhancedCaches';
export { 
    PartialInvalidationStrategy,
    CascadeInvalidationStrategy,
    FullInvalidationStrategy,
    SmartInvalidationStrategy,
    InvalidationStrategyRegistry,
    defaultStrategyRegistry
} from './InvalidationStrategies';

// Export utility functions
export {
    createFilePath,
    createProjectPath,
    createWorkspacePath,
    createCacheKey
} from './interfaces';