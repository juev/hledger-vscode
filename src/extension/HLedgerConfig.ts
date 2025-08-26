// HLedgerConfig.ts - Configuration and cache management
// ~200 lines according to REFACTORING.md FASE G
// Combines configuration and caching functionality

import * as vscode from 'vscode';
import * as path from 'path';
import { HLedgerParser, ParsedHLedgerData } from './HLedgerParser';
import { SimpleProjectCache } from './SimpleProjectCache';
import { CompletionContext, AccountName, PayeeName, TagName, CommodityCode, UsageCount, createUsageCount, createCacheKey } from './types';

// CompletionContext is now imported from types.ts
export { CompletionContext } from './types';

export class HLedgerConfig {
    // Pre-compiled regex patterns for performance optimization
    private static readonly PATTERNS = {
        TAG_IN_COMMENT: /\w+:\s*$|\/\w+:\w*$/,
        INDENTED_LINE: /^\s+/,
        KEYWORD_CONTEXT: /^\s*\w*$/,
        AFTER_NUMBER: /\d+(\.\d+)?\s*$/,
        CURRENCY_CONTEXT: /[\d$€£¥₽]\s*$/,
        POSTING_WITH_AMOUNTS: /^\s+.*\d+/,
        ACCOUNT_END: /^\s+[^0-9]*\s+/,
        FULL_DATE: /^\d{0,4}([-\/]\d{0,2}([-\/]\d{0,2})?)?$/,
        SHORT_DATE: /^(0[1-9]|1[0-2])([-\/](0[1-9]|[12]\d|3[01]))?$/,
        DATE_IN_TRANSACTION: /^\s*\d{4}[-\/]\d{2}[-\/]\d{2}\s*[*!]?\s*/
    } as const;

    private parser: HLedgerParser;
    private cache: SimpleProjectCache;
    private data: ParsedHLedgerData | null = null;
    private lastWorkspacePath: string | null = null;

    constructor(parser?: HLedgerParser, cache?: SimpleProjectCache) {
        this.parser = parser || new HLedgerParser();
        this.cache = cache || new SimpleProjectCache();
    }

    // Main method to get configuration for a document
    getConfigForDocument(document: vscode.TextDocument): void {
        const filePath = document.uri.fsPath;
        
        // Determine project path
        let projectPath: string;
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        if (workspaceFolder) {
            projectPath = workspaceFolder.uri.fsPath;
        } else {
            // No workspace, use directory of the file
            projectPath = path.dirname(filePath);
        }
        
        // Get cached data or parse workspace
        const cacheKey = createCacheKey(projectPath);
        this.data = this.cache.get(cacheKey);
        if (!this.data || this.lastWorkspacePath !== projectPath) {
            this.data = this.parser.parseWorkspace(projectPath);
            this.cache.set(cacheKey, this.data);
            this.lastWorkspacePath = projectPath;
        }
        
        // Parse current document to get latest changes
        const currentData = this.parser.parseContent(document.getText(), path.dirname(filePath));
        this.mergeCurrentData(currentData);
    }

    // Helper method to cast readonly data to mutable for internal operations
    // Type-safe conversion that preserves structure while allowing mutations
    private asMutable(data: ParsedHLedgerData): {
        accounts: Set<AccountName>;
        usedAccounts: Set<AccountName>;
        payees: Set<PayeeName>;
        tags: Set<TagName>;
        commodities: Set<CommodityCode>;
        accountUsage: Map<AccountName, UsageCount>;
        payeeUsage: Map<PayeeName, UsageCount>;
        tagUsage: Map<TagName, UsageCount>;
        commodityUsage: Map<CommodityCode, UsageCount>;
    } {
        // Safe cast through unknown to bypass readonly constraints
        // This is justified because we know the underlying implementation uses mutable collections
        return data as unknown as {
            accounts: Set<AccountName>;
            usedAccounts: Set<AccountName>;
            payees: Set<PayeeName>;
            tags: Set<TagName>;
            commodities: Set<CommodityCode>;
            accountUsage: Map<AccountName, UsageCount>;
            payeeUsage: Map<PayeeName, UsageCount>;
            tagUsage: Map<TagName, UsageCount>;
            commodityUsage: Map<CommodityCode, UsageCount>;
        };
    }

