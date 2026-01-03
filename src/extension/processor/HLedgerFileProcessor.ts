// HLedgerFileProcessor.ts - File processing and I/O operations for hledger files
// Handles file discovery, reading, and include directive processing

import * as fs from 'fs';
import * as path from 'path';
import { ParsedHLedgerData, HLedgerASTBuilder } from '../ast/HLedgerASTBuilder';
import { HLedgerLexer, TokenType } from '../lexer/HLedgerLexer';
import { calculateAlignmentColumn } from '../utils/formattingUtils';

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
 * File processing error with context
 */
export interface FileProcessingError {
    /** File path where error occurred */
    file: string;
    /** Error message */
    error: string;
    /** Optional line number where error occurred */
    line?: number;
}

/**
 * File processing warning with context
 */
export interface FileProcessingWarning {
    /** File path where warning occurred */
    file: string;
    /** Warning message */
    message: string;
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
    /** Errors encountered during processing */
    errors: FileProcessingError[];
    /** Warnings encountered during processing */
    warnings: FileProcessingWarning[];
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
    private readonly astBuilder: HLedgerASTBuilder;
    private readonly options: Required<FileProcessingOptions>;

    constructor(options: FileProcessingOptions = {}) {
        this.options = { ...DEFAULT_OPTIONS, ...options };
        this.lexer = new HLedgerLexer();
        this.astBuilder = new HLedgerASTBuilder();
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
            bytesProcessed: 0,
            errors: [],
            warnings: []
        };

        try {
            if (this.shouldExcludeFile(filePath)) {
                result.filesExcluded.push(filePath);
                result.warnings.push({
                    file: filePath,
                    message: 'File excluded by pattern'
                });
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
            result.errors.push(...parseResult.errors);
            result.warnings.push(...parseResult.warnings);

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const contextMessage = `Failed to process file: ${errorMessage}`;

            // Add structured error to result
            result.errors.push({
                file: filePath,
                error: contextMessage
            });

            // Log error with context for debugging (always, not just non-test)
            console.error(`HLedger: Error processing file ${filePath}:`, errorMessage);

            // In non-test environment, also log stack trace
            if (process.env.NODE_ENV !== 'test' && error instanceof Error && error.stack) {
                console.error('Stack trace:', error.stack);
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
            bytesProcessed: 0,
            errors: [],
            warnings: []
        };

        // Filter out excluded files
        const validFiles = filePaths.filter(file => !this.shouldExcludeFile(file));
        const excludedFiles = filePaths.filter(file => this.shouldExcludeFile(file));

        combinedResult.filesExcluded = excludedFiles;

        // Add warnings for excluded files
        excludedFiles.forEach(file => {
            combinedResult.warnings.push({
                file,
                message: 'File excluded by pattern'
            });
        });

        if (validFiles.length === 0) {
            combinedResult.processingTime = Date.now() - startTime;
            return combinedResult;
        }

        // Initialize mutable data structure for merging
        let mutableData: any = null;
        let isFirstFile = true;

        // Process files in parallel with limited concurrency
        const concurrencyLimit = 5;
        for (let i = 0; i < validFiles.length; i += concurrencyLimit) {
            const batch = validFiles.slice(i, i + concurrencyLimit);
            const batchResults = await Promise.all(batch.map(file => this.processFile(file)));

            // Combine batch results
            for (const batchResult of batchResults) {
                combinedResult.filesProcessed.push(...batchResult.filesProcessed);
                combinedResult.bytesProcessed += batchResult.bytesProcessed;
                combinedResult.errors.push(...batchResult.errors);
                combinedResult.warnings.push(...batchResult.warnings);

                // Merge parsed data from this batch
                if (batchResult.data) {
                    if (isFirstFile) {
                        // Initialize with first file's data
                        mutableData = this.createMutableData(batchResult.data);
                        isFirstFile = false;
                    } else {
                        // Merge subsequent files into combined data
                        this.astBuilder.mergeData(mutableData, batchResult.data);
                    }
                }
            }
        }

        // Convert mutable data back to readonly
        if (mutableData) {
            combinedResult.data = this.toReadonlyData(mutableData);
        }

        combinedResult.processingTime = Date.now() - startTime;
        return combinedResult;
    }

    /**
     * Discovers hledger files in a directory with security protections
     *
     * @param dirPath - Directory path to search
     * @param maxDepth - Maximum recursion depth (default: 10)
     * @param currentDepth - Current recursion depth (internal use)
     * @param visitedDirs - Set of visited directories to prevent cycles (internal use)
     * @returns Array of hledger file paths
     */
    public findHLedgerFiles(
        dirPath: string,
        maxDepth: number = 10,
        currentDepth: number = 0,
        visitedDirs: Set<string> = new Set()
    ): string[] {
        if (!fs.existsSync(dirPath)) {
            // Only warn in non-test environments to avoid test noise
            if (!process.env.JEST_WORKER_ID) {
                console.warn(`HLedger: Directory does not exist: ${dirPath}`);
            }
            return [];
        }

        // Security check: Enforce depth limit to prevent DoS
        if (currentDepth >= maxDepth) {
            // Only warn in non-test environments to avoid test noise
            if (!process.env.JEST_WORKER_ID) {
                console.warn(`HLedger: Maximum depth (${maxDepth}) reached at ${dirPath}, stopping traversal`);
            }
            return [];
        }

        // Security check: Skip system directories to prevent DoS
        if (this.isSystemDirectory(dirPath)) {
            // Only warn in non-test environments to avoid test noise
            if (!process.env.JEST_WORKER_ID) {
                console.warn(`HLedger: Skipping system directory ${dirPath}`);
            }
            return [];
        }

        const files: string[] = [];

        try {
            // Resolve real path to detect symlinks
            const realPath = fs.realpathSync(dirPath);

            // Security check: Detect symlink cycles
            if (visitedDirs.has(realPath)) {
                // Only warn in non-test environments to avoid test noise
                if (!process.env.JEST_WORKER_ID) {
                    console.warn(`HLedger: Symlink cycle detected at ${dirPath} (real: ${realPath}), skipping`);
                }
                return [];
            }

            // Mark this directory as visited
            visitedDirs.add(realPath);

            const entries = fs.readdirSync(dirPath, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);

                if (this.shouldExcludeFile(fullPath)) {
                    continue;
                }

                try {
                    if (entry.isFile() && this.isHLedgerFile(entry.name)) {
                        files.push(fullPath);
                    } else if (entry.isDirectory()) {
                        // Skip system directories
                        if (this.isSystemDirectory(fullPath)) {
                            continue;
                        }
                        // Recursively search subdirectories with incremented depth
                        files.push(...this.findHLedgerFiles(fullPath, maxDepth, currentDepth + 1, visitedDirs));
                    }
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    console.error(`HLedger: Error accessing ${fullPath}: ${errorMessage}`);
                    // Continue processing other files
                }
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`HLedger: Error scanning directory ${dirPath}: ${errorMessage}`);

            if (process.env.NODE_ENV !== 'test' && error instanceof Error && error.stack) {
                console.error('Stack trace:', error.stack);
            }
        }

        return files.sort(); // Sort for consistent ordering
    }

