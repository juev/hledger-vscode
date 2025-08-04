import * as fs from 'fs';
import * as path from 'path';
import { IHLedgerParser, ParsedHLedgerData } from './interfaces';
import {
    AccountName,
    PayeeName,
    CommodityName,
    TagEntry,
    DateString,
    FilePath,
    AccountAlias,
    createAccountName,
    createPayeeName,
    createCommodityName,
    createTagEntry,
    createDateString,
    createFilePath,
    createAccountAlias
} from './BrandedTypes';

/**
 * Pure parser for HLedger files without side effects
 * Extracts structured data from hledger content following hledger 1.43 specification
 */
export class HLedgerParser implements IHLedgerParser {
    
    /**
     * Parse a file from filesystem
     * @param filePath - Path to the hledger file
     * @returns Parsed data structure
     */
    parseFile(filePath: FilePath): ParsedHLedgerData {
        try {
            if (!fs.existsSync(filePath)) {
                return this.createEmptyData();
            }
            
            const content = fs.readFileSync(filePath, 'utf8');
            return this.parseContent(content, createFilePath(path.dirname(filePath)));
        } catch (error) {
            if (process.env.NODE_ENV !== 'test') {
                console.error('Error parsing file:', filePath, error);
            }
            return this.createEmptyData();
        }
    }
    
    /**
     * Parse hledger content from string
     * @param content - Raw hledger content
     * @param basePath - Base path for resolving includes
     * @returns Parsed data structure
     */
    parseContent(content: string, basePath?: FilePath): ParsedHLedgerData {
        const data = this.createEmptyData();
        const lines = content.split('\n');
        
        for (const line of lines) {
            this.parseLine(line, data, basePath || createFilePath(''));
        }
        
        // Union all accounts (defined + used)
        data.definedAccounts.forEach(acc => data.accounts.add(acc));
        data.usedAccounts.forEach(acc => data.accounts.add(acc));
        
        return data;
    }
    
    /**
     * Create empty data structure
     */
    private createEmptyData(): ParsedHLedgerData {
        return {
            accounts: new Set<AccountName>(),
            definedAccounts: new Set<AccountName>(),
            usedAccounts: new Set<AccountName>(),
            payees: new Set<PayeeName>(),
            tags: new Set<TagEntry>(),
            commodities: new Set<CommodityName>(),
            aliases: new Map<AccountAlias, AccountName>(),
            defaultCommodity: null,
            lastDate: null,
            accountUsage: new Map<AccountName, number>(),
            payeeUsage: new Map<PayeeName, number>(),
            tagUsage: new Map<TagEntry, number>(),
            commodityUsage: new Map<CommodityName, number>()
        };
    }
    
    /**
     * Parse a single line and update data structure
     */
    private parseLine(line: string, data: ParsedHLedgerData, basePath: FilePath): void {
        const trimmed = line.trim();
        
        // Skip empty lines and comments
        if (!trimmed || trimmed.startsWith('#')) {
            return;
        }
        
        // Extract dates from transactions for date completion (keep the most recent)
        // Support all hledger date formats: YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD, MM-DD, MM/DD, MM.DD
        const dateMatch = trimmed.match(/^(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2})/);
        if (dateMatch) {
            try {
                data.lastDate = createDateString(dateMatch[1]);
            } catch (error) {
                // Skip invalid dates
            }
            this.parseTransactionLine(trimmed, data);
            return;
        }
        
        // Account definitions
        const accountMatch = trimmed.match(/^account\s+([^;]+)/);
        if (accountMatch) {
            try {
                const account = createAccountName(accountMatch[1].trim());
                data.definedAccounts.add(account);
            } catch (error) {
                // Skip invalid account names
            }
            return;
        }
        
        // Alias definitions
        const aliasMatch = trimmed.match(/^alias\s+([^=]+)\s*=\s*(.+)/);
        if (aliasMatch) {
            try {
                const alias = createAccountAlias(aliasMatch[1].trim());
                const target = createAccountName(aliasMatch[2].trim());
                data.aliases.set(alias, target);
                data.definedAccounts.add(target);
            } catch (error) {
                // Skip invalid aliases
            }
            return;
        }
        
        // Commodity definitions
        const commodityMatch = trimmed.match(/^commodity\s+(.+)/);
        if (commodityMatch) {
            try {
                const commodity = createCommodityName(commodityMatch[1].trim());
                data.commodities.add(commodity);
            } catch (error) {
                // Skip invalid commodities
            }
            return;
        }
        
        // Default commodity
        const defaultMatch = trimmed.match(/^D\s+(.+)/);
        if (defaultMatch) {
            try {
                data.defaultCommodity = createCommodityName(defaultMatch[1].trim());
            } catch (error) {
                // Skip invalid default commodity
            }
            return;
        }
        
        // Include files
        const includeMatch = trimmed.match(/^include\s+(.+)/);
        if (includeMatch && basePath) {
            const includePath = includeMatch[1].trim();
            const fullPath = path.resolve(basePath, includePath);
            try {
                const includedData = this.parseFile(createFilePath(fullPath));
                this.mergeData(data, includedData);
            } catch (error) {
                // Skip files that can't be included
            }
            return;
        }
        
