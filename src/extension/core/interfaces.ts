import {
    AccountName,
    PayeeName,
    CommodityName,
    TagName,
    TagEntry,
    DateString,
    FilePath,
    AccountAlias,
    HLedgerKeyword,
    WorkspacePath,
    CacheKey,
    CacheValue
} from './BrandedTypes';

/** Forward declaration for AsyncParseOptions */
interface AsyncParseOptions {
    chunkSize?: number;
    yieldEvery?: number;
    maxFileSize?: number;
    enableCache?: boolean;
    timeout?: number;
}

/**
 * Interface for parsing HLedger files and content
 * Responsible for extracting structured data from hledger files
 */
export interface IHLedgerParser {
    /**
     * Parse a file from filesystem
     * @param filePath - Path to the hledger file
     * @returns Parsed data structure
     */
    parseFile(filePath: FilePath): ParsedHLedgerData;
    
    /**
     * Parse hledger content from string
     * @param content - Raw hledger content
     * @param basePath - Base path for resolving includes
     * @returns Parsed data structure
     */
    parseContent(content: string, basePath?: FilePath): ParsedHLedgerData;
}

/**
 * Extended interface for asynchronous HLedger parsing
 * Adds async methods for better performance with large files
 */
export interface IAsyncHLedgerParser extends IHLedgerParser {
    /**
     * Parse a file asynchronously from filesystem
     * @param filePath - Path to the hledger file
     * @param options - Async parsing options
     * @returns Promise of parsed data structure
     */
    parseFileAsync(filePath: FilePath, options?: AsyncParseOptions): Promise<ParsedHLedgerData>;
    
    /**
     * Parse hledger content asynchronously from string
     * @param content - Raw hledger content
     * @param basePath - Base path for resolving includes
     * @param options - Async parsing options
     * @returns Promise of parsed data structure
     */
    parseContentAsync(content: string, basePath?: FilePath, options?: AsyncParseOptions): Promise<ParsedHLedgerData>;
    
    /**
     * Parse multiple files asynchronously with controlled concurrency
     * @param filePaths - Array of file paths to parse
     * @param options - Async parsing options
     * @returns Promise of combined parsed data
     */
    parseFilesAsync(filePaths: FilePath[], options?: AsyncParseOptions): Promise<ParsedHLedgerData>;
    
    /**
     * Clear internal caches
     */
    clearCache(): void;
    
    /**
     * Get cache statistics
     */
    getCacheStats(): { size: number; entries: string[] };
}

/**
 * Interface for accessing internal data store properties
 * Used for backward compatibility with legacy property access
 */
export interface IDataStoreInternal {
    readonly accounts: Set<AccountName>;
    readonly definedAccounts: Set<AccountName>;
    readonly usedAccounts: Set<AccountName>;
    readonly payees: Set<PayeeName>;
    readonly tags: Set<TagEntry>;
    readonly commodities: Set<CommodityName>;
    readonly aliases: Map<AccountAlias, AccountName>;
    readonly defaultCommodity: CommodityName | null;
    readonly lastDate: DateString | null;
}

/**
 * Interface for storing and retrieving HLedger data
 * Responsible for managing all parsed data in memory
 */
export interface IDataStore extends IDataStoreInternal {
    // === Data Management ===
    
    /**
     * Add an account to the store
     */
    addAccount(account: AccountName): void;
    
    /**
     * Add a defined account (from account directive)
     */
    addDefinedAccount(account: AccountName): void;
    
    /**
     * Add a used account (from transactions)
     */
    addUsedAccount(account: AccountName): void;
    
    /**
     * Add a payee to the store
     */
    addPayee(payee: PayeeName): void;
    
    /**
     * Add a tag to the store
     */
    addTag(tag: TagEntry): void;
    
    /**
     * Add a commodity to the store
     */
    addCommodity(commodity: CommodityName): void;
    
    /**
     * Set an account alias
     */
    setAlias(alias: AccountAlias, target: AccountName): void;
    
    /**
     * Set the default commodity
     */
    setDefaultCommodity(commodity: CommodityName): void;
    
    /**
     * Set the last transaction date
     */
    setLastDate(date: DateString): void;
    
    // === Data Retrieval ===
    
    /**
     * Get all accounts (defined + used)
     */
    getAccounts(): AccountName[];
    
    /**
     * Get only defined accounts
     */
    getDefinedAccounts(): AccountName[];
    
    /**
     * Get only used accounts
     */
    getUsedAccounts(): AccountName[];
    
    /**
     * Get undefined accounts (used but not defined)
     */
    getUndefinedAccounts(): AccountName[];
    
    /**
     * Get all payees
     */
    getPayees(): PayeeName[];
    
    /**
     * Get all tags
     */
    getTags(): TagEntry[];
    
    /**
     * Get all commodities
     */
    getCommodities(): CommodityName[];
    
    /**
     * Get all aliases as a Map
     */
    getAliases(): Map<AccountAlias, AccountName>;
    
    /**
     * Get the default commodity
     */
    getDefaultCommodity(): CommodityName | null;
    
