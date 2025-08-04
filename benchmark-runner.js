/**
 * Benchmark runner for HLedger VSCode extension
 * Compiles TypeScript and runs performance tests
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Ensure output directory exists
const benchmarkDir = path.join(__dirname, 'benchmark-results');
if (!fs.existsSync(benchmarkDir)) {
    fs.mkdirSync(benchmarkDir, { recursive: true });
}

console.log('Starting HLedger Extension Performance Benchmark...\n');

try {
    // Compile TypeScript
    console.log('Compiling TypeScript...');
    execSync('npm run compile', { stdio: 'inherit', cwd: __dirname });
    
    // Run benchmark
    console.log('Running benchmarks...\n');
    
    // Import and run benchmark (using compiled JS)
    const { BenchmarkSuite, TestDataGenerator } = require('./out/extension/performance/BenchmarkSuite');
    
    async function runBenchmarks() {
        const suite = new BenchmarkSuite({
            outputDir: benchmarkDir,
            saveResults: true,
            includeMemoryTracking: true,
            maxIterations: 50,
            minIterations: 10
        });
        
        const results = await suite.runAll();
        
        console.log('\n' + '='.repeat(80));
        console.log('BENCHMARK COMPLETED');
        console.log('='.repeat(80));
        console.log(`Total tests run: ${results.length}`);
        console.log(`Results saved to: ${benchmarkDir}`);
        
        // Identify performance bottlenecks
        console.log('\nPERFORMANCE BOTTLENECKS:');
        console.log('-'.repeat(50));
        
        const sortedByDuration = results.sort((a, b) => b.report.averageDuration - a.report.averageDuration);
        const top5 = sortedByDuration.slice(0, 5);
        
        top5.forEach((result, index) => {
            console.log(`${index + 1}. ${result.name}: ${result.report.averageDuration.toFixed(2)}ms avg`);
            if (result.report.percentiles) {
                console.log(`   P95: ${result.report.percentiles.p95.toFixed(2)}ms`);
            }
            if (result.report.memoryPeakUsage) {
                console.log(`   Peak Memory: ${formatBytes(result.report.memoryPeakUsage)}`);
            }
            console.log();
        });
        
        // Performance targets
        console.log('PERFORMANCE TARGETS:');
        console.log('-'.repeat(50));
        
        const parserResults = results.filter(r => r.category === 'parsing');
        const fuzzyResults = results.filter(r => r.category === 'fuzzy_matching');
        
        if (parserResults.length > 0) {
            const avgParserTime = parserResults.reduce((sum, r) => sum + r.report.averageDuration, 0) / parserResults.length;
            console.log(`Current avg parser time: ${avgParserTime.toFixed(2)}ms`);
            console.log(`Target after optimization: ${(avgParserTime * 0.5).toFixed(2)}ms (50% improvement)`);
        }
        
        if (fuzzyResults.length > 0) {
            const avgFuzzyTime = fuzzyResults.reduce((sum, r) => sum + r.report.averageDuration, 0) / fuzzyResults.length;
            console.log(`Current avg fuzzy search time: ${avgFuzzyTime.toFixed(2)}ms`);
            console.log(`Target after optimization: ${(avgFuzzyTime * 0.5).toFixed(2)}ms (50% improvement)`);
        }
        
        return results;
    }
    
    function formatBytes(bytes) {
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 Bytes';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }
    
    runBenchmarks().catch(console.error);
    
} catch (error) {
    console.error('Benchmark failed:', error);
    process.exit(1);
}