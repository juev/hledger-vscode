/**
 * Comprehensive tests for the cache invalidation system
 * 
 * This test suite covers:
 * - SmartCache functionality and LRU eviction
 * - File watcher debouncing and event handling
 * - Invalidation strategies (partial, cascade, full, smart)
 * - Cache invalidation manager coordination
 * - Enhanced cache backward compatibility
 * - Feature flags and configuration management
 * - Error handling and recovery
 */

import * as vscode from 'vscode';
import { createSmartCache } from '../caching/SmartCache';
import { createFileWatcher } from '../caching/FileWatcher';
import { createCacheInvalidationManager } from '../caching/CacheInvalidationManager';
import { 
    PartialInvalidationStrategy,
    CascadeInvalidationStrategy,
    FullInvalidationStrategy,
    SmartInvalidationStrategy,
    InvalidationStrategyRegistry
} from '../caching/InvalidationStrategies';
import { 
    createEnhancedProjectCache,
    createEnhancedWorkspaceCache
} from '../caching/EnhancedCaches';
import { CachingSystem, getCachingSystem, initializeCaching } from '../caching';
import {
    ISmartCache,
    ICacheInvalidationManager,
    IFileWatcher,
    IEnhancedProjectCache,
    IEnhancedWorkspaceCache,
    CacheKey,
    FilePath,
    ProjectPath,
    WorkspacePath,
    InvalidationEventType,
    InvalidationStrategy,
    createCacheKey,
    createFilePath,
    createProjectPath,
    createWorkspacePath
} from '../caching/interfaces';

// Mock VS Code API for testing
jest.mock('vscode', () => ({
    workspace: {
        getConfiguration: jest.fn(() => ({
            get: jest.fn((key, defaultValue) => defaultValue)
        })),
        createFileSystemWatcher: jest.fn(() => ({
            onDidCreate: jest.fn(),
            onDidChange: jest.fn(),
            onDidDelete: jest.fn(),
            dispose: jest.fn()
        })),
        onDidChangeConfiguration: jest.fn(() => ({
            dispose: jest.fn()
        }))
    },
    Disposable: jest.fn().mockImplementation((callback) => ({
        dispose: callback
    })),
    Uri: {
        file: jest.fn((path) => ({ fsPath: path }))
    }
}));

