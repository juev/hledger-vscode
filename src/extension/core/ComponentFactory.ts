/**
 * Component Factory - Manages initialization and lifecycle of optimized components
 */

import { IHLedgerParser, IAsyncHLedgerParser } from './interfaces';
import { HLedgerParser } from './HLedgerParser';
import { AsyncHLedgerParser } from './AsyncHLedgerParser';
import { FuzzyMatcher } from '../completion/base/FuzzyMatcher';
import { OptimizedFuzzyMatcher } from '../completion/base/OptimizedFuzzyMatcher';
import { OptimizationConfig } from './ConfigWatcher';
import { PerformanceMonitor } from './PerformanceMonitor';

/**
 * Factory for creating and managing optimization components
 */
export class ComponentFactory {
    private performanceMonitor: PerformanceMonitor;
    
    // Component instances
    private standardParser!: IHLedgerParser;
    private asyncParser: IAsyncHLedgerParser | null = null;
    private standardFuzzyMatcher!: FuzzyMatcher;
    private optimizedFuzzyMatcher: OptimizedFuzzyMatcher | null = null;

    constructor(performanceMonitor: PerformanceMonitor) {
        this.performanceMonitor = performanceMonitor;
        this.initializeStandardComponents();
    }

    /**
     * Initialize standard (non-optimized) components
     */
    private initializeStandardComponents(): void {
        this.standardParser = new HLedgerParser();
        this.standardFuzzyMatcher = new FuzzyMatcher();
    }

    /**
     * Initialize optimized components based on configuration
     */
    initializeOptimizedComponents(config: OptimizationConfig): void {
        // Initialize async parser
        if (config.enableAsyncParsing) {
            if (!this.asyncParser) {
                this.asyncParser = new AsyncHLedgerParser();
                this.performanceMonitor.log('Initialized AsyncHLedgerParser');
            }
        } else {
            if (this.asyncParser) {
                // AsyncHLedgerParser disposal handled by GC
                this.asyncParser = null;
                this.performanceMonitor.log('Disposed AsyncHLedgerParser');
            }
        }

        // Initialize optimized fuzzy matcher
        if (config.enableOptimizedFuzzyMatching) {
            if (!this.optimizedFuzzyMatcher) {
                this.optimizedFuzzyMatcher = new OptimizedFuzzyMatcher({
                    enableIndexing: config.fuzzyIndexing,
                    cacheResults: config.cacheResults
                });
                this.performanceMonitor.log('Initialized OptimizedFuzzyMatcher');
            } else {
                // OptimizedFuzzyMatcher configuration update - recreate for now
                this.optimizedFuzzyMatcher = null;
                this.optimizedFuzzyMatcher = new OptimizedFuzzyMatcher({
                    enableIndexing: config.fuzzyIndexing,
                    cacheResults: config.cacheResults
                });
            }
        } else {
            if (this.optimizedFuzzyMatcher) {
                // OptimizedFuzzyMatcher disposal handled by GC
                this.optimizedFuzzyMatcher = null;
                this.performanceMonitor.log('Disposed OptimizedFuzzyMatcher');
            }
        }
    }

    /**
     * Get parser instance (standard or optimized)
     */
    getParser(useOptimized: boolean): IHLedgerParser | IAsyncHLedgerParser {
        if (useOptimized && this.asyncParser) {
            return this.asyncParser;
        }
        return this.standardParser;
    }

    /**
     * Get standard parser instance
     */
    getStandardParser(): IHLedgerParser {
        return this.standardParser;
    }

    /**
     * Get async parser instance (may be null)
     */
    getAsyncParser(): IAsyncHLedgerParser | null {
        return this.asyncParser;
    }

    /**
     * Get fuzzy matcher instance (standard or optimized)
     */
    getFuzzyMatcher(useOptimized: boolean): FuzzyMatcher | OptimizedFuzzyMatcher {
        if (useOptimized && this.optimizedFuzzyMatcher) {
            return this.optimizedFuzzyMatcher;
        }
        return this.standardFuzzyMatcher;
    }

    /**
     * Get standard fuzzy matcher instance
     */
    getStandardFuzzyMatcher(): FuzzyMatcher {
        return this.standardFuzzyMatcher;
    }

    /**
     * Get optimized fuzzy matcher instance (may be null)
     */
    getOptimizedFuzzyMatcher(): OptimizedFuzzyMatcher | null {
        return this.optimizedFuzzyMatcher;
    }

    /**
     * Check if async parser is available
     */
    hasAsyncParser(): boolean {
        return this.asyncParser !== null;
    }

    /**
     * Check if optimized fuzzy matcher is available
     */
    hasOptimizedFuzzyMatcher(): boolean {
        return this.optimizedFuzzyMatcher !== null;
    }

    /**
     * Get component status summary
     */
    getComponentStatus(): {
        standardParser: boolean;
        asyncParser: boolean;
        standardFuzzyMatcher: boolean;
        optimizedFuzzyMatcher: boolean;
    } {
        return {
            standardParser: this.standardParser !== null,
            asyncParser: this.asyncParser !== null,
            standardFuzzyMatcher: this.standardFuzzyMatcher !== null,
            optimizedFuzzyMatcher: this.optimizedFuzzyMatcher !== null
        };
    }

    /**
     * Reinitialize all components (useful for testing or recovery)
     */
    reinitializeComponents(config: OptimizationConfig): void {
        this.performanceMonitor.log('Reinitializing all components...');
        
        // Dispose existing optimized components
        this.disposeOptimizedComponents();
        
        // Reinitialize standard components
        this.initializeStandardComponents();
        
        // Initialize optimized components based on config
        this.initializeOptimizedComponents(config);
        
        this.performanceMonitor.log('Component reinitialization completed');
    }

    /**
     * Dispose optimized components only
     */
    private disposeOptimizedComponents(): void {
        if (this.asyncParser) {
            // AsyncHLedgerParser disposal handled by GC
            this.asyncParser = null;
        }
        
        if (this.optimizedFuzzyMatcher) {
            // OptimizedFuzzyMatcher disposal handled by GC
            this.optimizedFuzzyMatcher = null;
        }
    }

    /**
     * Dispose all components
     */
    dispose(): void {
        this.performanceMonitor.log('Disposing all components...');
        
        // Dispose optimized components
        this.disposeOptimizedComponents();
        
        // Standard components don't need explicit disposal
        // but we null them for consistency
        // Note: Don't dispose standard components as they might be used elsewhere
        
        this.performanceMonitor.log('Component disposal completed');
    }

    /**
     * Get memory usage estimation for components
     */
    getMemoryUsage(): {
        standardParser: string;
        asyncParser: string;
        standardFuzzyMatcher: string;
        optimizedFuzzyMatcher: string;
        total: string;
    } {
        // This is a rough estimation - actual memory usage would require more sophisticated tracking
        const standardParserMem = 50; // KB
        const asyncParserMem = this.asyncParser ? 200 : 0; // KB
        const standardFuzzyMem = 30; // KB
        const optimizedFuzzyMem = this.optimizedFuzzyMatcher ? 150 : 0; // KB
        
        const total = standardParserMem + asyncParserMem + standardFuzzyMem + optimizedFuzzyMem;
        
        return {
            standardParser: `~${standardParserMem}KB`,
            asyncParser: this.asyncParser ? `~${asyncParserMem}KB` : 'Not loaded',
            standardFuzzyMatcher: `~${standardFuzzyMem}KB`,
            optimizedFuzzyMatcher: this.optimizedFuzzyMatcher ? `~${optimizedFuzzyMem}KB` : 'Not loaded',
            total: `~${total}KB`
        };
    }
}