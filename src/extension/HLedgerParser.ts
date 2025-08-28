// HLedgerParser.ts - Simplified parser for hledger files
// ~300 lines according to REFACTORING.md FASE G
// Consolidates parsing logic from ConfigManager into a dedicated parser

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import {
    AccountName, PayeeName, TagName, TagValue, CommodityCode, UsageCount,
    createAccountName, createPayeeName, createTagName, createTagValue, createCommodityCode, createUsageCount
} from './types';

/**
 * Internal mutable interface for building parsed data during parsing.
 */
interface MutableParsedHLedgerData {
    accounts: Set<AccountName>;
    definedAccounts: Set<AccountName>;
    usedAccounts: Set<AccountName>;
    payees: Set<PayeeName>;
    tags: Set<TagName>;
    commodities: Set<CommodityCode>;
    aliases: Map<AccountName, AccountName>;

    // Tag value mappings and usage tracking
    tagValues: Map<TagName, Set<TagValue>>;
    tagValueUsage: Map<string, UsageCount>;

    // Usage tracking with branded types for frequency-based prioritization
    accountUsage: Map<AccountName, UsageCount>;
    payeeUsage: Map<PayeeName, UsageCount>;
    tagUsage: Map<TagName, UsageCount>;
    commodityUsage: Map<CommodityCode, UsageCount>;

    defaultCommodity: CommodityCode | null;
    lastDate: string | null;
}

/**
 * Enhanced ParsedHLedgerData interface with branded types for type safety.
 * Represents all parsed data from hledger files including usage tracking.
 */
export interface ParsedHLedgerData {
    readonly accounts: ReadonlySet<AccountName>;
    readonly definedAccounts: ReadonlySet<AccountName>;
    readonly usedAccounts: ReadonlySet<AccountName>;
    readonly payees: ReadonlySet<PayeeName>;
    readonly tags: ReadonlySet<TagName>;
    readonly commodities: ReadonlySet<CommodityCode>;
    readonly aliases: ReadonlyMap<AccountName, AccountName>;

    // Tag value mappings and usage tracking
    readonly tagValues: ReadonlyMap<TagName, ReadonlySet<TagValue>>;
    readonly tagValueUsage: ReadonlyMap<string, UsageCount>;

    // Usage tracking with branded types for frequency-based prioritization
    readonly accountUsage: ReadonlyMap<AccountName, UsageCount>;
    readonly payeeUsage: ReadonlyMap<PayeeName, UsageCount>;
    readonly tagUsage: ReadonlyMap<TagName, UsageCount>;
    readonly commodityUsage: ReadonlyMap<CommodityCode, UsageCount>;

    readonly defaultCommodity: CommodityCode | null;
    readonly lastDate: string | null;
}

/**
 * Enhanced HLedger file parser with type safety and performance optimizations.
 * 
 * Features:
 * - Branded types for all parsed entities (accounts, payees, tags, commodities)
 * - Usage frequency tracking for intelligent completion prioritization
 * - Async parsing support for large files (>1MB)
 * - Include directive support for modular file structures
 * - Comprehensive error handling with graceful degradation
 * - Memory-efficient parsing with configurable chunking
 * 
 * Supports all hledger file formats (.journal, .hledger, .ledger) and follows
 * hledger 1.43 specification for maximum compatibility.
 */
export class HLedgerParser {

    parseFile(filePath: string): ParsedHLedgerData {
        try {
            if (!fs.existsSync(filePath)) {
                return this.toReadonly(this.createEmptyData());
            }

            const content = fs.readFileSync(filePath, 'utf8');
            const basePath = path.dirname(filePath);
            return this.parseContent(content, basePath);
        } catch (error) {
            // Log error only in non-test environment
            if (process.env.NODE_ENV !== 'test') {
                console.error('Error parsing file:', filePath, error);
            }
            return this.toReadonly(this.createEmptyData());
        }
    }

    async parseFileAsync(filePath: string): Promise<ParsedHLedgerData> {
        try {
            const stats = await fs.promises.stat(filePath);
            // For large files (>1MB), use async processing
            if (stats.size > 1024 * 1024) {
                return this.parseContentAsync(await fs.promises.readFile(filePath, 'utf8'), path.dirname(filePath));
            }
            return this.parseFile(filePath);
        } catch (error) {
            if (process.env.NODE_ENV !== 'test') {
                console.error('Error parsing file async:', filePath, error);
            }
            return this.createEmptyData();
        }
    }

