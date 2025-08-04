/**
 * Metrics Collector - Handles collection and export of performance and optimization metrics
 */

import * as vscode from 'vscode';
import { PerformanceMonitor, OptimizationMetrics } from './PerformanceMonitor';
import { OptimizationConfig } from './ConfigWatcher';

/**
 * Collects and exports various metrics from the optimization system
 */
export class MetricsCollector {
    private performanceMonitor: PerformanceMonitor;

    constructor(performanceMonitor: PerformanceMonitor) {
        this.performanceMonitor = performanceMonitor;
    }

    /**
     * Run performance benchmark
     */
    async runBenchmark(enableBenchmarking: boolean): Promise<void> {
        if (!enableBenchmarking) {
            this.performanceMonitor.log('Benchmarking is disabled in configuration');
            return;
        }

        this.performanceMonitor.log('Starting performance benchmark...');

        try {
            const { runQuickBenchmark } = await import('../performance/BenchmarkSuite');
            await runQuickBenchmark();
            this.performanceMonitor.log('Benchmark completed successfully');
        } catch (error) {
            this.performanceMonitor.recordError('benchmark', error);
        }
    }

    /**
     * Export performance data
     */
    exportPerformanceData(config: OptimizationConfig): string {
        return this.performanceMonitor.exportPerformanceData(config);
    }

    /**
     * Get current metrics
     */
    getMetrics(): Readonly<OptimizationMetrics> {
        return this.performanceMonitor.getMetrics();
    }

    /**
     * Reset all metrics
     */
    resetMetrics(): void {
        this.performanceMonitor.resetMetrics();
    }

    /**
     * Register VS Code commands for metrics operations
     */
    registerCommands(context: vscode.ExtensionContext, config: OptimizationConfig): void {
        const benchmarkCommand = vscode.commands.registerCommand('hledger.optimization.runBenchmark', () => {
            this.runBenchmark(config.enableBenchmarking);
        });

        const exportCommand = vscode.commands.registerCommand('hledger.optimization.exportData', async () => {
            const data = this.exportPerformanceData(config);
            const document = await vscode.workspace.openTextDocument({
                content: data,
                language: 'json'
            });
            await vscode.window.showTextDocument(document);
        });

        const resetCommand = vscode.commands.registerCommand('hledger.optimization.resetMetrics', () => {
            this.resetMetrics();
            this.performanceMonitor.log('Performance metrics reset');
        });

        context.subscriptions.push(benchmarkCommand, exportCommand, resetCommand);
    }

    /**
     * Get summary statistics
     */
    getSummary(): {
        totalOperations: number;
        successRate: number;
        averageParseTime: number;
        averageFuzzyTime: number;
        optimizationUsage: number;
    } {
        const metrics = this.getMetrics();
        const totalParseOps = metrics.parserFallbacks + (metrics.optimizationsUsed.filter(opt => opt.startsWith('parser-')).length);
        const totalFuzzyOps = metrics.fuzzyFallbacks + (metrics.optimizationsUsed.filter(opt => opt.startsWith('fuzzy-')).length);
        const totalOps = totalParseOps + totalFuzzyOps;
        const successfulOps = totalOps - metrics.errorsEncountered.length;

        return {
            totalOperations: totalOps,
            successRate: totalOps > 0 ? (successfulOps / totalOps) * 100 : 100,
            averageParseTime: totalParseOps > 0 ? metrics.totalParseTime / totalParseOps : 0,
            averageFuzzyTime: totalFuzzyOps > 0 ? metrics.totalFuzzyTime / totalFuzzyOps : 0,
            optimizationUsage: metrics.optimizationsUsed.length
        };
    }

    /**
     * Generate detailed report
     */
    generateDetailedReport(config: OptimizationConfig): string {
        const metrics = this.getMetrics();
        const summary = this.getSummary();
        
        const report = {
            timestamp: new Date().toISOString(),
            summary,
            configuration: config,
            detailedMetrics: metrics,
            recommendations: this.generateRecommendations(metrics, config)
        };

        return JSON.stringify(report, null, 2);
    }

    /**
     * Generate performance recommendations based on metrics
     */
    private generateRecommendations(metrics: OptimizationMetrics, config: OptimizationConfig): string[] {
        const recommendations: string[] = [];

        // Check fallback rates
        if (metrics.parserFallbacks > 0 && !config.enableAsyncParsing) {
            recommendations.push('Consider enabling async parsing for better performance on large files');
        }

        if (metrics.fuzzyFallbacks > 0 && !config.enableOptimizedFuzzyMatching) {
            recommendations.push('Consider enabling optimized fuzzy matching for better completion performance');
        }

        // Check error rates
        if (metrics.errorsEncountered.length > 0) {
            recommendations.push(`${metrics.errorsEncountered.length} errors encountered - check logs for details`);
        }

        // Check optimization usage
        if (metrics.optimizationsUsed.length === 0) {
            recommendations.push('No optimizations are currently active - consider enabling them for better performance');
        }

        // Performance-based recommendations
        const summary = this.getSummary();
        if (summary.averageParseTime > 1000) {
            recommendations.push('Average parse time is high (>1s) - consider enabling async parsing or reducing file size');
        }

        if (summary.averageFuzzyTime > 100) {
            recommendations.push('Average fuzzy matching time is high (>100ms) - consider enabling optimized fuzzy matching');
        }

        if (recommendations.length === 0) {
            recommendations.push('Performance is optimal with current settings');
        }

        return recommendations;
    }

    /**
     * Log current metrics summary
     */
    logSummary(): void {
        const summary = this.getSummary();
        this.performanceMonitor.log(`Performance Summary - Operations: ${summary.totalOperations}, Success Rate: ${summary.successRate.toFixed(1)}%, Avg Parse: ${summary.averageParseTime.toFixed(1)}ms, Avg Fuzzy: ${summary.averageFuzzyTime.toFixed(1)}ms`);
    }
}