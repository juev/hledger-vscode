/**
 * Comprehensive type-safe interfaces for the HLedger cache invalidation system
 * 
 * This file provides branded types, strict generic constraints, and error boundaries
 * for a production-ready caching system with granular invalidation strategies.
 */

import * as vscode from 'vscode';

// === BRANDED TYPES FOR TYPE SAFETY ===

/**
 * Branded string type for file paths to prevent mixing with regular strings
 */
export type FilePath = string & { readonly __brand: 'FilePath' };

/**
 * Branded string type for project paths
 */
export type ProjectPath = string & { readonly __brand: 'ProjectPath' };

/**
 * Branded string type for workspace paths  
 */
export type WorkspacePath = string & { readonly __brand: 'WorkspacePath' };

/**
 * Branded type for cache keys to ensure type safety
 */
export type CacheKey = string & { readonly __brand: 'CacheKey' };

/**
 * Branded type for invalidation event IDs
 */
export type InvalidationEventId = string & { readonly __brand: 'InvalidationEventId' };

// === UTILITY TYPES ===

/**
 * Helper function to create branded FilePath
 */
export const createFilePath = (path: string): FilePath => path as FilePath;

/**
 * Helper function to create branded ProjectPath
 */
export const createProjectPath = (path: string): ProjectPath => path as ProjectPath;

/**
 * Helper function to create branded WorkspacePath
 */
export const createWorkspacePath = (path: string): WorkspacePath => path as WorkspacePath;

/**
 * Helper function to create branded CacheKey
 */
export const createCacheKey = (key: string): CacheKey => key as CacheKey;

// === INVALIDATION EVENT TYPES ===

/**
 * Types of invalidation events that can occur
 */
export enum InvalidationEventType {
    FILE_CREATED = 'file-created',
    FILE_MODIFIED = 'file-modified', 
    FILE_DELETED = 'file-deleted',
    FILE_RENAMED = 'file-renamed',
    DIRECTORY_CREATED = 'directory-created',
    DIRECTORY_DELETED = 'directory-deleted',
    INCLUDE_CHANGED = 'include-changed',
    CONFIG_CHANGED = 'config-changed',
    MANUAL_INVALIDATION = 'manual-invalidation'
}

/**
 * Invalidation strategies for different scenarios
 */
export enum InvalidationStrategy {
    PARTIAL = 'partial',        // Only invalidate specific data
    CASCADE = 'cascade',        // Also invalidate dependent data
    FULL = 'full',             // Full cache invalidation
    SMART = 'smart'            // AI-determined strategy based on changes
}

/**
 * Invalidation event data structure
 */
export interface InvalidationEvent {
    readonly id: InvalidationEventId;
    readonly type: InvalidationEventType;
    readonly timestamp: number;
    readonly filePath?: FilePath;
    readonly oldPath?: FilePath;  // For rename events
    readonly newPath?: FilePath;  // For rename events
    readonly projectPath?: ProjectPath;
    readonly workspacePath?: WorkspacePath;
    readonly strategy: InvalidationStrategy;
    readonly metadata?: Record<string, any>;
}

// === CACHE ENTRY INTERFACES ===

/**
 * Generic cache entry with metadata and validation
 */
export interface ICacheEntry<T> {
    readonly key: CacheKey;
    readonly data: T;
    readonly timestamp: number;
    readonly expiresAt?: number;
    readonly dependencies: readonly FilePath[];
    readonly metadata: Readonly<{
        lastModified: number;
        checksum?: string;
        size?: number;
        version: string;
    }>;
    readonly tags: readonly string[];
}

/**
 * Cache validation result
 */
export interface CacheValidationResult {
    readonly isValid: boolean;
    readonly reason?: string;
    readonly invalidatedKeys: readonly CacheKey[];
    readonly suggestedStrategy: InvalidationStrategy;
}

// === FILE WATCHING INTERFACES ===

/**
 * File system event data
 */