    parseContent(content: string, basePath?: string): ParsedHLedgerData {
        const data = this.createEmptyData();
        const lines = content.split('\n');

        let inTransaction = false;
        let transactionPayee = '';

        for (const line of lines) {
            const trimmedLine = line.trim();

            // Update transaction state BEFORE parsing the line
            if (trimmedLine && !line.startsWith(' ') && !line.startsWith('\t')) {
                if (this.isTransactionLine(trimmedLine)) {
                    inTransaction = true;
                    transactionPayee = this.extractPayeeFromTransaction(trimmedLine);
                } else {
                    inTransaction = false;
                    transactionPayee = '';
                }
            }

            this.parseLine(line, data, basePath, inTransaction, transactionPayee);
        }

        return this.toReadonly(data);
    }

    private async parseContentAsync(content: string, basePath?: string): Promise<ParsedHLedgerData> {
        const data = this.createEmptyData();
        const lines = content.split('\n');

        let inTransaction = false;
        let transactionPayee = '';
        let processedLines = 0;

        for (const line of lines) {
            const trimmedLine = line.trim();

            // Update transaction state BEFORE parsing the line
            if (trimmedLine && !line.startsWith(' ') && !line.startsWith('\t')) {
                if (this.isTransactionLine(trimmedLine)) {
                    inTransaction = true;
                    transactionPayee = this.extractPayeeFromTransaction(trimmedLine);
                } else {
                    inTransaction = false;
                    transactionPayee = '';
                }
            }

            this.parseLine(line, data, basePath, inTransaction, transactionPayee);

            // Yield control every 1000 lines for large files
            processedLines++;
            if (processedLines % 1000 === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }

        return this.toReadonly(data);
    }

    private parseLine(line: string, data: MutableParsedHLedgerData, basePath?: string, inTransaction = false, transactionPayee = ''): void {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith(';') || trimmedLine.startsWith('#')) {
            return;
        }

        // Include directives - process files recursively
        if (trimmedLine.startsWith('include ')) {
            this.handleIncludeDirective(trimmedLine, data, basePath);
            return;
        }

        // Account directive
        if (trimmedLine.startsWith('account ')) {
            let accountLine = trimmedLine.substring(8).trim();
            // Remove inline comments
            const commentIndex = accountLine.indexOf(';');
            if (commentIndex !== -1) {
                accountLine = accountLine.substring(0, commentIndex).trim();
            }
            const accountName = createAccountName(accountLine);
            if (accountName) {
                data.accounts.add(accountName);
                data.definedAccounts.add(accountName);
                // Don't increment usage for account definitions - only count actual usage
            }
            return;
        }

        // Commodity directive
        if (trimmedLine.startsWith('commodity ')) {
            const commodityName = createCommodityCode(trimmedLine.substring(10).trim());
            if (commodityName) {
                data.commodities.add(commodityName);
                // Don't increment usage for commodity definitions - only count actual usage
            }
            return;
        }

        // Default commodity
        if (trimmedLine.startsWith('D ')) {
            const commodityName = createCommodityCode(trimmedLine.substring(2).trim());
            if (commodityName) {
                data.defaultCommodity = commodityName;
                data.commodities.add(commodityName);
                // Don't increment usage for default commodity definition - only count actual usage
            }
            return;
        }

        // Alias directive
        if (trimmedLine.includes('alias')) {
            this.handleAliasDirective(trimmedLine, data);
            return;
        }

        // Transaction line
        if (this.isTransactionLine(trimmedLine)) {
            this.handleTransactionLine(trimmedLine, data);
            return;
        }

        // Posting line (account line inside transaction)
        if (inTransaction && (line.startsWith('    ') || line.startsWith('\t'))) {
            this.handlePostingLine(line, data, transactionPayee);
            return;
        }
    }

    private handleIncludeDirective(line: string, data: MutableParsedHLedgerData, basePath?: string): void {
        const includeFile = line.substring(8).trim();
        if (includeFile && basePath) {
            const fullPath = path.resolve(basePath, includeFile);
            try {
                const includedData = this.parseFile(fullPath);
                this.mergeData(data, includedData);
            } catch (error) {
                // Silently ignore include errors
            }
        }
    }

    private handleAliasDirective(line: string, data: MutableParsedHLedgerData): void {
        const aliasMatch = line.match(/alias\s+([^=]+)=(.+)/);
        if (aliasMatch && aliasMatch[1] && aliasMatch[2]) {
            const alias = createAccountName(aliasMatch[1].trim());
            const account = createAccountName(aliasMatch[2].trim());
            data.aliases.set(alias, account);
        }
    }

