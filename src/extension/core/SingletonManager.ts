/**
 * Base singleton pattern with lifecycle management and testing support
 * Provides thread-safe implementation with proper disposal and reset capabilities
 */

import * as vscode from 'vscode';

/**
 * Interface for disposable singletons
 */
export interface DisposableSingleton extends vscode.Disposable {
    /**
     * Reset the singleton state (primarily for testing)
     */
    reset(): void;
    
    /**
     * Check if the singleton is initialized
     */
    isInitialized(): boolean;
}

/**
 * Abstract base class for implementing thread-safe singletons with lifecycle management
 */
export abstract class BaseSingleton implements DisposableSingleton {
    private static readonly _instances = new Map<string, BaseSingleton>();
    private static readonly _locks = new Map<string, Promise<any>>();
    
    protected _isInitialized = false;
    protected _isDisposed = false;
    protected readonly _disposables: vscode.Disposable[] = [];
    
    /**
     * Get the singleton key for this class
     */
    protected abstract getSingletonKey(): string;
    
    /**
     * Initialize the singleton (called once during getInstance)
     */
    protected abstract initialize(context?: vscode.ExtensionContext): void | Promise<void>;
    
    /**
     * Get or create singleton instance with thread-safe initialization
     */
    protected static async getInstance<T extends BaseSingleton>(
        this: { new (context?: vscode.ExtensionContext): T } & typeof BaseSingleton,
        context?: vscode.ExtensionContext
    ): Promise<T> {
        // Create a temporary instance to get the key
        const TempClass = this as any;
        const tempInstance = Object.create(TempClass.prototype);
        tempInstance.constructor = TempClass;
        const key = tempInstance.getSingletonKey();
        
        // Check if instance already exists
        const existing = BaseSingleton._instances.get(key);
        if (existing && !existing._isDisposed) {
            return existing as T;
        }
        
        // Check if initialization is in progress
        const lockPromise = BaseSingleton._locks.get(key);
        if (lockPromise) {
            await lockPromise;
            const existingAfterLock = BaseSingleton._instances.get(key);
            if (existingAfterLock && !existingAfterLock._isDisposed) {
                return existingAfterLock as T;
            }
        }
        
        // Create actual instance
        const instance = new this(context) as T;
        
        // Create new initialization promise
        const initPromise = instance._initializeInternal(context);
        BaseSingleton._locks.set(key, initPromise);
        
        try {
            await initPromise;
            BaseSingleton._instances.set(key, instance);
            return instance;
        } finally {
            BaseSingleton._locks.delete(key);
        }
    }
    
    /**
     * Get singleton instance synchronously (throws if not initialized)
     */
    protected static getInstanceSync<T extends BaseSingleton>(
        this: { new (context?: vscode.ExtensionContext): T } & typeof BaseSingleton
    ): T {
        // Create a temporary instance to get the key
        const TempClass = this as any;
        const tempInstance = Object.create(TempClass.prototype);
        tempInstance.constructor = TempClass;
        const key = tempInstance.getSingletonKey();
        const existing = BaseSingleton._instances.get(key);
        
        if (!existing || existing._isDisposed) {
            throw new Error(`Singleton ${key} is not initialized. Call getInstance() first.`);
        }
        
        return existing as T;
    }
    
    /**
     * Internal initialization wrapper
     */
    private async _initializeInternal(context?: vscode.ExtensionContext): Promise<void> {
        if (this._isInitialized || this._isDisposed) {
            return;
        }
        
        try {
            const result = this.initialize(context);
            if (result instanceof Promise) {
                await result;
            }
            this._isInitialized = true;
        } catch (error) {
            this._isDisposed = true;
            throw new Error(`Failed to initialize singleton ${this.getSingletonKey()}: ${error}`);
        }
    }
    
    /**
     * Check if the singleton is initialized
     */
    public isInitialized(): boolean {
        return this._isInitialized && !this._isDisposed;
    }
    