export interface FileSystemEvent {
    readonly type: InvalidationEventType;
    readonly uri: vscode.Uri;
    readonly timestamp: number;
}

/**
 * File watcher configuration
 */
export interface FileWatcherConfig {
    readonly patterns: readonly string[];
    readonly excludePatterns: readonly string[];
    readonly debounceMs: number;
    readonly maxEvents: number;
    readonly enableRecursive: boolean;
}

/**
 * File watcher interface
 */
export interface IFileWatcher {
    /**
     * Start watching files with the given configuration
     */
    start(config: FileWatcherConfig): Promise<void>;
    
    /**
     * Stop watching files
     */
    stop(): Promise<void>;
    
    /**
     * Add event listener for file system events
     */
    onFileSystemEvent(listener: (event: FileSystemEvent) => void): vscode.Disposable;
    
    /**
     * Check if watcher is currently active
     */
    readonly isActive: boolean;
    
    /**
     * Get current configuration
     */
    readonly config: Readonly<FileWatcherConfig> | null;
}

// === INVALIDATION STRATEGY INTERFACES ===

/**
 * Context for invalidation decisions
 */
export interface InvalidationContext {
    readonly event: InvalidationEvent;
    readonly affectedFiles: readonly FilePath[];
    readonly cacheSize: number;
    readonly lastInvalidation: number;
    readonly dependencyGraph: ReadonlyMap<FilePath, readonly FilePath[]>;
}

/**
 * Result of invalidation strategy execution
 */
export interface InvalidationResult {
    readonly strategy: InvalidationStrategy;
    readonly invalidatedKeys: readonly CacheKey[];
    readonly cascadedFiles: readonly FilePath[];
    readonly executionTimeMs: number;
    readonly errors: readonly Error[];
}

/**
 * Interface for invalidation strategy implementation
 */
export interface ICacheInvalidationStrategy {
    /**
     * Determine if this strategy can handle the given context
     */
    canHandle(context: InvalidationContext): boolean;
    
    /**
     * Execute the invalidation strategy
     */
    execute(context: InvalidationContext): Promise<InvalidationResult>;
    
    /**
     * Get strategy priority (higher = more preferred)
     */
    readonly priority: number;
    
    /**
     * Strategy name for debugging
     */
    readonly name: string;
}

// === CACHE INVALIDATION MANAGER INTERFACES ===

/**
 * Configuration for cache invalidation manager
 */
export interface CacheInvalidationConfig {
    readonly debounceMs: number;
    readonly maxBatchSize: number;
    readonly enableSmartInvalidation: boolean;
    readonly enableCascading: boolean;
    readonly maxCacheAge: number;
    readonly compressionEnabled: boolean;
    readonly persistentCache: boolean;
}

/**
 * Statistics for cache invalidation (readonly external interface)
 */
export interface InvalidationStats {
    readonly totalInvalidations: number;
    readonly partialInvalidations: number;
    readonly fullInvalidations: number;
    readonly cascadeInvalidations: number;
    readonly averageExecutionTime: number;
    readonly errorCount: number;
    readonly lastInvalidation: number;
}

/**
 * Internal mutable invalidation statistics for implementation use
 * @internal
 */
export interface MutableInvalidationStats {
    totalInvalidations: number;
    partialInvalidations: number;
    fullInvalidations: number;
    cascadeInvalidations: number;
    averageExecutionTime: number;
    errorCount: number;
    lastInvalidation: number;
}

/**
 * Main cache invalidation manager interface
 */
export interface ICacheInvalidationManager {
    /**
     * Initialize the invalidation manager
     */
    initialize(config: CacheInvalidationConfig): Promise<void>;
    
    /**
     * Process an invalidation event
     */
    processEvent(event: InvalidationEvent): Promise<InvalidationResult>;
    
    /**
     * Register a cache for management
     */
    registerCache<T = CacheableData>(cache: ISmartCache<T>): void;
    
    /**
     * Unregister a cache
     */
    unregisterCache<T = CacheableData>(cache: ISmartCache<T>): void;
    