    private handleTransactionLine(line: string, data: MutableParsedHLedgerData): void {
        const dateMatch = line.match(/^(\d{4}[-\/\.]\d{2}[-\/\.]\d{2}|\d{2}[-\/\.]\d{2})/);
        if (dateMatch && dateMatch[1]) {
            data.lastDate = dateMatch[1];
        }

        const payeeString = this.extractPayeeFromTransaction(line);
        if (payeeString) {
            const payee = createPayeeName(payeeString);
            data.payees.add(payee);
            this.incrementUsage(data.payeeUsage, payee);
        }

        // Extract tags from transaction line
        this.extractTags(line, data);
    }

    private handlePostingLine(line: string, data: MutableParsedHLedgerData, transactionPayee: string): void {
        const trimmedLine = line.trim();

        // Extract account name (everything before amount)
        let accountName = '';
        const parts = trimmedLine.split(/\s{2,}|\t/);
        if (parts.length > 0 && parts[0]) {
            accountName = parts[0].trim();

            // Remove leading/trailing spaces and handle account hierarchy
            if (accountName) {
                const account = createAccountName(accountName);
                data.accounts.add(account);
                data.usedAccounts.add(account);
                this.incrementUsage(data.accountUsage, account);
            }
        }

        // Extract commodity from amount (if present)
        if (parts.length > 1 && parts[1]) {
            const amountPart = parts[1].trim();
            this.extractCommodityFromAmount(amountPart, data);
        }

        // Extract tags from posting line
        this.extractTags(trimmedLine, data);
    }

    private extractPayeeFromTransaction(line: string): string {
        // Remove date and status, extract payee (handle both full and short date formats)
        let cleaned = line.replace(/^(\d{4}[-\/\.]\d{2}[-\/\.]\d{2}|\d{2}[-\/\.]\d{2})/, '').trim();
        cleaned = cleaned.replace(/^[*!]\s*/, '').trim(); // Remove status

        // Remove transaction codes like (REF123), (CODE456)
        cleaned = cleaned.replace(/^\([^)]+\)\s*/, '').trim();

        // Split only by ; to separate payee from comment, but preserve pipe characters
        const parts = cleaned.split(/[;]/);
        const payee = parts[0] ? parts[0].trim() : '';
        
