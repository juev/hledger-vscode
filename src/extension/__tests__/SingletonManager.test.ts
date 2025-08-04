/**
 * Test suite for SingletonManager and singleton implementations
 */

import { BaseSingleton, SyncSingleton, SingletonLifecycleManager } from '../core/SingletonManager';
import { OptimizationManager } from '../core/OptimizationManager';
import { PerformanceProfiler } from '../performance/PerformanceProfiler';
import { InvalidationStrategyRegistry } from '../caching/InvalidationStrategies';
import { WorkspaceCache, ProjectCache } from '../main';

// Mock VS Code API
jest.mock('vscode', () => ({
    window: {
        createOutputChannel: jest.fn(() => ({
            appendLine: jest.fn(),
            dispose: jest.fn()
        }))
    },
    workspace: {
        getConfiguration: jest.fn(() => ({
            get: jest.fn((key: string, defaultValue?: any) => defaultValue)
        })),
        onDidChangeConfiguration: jest.fn(() => ({
            dispose: jest.fn()
        }))
    },
    commands: {
        registerCommand: jest.fn(() => ({
            dispose: jest.fn()
        }))
    }
}));

// Test implementation of BaseSingleton
class TestAsyncSingleton extends BaseSingleton {
    public initializeCalled = false;
    public initializeContext: any = null;
    
    protected getSingletonKey(): string {
        return 'TestAsyncSingleton';
    }
    
    protected async initialize(context?: any): Promise<void> {
        this.initializeCalled = true;
        this.initializeContext = context;
        await new Promise(resolve => setTimeout(resolve, 10)); // Simulate async work
    }
}

// Test implementation of SyncSingleton
class TestSyncSingleton extends SyncSingleton {
    public initializeCalled = false;
    public initializeContext: any = null;
    
    protected getSingletonKey(): string {
        return 'TestSyncSingleton';
    }
    
    protected initialize(context?: any): void {
        this.initializeCalled = true;
        this.initializeContext = context;
    }
}

describe('SingletonManager', () => {
    beforeEach(() => {
        // Reset all singletons before each test
        BaseSingleton.resetAll();
        SyncSingleton.resetAll();
        SingletonLifecycleManager.onExtensionDeactivated();
    });

    afterEach(() => {
        // Clean up after each test
        BaseSingleton.resetAll();
        SyncSingleton.resetAll();
        SingletonLifecycleManager.onExtensionDeactivated();
    });

    describe('BaseSingleton (Async)', () => {
        it('should create and return same instance', async () => {
            const instance1 = await TestAsyncSingleton.getInstance();
            const instance2 = await TestAsyncSingleton.getInstance();
            
            expect(instance1).toBe(instance2);
            expect(instance1.isInitialized()).toBe(true);
            expect(instance1.initializeCalled).toBe(true);
        });

        it('should pass context to initialize method', async () => {
            const context = { test: 'value' };
            const instance = await TestAsyncSingleton.getInstance(context);
            
            expect(instance.initializeContext).toBe(context);
        });

        it('should handle concurrent initialization', async () => {
            const promises = [
                TestAsyncSingleton.getInstance(),
                TestAsyncSingleton.getInstance(),
                TestAsyncSingleton.getInstance()
            ];
            
            const instances = await Promise.all(promises);
            
            expect(instances[0]).toBe(instances[1]);
            expect(instances[1]).toBe(instances[2]);
            expect(instances[0].initializeCalled).toBe(true);
        });

        it('should reset and dispose properly', async () => {
            const instance = await TestAsyncSingleton.getInstance();
            expect(instance.isInitialized()).toBe(true);
            
            instance.reset();
            expect(instance.isInitialized()).toBe(false);
            expect(instance.isDisposed()).toBe(false);
            
            instance.dispose();
            expect(instance.isDisposed()).toBe(true);
        });

        it('should throw when trying to get sync instance that is not initialized', () => {
            expect(() => {
                TestAsyncSingleton.getInstanceSync();
            }).toThrow('Singleton TestAsyncSingleton is not initialized');
        });
    });

    describe('SyncSingleton', () => {
        it('should create and return same instance', () => {
            const instance1 = TestSyncSingleton.getInstance();
            const instance2 = TestSyncSingleton.getInstance();
            
            expect(instance1).toBe(instance2);
            expect(instance1.isInitialized()).toBe(true);
            expect(instance1.initializeCalled).toBe(true);
        });

        it('should pass context to initialize method', () => {
            const context = { test: 'value' };
            const instance = TestSyncSingleton.getInstance(context);
            
            expect(instance.initializeContext).toBe(context);
        });

        it('should reset and dispose properly', () => {
            const instance = TestSyncSingleton.getInstance();
            expect(instance.isInitialized()).toBe(true);
            
            instance.reset();
            expect(instance.isInitialized()).toBe(false);
            expect(instance.isDisposed()).toBe(false);
            
            instance.dispose();
            expect(instance.isDisposed()).toBe(true);
        });
    });

    describe('SingletonLifecycleManager', () => {
        it('should track extension activation state', () => {
            expect(SingletonLifecycleManager.isExtensionActive()).toBe(false);
            
            SingletonLifecycleManager.onExtensionActivated();
            expect(SingletonLifecycleManager.isExtensionActive()).toBe(true);
            
            SingletonLifecycleManager.onExtensionDeactivated();
            expect(SingletonLifecycleManager.isExtensionActive()).toBe(false);
        });

        it('should manage singleton lifecycle', () => {
            const instance = TestSyncSingleton.getInstance();
            const disposeSpy = jest.spyOn(instance, 'dispose');
            
            SingletonLifecycleManager.register(instance);
            expect(SingletonLifecycleManager.getManagedSingletons().has(instance)).toBe(true);
            
            SingletonLifecycleManager.onExtensionDeactivated();
            expect(disposeSpy).toHaveBeenCalled();
        });
    });
});