    /**
     * Checks if a directory is a system directory that should be skipped
     *
     * @param dirPath - Directory path to check
     * @returns true if the directory is a system directory
     */
    private isSystemDirectory(dirPath: string): boolean {
        // Normalize and resolve path for consistent comparison
        const normalizedPath = path.normalize(path.resolve(dirPath));

        // Unix/Linux/macOS system directories (excluding /tmp which is legitimate for user files)
        const unixSystemDirs = ['/proc', '/dev', '/sys', '/run'];

        // Performance blacklist (common dev directories)
        const performanceBlacklist = ['node_modules', '.git', '.vscode', 'dist', 'build'];

        // Check if path starts with any Unix system directory
        for (const sysDir of unixSystemDirs) {
            if (normalizedPath.startsWith(sysDir + path.sep) || normalizedPath === sysDir) {
                return true;
            }
        }

        // Check if path contains any performance blacklist directory
        const pathParts = normalizedPath.split(path.sep);
        for (const blacklisted of performanceBlacklist) {
            if (pathParts.includes(blacklisted)) {
                return true;
            }
        }

        return false;
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
     * Validates include path stays within workspace boundaries
     *
     * Security: Prevents path traversal attacks that could access system files
     * outside the workspace. Rejects paths that:
     * - Escape workspace boundaries using .. navigation
     * - Target system directories (/etc, /sys, /proc, C:\Windows, etc.)
     *
     * @param basePath - Base directory path (workspace root)
     * @param includePath - Relative or absolute include path from journal
     * @returns Validated absolute path or null if rejected
     */
    private validateIncludePath(basePath: string, includePath: string): string | null {
        const resolvedPath = path.isAbsolute(includePath)
            ? path.resolve(includePath)
            : path.resolve(basePath, includePath);

        const normalizedBase = path.resolve(basePath);
        const normalizedPath = path.resolve(resolvedPath);

        // Check if resolved path is within workspace boundaries
        if (!normalizedPath.startsWith(normalizedBase + path.sep) && normalizedPath !== normalizedBase) {
            // Only log in non-test environments
            if (!process.env.JEST_WORKER_ID) {
                console.warn(`HLedger Security: Rejected include path outside workspace: ${includePath}`);
            }
            return null;
        }

        // Check if path targets system directory
        if (this.isSystemDirectory(normalizedPath)) {
            // Only log in non-test environments
            if (!process.env.JEST_WORKER_ID) {
                console.warn(`HLedger Security: Rejected include path to system directory: ${includePath}`);
            }
            return null;
        }

        return resolvedPath;
    }

    /**
     * Parses content with include directive processing
     */
    private async parseContent(content: string, basePath?: string, includeDepth = 0): Promise<{
        data: ParsedHLedgerData;
        includedFiles: string[];
        errors: FileProcessingError[];
        warnings: FileProcessingWarning[];
    }> {
        const includedFiles: string[] = [];
        const errors: FileProcessingError[] = [];
        const warnings: FileProcessingWarning[] = [];

        try {
            // Tokenize content using the lexer
            const tokens = this.lexer.tokenizeContent(content);

            // Build AST from tokens
            const parsedData = this.astBuilder.buildFromTokens(tokens, basePath);

            // Process include directives if enabled and depth limit not exceeded
            if (this.options.processIncludes && includeDepth < this.options.maxIncludeDepth && basePath) {
                // Create mutable data structure for merging included files
                const mutableData = this.createMutableData(parsedData);

                // Extract include directives and process them
                for (const token of tokens) {
                    if (token.type === TokenType.INCLUDE_DIRECTIVE) {
                        const includeMatch = token.trimmedLine.match(/^include\s+(.+)$/);
                        if (includeMatch?.[1]) {
                            const includePath = includeMatch[1].trim();

                            // Validate include path for security
                            const validatedPath = this.validateIncludePath(basePath, includePath);
                            if (!validatedPath) {
                                warnings.push({
                                    file: basePath,
                                    message: `Security: Include path rejected (outside workspace or system directory): ${includePath}`
                                });
                                continue;
                            }

                            const resolvedPath = validatedPath;

                            try {
                                // Check if file should be excluded
                                if (this.shouldExcludeFile(resolvedPath)) {
                                    warnings.push({
                                        file: resolvedPath,
                                        message: 'Include file excluded by pattern'
                                    });
                                    continue;
                                }

                                // Check if file exists
                                if (!fs.existsSync(resolvedPath)) {
                                    const errorMsg = `Include file not found: ${resolvedPath}`;
                                    errors.push({
                                        file: basePath ?? 'unknown',
                                        error: errorMsg
                                    });
                                    // Only warn in non-test environments to avoid test noise
                                    if (!process.env.JEST_WORKER_ID) {
                                        console.warn(`HLedger: ${errorMsg}`);
                                    }
                                    continue;
                                }

                                // Read and parse included file
                                const includeContent = fs.readFileSync(resolvedPath, 'utf8');
                                const includeResult = await this.parseContent(
                                    includeContent,
                                    path.dirname(resolvedPath),
                                    includeDepth + 1
                                );

                                // Track included files
                                includedFiles.push(resolvedPath);
                                includedFiles.push(...includeResult.includedFiles);

                                // Aggregate errors and warnings from included files
                                errors.push(...includeResult.errors);
                                warnings.push(...includeResult.warnings);

                                // Merge included data into main data
                                this.astBuilder.mergeData(mutableData, includeResult.data);

                            } catch (error) {
                                const errorMessage = error instanceof Error ? error.message : String(error);
                                const contextMessage = `Error processing include file ${resolvedPath}: ${errorMessage}`;

                                errors.push({
                                    file: resolvedPath,
                                    error: contextMessage
                                });

                                console.error(`HLedger: ${contextMessage}`);

                                if (process.env.NODE_ENV !== 'test' && error instanceof Error && error.stack) {
                                    console.error('Stack trace:', error.stack);
                                }
                            }
                        }
                    }
                }

                // Check for include depth exceeded
                if (includeDepth >= this.options.maxIncludeDepth) {
                    warnings.push({
                        file: basePath ?? 'unknown',
                        message: `Include depth limit (${this.options.maxIncludeDepth}) reached, skipping nested includes`
                    });
                }

                // Convert mutable data back to readonly
                return {
                    data: this.toReadonlyData(mutableData),
                    includedFiles,
                    errors,
                    warnings
                };
            }

            return {
                data: parsedData,
                includedFiles,
                errors,
                warnings
            };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const contextMessage = `Failed to parse content: ${errorMessage}`;

            errors.push({
                file: basePath ?? 'unknown',
                error: contextMessage
            });

            console.error(`HLedger: ${contextMessage}`);

            if (process.env.NODE_ENV !== 'test' && error instanceof Error && error.stack) {
                console.error('Stack trace:', error.stack);
            }

            // Return empty data with error information
            return {
                data: {} as ParsedHLedgerData,
                includedFiles,
                errors,
                warnings
            };
        }
    }

    /**
     * Creates a mutable copy of ParsedHLedgerData for merging
     */
    private createMutableData(data: ParsedHLedgerData): any {
        // Deep clone transaction templates
        const clonedTemplates = new Map();
        if (data.transactionTemplates) {
            data.transactionTemplates.forEach((templates, payee) => {
                const clonedInner = new Map();
                templates.forEach((template, key) => {
                    clonedInner.set(key, {
                        payee: template.payee,
                        postings: [...template.postings],
                        usageCount: template.usageCount,
                        lastUsedDate: template.lastUsedDate
                    });
                });
                clonedTemplates.set(payee, clonedInner);
            });
        }

        return {
            accounts: new Set(data.accounts),
            definedAccounts: new Set(data.definedAccounts),
            usedAccounts: new Set(data.usedAccounts),
            payees: new Set(data.payees),
            tags: new Set(data.tags),
            commodities: new Set(data.commodities),
            aliases: new Map(data.aliases),
            tagValues: new Map(
                Array.from(data.tagValues.entries()).map(([k, v]) => [k, new Set(v)])
            ),
            tagValueUsage: new Map(data.tagValueUsage),
            accountUsage: new Map(data.accountUsage),
            payeeUsage: new Map(data.payeeUsage),
            tagUsage: new Map(data.tagUsage),
            commodityUsage: new Map(data.commodityUsage),
            payeeAccounts: new Map(
                Array.from(data.payeeAccounts.entries()).map(([k, v]) => [k, new Set(v)])
            ),
            payeeAccountPairUsage: new Map(data.payeeAccountPairUsage),
            transactionTemplates: clonedTemplates,
            payeeRecentTemplates: new Map(
                Array.from(data.payeeRecentTemplates.entries())
                    .map(([k, v]) => [k, { keys: [...v.keys], writeIndex: v.writeIndex }])
            ),
            commodityFormats: new Map(data.commodityFormats),
            decimalMark: data.decimalMark,
            defaultCommodity: data.defaultCommodity,
            lastDate: data.lastDate,
            maxAccountNameLength: data.formattingProfile?.maxAccountNameLength ?? 0
        };
    }

    /**
     * Converts mutable data back to readonly ParsedHLedgerData
     */
    private toReadonlyData(mutableData: any): ParsedHLedgerData {
        const maxAccountNameLength = mutableData.maxAccountNameLength ?? 0;

        return {
            accounts: mutableData.accounts,
            definedAccounts: mutableData.definedAccounts,
            usedAccounts: mutableData.usedAccounts,
            payees: mutableData.payees,
            tags: mutableData.tags,
            commodities: mutableData.commodities,
            aliases: mutableData.aliases,
            tagValues: mutableData.tagValues,
            tagValueUsage: mutableData.tagValueUsage,
            accountUsage: mutableData.accountUsage,
            payeeUsage: mutableData.payeeUsage,
            tagUsage: mutableData.tagUsage,
            commodityUsage: mutableData.commodityUsage,
            payeeAccounts: mutableData.payeeAccounts,
            payeeAccountPairUsage: mutableData.payeeAccountPairUsage,
            transactionTemplates: mutableData.transactionTemplates ?? new Map(),
            payeeRecentTemplates: mutableData.payeeRecentTemplates ?? new Map(),
            commodityFormats: mutableData.commodityFormats,
            decimalMark: mutableData.decimalMark,
            defaultCommodity: mutableData.defaultCommodity,
            lastDate: mutableData.lastDate,
            formattingProfile: {
                amountAlignmentColumn: calculateAlignmentColumn(maxAccountNameLength),
                maxAccountNameLength: maxAccountNameLength,
                isDefaultAlignment: maxAccountNameLength === 0
            }
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
            const content = await fs.promises.readFile(filePath, 'utf8');
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