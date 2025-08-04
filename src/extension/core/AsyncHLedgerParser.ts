/**
 * Asynchronous HLedger parser optimized for performance
 * Prevents blocking the event loop with large files
 */

import * as fs from 'fs/promises';
import * as fssync from 'fs';
import * as path from 'path';
import { IAsyncHLedgerParser, ParsedHLedgerData } from './interfaces';

// Declare global gc function for TypeScript
declare global {
    var gc: (() => void) | undefined;
}

export interface AsyncParseOptions {
    /** Number of lines to process per chunk */
    chunkSize?: number;
    /** Yield control every N chunks */
    yieldEvery?: number;
    /** Maximum file size to process (bytes) */
    maxFileSize?: number;
    /** Enable content caching */
    enableCache?: boolean;
    /** Timeout for file operations in milliseconds */
    timeout?: number;
}

/** Custom error types for async parsing */
export class AsyncParseError extends Error {
    constructor(message: string, public readonly filePath?: string, public readonly cause?: Error) {
        super(message);
        this.name = 'AsyncParseError';
    }
}

export class FileSizeExceededError extends AsyncParseError {
    constructor(filePath: string, actualSize: number, maxSize: number) {
        super(`File size ${actualSize} bytes exceeds maximum ${maxSize} bytes`, filePath);
        this.name = 'FileSizeExceededError';
    }
}

/**
 * Asynchronous parser that yields control to prevent blocking
 */
export class AsyncHLedgerParser implements IAsyncHLedgerParser {
    private contentCache = new Map<string, { content: string; mtime: number }>();
    
    /**
     * Parse a file asynchronously from filesystem
     */
    async parseFileAsync(filePath: string, options: AsyncParseOptions = {}): Promise<ParsedHLedgerData> {
        try {
            const stats = await fs.stat(filePath);
            
            // Check file size limit
            if (options.maxFileSize && stats.size > options.maxFileSize) {
                throw new FileSizeExceededError(filePath, stats.size, options.maxFileSize);
            }
            
            // Check cache if enabled
            if (options.enableCache) {
                const cached = this.contentCache.get(filePath);
                if (cached && cached.mtime >= stats.mtimeMs) {
                    return this.parseContentAsync(cached.content, path.dirname(filePath), options);
                }
            }
            
            const content = await fs.readFile(filePath, 'utf8');
            
            // Update cache
            if (options.enableCache) {
                this.contentCache.set(filePath, { content, mtime: stats.mtimeMs });
            }
            
            return this.parseContentAsync(content, path.dirname(filePath), options);
        } catch (error) {
            if (process.env.NODE_ENV !== 'test') {
                console.error('Error parsing file:', filePath, error);
            }
            // Re-throw async parse errors, wrap others
            if (error instanceof AsyncParseError) {
                throw error;
            }
            throw new AsyncParseError(
                `Failed to parse file: ${filePath}`,
                filePath,
                error instanceof Error ? error : new Error(String(error))
            );
        }
    }

    /**
     * Parse content asynchronously with chunked processing
     */
    async parseContentAsync(content: string, basePath: string = '', options: AsyncParseOptions = {}): Promise<ParsedHLedgerData> {
        const {
            chunkSize = 1000,
            yieldEvery = 5,
            enableCache = false
        } = options;

        const data = this.createEmptyData();
        const lines = content.split('\n');
        
        let processedChunks = 0;
        
        // Process lines in chunks to avoid blocking
        for (let i = 0; i < lines.length; i += chunkSize) {
            const chunk = lines.slice(i, i + chunkSize);
            
            // Process chunk synchronously
            for (const line of chunk) {
                this.parseLine(line, data, basePath);
            }
            
            processedChunks++;
            
            // Yield control periodically
            if (processedChunks % yieldEvery === 0) {
                await this.yieldControl();
            }
        }
        
        // Union all accounts (defined + used)
        data.definedAccounts.forEach(acc => data.accounts.add(acc));
        data.usedAccounts.forEach(acc => data.accounts.add(acc));
        
        return data;
    }
    