    /**
     * Check if the singleton is disposed
     */
    public isDisposed(): boolean {
        return this._isDisposed;
    }
    
    /**
     * Reset the singleton state (primarily for testing)
     */
    public reset(): void {
        if (this._isDisposed) {
            return;
        }
        
        // Dispose current resources
        this.dispose();
        
        // Reset state
        this._isInitialized = false;
        this._isDisposed = false;
        this._disposables.length = 0;
        
        // Remove from instances map
        const key = this.getSingletonKey();
        BaseSingleton._instances.delete(key);
    }
    
    /**
     * Dispose the singleton and its resources
     */
    public dispose(): void {
        if (this._isDisposed) {
            return;
        }
        
        this._isDisposed = true;
        
        // Dispose all managed resources
        for (const disposable of this._disposables) {
            try {
                disposable.dispose();
            } catch (error) {
                console.error(`Error disposing resource in ${this.getSingletonKey()}:`, error);
            }
        }
        
        this._disposables.length = 0;
        
        // Remove from instances map
        const key = this.getSingletonKey();
        BaseSingleton._instances.delete(key);
    }
    
    /**
     * Add a disposable resource to be managed by this singleton
     */
    protected addDisposable(disposable: vscode.Disposable): void {
        if (!this._isDisposed) {
            this._disposables.push(disposable);
        }
    }
    
    /**
     * Reset all singletons (for testing)
     */
    public static resetAll(): void {
        for (const instance of BaseSingleton._instances.values()) {
            try {
                instance.reset();
            } catch (error) {
                console.error('Error resetting singleton:', error);
            }
        }
        BaseSingleton._instances.clear();
        BaseSingleton._locks.clear();
    }
    
    /**
     * Dispose all singletons
     */
    public static disposeAll(): void {
        for (const instance of BaseSingleton._instances.values()) {
            try {
                instance.dispose();
            } catch (error) {
                console.error('Error disposing singleton:', error);
            }
        }
        BaseSingleton._instances.clear();
        BaseSingleton._locks.clear();
    }
    
    /**
     * Get all active singleton instances (for debugging)
     */
    public static getActiveInstances(): Map<string, BaseSingleton> {
        return new Map(BaseSingleton._instances);
    }
}

/**
 * Synchronous singleton base class for simpler cases that don't require async initialization
 */
export abstract class SyncSingleton implements DisposableSingleton {
    private static readonly _instances = new Map<string, SyncSingleton>();
    
    protected _isInitialized = false;
    protected _isDisposed = false;
    protected readonly _disposables: vscode.Disposable[] = [];
    
    /**
     * Get the singleton key for this class
     */
    protected abstract getSingletonKey(): string;
    
    /**
     * Initialize the singleton (called once during getInstance)
     */
    protected abstract initialize(context?: vscode.ExtensionContext): void;
    
    /**
     * Get or create singleton instance
     */
    protected static getInstance<T extends SyncSingleton>(
        this: { new (context?: vscode.ExtensionContext): T } & typeof SyncSingleton,
        context?: vscode.ExtensionContext
    ): T {
        // Create a temporary instance to get the key
        const TempClass = this as any;
        const tempInstance = Object.create(TempClass.prototype);
        tempInstance.constructor = TempClass;
        const key = tempInstance.getSingletonKey();
        
        // Check if instance already exists
        const existing = SyncSingleton._instances.get(key);
        if (existing && !existing._isDisposed) {
            return existing as T;
        }
        
        // Create actual instance
        const instance = new this(context) as T;
        
        // Initialize new instance
        try {
            instance.initialize(context);
            instance._isInitialized = true;
            SyncSingleton._instances.set(key, instance);
            return instance;
        } catch (error) {
            instance._isDisposed = true;
            throw new Error(`Failed to initialize singleton ${key}: ${error}`);
        }
    }
    
    /**
     * Check if the singleton is initialized
     */
    public isInitialized(): boolean {
        return this._isInitialized && !this._isDisposed;
    }
    