    /**
     * Manual invalidation trigger
     */
    invalidate(keys: readonly CacheKey[], strategy?: InvalidationStrategy): Promise<InvalidationResult>;
    
    /**
     * Get invalidation statistics
     */
    getStats(): InvalidationStats;
    
    /**
     * Dispose and cleanup resources
     */
    dispose(): Promise<void>;
}

// === SMART CACHE INTERFACES ===

/**
 * Cache performance metrics (readonly external interface)
 */
export interface CacheMetrics {
    readonly hitRate: number;
    readonly missRate: number;
    readonly totalHits: number;
    readonly totalMisses: number;
    readonly averageAccessTime: number;
    readonly memoryUsage: number;
    readonly entryCount: number;
}

/**
 * Internal mutable metrics for implementation use
 * @internal
 */
export interface MutableCacheMetrics {
    hitRate: number;
    missRate: number;
    totalHits: number;
    totalMisses: number;
    averageAccessTime: number;
    memoryUsage: number;
    entryCount: number;
}

/**
 * Cache configuration with type constraints
 */
export interface SmartCacheConfig<T> {
    readonly maxSize: number;
    readonly maxAge: number;
    readonly enableCompression: boolean;
    readonly enablePersistence: boolean;
    readonly validator?: (entry: ICacheEntry<T>) => boolean;
    readonly serializer?: {
        serialize: (data: T) => string;
        deserialize: (data: string) => T;
    };
}

/**
 * Generic constraint for cacheable data
 */
export type CacheableData = Record<string, any> | readonly any[] | string | number | boolean | null;

/**
 * Helper type to check if T extends CacheableData
 */
export type EnsureCacheable<T> = T extends CacheableData ? T : never;

/**
 * Smart cache interface with automatic invalidation
 */
export interface ISmartCache<T = CacheableData> {
    /**
     * Get cached data by key
     */
    get(key: CacheKey): Promise<T | null>;
    
    /**
     * Set cached data with dependencies
     */
    set(key: CacheKey, data: T, dependencies?: readonly FilePath[], tags?: readonly string[]): Promise<void>;
    
    /**
     * Check if key exists and is valid
     */
    has(key: CacheKey): Promise<boolean>;
    
    /**
     * Delete specific cache entry
     */
    delete(key: CacheKey): Promise<boolean>;
    
    /**
     * Clear all cache entries
     */
    clear(): Promise<void>;
    
    /**
     * Invalidate entries by dependencies
     */
    invalidateByDependencies(files: readonly FilePath[]): Promise<readonly CacheKey[]>;
    
    /**
     * Invalidate entries by tags
     */
    invalidateByTags(tags: readonly string[]): Promise<readonly CacheKey[]>;
    
    /**
     * Get cache metrics
     */
    getMetrics(): CacheMetrics;
    
    /**
     * Get all cache keys
     */
    getKeys(): Promise<readonly CacheKey[]>;
    
    /**
     * Validate cache integrity
     */
    validate(): Promise<CacheValidationResult>;
    
    /**
     * Cache name for identification
     */
    readonly name: string;
    
    /**
     * Cache configuration
     */
    readonly config: Readonly<SmartCacheConfig<T>>;
}

// === ENHANCED INTERFACES FOR EXISTING CACHES ===

/**
 * Enhanced project cache with invalidation support
 */
export interface IEnhancedProjectCache extends ISmartCache<any> {
    /**
     * Get configuration for specific project
     */
    getConfig(projectPath: ProjectPath): Promise<any | null>;
    
    /**
     * Initialize project configuration
     */
    initialize(projectPath: ProjectPath): Promise<any>;
    
    /**
     * Check if project exists in cache
     */
    hasProject(projectPath: ProjectPath): Promise<boolean>;
    
    /**
     * Find project for specific file
     */
    findProjectForFile(filePath: FilePath): Promise<ProjectPath | null>;
    
