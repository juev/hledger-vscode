/**
 * Optimization Manager - Central controller for enabling/disabling performance optimizations
 * Orchestrates specialized components for different optimization concerns
 */

import * as vscode from 'vscode';
import { profiler, PerformanceProfiler } from '../performance/PerformanceProfiler';
import { IHLedgerParser, IAsyncHLedgerParser, ParsedHLedgerData } from './interfaces';
import { FuzzyMatch, FuzzyMatchOptions } from '../completion/base/FuzzyMatcher';
import { SyncSingleton, SingletonLifecycleManager } from './SingletonManager';
import { FilePath } from './BrandedTypes';
import { PerformanceMonitor, OptimizationMetrics } from './PerformanceMonitor';
import { FallbackHandler } from './FallbackHandler';
import { ConfigWatcher, OptimizationConfig } from './ConfigWatcher';
import { MetricsCollector } from './MetricsCollector';
import { ComponentFactory } from './ComponentFactory';

// Export types from components for backward compatibility
export type { OptimizationConfig } from './ConfigWatcher';
export type { OptimizationMetrics } from './PerformanceMonitor';

/**
 * Central optimization manager that orchestrates specialized components
 * for performance optimization, monitoring, and fallback handling
 */
export class OptimizationManager extends SyncSingleton {
    private performanceMonitor!: PerformanceMonitor;
    private fallbackHandler!: FallbackHandler;
    private configWatcher!: ConfigWatcher;
    private metricsCollector!: MetricsCollector;
    private componentFactory!: ComponentFactory;

    constructor(context?: vscode.ExtensionContext) {
        super();
        // Initialization will happen in initialize() method
    }

    protected getSingletonKey(): string {
        return 'OptimizationManager';
    }

    protected initialize(context?: vscode.ExtensionContext): void {
        // Initialize components
        this.performanceMonitor = new PerformanceMonitor(profiler);
        this.configWatcher = new ConfigWatcher();
        this.componentFactory = new ComponentFactory(this.performanceMonitor);
        this.fallbackHandler = new FallbackHandler(
            this.configWatcher.getConfig().fallbackOnError,
            this.performanceMonitor
        );
        this.metricsCollector = new MetricsCollector(this.performanceMonitor);

        // Setup VS Code integration
        if (context) {
            this.setupVSCodeIntegration(context);
        }

        // Setup configuration monitoring
        this.setupConfigurationWatcher();

        // Initialize components based on current config
        this.updateConfiguration(this.configWatcher.getConfig());

        // Register with lifecycle manager
        SingletonLifecycleManager.register(this);
    }


    /**
     * Reset singleton for testing
     */
    public static resetInstance(): void {
        const instances = SyncSingleton.getActiveInstances();
        const instance = instances.get('OptimizationManager');
        if (instance) {
            instance.reset();
        }
    }

    /**
     * Get parser instance with fallback safety
     */
    getParser(): IHLedgerParser | IAsyncHLedgerParser {
        const config = this.configWatcher.getConfig();
        return this.componentFactory.getParser(config.enableAsyncParsing);
    }

    /**
     * Parse file with automatic optimization selection and fallback
     */
    async parseFile(filePath: FilePath): Promise<ParsedHLedgerData> {
        const config = this.configWatcher.getConfig();
        return this.fallbackHandler.executeParseFile(
            filePath,
            this.componentFactory.getAsyncParser(),
            this.componentFactory.getStandardParser(),
            {
                enableAsyncParsing: config.enableAsyncParsing,
                enablePerformanceMonitoring: config.enablePerformanceMonitoring,
                maxFileSize: config.maxFileSize,
                asyncChunkSize: config.asyncChunkSize,
                cacheResults: config.cacheResults
            }
        );
    }

