/**
 * Optimization Manager - Central controller for enabling/disabling performance optimizations
 * Provides feature flags, fallback mechanisms, and monitoring integration
 */

import * as vscode from 'vscode';
import { profiler, PerformanceProfiler } from '../performance/PerformanceProfiler';
import { IHLedgerParser, IAsyncHLedgerParser, ParsedHLedgerData } from './interfaces';
import { HLedgerParser } from './HLedgerParser';
import { AsyncHLedgerParser, AsyncParseOptions } from './AsyncHLedgerParser';
import { FuzzyMatcher, FuzzyMatch, FuzzyMatchOptions } from '../completion/base/FuzzyMatcher';
import { OptimizedFuzzyMatcher, OptimizedFuzzyMatchOptions } from '../completion/base/OptimizedFuzzyMatcher';

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

/** Performance monitoring metrics */
export interface OptimizationMetrics {
    readonly parserFallbacks: number;
    readonly fuzzyFallbacks: number;
    readonly totalParseTime: number;
    readonly totalFuzzyTime: number;
    readonly errorsEncountered: string[];
    readonly optimizationsUsed: string[];
}

/**
 * Central optimization manager that coordinates performance enhancements
 * with fallback safety and monitoring capabilities
 */
export class OptimizationManager {
    private config: OptimizationConfig;
    private metrics: OptimizationMetrics;
    private standardParser: IHLedgerParser;
    private asyncParser: IAsyncHLedgerParser | null = null;
    private standardFuzzyMatcher: FuzzyMatcher;
    private optimizedFuzzyMatcher: OptimizedFuzzyMatcher | null = null;
    private profiler: PerformanceProfiler;
    private outputChannel: vscode.OutputChannel | null = null;

    constructor(context?: vscode.ExtensionContext) {
        this.config = this.loadConfiguration();
        this.metrics = this.initializeMetrics();
        this.standardParser = new HLedgerParser();
        this.standardFuzzyMatcher = new FuzzyMatcher();
        this.profiler = profiler;

        // Initialize optimized components if enabled
        this.initializeOptimizedComponents();

        // Setup VS Code integration
        if (context) {
            this.setupVSCodeIntegration(context);
        }

        // Setup configuration change listener
        this.setupConfigurationWatcher();
    }

    /**
     * Get parser instance with fallback safety
     */
    getParser(): IHLedgerParser | IAsyncHLedgerParser {
        if (this.config.enableAsyncParsing && this.asyncParser) {
            return this.asyncParser;
        }
        return this.standardParser;
    }

    /**
     * Parse file with automatic optimization selection and fallback
     */
    async parseFile(filePath: string): Promise<ParsedHLedgerData> {
        const startTime = Date.now();
        
        try {
            if (this.config.enableAsyncParsing && this.asyncParser) {
                const options: AsyncParseOptions = {
                    maxFileSize: this.config.maxFileSize,
                    chunkSize: this.config.asyncChunkSize,
                    enableCache: this.config.cacheResults
                };

                const result = await this.asyncParser.parseFileAsync(filePath, options);
                
                if (this.config.enablePerformanceMonitoring) {
                    this.recordParseMetrics('async', Date.now() - startTime, true);
                    this.logPerformance(`Async parsing completed for ${filePath}`, Date.now() - startTime);
                }
                
                return result;
            }
        } catch (error) {
            this.handleError('async-parser', error, filePath);
            
            if (!this.config.fallbackOnError) {
                throw error;
            }
        }

        // Fallback to standard parser
        try {
            const result = this.standardParser.parseFile(filePath);
            
            if (this.config.enablePerformanceMonitoring) {
                this.recordParseMetrics('standard', Date.now() - startTime, false);
                this.logPerformance(`Standard parsing completed for ${filePath}`, Date.now() - startTime);
            }
            
            return result;
        } catch (error) {
            this.handleError('standard-parser', error, filePath);
            throw error;
        }
    }