describe('Actual Singleton Implementations', () => {
    beforeEach(() => {
        // Reset all singletons before each test
        BaseSingleton.resetAll();
        SyncSingleton.resetAll();
        SingletonLifecycleManager.onExtensionDeactivated();
    });

    afterEach(() => {
        // Clean up after each test
        BaseSingleton.resetAll();
        SyncSingleton.resetAll();
        SingletonLifecycleManager.onExtensionDeactivated();
    });

    describe('OptimizationManager', () => {
        it('should create singleton instance', () => {
            const instance1 = OptimizationManager.getInstance();
            const instance2 = OptimizationManager.getInstance();
            
            expect(instance1).toBe(instance2);
            expect(instance1.isInitialized()).toBe(true);
        });

        it('should reset properly', () => {
            const instance = OptimizationManager.getInstance();
            expect(instance.isInitialized()).toBe(true);
            
            OptimizationManager.resetInstance();
            
            // Getting instance again should create a new one
            const newInstance = OptimizationManager.getInstance();
            expect(newInstance).not.toBe(instance);
            expect(newInstance.isInitialized()).toBe(true);
        });
    });

    describe('PerformanceProfiler', () => {
        it('should create singleton instance', () => {
            const instance1 = PerformanceProfiler.getInstance();
            const instance2 = PerformanceProfiler.getInstance();
            
            expect(instance1).toBe(instance2);
            expect(instance1.isInitialized()).toBe(true);
        });

        it('should reset properly', () => {
            const instance = PerformanceProfiler.getInstance();
            expect(instance.isInitialized()).toBe(true);
            
            PerformanceProfiler.resetInstance();
            
            // Getting instance again should create a new one
            const newInstance = PerformanceProfiler.getInstance();
            expect(newInstance).not.toBe(instance);
            expect(newInstance.isInitialized()).toBe(true);
        });
    });

    describe('InvalidationStrategyRegistry', () => {
        it('should create singleton instance', () => {
            const instance1 = InvalidationStrategyRegistry.getInstance();
            const instance2 = InvalidationStrategyRegistry.getInstance();
            
            expect(instance1).toBe(instance2);
            expect(instance1.isInitialized()).toBe(true);
        });

        it('should have default strategies registered', () => {
            const instance = InvalidationStrategyRegistry.getInstance();
            const strategies = instance.getAllStrategies();
            
            expect(strategies.length).toBeGreaterThan(0);
            expect(strategies.some(s => s.name === 'partial')).toBe(true);
            expect(strategies.some(s => s.name === 'cascade')).toBe(true);
            expect(strategies.some(s => s.name === 'full')).toBe(true);
            expect(strategies.some(s => s.name === 'smart')).toBe(true);
        });
    });

    describe('WorkspaceCache', () => {
        it('should create singleton instance', () => {
            const instance1 = WorkspaceCache.getInstance();
            const instance2 = WorkspaceCache.getInstance();
            
            expect(instance1).toBe(instance2);
            expect(instance1.isInitialized()).toBe(true);
        });

        it('should reset properly', () => {
            const instance = WorkspaceCache.getInstance();
            expect(instance.isInitialized()).toBe(true);
            
            WorkspaceCache.resetInstance();
            
            // Getting instance again should create a new one
            const newInstance = WorkspaceCache.getInstance();
            expect(newInstance).not.toBe(instance);
            expect(newInstance.isInitialized()).toBe(true);
        });
    });

    describe('ProjectCache', () => {
        it('should create singleton instance', () => {
            const instance1 = ProjectCache.getInstance();
            const instance2 = ProjectCache.getInstance();
            
            expect(instance1).toBe(instance2);
            expect(instance1.isInitialized()).toBe(true);
        });

        it('should reset properly', () => {
            const instance = ProjectCache.getInstance();
            expect(instance.isInitialized()).toBe(true);
            
            ProjectCache.resetInstance();
            
            // Getting instance again should create a new one
            const newInstance = ProjectCache.getInstance();
            expect(newInstance).not.toBe(instance);
            expect(newInstance.isInitialized()).toBe(true);
        });
    });
});

