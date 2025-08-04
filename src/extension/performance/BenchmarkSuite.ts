/**
 * Comprehensive benchmark suite for HLedger VSCode extension
 * Tests performance of all major components with realistic data
 */

import * as fs from 'fs';
import * as path from 'path';
import { PerformanceProfiler, ProfilerReport } from './PerformanceProfiler';
import { HLedgerParser } from '../core/HLedgerParser';
import { FuzzyMatcher } from '../completion/base/FuzzyMatcher';
import { ConfigManager } from '../core/ConfigManager';

export interface BenchmarkResult {
    name: string;
    report: ProfilerReport;
    category: string;
    dataSize: number;
    metadata?: Record<string, any>;
}

export interface BenchmarkSuiteOptions {
    outputDir?: string;
    saveResults?: boolean;
    includeMemoryTracking?: boolean;
    warmupIterations?: number;
    minIterations?: number;
    maxIterations?: number;
}

/**
 * Test data generators for different scenarios
 */
export class TestDataGenerator {
    /**
     * Generate hledger content with specified number of transactions
     */
    static generateHLedgerContent(numTransactions: number): string {
        const accounts = [
            'Assets:Bank:Checking',
            'Assets:Bank:Savings',
            'Assets:Cash',
            'Expenses:Food:Groceries',
            'Expenses:Food:Restaurants',
            'Expenses:Transportation:Gas',
            'Expenses:Transportation:Public',
            'Expenses:Utilities:Electric',
            'Expenses:Utilities:Water',
            'Expenses:Entertainment',
            'Income:Salary',
            'Income:Freelance',
            'Liabilities:CreditCard'
        ];

        const payees = [
            'Grocery Store',
            'Gas Station',
            'Restaurant ABC',
            'Electric Company',
            'Water Department',
            'Movie Theater',
            'Coffee Shop',
            'Bookstore',
            'Pharmacy',
            'ATM Withdrawal'
        ];

        const commodities = ['USD', 'EUR', 'GBP', 'CAD', 'BTC', 'ETH'];
        const tags = ['category', 'project', 'location', 'method', 'status'];

        let content = '';
        
        // Add account definitions
        accounts.forEach(account => {
            content += `account ${account}\n`;
        });
        content += '\n';

        // Add commodity definitions
        commodities.forEach(commodity => {
            content += `commodity ${commodity}\n`;
        });
        content += '\n';

        // Generate transactions
        for (let i = 0; i < numTransactions; i++) {
            const date = new Date(2023, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1);
            const dateStr = date.toISOString().slice(0, 10);
            const payee = payees[Math.floor(Math.random() * payees.length)];
            const tag = tags[Math.floor(Math.random() * tags.length)];
            const commodity = commodities[Math.floor(Math.random() * commodities.length)];
            
            content += `${dateStr} * ${payee} ; ${tag}:value${i}\n`;
            
            // Add 2-4 postings per transaction
            const numPostings = 2 + Math.floor(Math.random() * 3);
            for (let j = 0; j < numPostings; j++) {
                const account = accounts[Math.floor(Math.random() * accounts.length)];
                const amount = (Math.random() * 1000).toFixed(2);
                if (j === numPostings - 1) {
                    // Last posting - no amount (auto-calculated)
                    content += `    ${account}\n`;
                } else {
                    content += `    ${account}  ${amount} ${commodity}\n`;
                }
            }
            content += '\n';
        }

        return content;
    }

    /**
     * Generate array of strings for fuzzy matching tests
     */
    static generateStringArray(size: number, avgLength: number = 20): string[] {
        const prefixes = ['Assets', 'Expenses', 'Income', 'Liabilities', 'Equity'];
        const categories = ['Bank', 'Food', 'Transport', 'Utilities', 'Entertainment', 'Health', 'Education'];
        const subcategories = ['Checking', 'Savings', 'Groceries', 'Restaurants', 'Gas', 'Public', 'Electric', 'Water'];
        
        const items: string[] = [];
        
        for (let i = 0; i < size; i++) {
            let item = '';
            const depth = 1 + Math.floor(Math.random() * 3); // 1-3 levels deep
            
            // Build hierarchical account name
            item = prefixes[Math.floor(Math.random() * prefixes.length)];
            
            if (depth > 1) {
                item += ':' + categories[Math.floor(Math.random() * categories.length)];
            }
            
            if (depth > 2) {
                item += ':' + subcategories[Math.floor(Math.random() * subcategories.length)];
            }
            
            // Add some variation with numbers and special chars
            if (Math.random() < 0.3) {
                item += ` ${Math.floor(Math.random() * 1000)}`;
            }
            
            items.push(item);
        }
        
        return items;
    }

