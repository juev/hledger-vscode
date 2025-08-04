/**
 * Performance profiler for HLedger VSCode extension
 * Provides comprehensive performance measurement and analysis tools
 */

import * as vscode from 'vscode';
import { SyncSingleton, SingletonLifecycleManager } from '../core/SingletonManager';

/** Branded type for performance metric names to ensure type safety */
type MetricName = string & { readonly __brand: unique symbol };

/** Type-safe performance metrics interface */
export interface PerformanceMetrics {
    readonly name: string;
    readonly duration: number;
    readonly memoryUsed?: number;
    readonly memoryDelta?: number;
    readonly timestamp: number;
    readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ProfilerReport {
    readonly totalDuration: number;
    readonly averageDuration: number;
    readonly minDuration: number;
    readonly maxDuration: number;
    readonly iterations: number;
    readonly memoryPeakUsage?: number;
    readonly memoryAverageUsage?: number;
    readonly metrics: readonly PerformanceMetrics[];
    readonly percentiles?: Readonly<{
        p50: number;
        p90: number;
        p95: number;
        p99: number;
    }>;
}

export interface ProfilerOptions {
    enableMemoryTracking?: boolean;
    enableGC?: boolean;
    warmupIterations?: number;
    minIterations?: number;
    maxIterations?: number;
    maxDuration?: number; // Maximum total profiling duration in ms
    collectMetadata?: boolean;
}

/**
 * High-precision performance profiler with memory tracking
 */
export class PerformanceProfiler extends SyncSingleton {
    private metrics: PerformanceMetrics[] = [];
    private startTime: number = 0;
    private startMemory: number = 0;
    private options: Required<ProfilerOptions>;

    constructor(options: ProfilerOptions = {}) {
        super();
        this.options = {
            enableMemoryTracking: options.enableMemoryTracking ?? true,
            enableGC: options.enableGC ?? false,
            warmupIterations: options.warmupIterations ?? 3,
            minIterations: options.minIterations ?? 10,
            maxIterations: options.maxIterations ?? 1000,
            maxDuration: 30000, // 30 seconds
            collectMetadata: true,
            ...options
        };
    }

    protected getSingletonKey(): string {
        return 'PerformanceProfiler';
    }

    protected initialize(): void {
        // Initialize profiler state
        this.metrics = [];
        this.startTime = 0;
        this.startMemory = 0;
        
        // Register with lifecycle manager
        SingletonLifecycleManager.register(this);
    }

    /**
     * Clear all metrics
     */
    clearMetrics(): void {
        this.metrics = [];
    }

    /**
     * Start profiling a specific operation
     */
    start(name: string): void {
        if (this.options.enableGC && global.gc) {
            global.gc();
        }

        this.startTime = this.getCurrentTime();
        this.startMemory = this.options.enableMemoryTracking ? this.getMemoryUsage() : 0;
    }

    /**
     * End profiling and record metrics
     */
    end(name: string, metadata?: Record<string, unknown>): PerformanceMetrics {
        const endTime = this.getCurrentTime();
        const endMemory = this.options.enableMemoryTracking ? this.getMemoryUsage() : 0;
        
        const metric: PerformanceMetrics = {
            name,
            duration: endTime - this.startTime,
            memoryUsed: this.options.enableMemoryTracking ? endMemory : undefined,
            memoryDelta: this.options.enableMemoryTracking ? endMemory - this.startMemory : undefined,
            timestamp: Date.now(),
            metadata: this.options.collectMetadata ? metadata : undefined
        };

        this.metrics.push(metric);
        return metric;
    }

    /**
     * Profile a function synchronously
     */
    profile<T>(name: string, fn: () => T, metadata?: Record<string, unknown>): T {
        this.start(name);
        const result = fn();
        this.end(name, metadata);
        return result;
    }

    /**
     * Profile an async function
     */
    async profileAsync<T>(name: string, fn: () => Promise<T>, metadata?: Record<string, unknown>): Promise<T> {
        this.start(name);
        const result = await fn();
        this.end(name, metadata);
        return result;
    }