    /**
     * Parse content with automatic optimization selection and fallback
     */
    async parseContent(content: string, basePath?: string): Promise<ParsedHLedgerData> {
        const startTime = Date.now();
        
        try {
            if (this.config.enableAsyncParsing && this.asyncParser) {
                const options: AsyncParseOptions = {
                    chunkSize: this.config.asyncChunkSize,
                    enableCache: this.config.cacheResults
                };

                const result = await this.asyncParser.parseContentAsync(content, basePath, options);
                
                if (this.config.enablePerformanceMonitoring) {
                    this.recordParseMetrics('async', Date.now() - startTime, true);
                }
                
                return result;
            }
        } catch (error) {
            this.handleError('async-parser', error);
            
            if (!this.config.fallbackOnError) {
                throw error;
            }
        }

        // Fallback to standard parser
        try {
            const result = this.standardParser.parseContent(content, basePath);
            
            if (this.config.enablePerformanceMonitoring) {
                this.recordParseMetrics('standard', Date.now() - startTime, false);
            }
            
            return result;
        } catch (error) {
            this.handleError('standard-parser', error);
            throw error;
        }
    }

    /**
     * Fuzzy match with automatic optimization selection and fallback
     */
    fuzzyMatch(query: string, items: string[], options: FuzzyMatchOptions = {}): FuzzyMatch[] {
        const startTime = Date.now();
        
        try {
            if (this.config.enableOptimizedFuzzyMatching && this.optimizedFuzzyMatcher) {
                const optimizedOptions: OptimizedFuzzyMatchOptions = {
                    ...options,
                    enableIndexing: this.config.fuzzyIndexing,
                    cacheResults: this.config.cacheResults
                };

                const result = this.optimizedFuzzyMatcher.match(query, items, optimizedOptions);
                
                if (this.config.enablePerformanceMonitoring) {
                    this.recordFuzzyMetrics('optimized', Date.now() - startTime, true);
                }
                
                return result;
            }
        } catch (error) {
            this.handleError('optimized-fuzzy', error);
            
            if (!this.config.fallbackOnError) {
                throw error;
            }
        }

        // Fallback to standard fuzzy matcher
        try {
            const result = this.standardFuzzyMatcher.match(query, items, options);
            
            if (this.config.enablePerformanceMonitoring) {
                this.recordFuzzyMetrics('standard', Date.now() - startTime, false);
            }
            
            return result;
        } catch (error) {
            this.handleError('standard-fuzzy', error);
            throw error;
        }
    }

    /**
     * Get current optimization metrics
     */
    getMetrics(): Readonly<OptimizationMetrics> {
        return { ...this.metrics };
    }

    /**
     * Reset metrics
     */
    resetMetrics(): void {
        this.metrics = this.initializeMetrics();
    }

    /**
     * Run performance benchmark
     */
    async runBenchmark(): Promise<void> {
        if (!this.config.enableBenchmarking) {
            this.log('Benchmarking is disabled in configuration');
            return;
        }

        this.log('Starting performance benchmark...');

        try {
            const { runQuickBenchmark } = await import('../performance/BenchmarkSuite');
            await runQuickBenchmark();
            this.log('Benchmark completed successfully');
        } catch (error) {
            this.handleError('benchmark', error);
        }
    }

    /**
     * Export performance data
     */
    exportPerformanceData(): string {
        const report = {
            timestamp: new Date().toISOString(),
            configuration: this.config,
            metrics: this.metrics,
            profilerData: this.profiler.getMetrics()
        };

        return JSON.stringify(report, null, 2);
    }

