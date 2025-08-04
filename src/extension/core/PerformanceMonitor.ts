/**
 * Performance Monitor - Handles performance tracking and metrics collection
 */

import * as vscode from 'vscode';
import { PerformanceProfiler } from '../performance/PerformanceProfiler';

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
 * Performance monitor that tracks optimization usage and metrics
 */
export class PerformanceMonitor {
    private metrics: OptimizationMetrics;
    private profiler: PerformanceProfiler;
    private outputChannel: vscode.OutputChannel | null = null;
    private enablePerformanceMonitoring: boolean;

    constructor(profiler: PerformanceProfiler, enablePerformanceMonitoring: boolean = false) {
        this.profiler = profiler;
        this.enablePerformanceMonitoring = enablePerformanceMonitoring;
        this.metrics = this.initializeMetrics();
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
     * Setup VS Code output channel for logging
     */
    setupOutputChannel(context?: vscode.ExtensionContext): void {
        if (!this.outputChannel) {
            this.outputChannel = vscode.window.createOutputChannel('HLedger Optimization');
            if (context) {
                context.subscriptions.push(this.outputChannel);
            }
        }
    }

    /**
     * Record parser performance metrics
     */
    recordParseMetrics(type: 'async' | 'standard', duration: number, optimized: boolean): void {
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
    recordFuzzyMetrics(type: 'optimized' | 'standard', duration: number, optimized: boolean): void {
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
     * Record error in metrics
     */
    recordError(component: string, error: unknown, context?: string): void {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const fullMessage = context ? `${component}: ${errorMessage} (context: ${context})` : `${component}: ${errorMessage}`;
        
        this.metrics = {
            ...this.metrics,
            errorsEncountered: [...this.metrics.errorsEncountered, fullMessage]
        };
    }

    /**
     * Log performance information
     */
    logPerformance(message: string, duration: number): void {
        if (this.enablePerformanceMonitoring) {
            this.log(`[PERF] ${message} - ${duration}ms`);
        }
    }

    /**
     * General logging with VS Code integration
     */
    log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
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
     * Export performance data
     */
    exportPerformanceData(config: any): string {
        const report = {
            timestamp: new Date().toISOString(),
            configuration: config,
            metrics: this.metrics,
            profilerData: this.profiler.getMetrics()
        };

        return JSON.stringify(report, null, 2);
    }

    /**
     * Update performance monitoring setting
     */
    setPerformanceMonitoring(enabled: boolean): void {
        this.enablePerformanceMonitoring = enabled;
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        if (this.outputChannel) {
            this.outputChannel.dispose();
            this.outputChannel = null;
        }
    }
}