describe('Integration Tests', () => {
    beforeEach(() => {
        // Reset all singletons before each test
        BaseSingleton.resetAll();
        SyncSingleton.resetAll();
        SingletonLifecycleManager.onExtensionDeactivated();
    });

    afterEach(() => {
        // Clean up after each test
        BaseSingleton.resetAll();
        SyncSingleton.resetAll();
        SingletonLifecycleManager.onExtensionDeactivated();
    });

    it('should handle full extension lifecycle', () => {
        // Activate extension
        SingletonLifecycleManager.onExtensionActivated();
        expect(SingletonLifecycleManager.isExtensionActive()).toBe(true);
        
        // Create singletons
        const optimizationManager = OptimizationManager.getInstance();
        const profiler = PerformanceProfiler.getInstance();
        const registry = InvalidationStrategyRegistry.getInstance();
        const workspaceCache = WorkspaceCache.getInstance();
        const projectCache = ProjectCache.getInstance();
        
        // Verify they're all initialized
        expect(optimizationManager.isInitialized()).toBe(true);
        expect(profiler.isInitialized()).toBe(true);
        expect(registry.isInitialized()).toBe(true);
        expect(workspaceCache.isInitialized()).toBe(true);
        expect(projectCache.isInitialized()).toBe(true);
        
        // Create spies to check disposal
        const optimizationManagerDispose = jest.spyOn(optimizationManager, 'dispose');
        const profilerDispose = jest.spyOn(profiler, 'dispose');
        const registryDispose = jest.spyOn(registry, 'dispose');
        const workspaceCacheDispose = jest.spyOn(workspaceCache, 'dispose');
        const projectCacheDispose = jest.spyOn(projectCache, 'dispose');
        
        // Deactivate extension
        SingletonLifecycleManager.onExtensionDeactivated();
        expect(SingletonLifecycleManager.isExtensionActive()).toBe(false);
        
        // Verify all managed singletons were disposed
        expect(optimizationManagerDispose).toHaveBeenCalled();
        expect(profilerDispose).toHaveBeenCalled();
        expect(registryDispose).toHaveBeenCalled();
        expect(workspaceCacheDispose).toHaveBeenCalled();
        expect(projectCacheDispose).toHaveBeenCalled();
    });

    it('should prevent memory leaks by resetting all instances', () => {
        // Create instances
        OptimizationManager.getInstance();
        PerformanceProfiler.getInstance();
        InvalidationStrategyRegistry.getInstance();
        WorkspaceCache.getInstance();
        ProjectCache.getInstance();
        
        // Verify instances exist
        expect(BaseSingleton.getActiveInstances().size + SyncSingleton.getActiveInstances().size).toBeGreaterThan(0);
        
        // Reset all
        BaseSingleton.resetAll();
        SyncSingleton.resetAll();
        
        // Verify all instances are cleared
        expect(BaseSingleton.getActiveInstances().size).toBe(0);
        expect(SyncSingleton.getActiveInstances().size).toBe(0);
    });
});