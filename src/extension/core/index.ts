/**
 * Core module exports for the refactored HLedger extension
 * Provides clean separation of concerns with specialized components
 */

// Interfaces
export * from './interfaces';

// Core components
export { HLedgerParser } from './HLedgerParser';
export { DataStore } from './DataStore';
export { UsageTracker } from './UsageTracker';
export { FileScanner } from './FileScanner';
export { ConfigManager } from './ConfigManager';

// Optimized components (experimental)
export { 
    AsyncHLedgerParser, 
    AsyncParseOptions, 
    AsyncParseError, 
    FileSizeExceededError 
} from './AsyncHLedgerParser';

export { 
    OptimizationManager, 
    getOptimizationManager,
    disposeOptimizationManager
} from './OptimizationManager';

// Export new extracted components
export { PerformanceMonitor, OptimizationMetrics } from './PerformanceMonitor';
export { FallbackHandler } from './FallbackHandler';
export { ConfigWatcher, OptimizationConfig } from './ConfigWatcher';
export { MetricsCollector } from './MetricsCollector';
export { ComponentFactory } from './ComponentFactory';

// Performance infrastructure
export * from '../performance/PerformanceProfiler';
export * from '../performance/BenchmarkSuite';

// Completion base classes with optimizations
export { FuzzyMatcher, FuzzyMatch, FuzzyMatchOptions } from '../completion/base/FuzzyMatcher';
export { 
    OptimizedFuzzyMatcher, 
    OptimizedFuzzyMatchOptions,
    IFuzzyMatcher,
    IndexedItem,
    SearchResult
} from '../completion/base/OptimizedFuzzyMatcher';

// Type aliases for backward compatibility
export type { IConfigManager as IHLedgerConfig } from './interfaces';