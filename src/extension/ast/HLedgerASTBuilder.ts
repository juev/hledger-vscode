// HLedgerASTBuilder.ts - Abstract Syntax Tree builder for hledger files
// Handles construction of data structures from tokens

import {
    AccountName, PayeeName, TagName, TagValue, CommodityCode, UsageCount,
    TemplatePosting, TransactionTemplate, TemplateKey,
    createPayeeName, createCommodityCode, createUsageCount
} from '../types';
import { NumberFormatService, CommodityFormat } from '../services/NumberFormatService';
import { HLedgerToken, TokenType } from '../lexer/HLedgerLexer';

/**
 * Mutable interface for transaction template during AST construction.
 * Allows updating amounts and usage counts as transactions are processed.
 */
interface MutableTransactionTemplate {
    payee: PayeeName;
    postings: TemplatePosting[];
    usageCount: UsageCount;
    lastUsedDate: string | null;
}

/**
 * Maximum number of different account combinations to store per payee.
 * Keeps only the most frequently used templates.
 */
const MAX_TEMPLATES_PER_PAYEE = 5;

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

    // Payee-to-account mappings for import history
    payeeAccounts: Map<PayeeName, Set<AccountName>>;
    payeeAccountPairUsage: Map<string, UsageCount>;

    // Transaction templates for autocomplete
    transactionTemplates: Map<PayeeName, Map<TemplateKey, MutableTransactionTemplate>>;

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

    // Payee-to-account mappings for import history
    readonly payeeAccounts: ReadonlyMap<PayeeName, ReadonlySet<AccountName>>;
    readonly payeeAccountPairUsage: ReadonlyMap<string, UsageCount>;

    // Transaction templates for autocomplete
    readonly transactionTemplates: ReadonlyMap<PayeeName, ReadonlyMap<TemplateKey, TransactionTemplate>>;

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
    currentTransactionPostings: TemplatePosting[];
    currentTransactionDate: string | null;
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
            lastDate: null,
            currentTransactionPostings: [],
            currentTransactionDate: null
        };

        for (const token of tokens) {
            this.processToken(token, data, context);
        }

        // Finalize the last transaction if any
        this.finalizeTransaction(data, context);

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
        // Finalize previous transaction before starting a new one
        this.finalizeTransaction(data, context);

        if (token.payee) {
            this.addPayee(token.payee, data);
        }

        // Process tags from transaction
        if (token.tags) {
            this.processTags(token.tags, data);
        }

        // Update context for new transaction
        context.inTransaction = true;
        context.transactionPayee = token.payee || createPayeeName('Unknown');
        context.currentTransactionPostings = [];

        // Extract date from transaction line (support both full and short date formats)
        const dateMatch = token.trimmedLine.match(/^(\d{4}[-\/\.]\d{1,2}[-\/\.]\d{1,2}|\d{1,2}[-\/\.]\d{1,2})/);
        if (dateMatch?.[1]) {
            context.lastDate = dateMatch[1];
            context.currentTransactionDate = dateMatch[1];
            data.lastDate = dateMatch[1];
        }
    }

    /**
     * Processes posting tokens
     */
    private handlePostingToken(token: HLedgerToken, data: MutableParsedHLedgerData, context: BuildingContext): void {
        if (token.account) {
            this.addAccount(token.account, data);

            // Track payee-account relationship for import history
            if (context.inTransaction && context.transactionPayee) {
                this.addPayeeAccountMapping(context.transactionPayee, token.account, data);
            }

            // Accumulate posting for transaction template
            if (context.inTransaction) {
                context.currentTransactionPostings.push({
                    account: token.account,
                    amount: token.amount || null,
                    commodity: token.commodity || null
                });
            }
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
            const valueSet = data.tagValues.get(tagName);
            if (!valueSet) {
                continue;
            }

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
     * Adds an account to the data structures with usage tracking.
     * Filters out incomplete accounts (ending with colon or empty).
     */
    private addAccount(account: AccountName, data: MutableParsedHLedgerData): void {
        // Filter out incomplete accounts:
        // - Empty account names
        // - Names ending with colon (user still typing)
        // - Names that are just whitespace
        const trimmed = account.trim();
        if (!trimmed || trimmed.endsWith(':')) {
            return;
        }

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
     * Finalizes the current transaction and creates/updates template.
     * Called when a new transaction starts or at end of token processing.
     */
    private finalizeTransaction(data: MutableParsedHLedgerData, context: BuildingContext): void {
        // Skip if not in a transaction or fewer than 2 postings
        if (!context.inTransaction || context.currentTransactionPostings.length < 2) {
            context.inTransaction = false;
            context.currentTransactionPostings = [];
            context.currentTransactionDate = null;
            return;
        }

        const normalizedPayee = context.transactionPayee.normalize('NFC') as PayeeName;

        // Generate template key from sorted account names
        const accountNames = context.currentTransactionPostings
            .map(p => p.account)
            .sort()
            .join('|') as TemplateKey;

        // Get or create payee's template map
        if (!data.transactionTemplates.has(normalizedPayee)) {
            data.transactionTemplates.set(normalizedPayee, new Map());
        }
        const payeeTemplates = data.transactionTemplates.get(normalizedPayee)!;

        // Update existing template or create new one
        const existingTemplate = payeeTemplates.get(accountNames);
        if (existingTemplate) {
            // Update usage count
            existingTemplate.usageCount = createUsageCount(existingTemplate.usageCount + 1);
            existingTemplate.lastUsedDate = context.currentTransactionDate;

            // Update amounts with latest values
            existingTemplate.postings = context.currentTransactionPostings.map(posting => ({
                account: posting.account,
                amount: posting.amount,
                commodity: posting.commodity
            }));
        } else {
            // Create new template
            const newTemplate: MutableTransactionTemplate = {
                payee: normalizedPayee,
                postings: context.currentTransactionPostings.map(posting => ({
                    account: posting.account,
                    amount: posting.amount,
                    commodity: posting.commodity
                })),
                usageCount: createUsageCount(1),
                lastUsedDate: context.currentTransactionDate
            };
            payeeTemplates.set(accountNames, newTemplate);

            // Enforce MAX_TEMPLATES_PER_PAYEE limit
            if (payeeTemplates.size > MAX_TEMPLATES_PER_PAYEE) {
                this.pruneTemplates(payeeTemplates);
            }
        }

        // Reset context for next transaction
        context.inTransaction = false;
        context.currentTransactionPostings = [];
        context.currentTransactionDate = null;
    }

    /**
     * Removes least frequently used templates to maintain limit.
     */
    private pruneTemplates(templates: Map<TemplateKey, MutableTransactionTemplate>): void {
        const entries = Array.from(templates.entries())
            .sort((a, b) => a[1].usageCount - b[1].usageCount);

        while (templates.size > MAX_TEMPLATES_PER_PAYEE && entries.length > 0) {
            const lowestEntry = entries.shift();
            if (lowestEntry) {
                templates.delete(lowestEntry[0]);
            }
        }
    }

    /**
     * Adds a payee-account mapping for import history tracking.
     * Uses double-colon separator to avoid conflicts with account names containing colons.
     */
    private addPayeeAccountMapping(
        payee: PayeeName,
        account: AccountName,
        data: MutableParsedHLedgerData
    ): void {
        // Normalize payee for consistent matching
        const normalizedPayee = payee.normalize('NFC') as PayeeName;

        // Add account to payee's account set
        if (!data.payeeAccounts.has(normalizedPayee)) {
            data.payeeAccounts.set(normalizedPayee, new Set<AccountName>());
        }
        data.payeeAccounts.get(normalizedPayee)!.add(account);

        // Increment usage count for this payee-account pair
        const pairKey = `${normalizedPayee}::${account}`;
        const currentCount = data.payeeAccountPairUsage.get(pairKey) || createUsageCount(0);
        data.payeeAccountPairUsage.set(pairKey, createUsageCount(currentCount + 1));
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
            const targetValues = target.tagValues.get(tag);
            if (targetValues) {
                values.forEach(value => targetValues.add(value));
            }
        });

        // Merge usage data
        this.mergeUsageData(target.accountUsage, source.accountUsage);
        this.mergeUsageData(target.payeeUsage, source.payeeUsage);
        this.mergeUsageData(target.tagUsage, source.tagUsage);
        this.mergeUsageData(target.commodityUsage, source.commodityUsage);
        this.mergeUsageData(target.tagValueUsage, source.tagValueUsage);

        // Merge payee-account history
        source.payeeAccounts.forEach((accounts, payee) => {
            if (!target.payeeAccounts.has(payee)) {
                target.payeeAccounts.set(payee, new Set());
            }
            const targetAccounts = target.payeeAccounts.get(payee);
            if (targetAccounts) {
                accounts.forEach(account => targetAccounts.add(account));
            }
        });
        this.mergeUsageData(target.payeeAccountPairUsage, source.payeeAccountPairUsage);

        // Merge transaction templates
        source.transactionTemplates.forEach((sourceTemplates, payee) => {
            if (!target.transactionTemplates.has(payee)) {
                target.transactionTemplates.set(payee, new Map());
            }
            const targetTemplates = target.transactionTemplates.get(payee)!;

            sourceTemplates.forEach((template, key) => {
                const existingTemplate = targetTemplates.get(key);
                if (existingTemplate) {
                    // Combine usage counts, keep newer amounts
                    existingTemplate.usageCount = createUsageCount(existingTemplate.usageCount + template.usageCount);
                    if (template.lastUsedDate && (!existingTemplate.lastUsedDate || template.lastUsedDate > existingTemplate.lastUsedDate)) {
                        existingTemplate.lastUsedDate = template.lastUsedDate;
                        existingTemplate.postings = [...template.postings];
                    }
                } else {
                    targetTemplates.set(key, {
                        payee: template.payee,
                        postings: [...template.postings],
                        usageCount: template.usageCount,
                        lastUsedDate: template.lastUsedDate
                    });
                }
            });

            // Enforce MAX_TEMPLATES_PER_PAYEE after merge
            if (targetTemplates.size > MAX_TEMPLATES_PER_PAYEE) {
                this.pruneTemplates(targetTemplates);
            }
        });

        // Update other properties
        if (source.defaultCommodity && !target.defaultCommodity) {
            target.defaultCommodity = source.defaultCommodity;
        }
        if (source.decimalMark && !target.decimalMark) {
            target.decimalMark = source.decimalMark;
        }
        if (source.lastDate) {
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
            payeeAccounts: new Map(),
            payeeAccountPairUsage: new Map(),
            transactionTemplates: new Map(),
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
            payeeAccounts: data.payeeAccounts,
            payeeAccountPairUsage: data.payeeAccountPairUsage,
            transactionTemplates: data.transactionTemplates,
            commodityFormats: data.commodityFormats,
            decimalMark: data.decimalMark,
            defaultCommodity: data.defaultCommodity,
            lastDate: data.lastDate
        };
    }

    /**
     * Creates a mutable copy from readonly data for merging.
     * Used by tests and for data aggregation across files.
     */
    public createMutableFromReadonly(data: ParsedHLedgerData): MutableParsedHLedgerData {
        // Deep clone transaction templates
        const clonedTemplates = new Map<PayeeName, Map<TemplateKey, MutableTransactionTemplate>>();
        data.transactionTemplates.forEach((templates, payee) => {
            const clonedInner = new Map<TemplateKey, MutableTransactionTemplate>();
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

        return {
            accounts: new Set(data.accounts),
            definedAccounts: new Set(data.definedAccounts),
            usedAccounts: new Set(data.usedAccounts),
            payees: new Set(data.payees),
            tags: new Set(data.tags),
            commodities: new Set(data.commodities),
            aliases: new Map(data.aliases),
            tagValues: new Map(Array.from(data.tagValues.entries()).map(([k, v]) => [k, new Set(v)])),
            tagValueUsage: new Map(data.tagValueUsage),
            accountUsage: new Map(data.accountUsage),
            payeeUsage: new Map(data.payeeUsage),
            tagUsage: new Map(data.tagUsage),
            commodityUsage: new Map(data.commodityUsage),
            payeeAccounts: new Map(Array.from(data.payeeAccounts.entries()).map(([k, v]) => [k, new Set(v)])),
            payeeAccountPairUsage: new Map(data.payeeAccountPairUsage),
            transactionTemplates: clonedTemplates,
            commodityFormats: new Map(data.commodityFormats),
            decimalMark: data.decimalMark,
            defaultCommodity: data.defaultCommodity,
            lastDate: data.lastDate
        };
    }

    /**
     * Converts mutable data back to readonly.
     * Public wrapper for toReadonly for use by tests.
     */
    public toReadonlyData(data: MutableParsedHLedgerData): ParsedHLedgerData {
        return this.toReadonly(data);
    }
}