    // Merge current document data with cached workspace data
    private mergeCurrentData(currentData: ParsedHLedgerData): void {
        if (!this.data) return;

        const mutableData = this.asMutable(this.data);

        // Update with current document data
        currentData.accounts.forEach(acc => mutableData.accounts.add(acc));
        currentData.usedAccounts.forEach(acc => mutableData.usedAccounts.add(acc));
        currentData.payees.forEach(p => mutableData.payees.add(p));
        currentData.tags.forEach(t => mutableData.tags.add(t));
        currentData.commodities.forEach(c => mutableData.commodities.add(c));
        
        // Update usage counts with proper type handling
        currentData.accountUsage.forEach((count, key) => {
            const existing = mutableData.accountUsage.get(key) || createUsageCount(0);
            mutableData.accountUsage.set(key, createUsageCount(existing + count));
        });
        
        currentData.payeeUsage.forEach((count, key) => {
            const existing = mutableData.payeeUsage.get(key) || createUsageCount(0);
            mutableData.payeeUsage.set(key, createUsageCount(existing + count));
        });
        
        currentData.tagUsage.forEach((count, key) => {
            const existing = mutableData.tagUsage.get(key) || createUsageCount(0);
            mutableData.tagUsage.set(key, createUsageCount(existing + count));
        });
        
        currentData.commodityUsage.forEach((count, key) => {
            const existing = mutableData.commodityUsage.get(key) || createUsageCount(0);
            mutableData.commodityUsage.set(key, createUsageCount(existing + count));
        });
    }

    // Account methods with enhanced type safety
    getAccounts(): AccountName[] {
        return this.data ? Array.from(this.data.accounts) : [];
    }

    getAccountsByUsage(): AccountName[] {
        if (!this.data) return [];
        
        return Array.from(this.data.accounts).sort((a, b) => {
            const aUsage = this.data!.accountUsage.get(a) || 0;
            const bUsage = this.data!.accountUsage.get(b) || 0;
            
            if (aUsage !== bUsage) {
                return bUsage - aUsage; // Sort by usage descending
            }
            
            return a.localeCompare(b); // Then alphabetically
        });
    }

    getDefinedAccounts(): AccountName[] {
        return this.data ? Array.from(this.data.definedAccounts) : [];
    }

    getUsedAccounts(): AccountName[] {
        return this.data ? Array.from(this.data.usedAccounts) : [];
    }

    // Payee methods with enhanced type safety
    getPayees(): PayeeName[] {
        return this.data ? Array.from(this.data.payees) : [];
    }

    getPayeesByUsage(): PayeeName[] {
        if (!this.data) return [];
        
        return Array.from(this.data.payees).sort((a, b) => {
            const aUsage = this.data!.payeeUsage.get(a) || 0;
            const bUsage = this.data!.payeeUsage.get(b) || 0;
            
            if (aUsage !== bUsage) {
                return bUsage - aUsage;
            }
            
            return a.localeCompare(b);
        });
    }

    // Tag methods with enhanced type safety
    getTags(): TagName[] {
        return this.data ? Array.from(this.data.tags) : [];
    }

    getTagsByUsage(): TagName[] {
        if (!this.data) return [];
        
        return Array.from(this.data.tags).sort((a, b) => {
            const aUsage = this.data!.tagUsage.get(a) || 0;
            const bUsage = this.data!.tagUsage.get(b) || 0;
            
            if (aUsage !== bUsage) {
                return bUsage - aUsage;
            }
            
            return a.localeCompare(b);
        });
    }

    // Commodity methods with enhanced type safety
    getCommodities(): CommodityCode[] {
        return this.data ? Array.from(this.data.commodities) : [];
    }

    getCommoditiesByUsage(): CommodityCode[] {
        if (!this.data) return [];
        
        return Array.from(this.data.commodities).sort((a, b) => {
            const aUsage = this.data!.commodityUsage.get(a) || 0;
            const bUsage = this.data!.commodityUsage.get(b) || 0;
            
            if (aUsage !== bUsage) {
                return bUsage - aUsage;
            }
            
            return a.localeCompare(b);
        });
    }

    getDefaultCommodity(): CommodityCode | null {
        return this.data?.defaultCommodity || null;
    }

    // Date methods
    getLastDate(): string | null {
        return this.data?.lastDate || null;
    }

    // Alias methods with enhanced type safety
    getAliases(): ReadonlyMap<AccountName, AccountName> {
        return this.data?.aliases || new Map();
    }

