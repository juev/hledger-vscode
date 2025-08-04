/**
 * Configuration Watcher - Handles configuration loading and monitoring for changes
 */

import * as vscode from 'vscode';

/** Configuration interface for optimization settings */
export interface OptimizationConfig {
    readonly enableAsyncParsing: boolean;
    readonly enableOptimizedFuzzyMatching: boolean;
    readonly enablePerformanceMonitoring: boolean;
    readonly enableBenchmarking: boolean;
    readonly fallbackOnError: boolean;
    readonly maxFileSize: number;
    readonly asyncChunkSize: number;
    readonly fuzzyIndexing: boolean;
    readonly cacheResults: boolean;
}

/** Default optimization configuration */
const DEFAULT_CONFIG: OptimizationConfig = {
    enableAsyncParsing: false,
    enableOptimizedFuzzyMatching: false,
    enablePerformanceMonitoring: false,
    enableBenchmarking: false,
    fallbackOnError: true,
    maxFileSize: 10 * 1024 * 1024, // 10MB
    asyncChunkSize: 1000,
    fuzzyIndexing: true,
    cacheResults: true
};

/**
 * Configuration watcher that monitors VS Code settings changes
 */
export class ConfigWatcher {
    private config: OptimizationConfig;
    private configurationWatcher: vscode.Disposable | null = null;
    private onConfigChangedCallback: ((config: OptimizationConfig) => void) | null = null;
    private disposables: vscode.Disposable[] = [];

    constructor() {
        this.config = this.loadConfiguration();
    }

    /**
     * Load configuration from VS Code settings
     */
    private loadConfiguration(): OptimizationConfig {
        const config = vscode.workspace.getConfiguration('hledger.optimization');
        
        return {
            enableAsyncParsing: config.get('enableAsyncParsing', DEFAULT_CONFIG.enableAsyncParsing),
            enableOptimizedFuzzyMatching: config.get('enableOptimizedFuzzyMatching', DEFAULT_CONFIG.enableOptimizedFuzzyMatching),
            enablePerformanceMonitoring: config.get('enablePerformanceMonitoring', DEFAULT_CONFIG.enablePerformanceMonitoring),
            enableBenchmarking: config.get('enableBenchmarking', DEFAULT_CONFIG.enableBenchmarking),
            fallbackOnError: config.get('fallbackOnError', DEFAULT_CONFIG.fallbackOnError),
            maxFileSize: config.get('maxFileSize', DEFAULT_CONFIG.maxFileSize),
            asyncChunkSize: config.get('asyncChunkSize', DEFAULT_CONFIG.asyncChunkSize),
            fuzzyIndexing: config.get('fuzzyIndexing', DEFAULT_CONFIG.fuzzyIndexing),
            cacheResults: config.get('cacheResults', DEFAULT_CONFIG.cacheResults)
        };
    }

    /**
     * Setup configuration change watcher
     */
    setupConfigurationWatcher(): void {
        this.configurationWatcher = vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration('hledger.optimization')) {
                const newConfig = this.loadConfiguration();
                this.updateConfiguration(newConfig);
            }
        });
        this.disposables.push(this.configurationWatcher);
    }

    /**
     * Update configuration and notify callback
     */
    private updateConfiguration(newConfig: OptimizationConfig): void {
        const oldConfig = this.config;
        this.config = newConfig;
        
        if (this.onConfigChangedCallback) {
            this.onConfigChangedCallback(this.config);
        }

        // Log significant changes
        if (oldConfig.enableAsyncParsing !== newConfig.enableAsyncParsing) {
            console.log(`HLedger: Async parsing ${newConfig.enableAsyncParsing ? 'enabled' : 'disabled'}`);
        }
        if (oldConfig.enableOptimizedFuzzyMatching !== newConfig.enableOptimizedFuzzyMatching) {
            console.log(`HLedger: Optimized fuzzy matching ${newConfig.enableOptimizedFuzzyMatching ? 'enabled' : 'disabled'}`);
        }
        if (oldConfig.enablePerformanceMonitoring !== newConfig.enablePerformanceMonitoring) {
            console.log(`HLedger: Performance monitoring ${newConfig.enablePerformanceMonitoring ? 'enabled' : 'disabled'}`);
        }
    }

    /**
     * Set callback for configuration changes
     */
    onConfigChanged(callback: (config: OptimizationConfig) => void): void {
        this.onConfigChangedCallback = callback;
    }

    /**
     * Get current configuration
     */
    getConfig(): OptimizationConfig {
        return { ...this.config };
    }

    /**
     * Manually update configuration (for testing)
     */
    updateConfig(newConfig: Partial<OptimizationConfig>): void {
        this.config = { ...this.config, ...newConfig };
        if (this.onConfigChangedCallback) {
            this.onConfigChangedCallback(this.config);
        }
    }

    /**
     * Get default configuration
     */
    static getDefaultConfig(): OptimizationConfig {
        return { ...DEFAULT_CONFIG };
    }

    /**
     * Validate configuration values
     */
    validateConfig(config: OptimizationConfig): string[] {
        const errors: string[] = [];

        if (config.maxFileSize <= 0) {
            errors.push('maxFileSize must be greater than 0');
        }

        if (config.asyncChunkSize <= 0) {
            errors.push('asyncChunkSize must be greater than 0');
        }

        if (config.maxFileSize > 100 * 1024 * 1024) { // 100MB
            errors.push('maxFileSize should not exceed 100MB for performance reasons');
        }

        if (config.asyncChunkSize > 10000) {
            errors.push('asyncChunkSize should not exceed 10000 for performance reasons');
        }

        return errors;
    }

    /**
     * Add disposable to cleanup list
     */
    addDisposable(disposable: vscode.Disposable): void {
        this.disposables.push(disposable);
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        this.disposables.forEach(disposable => disposable.dispose());
        this.disposables = [];
        this.configurationWatcher = null;
        this.onConfigChangedCallback = null;
    }
}