    /**
     * Get the last transaction date
     */
    getLastDate(): DateString | null;
    
    // === Tag Value Methods ===
    
    /**
     * Get tag values for a specific tag name
     */
    getTagValues(tagName: string): string[];
    
    /**
     * Add a tag value for a specific tag name
     */
    addTagValue(tagName: string, value: string): void;
    
    // === Utility ===
    
    /**
     * Clear all stored data
     */
    clear(): void;
    
    /**
     * Merge data from another data store
     */
    merge(other: IDataStore): void;
}

/**
 * Interface for accessing internal usage tracker properties
 * Used for backward compatibility with legacy property access
 */
export interface IUsageTrackerInternal {
    readonly accountUsageCount: Map<AccountName, number>;
    readonly payeeUsageCount: Map<PayeeName, number>;
    readonly tagUsageCount: Map<TagEntry, number>;
    readonly commodityUsageCount: Map<CommodityName, number>;
}

/**
 * Interface for tracking usage frequency statistics
 * Responsible for maintaining usage counters for prioritization
 */
export interface IUsageTracker extends IUsageTrackerInternal {
    // === Usage Tracking ===
    
    /**
     * Increment usage count for an account
     */
    incrementAccountUsage(account: AccountName): void;
    
    /**
     * Increment usage count for a payee
     */
    incrementPayeeUsage(payee: PayeeName): void;
    
    /**
     * Increment usage count for a tag
     */
    incrementTagUsage(tag: TagEntry): void;
    
    /**
     * Increment usage count for a commodity
     */
    incrementCommodityUsage(commodity: CommodityName): void;
    
    // === Sorted Results ===
    
    /**
     * Get accounts sorted by usage frequency (most used first)
     */
    getAccountsByUsage(): Array<{account: AccountName, count: number}>;
    
    /**
     * Get payees sorted by usage frequency (most used first)
     */
    getPayeesByUsage(): Array<{payee: PayeeName, count: number}>;
    
    /**
     * Get tags sorted by usage frequency (most used first)
     */
    getTagsByUsage(): Array<{tag: TagEntry, count: number}>;
    
    /**
     * Get commodities sorted by usage frequency (most used first)
     */
    getCommoditiesByUsage(): Array<{commodity: CommodityName, count: number}>;
    
    // === Tag Value Methods ===
    
    /**
     * Get tag values for a specific tag name
     */
    getTagValues(tagName: string): string[];
    
    /**
     * Get tag values sorted by last usage time (most recent first) for a specific tag name
     */
    getTagValuesByLastUsed(tagName: string): Array<{value: string, count: number}>;
    
    /**
     * Add a tag value for a specific tag name
     */
    addTagValue(tagName: string, value: string): void;
    
    /**
     * Increment usage count for a specific tag value
     */
    incrementTagValueUsage(tagName: string, value: string): void;
    
    // === Individual Usage Retrieval ===
    
    /**
     * Get usage count for a specific account
     */
    getAccountUsage(account: AccountName): number;
    
    /**
     * Get usage count for a specific payee
     */
    getPayeeUsage(payee: PayeeName): number;
    
    /**
     * Get usage count for a specific tag
     */
    getTagUsage(tag: TagEntry): number;
    
    /**
     * Get usage count for a specific commodity
     */
    getCommodityUsage(commodity: CommodityName): number;
    
    // === Utility ===
    
    /**
     * Clear all usage statistics
     */
    clear(): void;
    
    /**
     * Merge usage statistics from another tracker
     */
    merge(other: IUsageTracker): void;
}

/**
 * Interface for scanning filesystem for hledger files
 * Responsible for finding and listing hledger files
 */
export interface IFileScanner {
    /**
     * Find hledger files in a directory
     * @param dir - Directory to search
     * @param recursive - Whether to search recursively
     * @returns Array of file paths
     */
    findHLedgerFiles(dir: FilePath, recursive?: boolean): FilePath[];
    
    /**
     * Scan workspace for hledger files
     * @param workspacePath - Workspace root path
     * @returns Array of file paths
     */
    scanWorkspace(workspacePath: WorkspacePath): FilePath[];
}

/**
 * Data structure returned by parser containing all extracted information
 */
export interface ParsedHLedgerData {
    /** All accounts (union of defined and used) */
    accounts: Set<AccountName>;
    
    /** Accounts defined with 'account' directive */
    definedAccounts: Set<AccountName>;
    
    /** Accounts used in transactions */
    usedAccounts: Set<AccountName>;
    
    /** Payees extracted from transaction descriptions */
    payees: Set<PayeeName>;
    
    /** Tags extracted from comments */
    tags: Set<TagEntry>;
    
    /** Commodities (currencies) found */
    commodities: Set<CommodityName>;
    
    /** Account aliases */
    aliases: Map<AccountAlias, AccountName>;
    
    /** Default commodity from 'D' directive */
    defaultCommodity: CommodityName | null;
    
    /** Last transaction date encountered */
    lastDate: DateString | null;
    
