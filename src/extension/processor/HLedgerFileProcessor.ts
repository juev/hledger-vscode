// HLedgerFileProcessor.ts - File processing and I/O operations for hledger files
// Handles file discovery, reading, and include directive processing

import * as fs from 'fs';
import * as path from 'path';
import { ParsedHLedgerData } from '../ast/HLedgerASTBuilder';
import { HLedgerLexer } from '../lexer/HLedgerLexer';

/**
 * File processing options
 */
export interface FileProcessingOptions {
    /** Enable async processing for large files */
    enableAsync?: boolean;
    /** File size threshold for async processing (bytes) */
    asyncThreshold?: number;
    /** Follow include directives recursively */
    processIncludes?: boolean;
    /** Maximum include depth to prevent infinite loops */
    maxIncludeDepth?: number;
    /** Exclude certain files or patterns */
    excludePatterns?: RegExp[];
}

/**
 * File processing result with metadata
 */
export interface FileProcessingResult {
    /** Parsed data */
    data: ParsedHLedgerData;
    /** Files processed */
    filesProcessed: string[];
    /** Files excluded */
    filesExcluded: string[];
    /** Processing time in milliseconds */
    processingTime: number;
    /** Total bytes processed */
    bytesProcessed: number;
}

/**
 * Default processing options
 */
const DEFAULT_OPTIONS: Required<FileProcessingOptions> = {
    enableAsync: true,
    asyncThreshold: 1024 * 1024, // 1MB
    processIncludes: true,
    maxIncludeDepth: 10,
    excludePatterns: [
        /node_modules/,
        /\.git/,
        /\.vscode/,
        /dist/,
        /build/
    ]
};

/**
 * File processor for hledger files - handles I/O operations and file discovery
 */
export class HLedgerFileProcessor {
    private readonly lexer: HLedgerLexer;
    private readonly options: Required<FileProcessingOptions>;

    constructor(options: FileProcessingOptions = {}) {
        this.options = { ...DEFAULT_OPTIONS, ...options };
        this.lexer = new HLedgerLexer();
    }

    /**
     * Processes a single hledger file
     */
    public async processFile(filePath: string, includeDepth = 0): Promise<FileProcessingResult> {
        const startTime = Date.now();
        const result: FileProcessingResult = {
            data: {} as ParsedHLedgerData,
            filesProcessed: [],
            filesExcluded: [],
            processingTime: 0,
            bytesProcessed: 0
        };

        try {
            if (this.shouldExcludeFile(filePath)) {
                result.filesExcluded.push(filePath);
                result.processingTime = Date.now() - startTime;
                return result;
            }

            const stats = await fs.promises.stat(filePath);
            result.bytesProcessed += stats.size;

            let content: string;
            if (this.options.enableAsync && stats.size > this.options.asyncThreshold) {
                content = await this.readFileAsync(filePath);
            } else {
                content = fs.readFileSync(filePath, 'utf8');
            }

            result.filesProcessed.push(filePath);
            const parseResult = await this.parseContent(content, path.dirname(filePath), includeDepth);

            result.data = parseResult.data;
            result.filesProcessed.push(...parseResult.includedFiles);

        } catch (error) {
            // Log error only in non-test environment
            if (process.env.NODE_ENV !== 'test') {
                console.error('Error processing file:', filePath, error);
            }
        }

        result.processingTime = Date.now() - startTime;
        return result;
    }

    /**
     * Processes multiple files and merges results
     */
    public async processFiles(filePaths: string[]): Promise<FileProcessingResult> {
        const startTime = Date.now();
        const combinedResult: FileProcessingResult = {
            data: {} as ParsedHLedgerData,
            filesProcessed: [],
            filesExcluded: [],
            processingTime: 0,
            bytesProcessed: 0
        };

        // Filter out excluded files
        const validFiles = filePaths.filter(file => !this.shouldExcludeFile(file));
        combinedResult.filesExcluded = filePaths.filter(file => this.shouldExcludeFile(file));

        // Process files in parallel with limited concurrency
        const concurrencyLimit = 5;
        for (let i = 0; i < validFiles.length; i += concurrencyLimit) {
            const batch = validFiles.slice(i, i + concurrencyLimit);
            const batchResults = await Promise.all(batch.map(file => this.processFile(file)));

            // Combine batch results
            batchResults.forEach(batchResult => {
                combinedResult.filesProcessed.push(...batchResult.filesProcessed);
                combinedResult.bytesProcessed += batchResult.bytesProcessed;

                // Note: This would need proper merging logic with the actual ParsedHLedgerData
                // For now, we'll use the last result as the combined data
                if (batchResult.data) {
                    combinedResult.data = batchResult.data;
                }
            });
        }

        combinedResult.processingTime = Date.now() - startTime;
        return combinedResult;
    }

    /**
     * Discovers hledger files in a directory
     */
    public findHLedgerFiles(dirPath: string): string[] {
        if (!fs.existsSync(dirPath)) {
            return [];
        }

        const files: string[] = [];

        try {
            const entries = fs.readdirSync(dirPath, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);

                if (this.shouldExcludeFile(fullPath)) {
                    continue;
                }

                if (entry.isFile() && this.isHLedgerFile(entry.name)) {
                    files.push(fullPath);
                } else if (entry.isDirectory()) {
                    // Recursively search subdirectories
                    files.push(...this.findHLedgerFiles(fullPath));
                }
            }
        } catch (error) {
            if (process.env.NODE_ENV !== 'test') {
                console.error('Error scanning directory:', dirPath, error);
            }
        }