    /**
     * Parse content with automatic optimization selection and fallback
     */
    async parseContent(content: string, basePath?: FilePath): Promise<ParsedHLedgerData> {
        const config = this.configWatcher.getConfig();
        return this.fallbackHandler.executeParseContent(
            content,
            basePath,
            this.componentFactory.getAsyncParser(),
            this.componentFactory.getStandardParser(),
            {
                enableAsyncParsing: config.enableAsyncParsing,
                enablePerformanceMonitoring: config.enablePerformanceMonitoring,
                asyncChunkSize: config.asyncChunkSize,
                cacheResults: config.cacheResults
            }
        );
    }

    /**
     * Fuzzy match with automatic optimization selection and fallback
     */
    fuzzyMatch(query: string, items: string[], options: FuzzyMatchOptions = {}): FuzzyMatch[] {
        const config = this.configWatcher.getConfig();
        return this.fallbackHandler.executeFuzzyMatch(
            query,
            items,
            this.componentFactory.getOptimizedFuzzyMatcher(),
            this.componentFactory.getStandardFuzzyMatcher(),
            {
                enableOptimizedFuzzyMatching: config.enableOptimizedFuzzyMatching,
                enablePerformanceMonitoring: config.enablePerformanceMonitoring,
                fuzzyIndexing: config.fuzzyIndexing,
                cacheResults: config.cacheResults
            },
            options
        );
    }

    /**
     * Get current optimization metrics
     */
    getMetrics(): Readonly<OptimizationMetrics> {
        return this.metricsCollector.getMetrics();
    }

    /**
     * Reset metrics
     */
    resetMetrics(): void {
        this.metricsCollector.resetMetrics();
    }

    /**
     * Run performance benchmark
     */
    async runBenchmark(): Promise<void> {
        const config = this.configWatcher.getConfig();
        await this.metricsCollector.runBenchmark(config.enableBenchmarking);
    }

    /**
     * Export performance data
     */
    exportPerformanceData(): string {
        const config = this.configWatcher.getConfig();
        return this.metricsCollector.exportPerformanceData(config);
    }

    /**
     * Update configuration
     */
    updateConfiguration(newConfig: OptimizationConfig): void {
        // Update component factory with new configuration
        this.componentFactory.initializeOptimizedComponents(newConfig);
        
        // Update fallback handler
        this.fallbackHandler.setFallbackOnError(newConfig.fallbackOnError);
        
        // Update performance monitoring
        this.performanceMonitor.setPerformanceMonitoring(newConfig.enablePerformanceMonitoring);
        
        this.performanceMonitor.log(`Configuration updated`);
    }


    /**
     * Setup VS Code integration
     */
    private setupVSCodeIntegration(context: vscode.ExtensionContext): void {
        // Setup performance monitor output channel
        this.performanceMonitor.setupOutputChannel(context);
        
        // Register commands through metrics collector
        const config = this.configWatcher.getConfig();
        this.metricsCollector.registerCommands(context, config);
    }

    /**
     * Setup configuration change watcher
     */
    private setupConfigurationWatcher(): void {
        this.configWatcher.setupConfigurationWatcher();
        this.configWatcher.onConfigChanged((config) => {
            this.updateConfiguration(config);
        });
        this.addDisposable(this.configWatcher);
    }


    /**
     * Override dispose to cleanup resources properly
     */
    public dispose(): void {
        // Dispose all components
        this.performanceMonitor?.dispose();
        this.configWatcher?.dispose();
        this.componentFactory?.dispose();

        // Call parent dispose
        super.dispose();
    }

}

/**
 * Get or create global optimization manager
 * @deprecated Use OptimizationManager.getInstance() instead
 */
export function getOptimizationManager(context?: vscode.ExtensionContext): OptimizationManager {
    return OptimizationManager.getInstance(context);
}

/**
 * Dispose global optimization manager
 * @deprecated Use OptimizationManager.resetInstance() instead
 */
export function disposeOptimizationManager(): void {
    OptimizationManager.resetInstance();
}