    // Context detection for completion
    getCompletionContext(document: vscode.TextDocument, position: vscode.Position): CompletionContext {
        const line = document.lineAt(position).text;
        const beforeCursor = line.substring(0, position.character);
        const wordRange = document.getWordRangeAtPosition(position);
        const word = wordRange ? document.getText(wordRange) : '';

        // Check if we're in a comment
        if (beforeCursor.includes(';') || beforeCursor.includes('#')) {
            // Look for tag patterns in comments
            if (HLedgerConfig.PATTERNS.TAG_IN_COMMENT.test(beforeCursor)) {
                return { type: 'tag', query: word };
            }
            return { type: 'tag', query: '' };
        }

        // Check for date context (beginning of line with date pattern)
        // More flexible date detection - allow longer positions and better regex
        const lineStart = beforeCursor.trimStart();
        if (this.isDateContext(lineStart, position.character - (beforeCursor.length - lineStart.length))) {
            return { type: 'date', query: word };
        }

        // Check for hledger keywords at beginning of line
        if (HLedgerConfig.PATTERNS.KEYWORD_CONTEXT.test(beforeCursor) && position.character < 20) {
            return { type: 'keyword', query: word };
        }

        // Check for account context (indented lines or after account keyword)
        if (HLedgerConfig.PATTERNS.INDENTED_LINE.test(beforeCursor) && !this.isInAmountPosition(line, position.character)) {
            return { type: 'account', query: word };
        }

        // Check for explicit commodity context (after commodity keyword)
        if (beforeCursor.includes('commodity ')) {
            return { type: 'commodity', query: word };
        }

        // Check for commodity context in amount positions (after numbers/amounts)
        if (this.isInAmountPosition(line, position.character)) {
            return { type: 'commodity', query: word };
        }

        // Check for payee context (after date in transaction line)
        if (this.isPayeePosition(line, position.character)) {
            return { type: 'payee', query: word };
        }

        // Check for account directive context
        if (beforeCursor.includes('account ')) {
            return { type: 'account', query: word };
        }

        // Default to account completion for indented lines
        if (HLedgerConfig.PATTERNS.INDENTED_LINE.test(beforeCursor)) {
            return { type: 'account', query: word };
        }

        // Default to keyword completion for line start
        return { type: 'keyword', query: word };
    }

    private isDateContext(lineStart: string, positionInTrimmed: number): boolean {
        // Check if we're at the beginning of a line typing a date
        // Support multiple date formats using pre-compiled patterns
        const isFullDate = HLedgerConfig.PATTERNS.FULL_DATE.test(lineStart);
        const isShortDate = HLedgerConfig.PATTERNS.SHORT_DATE.test(lineStart);
        const isValidPattern = isFullDate || isShortDate;
        
        // Allow longer positions for short dates (up to 5 chars: "08-10")
        const maxPosition = isShortDate ? 5 : 10;
        
        return isValidPattern && positionInTrimmed <= maxPosition;
    }

    private isInAmountPosition(line: string, position: number): boolean {
        // Improved amount position detection using pre-compiled patterns
        const beforeCursor = line.substring(0, position);
        
        // Check if we're after a number (with optional whitespace)
        if (HLedgerConfig.PATTERNS.AFTER_NUMBER.test(beforeCursor)) {
            return true;
        }
        
        // Check if we're between currency symbols and numbers
        if (HLedgerConfig.PATTERNS.CURRENCY_CONTEXT.test(beforeCursor)) {
            return true;
        }
        
        // Check if we're in a posting line with amounts (indented line with numbers)
        if (HLedgerConfig.PATTERNS.POSTING_WITH_AMOUNTS.test(beforeCursor)) {
            // Make sure we're not in the account name part
            const accountMatch = beforeCursor.match(HLedgerConfig.PATTERNS.ACCOUNT_END);
            if (accountMatch && position > accountMatch[0].length) {
                return true;
            }
        }
        
        return false;
    }

    private isPayeePosition(line: string, position: number): boolean {
        // Payee comes after date and optional status in transaction lines
        const beforeCursor = line.substring(0, position);
        const dateMatch = beforeCursor.match(HLedgerConfig.PATTERNS.DATE_IN_TRANSACTION);
        
        return !!dateMatch && position > dateMatch[0].length;
    }

    // Note: isKeywordContext method was inlined to use pre-compiled patterns directly

    // Clear cache
    clearCache(): void {
        this.cache.clear();
        this.data = null;
        this.lastWorkspacePath = null;
    }

    // Get cache statistics
    getCacheStats() {
        return this.cache.getStats();
    }

    // Direct access to usage maps with enhanced type safety
    get accountUsage(): ReadonlyMap<AccountName, UsageCount> {
        return this.data?.accountUsage || new Map();
    }

    get payeeUsage(): ReadonlyMap<PayeeName, UsageCount> {
        return this.data?.payeeUsage || new Map();
    }

    get tagUsage(): ReadonlyMap<TagName, UsageCount> {
        return this.data?.tagUsage || new Map();
    }

    get commodityUsage(): ReadonlyMap<CommodityCode, UsageCount> {
        return this.data?.commodityUsage || new Map();
    }

    // Backward compatibility methods for tests
    parseContent(content: string, basePath?: string): void {
        const parsedData = this.parser.parseContent(content, basePath);
        if (this.data) {
            this.mergeCurrentData(parsedData);
        } else {
            this.data = parsedData;
        }
    }

    parseFile(filePath: string): void {
        this.data = this.parser.parseFile(filePath);
    }

    scanWorkspace(workspacePath: string): void {
        this.data = this.parser.parseWorkspace(workspacePath);
        this.lastWorkspacePath = workspacePath;
    }

    // Legacy property access for backward compatibility
    get defaultCommodity(): CommodityCode | null {
        return this.getDefaultCommodity();
    }

    getUndefinedAccounts(): AccountName[] {
        // Return accounts that are used but not defined
        const defined = new Set(this.getDefinedAccounts());
        return this.getUsedAccounts().filter(account => !defined.has(account));
    }
}