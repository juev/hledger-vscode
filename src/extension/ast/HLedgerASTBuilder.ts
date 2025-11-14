// HLedgerASTBuilder.ts - Abstract Syntax Tree builder for hledger files
// Handles construction of data structures from tokens

import {
    AccountName, PayeeName, TagName, TagValue, CommodityCode, UsageCount,
    createAccountName, createPayeeName, createTagName, createTagValue, createCommodityCode, createUsageCount
} from '../types';
import { NumberFormatService, CommodityFormat } from '../services/NumberFormatService';
import { HLedgerToken, TokenType } from '../lexer/HLedgerLexer';

/**
 * Internal mutable interface for building parsed data during AST construction
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

    // Format information for number formatting and commodity display
    commodityFormats: Map<CommodityCode, CommodityFormat>;
    decimalMark: '.' | ',' | null;

    defaultCommodity: CommodityCode | null;
    lastDate: string | null;
}

/**
 * Enhanced ParsedHLedgerData interface with branded types for type safety
 */
export interface ParsedHLedgerData {
    readonly accounts: ReadonlySet<AccountName>;
    readonly definedAccounts: ReadonlySet<AccountName>;
    readonly usedAccounts: ReadonlySet<AccountName>;
    readonly payees: ReadonlySet<PayeeName>;
    readonly tags: ReadonlySet<TagName>;
    readonly commodities: ReadonlySet<CommodityCode>;
    readonly aliases: ReadonlyMap<AccountName, AccountName>;

    // Tag value mappings with frequency data
    readonly tagValues: ReadonlyMap<TagName, ReadonlySet<TagValue>>;
    readonly tagValueUsage: ReadonlyMap<string, UsageCount>;

    // Usage tracking for intelligent auto-completion
    readonly accountUsage: ReadonlyMap<AccountName, UsageCount>;
    readonly payeeUsage: ReadonlyMap<PayeeName, UsageCount>;
    readonly tagUsage: ReadonlyMap<TagName, UsageCount>;
    readonly commodityUsage: ReadonlyMap<CommodityCode, UsageCount>;

    // Number format information
    readonly commodityFormats: ReadonlyMap<CommodityCode, CommodityFormat>;
    readonly decimalMark: '.' | ',' | null;
    readonly defaultCommodity: CommodityCode | null;
    readonly lastDate: string | null;
}

/**
 * Building context for processing tokens
 */
interface BuildingContext {
    inTransaction: boolean;
    transactionPayee: PayeeName;
    pendingFormatDirective: string | null;
    lastDate: string | null;
}

/**
 * AST Builder for hledger - constructs data structures from tokens
 */
export class HLedgerASTBuilder {
    private readonly numberFormatService: NumberFormatService;

    constructor(numberFormatService?: NumberFormatService) {
        this.numberFormatService = numberFormatService || new NumberFormatService();
    }

    /**
     * Builds AST data from an array of tokens
     */
    public buildFromTokens(tokens: HLedgerToken[], basePath?: string): ParsedHLedgerData {
        const data = this.createEmptyData();
        const context: BuildingContext = {
            inTransaction: false,
            transactionPayee: createPayeeName(''),
            pendingFormatDirective: null,
            lastDate: null
        };

        for (const token of tokens) {
            this.processToken(token, data, context);
        }

        return this.toReadonly(data);
    }

    /**
     * Processes a single token and updates the AST data
     */
    private processToken(token: HLedgerToken, data: MutableParsedHLedgerData, context: BuildingContext): void {
        switch (token.type) {
            case TokenType.TRANSACTION:
                this.handleTransactionToken(token, data, context);
                break;

            case TokenType.POSTING:
                this.handlePostingToken(token, data, context);
                break;

            case TokenType.INCLUDE_DIRECTIVE:
                // Handled by FileProcessor
                break;

            case TokenType.ALIAS_DIRECTIVE:
                this.handleAliasDirective(token, data);
                break;

            case TokenType.COMMODITY_DIRECTIVE:
                this.handleCommodityDirective(token, data);
                break;

            case TokenType.FORMAT_DIRECTIVE:
                this.handleFormatDirective(token, data, context);
                break;

            case TokenType.DECIMAL_MARK_DIRECTIVE:
                this.handleDecimalMarkDirective(token, data);
                break;

            case TokenType.DEFAULT_COMMODITY_DIRECTIVE:
                this.handleDefaultCommodityDirective(token, data);
                break;

            case TokenType.ACCOUNT_DIRECTIVE:
                this.handleAccountDirective(token, data);
                break;

            case TokenType.PAYEE_DIRECTIVE:
                this.handlePayeeDirective(token, data);
                break;

            case TokenType.TAG_DIRECTIVE:
                this.handleTagDirective(token, data);
                break;

            case TokenType.EMPTY:
            case TokenType.COMMENT:
            case TokenType.UNKNOWN:
                // Ignore these tokens
                break;

            default:
                // Silently ignore unknown token types
                break;
        }
    }