    /**
     * Synchronous fallback methods for compatibility
     */
    parseFile(filePath: string): ParsedHLedgerData {
        try {
            if (!fssync.existsSync(filePath)) {
                return this.createEmptyData();
            }
            
            const content = fssync.readFileSync(filePath, 'utf8');
            return this.parseContent(content, path.dirname(filePath));
        } catch (error) {
            if (process.env.NODE_ENV !== 'test') {
                console.error('Error parsing file:', filePath, error);
            }
            return this.createEmptyData();
        }
    }

    parseContent(content: string, basePath: string = ''): ParsedHLedgerData {
        const data = this.createEmptyData();
        const lines = content.split('\n');
        
        for (const line of lines) {
            this.parseLine(line, data, basePath);
        }
        
        // Union all accounts (defined + used)
        data.definedAccounts.forEach(acc => data.accounts.add(acc));
        data.usedAccounts.forEach(acc => data.accounts.add(acc));
        
        return data;
    }

    /**
     * Optimized batch processing for multiple files
     */
    async parseFilesAsync(filePaths: string[], options: AsyncParseOptions = {}): Promise<ParsedHLedgerData> {
        const combinedData = this.createEmptyData();
        
        // Process files concurrently with controlled concurrency
        const concurrency = 3; // Process max 3 files simultaneously
        
        for (let i = 0; i < filePaths.length; i += concurrency) {
            const batch = filePaths.slice(i, i + concurrency);
            
            const batchResults = await Promise.all(
                batch.map(filePath => this.parseFileAsync(filePath, options))
            );
            
            // Merge results
            for (const result of batchResults) {
                this.mergeData(combinedData, result);
            }
            
            // Yield between batches
            if (i + concurrency < filePaths.length) {
                await this.yieldControl();
            }
        }
        
        return combinedData;
    }

    /**
     * Clear content cache
     */
    clearCache(): void {
        this.contentCache.clear();
    }

    /**
     * Get cache statistics
     */
    getCacheStats(): { size: number; entries: string[] } {
        return {
            size: this.contentCache.size,
            entries: Array.from(this.contentCache.keys())
        };
    }

    /**
     * Yield control to event loop
     */
    private async yieldControl(): Promise<void> {
        return new Promise(resolve => setImmediate(resolve));
    }

    /**
     * Create empty data structure
     */
    private createEmptyData(): ParsedHLedgerData {
        return {
            accounts: new Set<string>(),
            definedAccounts: new Set<string>(),
            usedAccounts: new Set<string>(),
            payees: new Set<string>(),
            tags: new Set<string>(),
            commodities: new Set<string>(),
            aliases: new Map<string, string>(),
            defaultCommodity: null,
            lastDate: null,
            accountUsage: new Map<string, number>(),
            payeeUsage: new Map<string, number>(),
            tagUsage: new Map<string, number>(),
            commodityUsage: new Map<string, number>()
        };
    }

    /**
     * Parse a single line and update data structure
     * Optimized version with reduced regex complexity
     */
    private parseLine(line: string, data: ParsedHLedgerData, basePath: string): void {
        const trimmed = line.trim();
        
        // Skip empty lines and comments (fastest checks first)
        if (!trimmed || trimmed[0] === '#') {
            return;
        }
        
        // Fast date detection - check first character
        const firstChar = trimmed[0];
        if (firstChar >= '0' && firstChar <= '9') {
            // Likely date - use optimized regex
            const dateMatch = trimmed.match(/^(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2})/);
            if (dateMatch) {
                data.lastDate = dateMatch[1];
                this.parseTransactionLine(trimmed, data);
                return;
            }
        }
        