    /**
     * Check if the singleton is disposed
     */
    public isDisposed(): boolean {
        return this._isDisposed;
    }
    
    /**
     * Reset the singleton state (primarily for testing)
     */
    public reset(): void {
        if (this._isDisposed) {
            return;
        }
        
        // Dispose current resources
        this.dispose();
        
        // Reset state
        this._isInitialized = false;
        this._isDisposed = false;
        this._disposables.length = 0;
        
        // Remove from instances map
        const key = this.getSingletonKey();
        SyncSingleton._instances.delete(key);
    }
    
    /**
     * Dispose the singleton and its resources
     */
    public dispose(): void {
        if (this._isDisposed) {
            return;
        }
        
        this._isDisposed = true;
        
        // Dispose all managed resources
        for (const disposable of this._disposables) {
            try {
                disposable.dispose();
            } catch (error) {
                console.error(`Error disposing resource in ${this.getSingletonKey()}:`, error);
            }
        }
        
        this._disposables.length = 0;
        
        // Remove from instances map
        const key = this.getSingletonKey();
        SyncSingleton._instances.delete(key);
    }
    
    /**
     * Add a disposable resource to be managed by this singleton
     */
    protected addDisposable(disposable: vscode.Disposable): void {
        if (!this._isDisposed) {
            this._disposables.push(disposable);
        }
    }
    
    /**
     * Reset all singletons (for testing)
     */
    public static resetAll(): void {
        for (const instance of SyncSingleton._instances.values()) {
            try {
                instance.reset();
            } catch (error) {
                console.error('Error resetting singleton:', error);
            }
        }
        SyncSingleton._instances.clear();
    }
    
    /**
     * Dispose all singletons
     */
    public static disposeAll(): void {
        for (const instance of SyncSingleton._instances.values()) {
            try {
                instance.dispose();
            } catch (error) {
                console.error('Error disposing singleton:', error);
            }
        }
        SyncSingleton._instances.clear();
    }
    
    /**
     * Get all active singleton instances (for debugging)
     */
    public static getActiveInstances(): Map<string, SyncSingleton> {
        return new Map(SyncSingleton._instances);
    }
}

/**
 * Lifecycle manager for extension singletons
 */
export class SingletonLifecycleManager {
    private static _isExtensionActive = false;
    private static readonly _managedSingletons = new Set<DisposableSingleton>();
    
    /**
     * Register a singleton to be managed by the extension lifecycle
     */
    public static register(singleton: DisposableSingleton): void {
        SingletonLifecycleManager._managedSingletons.add(singleton);
    }
    
    /**
     * Unregister a singleton from lifecycle management
     */
    public static unregister(singleton: DisposableSingleton): void {
        SingletonLifecycleManager._managedSingletons.delete(singleton);
    }
    
    /**
     * Called when extension is activated
     */
    public static onExtensionActivated(): void {
        SingletonLifecycleManager._isExtensionActive = true;
    }
    
    /**
     * Called when extension is deactivated
     */
    public static onExtensionDeactivated(): void {
        SingletonLifecycleManager._isExtensionActive = false;
        
        // Dispose all managed singletons
        for (const singleton of SingletonLifecycleManager._managedSingletons) {
            try {
                singleton.dispose();
            } catch (error) {
                console.error('Error disposing managed singleton:', error);
            }
        }
        
        SingletonLifecycleManager._managedSingletons.clear();
        
        // Reset all base singletons
        BaseSingleton.resetAll();
        SyncSingleton.resetAll();
    }
    
    /**
     * Check if extension is active
     */
    public static isExtensionActive(): boolean {
        return SingletonLifecycleManager._isExtensionActive;
    }
    
    /**
     * Get all managed singletons (for debugging)
     */
    public static getManagedSingletons(): Set<DisposableSingleton> {
        return new Set(SingletonLifecycleManager._managedSingletons);
    }
}