    /**
     * Processes transaction tokens
     */
    private handleTransactionToken(token: HLedgerToken, data: MutableParsedHLedgerData, context: BuildingContext): void {
        if (token.payee) {
            this.addPayee(token.payee, data);
        }

        // Process tags from transaction
        if (token.tags) {
            this.processTags(token.tags, data);
        }

        // Update context
        context.inTransaction = true;
        context.transactionPayee = token.payee || createPayeeName('Unknown');

        // Extract date from transaction line
        const dateMatch = token.trimmedLine.match(/^(\d{4}[-/]\d{1,2}[-/]\d{1,2})/);
        if (dateMatch) {
            context.lastDate = dateMatch[1];
            data.lastDate = dateMatch[1];
        }
    }

    /**
     * Processes posting tokens
     */
    private handlePostingToken(token: HLedgerToken, data: MutableParsedHLedgerData, context: BuildingContext): void {
        if (token.account) {
            this.addAccount(token.account, data);
        }

        // Extract commodity from amount if present
        if (token.amount && token.commodity) {
            this.addCommodity(token.commodity, data);
        }

        // Process tags from posting
        if (token.tags) {
            this.processTags(token.tags, data);
        }
    }

    /**
     * Processes alias directives
     */
    private handleAliasDirective(token: HLedgerToken, data: MutableParsedHLedgerData): void {
        if (token.aliasFrom && token.aliasTo) {
            data.aliases.set(token.aliasFrom, token.aliasTo);
        }
    }

    /**
     * Processes commodity directives
     */
    private handleCommodityDirective(token: HLedgerToken, data: MutableParsedHLedgerData): void {
        if (token.commoditySymbol) {
            const commodity = createCommodityCode(token.commoditySymbol);
            this.addCommodity(commodity, data);
        }
    }

    /**
     * Processes format directives
     */
    private handleFormatDirective(token: HLedgerToken, data: MutableParsedHLedgerData, context: BuildingContext): void {
        if (token.formatPattern) {
            // Store format directive for next commodity directive
            context.pendingFormatDirective = token.formatPattern;
        }
    }

    /**
     * Processes decimal mark directives
     */
    private handleDecimalMarkDirective(token: HLedgerToken, data: MutableParsedHLedgerData): void {
        if (token.decimalMark) {
            data.decimalMark = token.decimalMark;
        }
    }

    /**
     * Processes default commodity directives
     */
    private handleDefaultCommodityDirective(token: HLedgerToken, data: MutableParsedHLedgerData): void {
        if (token.commodity) {
            data.defaultCommodity = token.commodity;
            this.addCommodity(token.commodity, data);
        }
    }

    /**
     * Processes account directives
     */
    private handleAccountDirective(token: HLedgerToken, data: MutableParsedHLedgerData): void {
        if (token.account) {
            data.definedAccounts.add(token.account);
            this.addAccount(token.account, data);
        }
    }

    /**
     * Processes payee directives
     */
    private handlePayeeDirective(token: HLedgerToken, data: MutableParsedHLedgerData): void {
        if (token.payee) {
            this.addPayee(token.payee, data);
        }
    }

    /**
     * Processes tag directives
     */
    private handleTagDirective(token: HLedgerToken, data: MutableParsedHLedgerData): void {
        if (token.tagName) {
            this.addTag(token.tagName, data);
        }
    }

    /**
     * Processes tags and their values
     */
    private processTags(tags: Map<TagName, Set<TagValue>>, data: MutableParsedHLedgerData): void {
        for (const [tagName, values] of tags) {
            this.addTag(tagName, data);

            // Process tag values
            if (!data.tagValues.has(tagName)) {
                data.tagValues.set(tagName, new Set());
            }
            const valueSet = data.tagValues.get(tagName)!;

            for (const value of values) {
                valueSet.add(value);

                // Update usage tracking
                const key = `${tagName}:${value}`;
                const currentCount = data.tagValueUsage.get(key) || createUsageCount(0);
                data.tagValueUsage.set(key, createUsageCount(currentCount + 1));
            }
        }
    }

    /**
     * Adds an account to the data structures with usage tracking
     */
    private addAccount(account: AccountName, data: MutableParsedHLedgerData): void {
        data.accounts.add(account);
        data.usedAccounts.add(account);

        const currentCount = data.accountUsage.get(account) || createUsageCount(0);
        data.accountUsage.set(account, createUsageCount(currentCount + 1));
    }

    /**
     * Adds a payee to the data structures with usage tracking
     */
    private addPayee(payee: PayeeName, data: MutableParsedHLedgerData): void {
        data.payees.add(payee);

        const currentCount = data.payeeUsage.get(payee) || createUsageCount(0);
        data.payeeUsage.set(payee, createUsageCount(currentCount + 1));
    }