    /**
     * Generate usage frequency map
     */
    static generateUsageMap(items: string[]): Map<string, number> {
        const usageMap = new Map<string, number>();
        
        items.forEach(item => {
            // Zipf distribution: first items are more frequently used
            const frequency = Math.floor(Math.random() * 100) + 1;
            usageMap.set(item, frequency);
        });
        
        return usageMap;
    }
}

/**
 * Main benchmark suite
 */
export class BenchmarkSuite {
    private profiler: PerformanceProfiler;
    private results: BenchmarkResult[] = [];
    private options: Required<BenchmarkSuiteOptions>;

    constructor(options: BenchmarkSuiteOptions = {}) {
        this.options = {
            outputDir: './benchmark-results',
            saveResults: true,
            includeMemoryTracking: true,
            warmupIterations: 3,
            minIterations: 10,
            maxIterations: 100,
            ...options
        };

        this.profiler = PerformanceProfiler.getInstance();
    }

    /**
     * Run all benchmarks
     */
    async runAll(): Promise<BenchmarkResult[]> {
        console.log('Starting comprehensive benchmark suite...\n');

        // File parsing benchmarks
        await this.runParserBenchmarks();
        
        // Fuzzy matching benchmarks
        await this.runFuzzyMatchingBenchmarks();
        
        // Configuration management benchmarks
        await this.runConfigBenchmarks();
        
        // Memory usage benchmarks
        await this.runMemoryBenchmarks();

        if (this.options.saveResults) {
            await this.saveResults();
        }

        this.printSummary();
        return this.results;
    }

    /**
     * Run parser benchmarks with different file sizes
     */
    private async runParserBenchmarks(): Promise<void> {
        console.log('Running parser benchmarks...');
        
        const parser = new HLedgerParser();
        const testSizes = [100, 500, 1000, 5000, 10000];
        
        for (const size of testSizes) {
            const content = TestDataGenerator.generateHLedgerContent(size);
            const contentSize = Buffer.byteLength(content, 'utf8');
            
            console.log(`  Testing parser with ${size} transactions (${this.formatBytes(contentSize)})...`);
            
            const report = this.profiler.benchmark(
                `parser_${size}_transactions`,
                () => parser.parseContent(content),
                { maxIterations: Math.min(50, this.options.maxIterations) }
            );
            
            this.results.push({
                name: `Parser - ${size} transactions`,
                report,
                category: 'parsing',
                dataSize: size,
                metadata: { contentSize, transactionCount: size }
            });
        }
    }

    /**
     * Run fuzzy matching benchmarks with different data sizes and query types
     */
    private async runFuzzyMatchingBenchmarks(): Promise<void> {
        console.log('Running fuzzy matching benchmarks...');
        
        const matcher = new FuzzyMatcher();
        const testSizes = [100, 500, 1000, 5000, 10000];
        const queryTypes = [
            { name: 'short', query: 'ex', description: 'Short query (2 chars)' },
            { name: 'medium', query: 'expense', description: 'Medium query (7 chars)' },
            { name: 'long', query: 'expenses:food:restaurants', description: 'Long query (23 chars)' },
            { name: 'partial', query: 'exp:fo:res', description: 'Partial hierarchical match' }
        ];
        
        for (const size of testSizes) {
            const items = TestDataGenerator.generateStringArray(size);
            const usageMap = TestDataGenerator.generateUsageMap(items);
            
            for (const queryType of queryTypes) {
                console.log(`  Testing fuzzy matcher: ${size} items, ${queryType.description}...`);
                
                const report = this.profiler.benchmark(
                    `fuzzy_${size}_${queryType.name}`,
                    () => matcher.match(queryType.query, items, { usageCounts: usageMap }),
                    { maxIterations: Math.min(30, this.options.maxIterations) }
                );
                
                this.results.push({
                    name: `Fuzzy Match - ${size} items, ${queryType.description}`,
                    report,
                    category: 'fuzzy_matching',
                    dataSize: size,
                    metadata: { 
                        itemCount: size, 
                        queryLength: queryType.query.length,
                        queryType: queryType.name
                    }
                });
            }
        }
    }