        // Directive parsing - check first word
        const spaceIndex = trimmed.indexOf(' ');
        if (spaceIndex > 0) {
            const directive = trimmed.substring(0, spaceIndex);
            const content = trimmed.substring(spaceIndex + 1).trim();
            
            switch (directive) {
                case 'account':
                    data.definedAccounts.add(content.split(';')[0].trim());
                    return;
                    
                case 'alias':
                    const equalIndex = content.indexOf('=');
                    if (equalIndex > 0) {
                        const alias = content.substring(0, equalIndex).trim();
                        const target = content.substring(equalIndex + 1).trim();
                        data.aliases.set(alias, target);
                        data.definedAccounts.add(alias);
                        data.definedAccounts.add(target);
                    }
                    return;
                    
                case 'commodity':
                    data.commodities.add(content);
                    return;
                    
                case 'include':
                    if (basePath) {
                        const includePath = path.resolve(basePath, content);
                        const includedData = this.parseFile(includePath);
                        this.mergeData(data, includedData);
                    }
                    return;
            }
        }
        
        // Default commodity (single character directive)
        if (trimmed[0] === 'D' && trimmed[1] === ' ') {
            data.defaultCommodity = trimmed.substring(2).trim();
            return;
        }
        
        // Parse posting lines (lines starting with whitespace)
        if (line[0] === ' ' || line[0] === '\t') {
            this.parsePostingLine(line, data);
            return;
        }
    }
    
    /**
     * Parse transaction header line (optimized)
     */
    private parseTransactionLine(line: string, data: ParsedHLedgerData): void {
        // Find the description by skipping date, status, and code
        let startPos = 0;
        
        // Skip date (find first space after date)
        while (startPos < line.length && line[startPos] !== ' ') {
            startPos++;
        }
        while (startPos < line.length && line[startPos] === ' ') {
            startPos++;
        }
        
        // Skip optional status (* or !)
        if (startPos < line.length && (line[startPos] === '*' || line[startPos] === '!')) {
            startPos++;
            while (startPos < line.length && line[startPos] === ' ') {
                startPos++;
            }
        }
        
        // Skip optional code (parentheses)
        if (startPos < line.length && line[startPos] === '(') {
            while (startPos < line.length && line[startPos] !== ')') {
                startPos++;
            }
            if (startPos < line.length) {
                startPos++; // Skip closing paren
            }
            while (startPos < line.length && line[startPos] === ' ') {
                startPos++;
            }
        }
        
        // Find comment separator
        const commentIndex = line.indexOf(';', startPos);
        const descriptionEnd = commentIndex >= 0 ? commentIndex : line.length;
        
        const description = line.substring(startPos, descriptionEnd).trim();
        if (description) {
            data.payees.add(description);
            this.incrementUsage(data.payeeUsage, description);
        }
        
        // Extract tags from comment
        if (commentIndex >= 0) {
            const comment = line.substring(commentIndex + 1).trim();
            this.extractTags(comment, data);
        }
    }
    
    /**
     * Parse posting line (optimized)
     */
    private parsePostingLine(line: string, data: ParsedHLedgerData): void {
        // Find account name (everything before two or more spaces or special chars)
        let accountEnd = 0;
        let spaceCount = 0;
        
        // Skip leading whitespace
        let start = 0;
        while (start < line.length && (line[start] === ' ' || line[start] === '\t')) {
            start++;
        }
        
        // Find end of account name
        for (let i = start; i < line.length; i++) {
            const char = line[i];
            
            if (char === ' ') {
                spaceCount++;
                if (spaceCount >= 2) {
                    accountEnd = i - spaceCount + 1;
                    break;
                }
            } else if (char === ';' || char === '@' || char === '=') {
                accountEnd = i;
                break;
            } else {
                spaceCount = 0;
            }
        }
        
        if (accountEnd === 0) {
            accountEnd = line.length;
        }
        
        const account = line.substring(start, accountEnd).trim();
        if (account) {
            data.usedAccounts.add(account);
            this.incrementUsage(data.accountUsage, account);
        }
        
        // Extract commodities and tags from remaining content
        const remaining = line.substring(accountEnd);
        this.extractCommodityFromAmount(remaining, data);
        
        const commentIndex = remaining.indexOf(';');
        if (commentIndex >= 0) {
            const comment = remaining.substring(commentIndex + 1).trim();
            
            // Check for date: tags
            const dateTagMatch = comment.match(/\bdate:(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2})/);
            if (dateTagMatch) {
                data.lastDate = dateTagMatch[1];
            }
            
            this.extractTags(comment, data);
        }
    }
    
    /**
     * Extract tags from comment text (optimized)
     */
    private extractTags(comment: string, data: ParsedHLedgerData): void {
        // Manual parsing instead of regex for better performance
        let i = 0;
        while (i < comment.length) {
            // Skip non-letter characters
            while (i < comment.length && !this.isLetter(comment[i])) {
                i++;
            }
            
            if (i >= comment.length) break;
            
            // Read tag name
            const tagStart = i;
            while (i < comment.length && this.isTagChar(comment[i])) {
                i++;
            }
            
            // Check for colon
            if (i < comment.length && comment[i] === ':') {
                const tag = comment.substring(tagStart, i);
                data.tags.add(tag);
                this.incrementUsage(data.tagUsage, tag);
                
                // Skip to next potential tag
                while (i < comment.length && comment[i] !== ' ' && comment[i] !== ',' && comment[i] !== ';') {
                    i++;
                }
            } else {
                // Not a tag, continue
                i++;
            }
        }
    }
    
    /**
     * Extract commodity from amount string (optimized)
     */
    private extractCommodityFromAmount(amount: string, data: ParsedHLedgerData): void {
        // Simple commodity extraction - look for letter sequences
        let i = 0;
        while (i < amount.length) {
            const char = amount[i];
            
            if (this.isLetter(char) || char === '$' || char === '€' || char === '£') {
                let commodityStart = i;
                
                // Read commodity
                while (i < amount.length && this.isCommodityChar(amount[i])) {
                    i++;
                }
                
                const commodity = amount.substring(commodityStart, i);
                if (commodity.length >= 1) {
                    data.commodities.add(commodity);
                    this.incrementUsage(data.commodityUsage, commodity);
                }
            } else {
                i++;
            }
        }
    }
    
    /**
     * Helper methods for character classification
     */
    private isLetter(char: string): boolean {
        return (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') || (char >= '\u0400' && char <= '\u04FF');
    }
    
    private isTagChar(char: string): boolean {
        return this.isLetter(char) || (char >= '0' && char <= '9') || char === '_';
    }
    
    private isCommodityChar(char: string): boolean {
        return this.isLetter(char) || (char >= '0' && char <= '9');
    }
    
    /**
     * Increment usage count for an item
     */
    private incrementUsage(usageMap: Map<string, number>, item: string): void {
        usageMap.set(item, (usageMap.get(item) || 0) + 1);
    }
    
    /**
     * Merge data from another parsed result
     */
    private mergeData(target: ParsedHLedgerData, source: ParsedHLedgerData): void {
        // Merge sets
        source.accounts.forEach(item => target.accounts.add(item));
        source.definedAccounts.forEach(item => target.definedAccounts.add(item));
        source.usedAccounts.forEach(item => target.usedAccounts.add(item));
        source.payees.forEach(item => target.payees.add(item));
        source.tags.forEach(item => target.tags.add(item));
        source.commodities.forEach(item => target.commodities.add(item));
        
        // Merge aliases
        source.aliases.forEach((value, key) => target.aliases.set(key, value));
        
        // Update scalar values (keep latest)
        if (source.defaultCommodity) {
            target.defaultCommodity = source.defaultCommodity;
        }
        if (source.lastDate) {
            target.lastDate = source.lastDate;
        }
        
        // Merge usage maps
        this.mergeUsageMap(target.accountUsage, source.accountUsage);
        this.mergeUsageMap(target.payeeUsage, source.payeeUsage);
        this.mergeUsageMap(target.tagUsage, source.tagUsage);
        this.mergeUsageMap(target.commodityUsage, source.commodityUsage);
    }
    
    /**
     * Merge usage counts from source map into target map
     */
    private mergeUsageMap(target: Map<string, number>, source: Map<string, number>): void {
        source.forEach((count, item) => {
            target.set(item, (target.get(item) || 0) + count);
        });
    }
}