describe('Cache Invalidation System', () => {
    beforeAll(() => {
        // Set test environment
        process.env.NODE_ENV = 'test';
    });
    
    afterEach(() => {
        // Clean up any timers or pending operations
        jest.clearAllTimers();
    });

    describe('SmartCache', () => {
        let cache: any;
        
        beforeEach(() => {
            cache = createSmartCache('test-cache', {
                maxSize: 5,
                maxAge: 1000,
                enableCompression: false,
                enablePersistence: false
            });
        });
        
        afterEach(async () => {
            await cache.clear();
        });
        
        test('should store and retrieve data', async () => {
            const key = createCacheKey('test-key');
            const data = { message: 'Hello, World!' };
            
            await cache.set(key, data);
            const retrieved = await cache.get(key);
            
            expect(retrieved).toEqual(data);
        });
        
        test('should handle dependencies and tags', async () => {
            const key = createCacheKey('test-key');
            const data = { message: 'Test' };
            const dependencies = [createFilePath('/test/file.journal')];
            const tags = ['test-tag'];
            
            await cache.set(key, data, dependencies, tags);
            
            // Invalidate by dependencies
            const invalidated = await cache.invalidateByDependencies(dependencies);
            expect(invalidated).toContain(key);
            
            // Data should be removed
            const retrieved = await cache.get(key);
            expect(retrieved).toBeNull();
        });
        
        test('should handle cache size limits with LRU eviction', async () => {
            // Fill cache to capacity
            for (let i = 0; i < 5; i++) {
                await cache.set(createCacheKey(`key-${i}`), { value: i });
            }
            
            // Access some entries to change LRU order
            await cache.get(createCacheKey('key-0'));
            await cache.get(createCacheKey('key-1'));
            
            // Add one more entry to trigger eviction
            await cache.set(createCacheKey('key-5'), { value: 5 });
            
            // Least recently used entries should be evicted
            expect(await cache.has(createCacheKey('key-0'))).toBe(true); // Recently accessed
            expect(await cache.has(createCacheKey('key-1'))).toBe(true); // Recently accessed
            expect(await cache.has(createCacheKey('key-5'))).toBe(true); // Just added
            
            // Some older entries should be evicted
            const metrics = cache.getMetrics();
            expect(metrics.entryCount).toBeLessThanOrEqual(5);
        });
        
        test('should handle expiration', async () => {
            const shortLivedCache = createSmartCache('short-lived', {
                maxSize: 10,
                maxAge: 50, // 50ms
                enableCompression: false,
                enablePersistence: false
            });
            
            const key = createCacheKey('expiring-key');
            await shortLivedCache.set(key, { data: 'test' });
            
            // Should exist initially
            expect(await shortLivedCache.has(key)).toBe(true);
            
            // Wait for expiration
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Should be expired
            expect(await shortLivedCache.has(key)).toBe(false);
            
            await shortLivedCache.clear();
        });
        
        test('should track metrics correctly', async () => {
            const key = createCacheKey('metrics-key');
            const data = { test: 'data' };
            
            // Initial metrics
            let metrics = cache.getMetrics();
            expect(metrics.totalHits).toBe(0);
            expect(metrics.totalMisses).toBe(0);
            
            // Cache miss
            await cache.get(key);
            metrics = cache.getMetrics();
            expect(metrics.totalMisses).toBe(1);
            
            // Cache set and hit
            await cache.set(key, data);
            await cache.get(key);
            metrics = cache.getMetrics();
            expect(metrics.totalHits).toBe(1);
            expect(metrics.hitRate).toBeCloseTo(0.5); // 1 hit out of 2 total accesses
        });
    });
    
    describe('Invalidation Strategies', () => {
        let registry: InvalidationStrategyRegistry;
        
        beforeEach(() => {
            registry = new InvalidationStrategyRegistry();
        });
        
        test('should register and retrieve strategies', () => {
            const customStrategy = new PartialInvalidationStrategy();
            registry.register(customStrategy);
            
            const retrieved = registry.getStrategy('partial');
            expect(retrieved).toBe(customStrategy);
        });
        
        test('should find best strategy by priority', () => {
            const context = {
                event: {
                    id: 'test' as any,
                    type: InvalidationEventType.FILE_MODIFIED,
                    timestamp: Date.now(),
                    strategy: InvalidationStrategy.SMART
                },
                affectedFiles: [createFilePath('/test/file.journal')],
                cacheSize: 100,
                lastInvalidation: Date.now() - 10000,
                dependencyGraph: new Map()
            };
            
            const bestStrategy = registry.findBestStrategy(context);
            expect(bestStrategy.name).toBe('smart'); // Highest priority
        });
        
        test('partial strategy should handle low-impact changes', async () => {
            const strategy = new PartialInvalidationStrategy();
            const context = {
                event: {
                    id: 'test' as any,
                    type: InvalidationEventType.FILE_MODIFIED,
                    timestamp: Date.now(),
                    filePath: createFilePath('/test/small.journal'),
                    strategy: InvalidationStrategy.PARTIAL
                },
                affectedFiles: [createFilePath('/test/small.journal')],
                cacheSize: 50,
                lastInvalidation: Date.now() - 10000,
                dependencyGraph: new Map()
            };
            
            expect(strategy.canHandle(context)).toBe(true);
            
            const result = await strategy.execute(context);
            expect(result.strategy).toBe(InvalidationStrategy.PARTIAL);
            expect(result.invalidatedKeys.length).toBeGreaterThan(0);
            expect(result.cascadedFiles.length).toBe(0); // No cascading in partial
        });
        
        test('cascade strategy should handle dependencies', async () => {
            const strategy = new CascadeInvalidationStrategy();
            const mainFile = createFilePath('/test/main.journal');
            const includedFile = createFilePath('/test/included.journal');
            
            const dependencyGraph = new Map();
            dependencyGraph.set(mainFile, [includedFile]);
            
            const context = {
                event: {
                    id: 'test' as any,
                    type: InvalidationEventType.FILE_MODIFIED,
                    timestamp: Date.now(),
                    filePath: includedFile,
                    strategy: InvalidationStrategy.CASCADE
                },
                affectedFiles: [includedFile],
                cacheSize: 200,
                lastInvalidation: Date.now() - 10000,
                dependencyGraph
            };
            
            expect(strategy.canHandle(context)).toBe(true);
            
            const result = await strategy.execute(context);
            expect(result.strategy).toBe(InvalidationStrategy.CASCADE);
            expect(result.cascadedFiles.length).toBeGreaterThan(0);
        });
        
        test('full strategy should handle critical changes', async () => {
            const strategy = new FullInvalidationStrategy();
            const context = {
                event: {
                    id: 'test' as any,
                    type: InvalidationEventType.CONFIG_CHANGED,
                    timestamp: Date.now(),
                    strategy: InvalidationStrategy.FULL
                },
                affectedFiles: [],
                cacheSize: 1000,
                lastInvalidation: Date.now() - 10000,
                dependencyGraph: new Map()
            };
            
            expect(strategy.canHandle(context)).toBe(true);
            
            const result = await strategy.execute(context);
            expect(result.strategy).toBe(InvalidationStrategy.FULL);
            expect(result.invalidatedKeys).toContain(createCacheKey('*'));
        });
        
        test('smart strategy should delegate to best sub-strategy', async () => {
            const strategy = new SmartInvalidationStrategy();
            const context = {
                event: {
                    id: 'test' as any,
                    type: InvalidationEventType.FILE_MODIFIED,
                    timestamp: Date.now(),
                    filePath: createFilePath('/test/file.journal'),
                    strategy: InvalidationStrategy.SMART
                },
                affectedFiles: [createFilePath('/test/file.journal')],
                cacheSize: 100,
                lastInvalidation: Date.now() - 10000,
                dependencyGraph: new Map()
            };
            
            expect(strategy.canHandle(context)).toBe(true);
            
            const result = await strategy.execute(context);
            expect(result.strategy).toBe(InvalidationStrategy.SMART);
            expect(result.errors.length).toBe(0);
        });
    });
    
    describe('Cache Invalidation Manager', () => {
        let manager: any;
        let cache: any;
        
        beforeEach(async () => {
            manager = createCacheInvalidationManager();
            cache = createSmartCache('test-cache', { maxSize: 100, maxAge: 60000 });
            
            await manager.initialize({
                debounceMs: 50,
                maxBatchSize: 10,
                enableSmartInvalidation: true,
                enableCascading: true,
                maxCacheAge: 60000,
                compressionEnabled: false,
                persistentCache: false
            });
            
            manager.registerCache(cache);
        });
        
        afterEach(async () => {
            await manager.dispose();
            await cache.clear();
        });
        
        test('should process invalidation events', async () => {
            const event = {
                id: 'test-event' as any,
                type: InvalidationEventType.FILE_MODIFIED,
                timestamp: Date.now(),
                filePath: createFilePath('/test/file.journal'),
                strategy: InvalidationStrategy.SMART
            };
            
            const result = await manager.processEvent(event);
            expect(result.errors.length).toBe(0);
            expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
        });
        
        test('should handle manual invalidation', async () => {
            // Add some data to cache
            await cache.set(createCacheKey('test-key'), { data: 'test' });
            expect(await cache.has(createCacheKey('test-key'))).toBe(true);
            
            // Manual invalidation
            const keys = [createCacheKey('test-key')];
            const result = await manager.invalidate(keys);
            
            expect(result.invalidatedKeys).toContain(createCacheKey('test-key'));
            expect(await cache.has(createCacheKey('test-key'))).toBe(false);
        });
        
        test('should track statistics', async () => {
            const event = {
                id: 'stats-test' as any,
                type: InvalidationEventType.FILE_MODIFIED,
                timestamp: Date.now(),
                strategy: InvalidationStrategy.PARTIAL
            };
            
            await manager.processEvent(event);
            const stats = manager.getStats();
            
            expect(stats.totalInvalidations).toBeGreaterThan(0);
            expect(stats.averageExecutionTime).toBeGreaterThanOrEqual(0);
        });
    });
    
    describe('Enhanced Caches', () => {
        let projectCache: IEnhancedProjectCache;
        let workspaceCache: IEnhancedWorkspaceCache;
        
        beforeEach(() => {
            projectCache = createEnhancedProjectCache();
            workspaceCache = createEnhancedWorkspaceCache();
        });
        
        afterEach(async () => {
            await projectCache.clear();
            await workspaceCache.clear();
        });
        
        test('enhanced project cache should maintain backward compatibility', () => {
            // Test legacy synchronous interface
            const projectPath = createProjectPath('/test/project');
            
            // Should return null initially  
            expect((projectCache as any).getLegacyConfig(projectPath)).toBeNull();
            expect((projectCache as any).hasLegacyProject(projectPath)).toBe(false);
            
            // Initialize project (legacy sync method)
            const config = (projectCache as any).initializeLegacy(projectPath);
            expect(config).toBeDefined();
            expect((projectCache as any).hasLegacyProject(projectPath)).toBe(true);
            
            // Should now return config
            const retrievedConfig = (projectCache as any).getLegacyConfig(projectPath);
            expect(retrievedConfig).toBe(config);
        });
        
        test('enhanced project cache should work with async interface', async () => {
            const projectPath = createProjectPath('/test/async-project');
            
            // Test async interface
            expect(await projectCache.hasProject(projectPath)).toBe(false);
            
            const config = await projectCache.initialize(projectPath);
            expect(config).toBeDefined();
            expect(await projectCache.hasProject(projectPath)).toBe(true);
            
            const retrievedConfig = await projectCache.getConfig(projectPath);
            expect(retrievedConfig).toBe(config);
        });
        
        test('enhanced workspace cache should maintain backward compatibility', () => {
            const workspacePath = createWorkspacePath('/test/workspace');
            
            // Should be invalid initially
            expect((workspaceCache as any).isLegacyValid(workspacePath)).toBe(false);
            expect((workspaceCache as any).getLegacyConfig()).toBeNull();
            
            // Update workspace (legacy sync method)
            (workspaceCache as any).updateLegacy(workspacePath);
            expect((workspaceCache as any).isLegacyValid(workspacePath)).toBe(true);
            
            const config = (workspaceCache as any).getLegacyConfig();
            expect(config).toBeDefined();
        });
        
        test('enhanced workspace cache should work with async interface', async () => {
            const workspacePath = createWorkspacePath('/test/async-workspace');
            
            // Test async interface
            expect(await workspaceCache.isValid(workspacePath)).toBe(false);
            expect(await workspaceCache.getConfig()).toBeNull();
            
            await workspaceCache.update(workspacePath);
            expect(await workspaceCache.isValid(workspacePath)).toBe(true);
            
            const config = await workspaceCache.getConfig();
            expect(config).toBeDefined();
            
            const retrievedWorkspacePath = await workspaceCache.getWorkspacePath();
            expect(retrievedWorkspacePath).toBe(workspacePath);
        });
    });
    
    describe('File Watcher', () => {
        let fileWatcher: any;
        
        beforeEach(() => {
            fileWatcher = createFileWatcher();
        });
        
        afterEach(async () => {
            if (fileWatcher.isActive) {
                await fileWatcher.stop();
            }
        });
        
        test('should start and stop properly', async () => {
            expect(fileWatcher.isActive).toBe(false);
            
            await fileWatcher.start({
                patterns: ['**/*.journal'],
                excludePatterns: ['**/node_modules/**'],
                debounceMs: 100,
                maxEvents: 50,
                enableRecursive: true
            });
            
            expect(fileWatcher.isActive).toBe(true);
            expect(fileWatcher.config).toBeDefined();
            
            await fileWatcher.stop();
            expect(fileWatcher.isActive).toBe(false);
            expect(fileWatcher.config).toBeNull();
        });
        
        test('should handle event listeners', async () => {
            let eventReceived = false;
            const disposable = fileWatcher.onFileSystemEvent(() => {
                eventReceived = true;
            });
            
            expect(disposable).toBeDefined();
            expect(typeof disposable.dispose).toBe('function');
            
            disposable.dispose();
        });
    });
    
    describe('Caching System Integration', () => {
        let mockContext: vscode.ExtensionContext;
        
        beforeEach(() => {
            mockContext = {
                subscriptions: [],
                workspaceState: {
                    get: jest.fn(),
                    update: jest.fn()
                },
                globalState: {
                    get: jest.fn(),
                    update: jest.fn()
                }
            } as any;
            
            // Mock VS Code configuration
            (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
                get: jest.fn((key, defaultValue) => {
                    // Return conservative defaults for testing
                    const defaults: any = {
                        'cache.smartInvalidation': false,
                        'cache.fileWatching': false,
                        'cache.cascadeInvalidation': false,
                        'cache.compressionEnabled': false,
                        'cache.persistentCache': false,
                        'cache.metricsCollection': true,
                        'cache.debugLogging': false,
                        'cache.debounceMs': 100,
                        'cache.maxBatchSize': 50,
                        'cache.maxAge': 300000,
                        'cache.maxSize': 1000
                    };
                    return defaults[key] !== undefined ? defaults[key] : defaultValue;
                })
            });
        });
        
        afterEach(() => {
            // Clean up singleton
            const cachingSystem = getCachingSystem();
            cachingSystem.dispose();
        });
        
        test('should initialize with default configuration', async () => {
            await initializeCaching(mockContext);
            
            const cachingSystem = getCachingSystem();
            const diagnostics = cachingSystem.getDiagnostics();
            
            expect(diagnostics.isInitialized).toBe(true);
            expect(diagnostics.enabledFeatures).toContain('metricsCollection');
        });
        
        test('should handle feature flags correctly', async () => {
            // Enable smart invalidation
            (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
                get: jest.fn((key, defaultValue) => {
                    if (key === 'cache.smartInvalidation') return true;
                    if (key === 'cache.fileWatching') return true;
                    return defaultValue;
                })
            });
            
            await initializeCaching(mockContext);
            
            const cachingSystem = getCachingSystem();
            const diagnostics = cachingSystem.getDiagnostics();
            
            expect(diagnostics.enabledFeatures).toContain('smartInvalidation');
            expect(diagnostics.enabledFeatures).toContain('fileWatching');
            
            // Should have enhanced caches available
            const projectCache = cachingSystem.getProjectCache();
            const workspaceCache = cachingSystem.getWorkspaceCache();
            
            expect(projectCache).toBeDefined();
            expect(workspaceCache).toBeDefined();
        });
        
        test('should handle configuration changes', async () => {
            await initializeCaching(mockContext);
            
            // Simulate configuration change
            const configListener = (vscode.workspace.onDidChangeConfiguration as jest.Mock).mock.calls[0][0];
            
            await configListener({
                affectsConfiguration: jest.fn((section) => section === 'hledger.cache')
            });
            
            // System should still be initialized after config change
            const cachingSystem = getCachingSystem();
            const diagnostics = cachingSystem.getDiagnostics();
            expect(diagnostics.isInitialized).toBe(true);
        });
        
        test('should create smart caches when features are enabled', async () => {
            // Enable smart invalidation
            (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
                get: jest.fn((key, defaultValue) => {
                    if (key === 'cache.smartInvalidation') return true;
                    return defaultValue;
                })
            });
            
            await initializeCaching(mockContext);
            
            const cachingSystem = getCachingSystem();
            const cache = cachingSystem.createSmartCache('test-cache');
            
            expect(cache).toBeDefined();
            expect(cache?.name).toBe('test-cache');
        });
        
        test('should return null for smart caches when features are disabled', async () => {
            await initializeCaching(mockContext);
            
            const cachingSystem = getCachingSystem();
            const cache = cachingSystem.createSmartCache('test-cache');
            
            expect(cache).toBeNull();
        });
        
        test('should handle manual invalidation', async () => {
            await initializeCaching(mockContext);
            
            const cachingSystem = getCachingSystem();
            
            // Should not throw even with invalidation manager disabled
            await expect(cachingSystem.invalidateCache('test-reason')).resolves.not.toThrow();
        });
    });
    
    describe('Error Handling', () => {
        test('should handle cache validation errors gracefully', async () => {
            const cache = createSmartCache('error-test', {
                maxSize: 10,
                maxAge: 1000,
                validator: (entry) => {
                    // Reject entries with 'invalid' in data
                    return !JSON.stringify(entry.data).includes('invalid');
                }
            });
            
            const validKey = createCacheKey('valid-key');
            const invalidKey = createCacheKey('invalid-key');
            
            await cache.set(validKey, { message: 'valid data' });
            await cache.set(invalidKey, { message: 'invalid data' });
            
            // Valid entry should be accessible
            expect(await cache.get(validKey)).toBeDefined();
            
            // Invalid entry should be removed by validator
            expect(await cache.get(invalidKey)).toBeNull();
            
            await cache.clear();
        });
        
        test('should handle invalidation manager errors', async () => {
            const manager = createCacheInvalidationManager();
            
            // Try to process event without initialization
            const event = {
                id: 'error-test' as any,
                type: InvalidationEventType.FILE_MODIFIED,
                timestamp: Date.now(),
                strategy: InvalidationStrategy.SMART
            };
            
            await expect(manager.processEvent(event)).rejects.toThrow();
        });
        
        test('should handle file watcher errors', async () => {
            const watcher = createFileWatcher();
            
            // Should handle invalid configuration gracefully
            await expect(watcher.start({
                patterns: [], // Empty patterns should cause error
                excludePatterns: [],
                debounceMs: 100,
                maxEvents: 50,
                enableRecursive: true
            })).rejects.toThrow();
        });
    });
});