        // Parse posting lines (lines starting with whitespace)
        if (/^\s+/.test(line)) {
            this.parsePostingLine(line, data);
            return;
        }
    }
    
    /**
     * Parse transaction header line
     */
    private parseTransactionLine(line: string, data: ParsedHLedgerData): void {
        // Extract payee from transaction line
        // Format: DATE [*|!] [CODE] DESCRIPTION [; COMMENT]
        // Support payee|note format as per hledger spec
        const transactionMatch = line.match(/^(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2})\s*(\*|!)?\s*(\([^)]+\))?\s*([^;]+)(?:;(.*))?$/);
        if (!transactionMatch) {
            return;
        }
        
        const description = transactionMatch[4]?.trim();
        if (description) {
            try {
                // Store entire description as payee, including pipe characters
                // Do not split on | to support payees like "Store | Branch"
                const payee = createPayeeName(description);
                data.payees.add(payee);
                // Increment usage count for payee
                this.incrementUsage(data.payeeUsage, payee);
            } catch (error) {
                // Skip invalid payee names
            }
        }
        
        // Extract tags from comment
        const comment = transactionMatch[5]?.trim();
        if (comment) {
            this.extractTags(comment, data);
        }
    }
    
    /**
     * Parse posting line (account line with amount)
     */
    private parsePostingLine(line: string, data: ParsedHLedgerData): void {
        // Parse posting line: ACCOUNT [AMOUNT] [@ PRICE] [= BALANCE_ASSERTION] [; COMMENT]
        // Support cost/price notation: @ unit_price, @@ total_price
        // Support balance assertions: = single commodity balance, == sole commodity balance
        const postingMatch = line.match(/^\s+([A-Za-z\u0400-\u04FF][A-Za-z\u0400-\u04FF0-9:_\-\s]*?)(?:\s{2,}([^@=;]+))?(?:\s*@@?\s*[^=;]+)?(?:\s*==?\s*[^;]+)?(?:\s*;(.*))?$/);
        if (!postingMatch) {
            return;
        }
        
        const accountStr = postingMatch[1].trim();
        try {
            const account = createAccountName(accountStr);
            data.usedAccounts.add(account);
            // Increment usage count for account
            this.incrementUsage(data.accountUsage, account);
        } catch (error) {
            // Skip invalid account names
        }
        
        // Extract and count commodities from amount
        const amount = postingMatch[2]?.trim();
        if (amount) {
            this.extractCommodityFromAmount(amount, data);
        }
        
        // Parse posting comment for tags including date:
        const postingComment = postingMatch[3]?.trim();
        if (postingComment) {
            // Look for date:DATE tags specifically
            const dateTagMatch = postingComment.match(/\bdate:(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2})/);
            if (dateTagMatch) {
                try {
                    // Store posting dates for date completion
                    data.lastDate = createDateString(dateTagMatch[1]);
                } catch (error) {
                    // Skip invalid dates
                }
            }
            
            // Parse other tags from posting comments
            this.extractTags(postingComment, data);
        }
    }
    
    /**
     * Extract tags from comment text
     */
    private extractTags(comment: string, data: ParsedHLedgerData): void {
        // Look for tags in format: tag:value
        const tagMatches = comment.match(/(^|[,\s])([a-zA-Z\u0400-\u04FF][a-zA-Z\u0400-\u04FF0-9_]*):([^\s,;]+)/g);
        if (!tagMatches) {
            return;
        }
        
        tagMatches.forEach(match => {
            const tagMatch = match.trim().match(/([a-zA-Z\u0400-\u04FF][a-zA-Z\u0400-\u04FF0-9_]*):(.+)/);
            if (tagMatch) {
                try {
                    const tagEntry = createTagEntry(match.trim());
                    data.tags.add(tagEntry);
                    // Increment usage count for tag
                    this.incrementUsage(data.tagUsage, tagEntry);
                } catch (error) {
                    // Skip invalid tag entries
                }
            }
        });
    }
    
    /**
     * Extract commodity from amount string
     */
    private extractCommodityFromAmount(amount: string, data: ParsedHLedgerData): void {
        // Match commodity symbols (letters, symbols like $, €, etc.)
        const commodityMatch = amount.match(/([A-Z]{3,}|[^\d\s.,+-]+)/);
        if (commodityMatch) {
            try {
                const commodity = createCommodityName(commodityMatch[1].trim());
                data.commodities.add(commodity);
                // Increment usage count for commodity
                this.incrementUsage(data.commodityUsage, commodity);
            } catch (error) {
                // Skip invalid commodities
            }
        }
    }
    
    /**
     * Increment usage count for an item
     */
    private incrementUsage<T extends AccountName | PayeeName | TagEntry | CommodityName>(usageMap: Map<T, number>, item: T): void {
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
    private mergeUsageMap<T extends AccountName | PayeeName | TagEntry | CommodityName>(target: Map<T, number>, source: Map<T, number>): void {
        source.forEach((count, item) => {
            target.set(item, (target.get(item) || 0) + count);
        });
    }
}