        return files.sort(); // Sort for consistent ordering
    }

    /**
     * Checks if a file should be excluded based on patterns
     */
    private shouldExcludeFile(filePath: string): boolean {
        return this.options.excludePatterns.some(pattern => pattern.test(filePath));
    }

    /**
     * Checks if a file is an hledger file based on extension
     */
    private isHLedgerFile(fileName: string): boolean {
        const ext = path.extname(fileName).toLowerCase();
        return ext === '.journal' || ext === '.hledger' || ext === '.ledger';
    }

    /**
     * Reads a file asynchronously with chunking for large files
     */
    private async readFileAsync(filePath: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const chunks: string[] = [];
            const stream = fs.createReadStream(filePath, { encoding: 'utf8' });

            stream.on('data', (chunk: string) => {
                chunks.push(chunk);
            });

            stream.on('end', () => {
                resolve(chunks.join(''));
            });

            stream.on('error', (error) => {
                reject(error);
            });
        });
    }

    /**
     * Parses content with include directive processing
     */
    private async parseContent(content: string, basePath?: string, includeDepth = 0): Promise<{
        data: ParsedHLedgerData;
        includedFiles: string[];
    }> {
        const includedFiles: string[] = [];

        // Note: This would need integration with the actual AST builder
        // For now, this is a placeholder that shows the structure

        if (!this.options.processIncludes || includeDepth >= this.options.maxIncludeDepth) {
            return {
                data: {} as ParsedHLedgerData,
                includedFiles
            };
        }

        // Tokenize content
        const tokens = this.lexer.tokenizeContent(content);

        // Extract include directives
        for (const token of tokens) {
            // This would be handled by the main parser/AST builder
            // The structure shows how includes would be processed
        }

        return {
            data: {} as ParsedHLedgerData,
            includedFiles
        };
    }

    /**
     * Gets file statistics
     */
    public async getFileStats(filePath: string): Promise<{
        exists: boolean;
        size: number;
        modified: Date | null;
        isHLedgerFile: boolean;
    }> {
        try {
            const stats = await fs.promises.stat(filePath);
            return {
                exists: true,
                size: stats.size,
                modified: stats.mtime,
                isHLedgerFile: this.isHLedgerFile(path.basename(filePath))
            };
        } catch (error) {
            return {
                exists: false,
                size: 0,
                modified: null,
                isHLedgerFile: false
            };
        }
    }

    /**
     * Validates if file content appears to be valid hledger format
     */
    public validateFileContent(content: string): {
        isValid: boolean;
        errors: string[];
        warnings: string[];
    } {
        const errors: string[] = [];
        const warnings: string[] = [];

        try {
            const tokens = this.lexer.tokenizeContent(content);

            // Basic validation checks
            const hasTransactions = tokens.some(t => t.type === 'transaction');
            const hasPostings = tokens.some(t => t.type === 'posting');

            if (tokens.length > 0 && !hasTransactions && !hasPostings) {
                warnings.push('File contains no transactions or postings');
            }

            // Check for unbalanced postings (simplified)
            let transactionCount = 0;
            let postingCount = 0;

            for (const token of tokens) {
                if (token.type === 'transaction') {
                    transactionCount++;
                } else if (token.type === 'posting') {
                    postingCount++;
                }
            }

            if (transactionCount > 0 && postingCount === 0) {
                warnings.push('File has transactions but no postings');
            }

            return {
                isValid: errors.length === 0,
                errors,
                warnings
            };

        } catch (error) {
            errors.push(`Validation error: ${error}`);
            return {
                isValid: false,
                errors,
                warnings
            };
        }
    }

    /**
     * Reads the first few lines of a file to detect its type
     */
    public async detectFileType(filePath: string, sampleSize = 10): Promise<{
        fileType: string;
        confidence: number;
        sample: string[];
    }> {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.split('\n').slice(0, sampleSize);

            const nonEmptyLines = lines.filter(line => line.trim() && !line.trim().startsWith(';'));

            if (nonEmptyLines.length === 0) {
                return {
                    fileType: 'empty',
                    confidence: 1.0,
                    sample: lines
                };
            }

            // Count different patterns
            const dateLines = nonEmptyLines.filter(line =>
                /^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(line.trim())
            ).length;

            const directiveLines = nonEmptyLines.filter(line => {
                const trimmed = line.trim();
                return /^(account|commodity|payee|tag|alias|include|format|decimal-mark|default)/i.test(trimmed);
            }).length;

            const postingLines = nonEmptyLines.filter(line =>
                line.length > 0 && (line[0] === ' ' || line[0] === '\t') &&
                !line.trim().startsWith(';')
            ).length;

            // Determine file type based on patterns
            if (dateLines > 0 || postingLines > 0) {
                return {
                    fileType: 'hledger',
                    confidence: Math.min(1.0, (dateLines + postingLines) / nonEmptyLines.length),
                    sample: lines
                };
            } else if (directiveLines > 0) {
                return {
                    fileType: 'hledger-config',
                    confidence: directiveLines / nonEmptyLines.length,
                    sample: lines
                };
            } else {
                return {
                    fileType: 'unknown',
                    confidence: 0.0,
                    sample: lines
                };
            }

        } catch (error) {
            return {
                fileType: 'error',
                confidence: 0.0,
                sample: []
            };
        }
    }
}