    /**
     * Run configuration management benchmarks
     */
    private async runConfigBenchmarks(): Promise<void> {
        console.log('Running configuration management benchmarks...');
        
        // Create temporary test files
        const tempDir = path.join(process.cwd(), 'temp-benchmark');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        const fileSizes = [1000, 5000, 10000];
        
        try {
            for (const size of fileSizes) {
                const content = TestDataGenerator.generateHLedgerContent(size);
                const testFile = path.join(tempDir, `test-${size}.journal`);
                fs.writeFileSync(testFile, content);
                
                console.log(`  Testing config scanning with ${size} transactions...`);
                
                const config = new ConfigManager();
                const report = this.profiler.benchmark(
                    `config_scan_${size}`,
                    () => {
                        config.clear();
                        config.parseFile(testFile);
                    },
                    { maxIterations: Math.min(20, this.options.maxIterations) }
                );
                
                this.results.push({
                    name: `Config Scan - ${size} transactions`,
                    report,
                    category: 'configuration',
                    dataSize: size,
                    metadata: { transactionCount: size, fileSize: Buffer.byteLength(content, 'utf8') }
                });
            }
        } finally {
            // Cleanup
            if (fs.existsSync(tempDir)) {
                fs.rmSync(tempDir, { recursive: true, force: true });
            }
        }
    }

    /**
     * Run memory usage benchmarks
     */
    private async runMemoryBenchmarks(): Promise<void> {
        console.log('Running memory usage benchmarks...');
        
        const testSizes = [1000, 5000, 10000];
        
        for (const size of testSizes) {
            console.log(`  Testing memory usage with ${size} items...`);
            
            // Test parser memory usage
            const content = TestDataGenerator.generateHLedgerContent(size);
            const parser = new HLedgerParser();
            
            const parserReport = this.profiler.benchmark(
                `memory_parser_${size}`,
                () => {
                    const result = parser.parseContent(content);
                    // Keep reference to prevent GC
                    return result;
                },
                { 
                    maxIterations: 10,
                    enableGC: true 
                }
            );
            
            this.results.push({
                name: `Memory Usage - Parser ${size} transactions`,
                report: parserReport,
                category: 'memory',
                dataSize: size,
                metadata: { component: 'parser', itemCount: size }
            });

            // Test fuzzy matcher memory usage
            const items = TestDataGenerator.generateStringArray(size);
            const matcher = new FuzzyMatcher();
            
            const fuzzyReport = this.profiler.benchmark(
                `memory_fuzzy_${size}`,
                () => {
                    const results = matcher.match('test', items);
                    // Keep reference to prevent GC
                    return results;
                },
                { 
                    maxIterations: 10,
                    enableGC: true 
                }
            );
            
            this.results.push({
                name: `Memory Usage - Fuzzy Matcher ${size} items`,
                report: fuzzyReport,
                category: 'memory',
                dataSize: size,
                metadata: { component: 'fuzzy_matcher', itemCount: size }
            });
        }
    }

    /**
     * Save benchmark results to files
     */
    private async saveResults(): Promise<void> {
        if (!fs.existsSync(this.options.outputDir)) {
            fs.mkdirSync(this.options.outputDir, { recursive: true });
        }
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const summaryFile = path.join(this.options.outputDir, `benchmark-summary-${timestamp}.json`);
        const csvFile = path.join(this.options.outputDir, `benchmark-data-${timestamp}.csv`);
        
        // Save JSON summary
        const summary = {
            timestamp: new Date().toISOString(),
            nodeVersion: process.version,
            platform: process.platform,
            arch: process.arch,
            results: this.results
        };
        
        fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
        
        // Save CSV data
        const csvData = this.generateCsvData();
        fs.writeFileSync(csvFile, csvData);
        
        console.log(`Results saved to:`);
        console.log(`  JSON: ${summaryFile}`);
        console.log(`  CSV: ${csvFile}`);
    }

    /**
     * Generate CSV data from results
     */
    private generateCsvData(): string {
        const headers = [
            'name', 'category', 'dataSize', 'averageDuration', 'minDuration', 'maxDuration',
            'p50', 'p90', 'p95', 'p99', 'iterations', 'memoryPeakUsage', 'memoryAverageUsage'
        ];
        
        const rows = this.results.map(result => [
            result.name,
            result.category,
            result.dataSize.toString(),
            result.report.averageDuration.toFixed(3),
            result.report.minDuration.toFixed(3),
            result.report.maxDuration.toFixed(3),
            result.report.percentiles?.p50.toFixed(3) || '',
            result.report.percentiles?.p90.toFixed(3) || '',
            result.report.percentiles?.p95.toFixed(3) || '',
            result.report.percentiles?.p99.toFixed(3) || '',
            result.report.iterations.toString(),
            result.report.memoryPeakUsage?.toString() || '',
            result.report.memoryAverageUsage?.toString() || ''
        ]);
        
        return [headers, ...rows].map(row => row.join(',')).join('\n');
    }

