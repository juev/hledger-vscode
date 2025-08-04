/**
 * Fallback Handler - Manages error handling and fallback mechanisms for optimization components
 */

import { IHLedgerParser, IAsyncHLedgerParser, ParsedHLedgerData } from './interfaces';
import { AsyncParseOptions } from './AsyncHLedgerParser';
import { FuzzyMatch, FuzzyMatchOptions } from '../completion/base/FuzzyMatcher';
import { OptimizedFuzzyMatchOptions } from '../completion/base/OptimizedFuzzyMatcher';
import { PerformanceMonitor } from './PerformanceMonitor';
import { FilePath, createFilePath } from './BrandedTypes';

/**
 * Handles fallback logic for optimization components with error recovery
 */
export class FallbackHandler {
    private fallbackOnError: boolean;
    private performanceMonitor: PerformanceMonitor;

    constructor(fallbackOnError: boolean, performanceMonitor: PerformanceMonitor) {
        this.fallbackOnError = fallbackOnError;
        this.performanceMonitor = performanceMonitor;
    }

    /**
     * Execute parser with fallback logic
     */
    async executeParseFile(
        filePath: FilePath,
        asyncParser: IAsyncHLedgerParser | null,
        standardParser: IHLedgerParser,
        options: {
            enableAsyncParsing: boolean;
            enablePerformanceMonitoring: boolean;
            maxFileSize: number;
            asyncChunkSize: number;
            cacheResults: boolean;
        }
    ): Promise<ParsedHLedgerData> {
        const startTime = Date.now();
        
        // Try optimized async parser first
        if (options.enableAsyncParsing && asyncParser) {
            try {
                const asyncOptions: AsyncParseOptions = {
                    maxFileSize: options.maxFileSize,
                    chunkSize: options.asyncChunkSize,
                    enableCache: options.cacheResults
                };

                const result = await asyncParser.parseFileAsync(filePath, asyncOptions);
                
                if (options.enablePerformanceMonitoring) {
                    this.performanceMonitor.recordParseMetrics('async', Date.now() - startTime, true);
                    this.performanceMonitor.logPerformance(`Async parsing completed for ${filePath}`, Date.now() - startTime);
                }
                
                return result;
            } catch (error) {
                this.handleError('async-parser', error, filePath);
                
                if (!this.fallbackOnError) {
                    throw error;
                }
            }
        }

        // Fallback to standard parser
        try {
            const result = standardParser.parseFile(filePath);
            
            if (options.enablePerformanceMonitoring) {
                this.performanceMonitor.recordParseMetrics('standard', Date.now() - startTime, false);
                this.performanceMonitor.logPerformance(`Standard parsing completed for ${filePath}`, Date.now() - startTime);
            }
            
            return result;
        } catch (error) {
            this.handleError('standard-parser', error, filePath);
            throw error;
        }
    }

    /**
     * Execute content parsing with fallback logic
     */
    async executeParseContent(
        content: string,
        basePath: FilePath | undefined,
        asyncParser: IAsyncHLedgerParser | null,
        standardParser: IHLedgerParser,
        options: {
            enableAsyncParsing: boolean;
            enablePerformanceMonitoring: boolean;
            asyncChunkSize: number;
            cacheResults: boolean;
        }
    ): Promise<ParsedHLedgerData> {
        const startTime = Date.now();
        
        // Try optimized async parser first
        if (options.enableAsyncParsing && asyncParser) {
            try {
                const asyncOptions: AsyncParseOptions = {
                    chunkSize: options.asyncChunkSize,
                    enableCache: options.cacheResults
                };

                const result = await asyncParser.parseContentAsync(content, basePath, asyncOptions);
                
                if (options.enablePerformanceMonitoring) {
                    this.performanceMonitor.recordParseMetrics('async', Date.now() - startTime, true);
                }
                
                return result;
            } catch (error) {
                this.handleError('async-parser', error);
                
                if (!this.fallbackOnError) {
                    throw error;
                }
            }
        }

        // Fallback to standard parser
        try {
            const result = standardParser.parseContent(content, basePath);
            
            if (options.enablePerformanceMonitoring) {
                this.performanceMonitor.recordParseMetrics('standard', Date.now() - startTime, false);
            }
            
            return result;
        } catch (error) {
            this.handleError('standard-parser', error);
            throw error;
        }
    }

    /**
     * Execute fuzzy matching with fallback logic
     */
    executeFuzzyMatch(
        query: string,
        items: string[],
        optimizedMatcher: any | null,
        standardMatcher: any,
        options: {
            enableOptimizedFuzzyMatching: boolean;
            enablePerformanceMonitoring: boolean;
            fuzzyIndexing: boolean;
            cacheResults: boolean;
        },
        baseOptions: FuzzyMatchOptions = {}
    ): FuzzyMatch[] {
        const startTime = Date.now();
        
        // Try optimized fuzzy matcher first
        if (options.enableOptimizedFuzzyMatching && optimizedMatcher) {
            try {
                const optimizedOptions: OptimizedFuzzyMatchOptions = {
                    ...baseOptions,
                    enableIndexing: options.fuzzyIndexing,
                    cacheResults: options.cacheResults
                };

                const result = optimizedMatcher.match(query, items, optimizedOptions);
                
                if (options.enablePerformanceMonitoring) {
                    this.performanceMonitor.recordFuzzyMetrics('optimized', Date.now() - startTime, true);
                }
                
                return result;
            } catch (error) {
                this.handleError('optimized-fuzzy', error);
                
                if (!this.fallbackOnError) {
                    throw error;
                }
            }
        }

        // Fallback to standard fuzzy matcher
        try {
            const result = standardMatcher.match(query, items, baseOptions);
            
            if (options.enablePerformanceMonitoring) {
                this.performanceMonitor.recordFuzzyMetrics('standard', Date.now() - startTime, false);
            }
            
            return result;
        } catch (error) {
            this.handleError('standard-fuzzy', error);
            throw error;
        }
    }

    /**
     * Handle errors with logging and metrics
     */
    private handleError(component: string, error: unknown, context?: string): void {
        this.performanceMonitor.recordError(component, error, context);
        
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.performanceMonitor.log(
            `Error in ${component}: ${errorMessage}${context ? ` (${context})` : ''}`, 
            'error'
        );
    }

    /**
     * Update fallback configuration
     */
    setFallbackOnError(enabled: boolean): void {
        this.fallbackOnError = enabled;
    }

    /**
     * Get current fallback setting
     */
    getFallbackOnError(): boolean {
        return this.fallbackOnError;
    }
}