    /**
     * Get all cached projects
     */
    getProjects(): Promise<readonly ProjectPath[]>;
}

/**
 * Enhanced workspace cache with invalidation support
 */
export interface IEnhancedWorkspaceCache extends ISmartCache<any> {
    /**
     * Check if workspace cache is valid
     */
    isValid(workspacePath: WorkspacePath): Promise<boolean>;
    
    /**
     * Update workspace cache
     */
    update(workspacePath: WorkspacePath): Promise<void>;
    
    /**
     * Get workspace configuration
     */
    getConfig(): Promise<any | null>;
    
    /**
     * Get current workspace path
     */
    getWorkspacePath(): Promise<WorkspacePath | null>;
}

// === ERROR TYPES ===

/**
 * Base cache error with context
 */
export abstract class CacheError extends Error {
    constructor(
        message: string,
        public readonly context: Record<string, any> = {},
        public readonly cause?: Error
    ) {
        super(message);
        this.name = this.constructor.name;
    }
}

/**
 * Cache invalidation specific errors
 */
export class InvalidationError extends CacheError {
    constructor(
        message: string,
        public readonly event: InvalidationEvent,
        context: Record<string, any> = {},
        cause?: Error
    ) {
        super(message, { ...context, eventId: event.id, eventType: event.type }, cause);
    }
}

/**
 * File watcher specific errors
 */
export class FileWatcherError extends CacheError {
    constructor(
        message: string,
        public readonly watcherPath?: string,
        context: Record<string, any> = {},
        cause?: Error
    ) {
        super(message, { ...context, watcherPath }, cause);
    }
}

/**
 * Cache validation errors
 */
export class CacheValidationError extends CacheError {
    constructor(
        message: string,
        public readonly cacheKey: CacheKey,
        context: Record<string, any> = {},
        cause?: Error
    ) {
        super(message, { ...context, cacheKey }, cause);
    }
}

// === FEATURE FLAGS ===

/**
 * Feature flags for gradual rollout
 */
export interface CacheFeatureFlags {
    readonly smartInvalidation: boolean;
    readonly cascadeInvalidation: boolean;
    readonly fileWatching: boolean;
    readonly compressionEnabled: boolean;
    readonly persistentCache: boolean;
    readonly metricsCollection: boolean;
    readonly debugLogging: boolean;
}

/**
 * Default feature flags (conservative defaults)
 */
export const DEFAULT_FEATURE_FLAGS: CacheFeatureFlags = {
    smartInvalidation: false,
    cascadeInvalidation: false,
    fileWatching: false,
    compressionEnabled: false,
    persistentCache: false,
    metricsCollection: true,
    debugLogging: false
} as const;

// === CONFIGURATION INTERFACES ===

/**
 * Main configuration for the caching system
 */
export interface CacheSystemConfig {
    readonly features: CacheFeatureFlags;
    readonly invalidation: CacheInvalidationConfig;
    readonly fileWatcher: FileWatcherConfig;
    readonly smartCache: {
        readonly defaultMaxSize: number;
        readonly defaultMaxAge: number;
        readonly enableCompression: boolean;
    };
}

/**
 * Default system configuration
 */
export const DEFAULT_CACHE_SYSTEM_CONFIG: CacheSystemConfig = {
    features: DEFAULT_FEATURE_FLAGS,
    invalidation: {
        debounceMs: 100,
        maxBatchSize: 50,
        enableSmartInvalidation: false,
        enableCascading: false,
        maxCacheAge: 300000, // 5 minutes
        compressionEnabled: false,
        persistentCache: false
    },
    fileWatcher: {
        patterns: ['**/*.journal', '**/*.hledger', '**/*.ledger'],
        excludePatterns: ['**/node_modules/**', '**/.git/**'],
        debounceMs: 100,
        maxEvents: 100,
        enableRecursive: true
    },
    smartCache: {
        defaultMaxSize: 1000,
        defaultMaxAge: 300000, // 5 minutes
        enableCompression: false
    }
} as const;