    /**
     * Update configuration
     */
    updateConfiguration(newConfig: Partial<OptimizationConfig>): void {
        this.config = { ...this.config, ...newConfig };
        this.initializeOptimizedComponents();
        this.log(`Configuration updated: ${JSON.stringify(newConfig)}`);
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
     * Initialize performance metrics
     */
    private initializeMetrics(): OptimizationMetrics {
        return {
            parserFallbacks: 0,
            fuzzyFallbacks: 0,
            totalParseTime: 0,
            totalFuzzyTime: 0,
            errorsEncountered: [],
            optimizationsUsed: []
        };
    }

    /**
     * Initialize optimized components based on configuration
     */
    private initializeOptimizedComponents(): void {
        // Initialize async parser
        if (this.config.enableAsyncParsing) {
            if (!this.asyncParser) {
                this.asyncParser = new AsyncHLedgerParser();
                this.log('Initialized AsyncHLedgerParser');
            }
        } else {
            this.asyncParser = null;
        }

        // Initialize optimized fuzzy matcher
        if (this.config.enableOptimizedFuzzyMatching) {
            if (!this.optimizedFuzzyMatcher) {
                this.optimizedFuzzyMatcher = new OptimizedFuzzyMatcher({
                    enableIndexing: this.config.fuzzyIndexing,
                    cacheResults: this.config.cacheResults
                });
                this.log('Initialized OptimizedFuzzyMatcher');
            }
        } else {
            this.optimizedFuzzyMatcher = null;
        }
    }

    /**
     * Setup VS Code integration
     */
    private setupVSCodeIntegration(context: vscode.ExtensionContext): void {
        // Create output channel
        this.outputChannel = vscode.window.createOutputChannel('HLedger Optimization');
        context.subscriptions.push(this.outputChannel);

        // Register commands
        const benchmarkCommand = vscode.commands.registerCommand('hledger.optimization.runBenchmark', () => {
            this.runBenchmark();
        });

        const exportCommand = vscode.commands.registerCommand('hledger.optimization.exportData', async () => {
            const data = this.exportPerformanceData();
            const document = await vscode.workspace.openTextDocument({
                content: data,
                language: 'json'
            });
            await vscode.window.showTextDocument(document);
        });

        const resetCommand = vscode.commands.registerCommand('hledger.optimization.resetMetrics', () => {
            this.resetMetrics();
            this.log('Performance metrics reset');
        });

        context.subscriptions.push(benchmarkCommand, exportCommand, resetCommand);
    }

    /**
     * Setup configuration change watcher
     */
    private setupConfigurationWatcher(): void {
        vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration('hledger.optimization')) {
                const newConfig = this.loadConfiguration();
                this.updateConfiguration(newConfig);
            }
        });
    }

    /**
     * Record parser performance metrics
     */
    private recordParseMetrics(type: 'async' | 'standard', duration: number, optimized: boolean): void {
        this.metrics = {
            ...this.metrics,
            totalParseTime: this.metrics.totalParseTime + duration,
            parserFallbacks: optimized ? this.metrics.parserFallbacks : this.metrics.parserFallbacks + 1,
            optimizationsUsed: optimized 
                ? [...this.metrics.optimizationsUsed, `parser-${type}`]
                : this.metrics.optimizationsUsed
        };
    }

    /**
     * Record fuzzy matching performance metrics
     */
    private recordFuzzyMetrics(type: 'optimized' | 'standard', duration: number, optimized: boolean): void {
        this.metrics = {
            ...this.metrics,
            totalFuzzyTime: this.metrics.totalFuzzyTime + duration,
            fuzzyFallbacks: optimized ? this.metrics.fuzzyFallbacks : this.metrics.fuzzyFallbacks + 1,
            optimizationsUsed: optimized 
                ? [...this.metrics.optimizationsUsed, `fuzzy-${type}`]
                : this.metrics.optimizationsUsed
        };
    }

    /**
     * Handle errors with logging and metrics
     */
    private handleError(component: string, error: unknown, context?: string): void {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const fullMessage = context ? `${component}: ${errorMessage} (context: ${context})` : `${component}: ${errorMessage}`;
        
        this.metrics = {
            ...this.metrics,
            errorsEncountered: [...this.metrics.errorsEncountered, fullMessage]
        };

        this.log(`Error in ${component}: ${errorMessage}${context ? ` (${context})` : ''}`, 'error');
    }

    /**
     * Log performance information
     */
    private logPerformance(message: string, duration: number): void {
        if (this.config.enablePerformanceMonitoring) {
            this.log(`[PERF] ${message} - ${duration}ms`);
        }
    }

    /**
     * General logging with VS Code integration
     */
    private log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ${message}`;

        if (this.outputChannel) {
            this.outputChannel.appendLine(logMessage);
        }

        if (level === 'error') {
            console.error(logMessage);
        } else if (level === 'warn') {
            console.warn(logMessage);
        } else {
            console.log(logMessage);
        }
    }
}

/**
 * Global optimization manager instance
 */
let globalOptimizationManager: OptimizationManager | null = null;

/**
 * Get or create global optimization manager
 */
export function getOptimizationManager(context?: vscode.ExtensionContext): OptimizationManager {
    if (!globalOptimizationManager) {
        globalOptimizationManager = new OptimizationManager(context);
    }
    return globalOptimizationManager;
}

/**
 * Dispose global optimization manager
 */
export function disposeOptimizationManager(): void {
    globalOptimizationManager = null;
}