        // Normalize Unicode characters for consistent matching (NFC normalization)
        // This ensures characters like Cyrillic are handled consistently
        return payee ? payee.normalize('NFC') : '';
    }

    private extractTags(line: string, data: MutableParsedHLedgerData): void {
        // Extract tags only from comments (after ; or #)
        // Tags are in the format tag:value within comments
        const commentMatch = line.match(/[;#](.*)$/);
        if (!commentMatch || !commentMatch[1]) {
            return;
        }

        const commentText = commentMatch[1];

        // Enhanced pattern to extract tag:value pairs with support for:
        // - Unicode letters and numbers in tag names
        // - Spaces and special characters in values
        // - Multiple tags separated by commas
        // Pattern matches: tagname:value where value can contain spaces until next comma or end
        const tagPattern = /([\p{L}\p{N}_]+):\s*([^,;#]*?)(?=\s*(?:,|$))/gu;
        const tagMatches = commentText.matchAll(tagPattern);
        
        for (const match of tagMatches) {
            const tagName = match[1].trim();
            const tagValue = match[2].trim();
            
            if (tagName && tagValue) {
                // Store regular tag:value pair (treat "tag" like any other tag name)
                const tag = createTagName(tagName);
                const value = createTagValue(tagValue);
                
                // Add tag to tags set
                data.tags.add(tag);
                this.incrementUsage(data.tagUsage, tag);
                
                // Add value to tag's value set
                if (!data.tagValues.has(tag)) {
                    data.tagValues.set(tag, new Set<TagValue>());
                }
                data.tagValues.get(tag)!.add(value);
                
                // Track usage of this specific tag:value pair
                const pairKey = `${tagName}:${tagValue}`;
                this.incrementUsage(data.tagValueUsage, pairKey as any);
            }
        }
    }

    private extractCommodityFromAmount(amountStr: string, data: MutableParsedHLedgerData): void {
        // Enhanced Unicode-aware commodity extraction
        // Matches international currency symbols, cryptocurrency symbols, and commodity codes
        // Supports Latin, Cyrillic, Greek, and other Unicode letter systems
        const commodityMatch = amountStr.match(/(\p{Sc}|[\p{L}]{2,}\d*|[A-Z]{2,}\d*)/u);
        if (commodityMatch && commodityMatch[1]) {
            const commodity = createCommodityCode(commodityMatch[1]);
            data.commodities.add(commodity);
            this.incrementUsage(data.commodityUsage, commodity);
        }
    }

    private isTransactionLine(line: string): boolean {
        // Transaction lines start with a date (full or short format)
        return /^(\d{4}[-\/\.]\d{2}[-\/\.]\d{2}|\d{2}[-\/\.]\d{2})/.test(line);
    }

    private incrementUsage<TKey extends string>(usageMap: Map<TKey, UsageCount>, key: TKey): void {
        const currentCount = usageMap.get(key) || createUsageCount(0);
        usageMap.set(key, createUsageCount(currentCount + 1));
    }

    private mergeData(target: MutableParsedHLedgerData, source: ParsedHLedgerData): void {
        // Merge sets
        source.accounts.forEach(acc => target.accounts.add(acc));
        source.definedAccounts.forEach(acc => target.definedAccounts.add(acc));
        source.usedAccounts.forEach(acc => target.usedAccounts.add(acc));
        source.payees.forEach(p => target.payees.add(p));
        source.tags.forEach(t => target.tags.add(t));
        source.commodities.forEach(c => target.commodities.add(c));

        // Merge maps
        source.aliases.forEach((value, key) => target.aliases.set(key, value));
        
        // Merge tag values
        source.tagValues.forEach((values, tag) => {
            if (!target.tagValues.has(tag)) {
                target.tagValues.set(tag, new Set<TagValue>());
            }
            values.forEach(value => target.tagValues.get(tag)!.add(value));
        });

        // Merge usage maps
        source.accountUsage.forEach((count, key) => {
            const existing = target.accountUsage.get(key) || createUsageCount(0);
            target.accountUsage.set(key, createUsageCount(existing + count));
        });

        source.payeeUsage.forEach((count, key) => {
            const existing = target.payeeUsage.get(key) || createUsageCount(0);
            target.payeeUsage.set(key, createUsageCount(existing + count));
        });

        source.tagUsage.forEach((count, key) => {
            const existing = target.tagUsage.get(key) || createUsageCount(0);
            target.tagUsage.set(key, createUsageCount(existing + count));
        });

        source.commodityUsage.forEach((count, key) => {
            const existing = target.commodityUsage.get(key) || createUsageCount(0);
            target.commodityUsage.set(key, createUsageCount(existing + count));
        });
        
        // Merge tag value usage
        source.tagValueUsage.forEach((count, key) => {
            const existing = target.tagValueUsage.get(key as any) || createUsageCount(0);
            target.tagValueUsage.set(key as any, createUsageCount(existing + count));
        });

        // Update last date if newer
        if (source.lastDate && (!target.lastDate || source.lastDate > target.lastDate)) {
            target.lastDate = source.lastDate;
        }

        // Update default commodity
        if (source.defaultCommodity) {
            target.defaultCommodity = source.defaultCommodity;
        }
    }

    private createEmptyData(): MutableParsedHLedgerData {
        return {
            accounts: new Set<AccountName>(),
            definedAccounts: new Set<AccountName>(),
            usedAccounts: new Set<AccountName>(),
            payees: new Set<PayeeName>(),
            tags: new Set<TagName>(),
            commodities: new Set<CommodityCode>(),
            aliases: new Map<AccountName, AccountName>(),
            tagValues: new Map<TagName, Set<TagValue>>(),
            tagValueUsage: new Map<string, UsageCount>(),
            accountUsage: new Map<AccountName, UsageCount>(),
            payeeUsage: new Map<PayeeName, UsageCount>(),
            tagUsage: new Map<TagName, UsageCount>(),
            commodityUsage: new Map<CommodityCode, UsageCount>(),
            defaultCommodity: null,
            lastDate: null
        };
    }

    private toReadonly(data: MutableParsedHLedgerData): ParsedHLedgerData {
        return data as ParsedHLedgerData;
    }

    // Convenience method for scanning entire workspace
    parseWorkspace(workspacePath: string): ParsedHLedgerData {
        const data = this.createEmptyData();

        try {
            const files = this.findHLedgerFiles(workspacePath);
            for (const file of files) {
                const fileData = this.parseFile(file);
                this.mergeData(data, fileData);
            }
        } catch (error) {
            if (process.env.NODE_ENV !== 'test') {
                console.error('Error scanning workspace:', workspacePath, error);
            }
        }

        return this.toReadonly(data);
    }

    private findHLedgerFiles(dirPath: string): string[] {
        const files: string[] = [];
        const hledgerExtensions = ['.journal', '.hledger', '.ledger'];

        try {
            const entries = fs.readdirSync(dirPath, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);

                if (entry.isDirectory() && !entry.name.startsWith('.')) {
                    // Recursively search subdirectories
                    files.push(...this.findHLedgerFiles(fullPath));
                } else if (entry.isFile()) {
                    const ext = path.extname(entry.name).toLowerCase();
                    if (hledgerExtensions.includes(ext)) {
                        files.push(fullPath);
                    }
                }
            }
        } catch (error) {
            // Silently ignore directory access errors
        }

        return files;
    }
}