    /**
     * Run multiple iterations of a function and collect statistics
     */
    benchmark(name: string, fn: () => void, customOptions?: Partial<ProfilerOptions>): ProfilerReport {
        const options = { ...this.options, ...customOptions };
        const iterationMetrics: PerformanceMetrics[] = [];
        
        const startBenchmark = Date.now();
        
        // Warmup phase
        for (let i = 0; i < options.warmupIterations; i++) {
            fn();
        }

        // Actual benchmark
        for (let i = 0; i < options.maxIterations && (Date.now() - startBenchmark) < options.maxDuration; i++) {
            this.start(`${name}_iteration_${i}`);
            fn();
            const metric = this.end(`${name}_iteration_${i}`, { iteration: i });
            iterationMetrics.push(metric);

            // Early exit if we have enough stable measurements
            if (i >= options.minIterations && this.isStable(iterationMetrics)) {
                break;
            }
        }

        return this.generateReport(name, iterationMetrics);
    }

    /**
     * Run multiple iterations of an async function and collect statistics
     */
    async benchmarkAsync(name: string, fn: () => Promise<void>, customOptions?: Partial<ProfilerOptions>): Promise<ProfilerReport> {
        const options = { ...this.options, ...customOptions };
        const iterationMetrics: PerformanceMetrics[] = [];
        
        const startBenchmark = Date.now();
        
        // Warmup phase
        for (let i = 0; i < options.warmupIterations; i++) {
            await fn();
        }

        // Actual benchmark
        for (let i = 0; i < options.maxIterations && (Date.now() - startBenchmark) < options.maxDuration; i++) {
            this.start(`${name}_iteration_${i}`);
            await fn();
            const metric = this.end(`${name}_iteration_${i}`, { iteration: i });
            iterationMetrics.push(metric);

            // Early exit if we have enough stable measurements
            if (i >= options.minIterations && this.isStable(iterationMetrics)) {
                break;
            }
        }

        return this.generateReport(name, iterationMetrics);
    }

    /**
     * Get all collected metrics
     */
    getMetrics(): PerformanceMetrics[] {
        return [...this.metrics];
    }

    /**
     * Generate comprehensive report
     */
    generateReport(name: string, metrics: PerformanceMetrics[]): ProfilerReport {
        if (metrics.length === 0) {
            throw new Error('No metrics available for report generation');
        }

        const durations = metrics.map(m => m.duration).sort((a, b) => a - b);
        const memoryUsages = metrics
            .map(m => m.memoryUsed)
            .filter((m): m is number => m !== undefined)
            .sort((a, b) => a - b);

        const totalDuration = durations.reduce((sum, d) => sum + d, 0);
        const averageDuration = totalDuration / durations.length;

        const report: ProfilerReport = {
            totalDuration,
            averageDuration,
            minDuration: durations[0],
            maxDuration: durations[durations.length - 1],
            iterations: metrics.length,
            metrics,
            percentiles: {
                p50: this.percentile(durations, 0.5),
                p90: this.percentile(durations, 0.9),
                p95: this.percentile(durations, 0.95),
                p99: this.percentile(durations, 0.99),
            },
            memoryPeakUsage: memoryUsages.length > 0 ? Math.max(...memoryUsages) : undefined,
            memoryAverageUsage: memoryUsages.length > 0 ? memoryUsages.reduce((sum, m) => sum + m, 0) / memoryUsages.length : undefined
        };

        return report;
    }

    /**
     * Clear all collected metrics
     */
    clear(): void {
        this.metrics = [];
    }

    /**
     * Format report as readable string
     */
    formatReport(report: ProfilerReport): string {
        const lines: string[] = [];
        
        lines.push(`Performance Report`);
        lines.push(`==================`);
        lines.push(`Total Duration: ${report.totalDuration.toFixed(2)}ms`);
        lines.push(`Average Duration: ${report.averageDuration.toFixed(2)}ms`);
        lines.push(`Min Duration: ${report.minDuration.toFixed(2)}ms`);
        lines.push(`Max Duration: ${report.maxDuration.toFixed(2)}ms`);
        lines.push(`Iterations: ${report.iterations}`);
        
        if (report.percentiles) {
            lines.push(`Percentiles:`);
            lines.push(`  P50: ${report.percentiles.p50.toFixed(2)}ms`);
            lines.push(`  P90: ${report.percentiles.p90.toFixed(2)}ms`);
            lines.push(`  P95: ${report.percentiles.p95.toFixed(2)}ms`);
            lines.push(`  P99: ${report.percentiles.p99.toFixed(2)}ms`);
        }

        if (report.memoryPeakUsage && report.memoryAverageUsage) {
            lines.push(`Memory Peak Usage: ${this.formatBytes(report.memoryPeakUsage)}`);
            lines.push(`Memory Average Usage: ${this.formatBytes(report.memoryAverageUsage)}`);
        }

        return lines.join('\n');
    }