    /** Usage statistics for accounts */
    accountUsage: Map<AccountName, number>;
    
    /** Usage statistics for payees */
    payeeUsage: Map<PayeeName, number>;
    
    /** Usage statistics for tags */
    tagUsage: Map<TagEntry, number>;
    
    /** Tag values organized by tag name with usage counts */
    tagValueUsage?: Map<string, Map<string, number>>;
    
    /** Usage statistics for commodities */
    commodityUsage: Map<CommodityName, number>;
}

/**
 * Interface for configuration manager components
 * Used for proper typing of internal components in ConfigManager
 */
export interface IConfigManagerComponents {
    parser: IHLedgerParser;
    dataStore: IDataStore;
    usageTracker: IUsageTracker;
    fileScanner: IFileScanner;
}

/**
 * Interface for objects that have internal components
 * Used for proper typing instead of casting to any
 */
export interface IComponentContainer {
    getComponents(): IConfigManagerComponents;
}

/**
 * Interface for text mate rule objects used in VS Code color customization
 */
export interface ITextMateRule {
    scope?: string;
    settings?: {
        foreground?: string;
        fontStyle?: string;
    };
}

/**
 * Interface for VS Code TextMate customizations
 */
export interface ITextMateCustomizations {
    "[*]"?: {
        textMateRules?: ITextMateRule[];
        [key: string]: unknown;
    };
    [key: string]: unknown;
}

/**
 * Interface for completion limits configuration
 */
export interface ICompletionLimits {
    maxResults: number;
    maxAccountResults: number;
}

/**
 * Interface for fuzzy matcher match results
 */
export interface IFuzzyMatch {
    item: string;
    score: number;
    matches: number[];
}

/**
 * Configuration manager interface that coordinates all components
 * This replaces the old IHLedgerConfig interface
 */
export interface IConfigManager extends IComponentContainer {
    // === File Operations ===
    
    /**
     * Parse a file and update internal state
     */
    parseFile(filePath: FilePath): void;
    
    /**
     * Parse content and update internal state
     */
    parseContent(content: string, basePath?: FilePath): void;
    
    /**
     * Scan workspace for files and parse them
     */
    scanWorkspace(workspacePath: WorkspacePath): void;
    
    // === Data Access Methods (for backward compatibility) ===
    
    getAccounts(): AccountName[];
    getDefinedAccounts(): AccountName[];
    getUsedAccounts(): AccountName[];
    getUndefinedAccounts(): AccountName[];
    getPayees(): PayeeName[];
    getTags(): TagEntry[];
    getCommodities(): CommodityName[];
    getAliases(): Map<AccountAlias, AccountName>;
    getDefaultCommodity(): CommodityName | null;
    getLastDate(): DateString | null;
    
    // === Usage-Based Methods ===
    
    getAccountsByUsage(): Array<{account: AccountName, count: number}>;
    getPayeesByUsage(): Array<{payee: PayeeName, count: number}>;
    getTagsByUsage(): Array<{tag: TagEntry, count: number}>;
    getCommoditiesByUsage(): Array<{commodity: CommodityName, count: number}>;
    
    // === Tag Value Methods ===
    
    /**
     * Get tag values for a specific tag name
     */
    getTagValues(tagName: string): string[];
    
    /**
     * Get tag values sorted by last usage time (most recent first) for a specific tag name
     */
    getTagValuesByLastUsed(tagName: string): Array<{value: string, count: number}>;
    
    // === Legacy Properties (for backward compatibility) ===
    
    /** @deprecated Use getAccounts() instead */
    readonly accounts: Set<AccountName>;
    
    /** @deprecated Use getDefinedAccounts() instead */
    readonly definedAccounts: Set<AccountName>;
    
    /** @deprecated Use getUsedAccounts() instead */
    readonly usedAccounts: Set<AccountName>;
    
    /** @deprecated Use getPayees() instead */
    readonly payees: Set<PayeeName>;
    
    /** @deprecated Use getTags() instead */
    readonly tags: Set<TagEntry>;
    
    /** @deprecated Use getCommodities() instead */
    readonly commodities: Set<CommodityName>;
    
    
    /** @deprecated Use getAliases() instead */
    readonly aliases: Map<AccountAlias, AccountName>;
    
    /** @deprecated Use getDefaultCommodity() instead */
    readonly defaultCommodity: CommodityName | null;
    
    /** @deprecated Use getLastDate() instead */
    readonly lastDate: DateString | null;
    
    /** @deprecated Internal usage tracking - use getAccountsByUsage() instead */
    readonly accountUsageCount: Map<AccountName, number>;
    
    /** @deprecated Internal usage tracking - use getPayeesByUsage() instead */
    readonly payeeUsageCount: Map<PayeeName, number>;
    
    /** @deprecated Internal usage tracking - use getTagsByUsage() instead */
    readonly tagUsageCount: Map<TagEntry, number>;
    
    /** @deprecated Internal usage tracking - use getCommoditiesByUsage() instead */
    readonly commodityUsageCount: Map<CommodityName, number>;
}