    /**
     * Adds a tag to the data structures with usage tracking
     */
    private addTag(tag: TagName, data: MutableParsedHLedgerData): void {
        data.tags.add(tag);

        const currentCount = data.tagUsage.get(tag) || createUsageCount(0);
        data.tagUsage.set(tag, createUsageCount(currentCount + 1));
    }

    /**
     * Adds a commodity to the data structures with usage tracking and format detection
     */
    private addCommodity(commodity: CommodityCode, data: MutableParsedHLedgerData): void {
        data.commodities.add(commodity);

        const currentCount = data.commodityUsage.get(commodity) || createUsageCount(0);
        data.commodityUsage.set(commodity, createUsageCount(currentCount + 1));

        // Auto-detect format if not already present
        if (!data.commodityFormats.has(commodity)) {
            // Create a basic commodity format for this commodity
            const basicFormat: CommodityFormat = {
                format: {
                    decimalMark: '.',
                    groupSeparator: ',',
                    decimalPlaces: 2,
                    useGrouping: true
                },
                symbol: commodity,
                symbolBefore: false,
                symbolSpacing: true,
                template: ''
            };
            data.commodityFormats.set(commodity, basicFormat);
        }
    }

    /**
     * Merges data from another parsed data structure
     */
    public mergeData(target: MutableParsedHLedgerData, source: ParsedHLedgerData): void {
        // Merge sets
        source.accounts.forEach(acc => target.accounts.add(acc));
        source.definedAccounts.forEach(acc => target.definedAccounts.add(acc));
        source.usedAccounts.forEach(acc => target.usedAccounts.add(acc));
        source.payees.forEach(payee => target.payees.add(payee));
        source.tags.forEach(tag => target.tags.add(tag));
        source.commodities.forEach(comm => target.commodities.add(comm));

        // Merge maps
        source.aliases.forEach((value, key) => target.aliases.set(key, value));
        source.commodityFormats.forEach((format, comm) => target.commodityFormats.set(comm, format));

        // Merge tag values
        source.tagValues.forEach((values, tag) => {
            if (!target.tagValues.has(tag)) {
                target.tagValues.set(tag, new Set());
            }
            const targetValues = target.tagValues.get(tag)!;
            values.forEach(value => targetValues.add(value));
        });

        // Merge usage data
        this.mergeUsageData(target.accountUsage, source.accountUsage);
        this.mergeUsageData(target.payeeUsage, source.payeeUsage);
        this.mergeUsageData(target.tagUsage, source.tagUsage);
        this.mergeUsageData(target.commodityUsage, source.commodityUsage);
        this.mergeUsageData(target.tagValueUsage, source.tagValueUsage);

        // Update other properties
        if (source.defaultCommodity && !target.defaultCommodity) {
            target.defaultCommodity = source.defaultCommodity;
        }
        if (source.decimalMark && !target.decimalMark) {
            target.decimalMark = source.decimalMark;
        }
        if (source.lastDate && (!target.lastDate || source.lastDate > target.lastDate)) {
            target.lastDate = source.lastDate;
        }
    }

    /**
     * Helper method to merge usage data
     */
    private mergeUsageData(target: Map<any, UsageCount>, source: ReadonlyMap<any, UsageCount>): void {
        source.forEach((sourceCount, key) => {
            const targetCount = target.get(key) || createUsageCount(0);
            target.set(key, createUsageCount(targetCount + sourceCount));
        });
    }

    /**
     * Creates empty mutable data structure
     */
    private createEmptyData(): MutableParsedHLedgerData {
        return {
            accounts: new Set(),
            definedAccounts: new Set(),
            usedAccounts: new Set(),
            payees: new Set(),
            tags: new Set(),
            commodities: new Set(),
            aliases: new Map(),
            tagValues: new Map(),
            tagValueUsage: new Map(),
            accountUsage: new Map(),
            payeeUsage: new Map(),
            tagUsage: new Map(),
            commodityUsage: new Map(),
            commodityFormats: new Map(),
            decimalMark: null,
            defaultCommodity: null,
            lastDate: null
        };
    }

    /**
     * Converts mutable data to readonly interface
     */
    private toReadonly(data: MutableParsedHLedgerData): ParsedHLedgerData {
        return {
            accounts: data.accounts,
            definedAccounts: data.definedAccounts,
            usedAccounts: data.usedAccounts,
            payees: data.payees,
            tags: data.tags,
            commodities: data.commodities,
            aliases: data.aliases,
            tagValues: data.tagValues,
            tagValueUsage: data.tagValueUsage,
            accountUsage: data.accountUsage,
            payeeUsage: data.payeeUsage,
            tagUsage: data.tagUsage,
            commodityUsage: data.commodityUsage,
            commodityFormats: data.commodityFormats,
            decimalMark: data.decimalMark,
            defaultCommodity: data.defaultCommodity,
            lastDate: data.lastDate
        };
    }
}