    /**
     * Print benchmark summary
     */
    private printSummary(): void {
        console.log('\n' + '='.repeat(80));
        console.log('BENCHMARK SUMMARY');
        console.log('='.repeat(80));
        
        const categories = [...new Set(this.results.map(r => r.category))];
        
        categories.forEach(category => {
            console.log(`\n${category.toUpperCase()}:`);
            console.log('-'.repeat(50));
            
            const categoryResults = this.results.filter(r => r.category === category);
            categoryResults.forEach(result => {
                console.log(`${result.name}:`);
                console.log(`  Average: ${result.report.averageDuration.toFixed(2)}ms`);
                console.log(`  P95: ${result.report.percentiles?.p95.toFixed(2)}ms`);
                if (result.report.memoryPeakUsage) {
                    console.log(`  Peak Memory: ${this.formatBytes(result.report.memoryPeakUsage)}`);
                }
                console.log();
            });
        });
        
        // Performance analysis
        console.log('\nPERFORMANCE ANALYSIS:');
        console.log('-'.repeat(50));
        
        const parserResults = this.results.filter(r => r.category === 'parsing');
        if (parserResults.length > 0) {
            const worstParser = parserResults.reduce((prev, curr) => 
                curr.report.averageDuration > prev.report.averageDuration ? curr : prev
            );
            console.log(`Slowest parser operation: ${worstParser.name} (${worstParser.report.averageDuration.toFixed(2)}ms avg)`);
        }
        
        const fuzzyResults = this.results.filter(r => r.category === 'fuzzy_matching');
        if (fuzzyResults.length > 0) {
            const worstFuzzy = fuzzyResults.reduce((prev, curr) => 
                curr.report.averageDuration > prev.report.averageDuration ? curr : prev
            );
            console.log(`Slowest fuzzy match: ${worstFuzzy.name} (${worstFuzzy.report.averageDuration.toFixed(2)}ms avg)`);
        }
        
        const memoryResults = this.results.filter(r => r.category === 'memory');
        if (memoryResults.length > 0) {
            const highestMemory = memoryResults.reduce((prev, curr) => 
                (curr.report.memoryPeakUsage || 0) > (prev.report.memoryPeakUsage || 0) ? curr : prev
            );
            if (highestMemory.report.memoryPeakUsage) {
                console.log(`Highest memory usage: ${highestMemory.name} (${this.formatBytes(highestMemory.report.memoryPeakUsage)})`);
            }
        }
    }

    /**
     * Get results by category
     */
    getResultsByCategory(category: string): BenchmarkResult[] {
        return this.results.filter(r => r.category === category);
    }

    /**
     * Compare two benchmark results
     */
    compareResults(result1: BenchmarkResult, result2: BenchmarkResult): {
        speedupFactor: number;
        memoryReduction: number;
        description: string;
    } {
        const speedupFactor = result1.report.averageDuration / result2.report.averageDuration;
        const memoryReduction = result1.report.memoryPeakUsage && result2.report.memoryPeakUsage 
            ? (result1.report.memoryPeakUsage - result2.report.memoryPeakUsage) / result1.report.memoryPeakUsage
            : 0;
        
        const speedDescription = speedupFactor > 1 
            ? `${((speedupFactor - 1) * 100).toFixed(1)}% faster` 
            : `${((1 - speedupFactor) * 100).toFixed(1)}% slower`;
        
        const memoryDescription = memoryReduction > 0 
            ? `${(memoryReduction * 100).toFixed(1)}% less memory` 
            : `${(-memoryReduction * 100).toFixed(1)}% more memory`;
        
        return {
            speedupFactor,
            memoryReduction,
            description: `${speedDescription}, ${memoryDescription}`
        };
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
}

/**
 * Quick benchmark runner for development
 */
export async function runQuickBenchmark(): Promise<void> {
    const suite = new BenchmarkSuite({
        saveResults: false,
        maxIterations: 20,
        minIterations: 5
    });
    
    await suite.runAll();
}

/**
 * Full benchmark runner for comprehensive analysis
 */
export async function runFullBenchmark(outputDir?: string): Promise<BenchmarkResult[]> {
    const suite = new BenchmarkSuite({
        outputDir: outputDir || './benchmark-results',
        saveResults: true,
        maxIterations: 100,
        minIterations: 20
    });
    
    return await suite.runAll();
}