    /**
     * Export metrics to CSV format
     */
    exportToCsv(metrics: PerformanceMetrics[]): string {
        if (metrics.length === 0) {
            return '';
        }

        const headers = ['name', 'duration', 'memoryUsed', 'memoryDelta', 'timestamp'];
        const rows = metrics.map(m => [
            m.name,
            m.duration.toString(),
            m.memoryUsed?.toString() || '',
            m.memoryDelta?.toString() || '',
            m.timestamp.toString()
        ]);

        return [headers, ...rows].map(row => row.join(',')).join('\n');
    }

    /**
     * Get high-precision timestamp
     */
    private getCurrentTime(): number {
        if (typeof performance !== 'undefined' && performance.now) {
            return performance.now();
        }
        return Date.now();
    }

    /**
     * Get current memory usage in bytes
     */
    private getMemoryUsage(): number {
        if (typeof process !== 'undefined' && process.memoryUsage) {
            return process.memoryUsage().heapUsed;
        }
        return 0;
    }

    /**
     * Calculate percentile
     */
    private percentile(sorted: number[], p: number): number {
        const index = Math.ceil(sorted.length * p) - 1;
        return sorted[Math.max(0, index)];
    }

    /**
     * Check if measurements are stable (low variance)
     */
    private isStable(metrics: PerformanceMetrics[]): boolean {
        if (metrics.length < 10) {
            return false;
        }

        const recent = metrics.slice(-10);
        const durations = recent.map(m => m.duration);
        const avg = durations.reduce((sum, d) => sum + d, 0) / durations.length;
        const variance = durations.reduce((sum, d) => sum + Math.pow(d - avg, 2), 0) / durations.length;
        const stdDev = Math.sqrt(variance);
        const coefficientOfVariation = stdDev / avg;

        // Consider stable if coefficient of variation is less than 5%
        return coefficientOfVariation < 0.05;
    }

    /**
     * Format bytes to human readable format
     */
    private formatBytes(bytes: number): string {
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 Bytes';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    /**
     * Get singleton instance of PerformanceProfiler
     */
    public static getInstance(context?: vscode.ExtensionContext): PerformanceProfiler {
        return super.getInstance.call(this, context);
    }

    /**
     * Reset singleton for testing
     */
    public static resetInstance(): void {
        const instances = SyncSingleton.getActiveInstances();
        const instance = instances.get('PerformanceProfiler');
        if (instance) {
            instance.reset();
        }
    }

    /**
     * Override dispose to cleanup resources properly
     */
    public dispose(): void {
        this.clearMetrics();
        super.dispose();
    }
}

/**
 * Singleton instance for global profiling
 * @deprecated Use PerformanceProfiler.getInstance() instead
 */
export const profiler = PerformanceProfiler.getInstance();

/**
 * Type-safe decorator for profiling synchronous methods
 */
export function profile(name?: string) {
    return function <T extends Record<string, unknown>>(
        target: T, 
        propertyKey: string, 
        descriptor: PropertyDescriptor
    ): PropertyDescriptor {
        const originalMethod = descriptor.value as (...args: unknown[]) => unknown;
        const profileName = name || `${(target.constructor as { name: string }).name}.${propertyKey}`;

        descriptor.value = function (this: T, ...args: unknown[]) {
            return PerformanceProfiler.getInstance().profile(profileName, () => originalMethod.apply(this, args));
        };

        return descriptor;
    };
}

/**
 * Type-safe decorator for profiling asynchronous methods
 */
export function profileAsync(name?: string) {
    return function <T extends Record<string, unknown>>(
        target: T, 
        propertyKey: string, 
        descriptor: PropertyDescriptor
    ): PropertyDescriptor {
        const originalMethod = descriptor.value as (...args: unknown[]) => Promise<unknown>;
        const profileName = name || `${(target.constructor as { name: string }).name}.${propertyKey}`;

        descriptor.value = async function (this: T, ...args: unknown[]) {
            return PerformanceProfiler.getInstance().profileAsync(profileName, () => originalMethod.apply(this, args));
        };

        return descriptor;
    };
}