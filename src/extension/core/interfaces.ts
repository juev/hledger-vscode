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
    parseFile(filePath: string): ParsedHLedgerData;
    
    /**
     * Parse hledger content from string
     * @param content - Raw hledger content
     * @param basePath - Base path for resolving includes
     * @returns Parsed data structure
     */
    parseContent(content: string, basePath?: string): ParsedHLedgerData;
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
    parseFileAsync(filePath: string, options?: AsyncParseOptions): Promise<ParsedHLedgerData>;
    
    /**
     * Parse hledger content asynchronously from string
     * @param content - Raw hledger content
     * @param basePath - Base path for resolving includes
     * @param options - Async parsing options
     * @returns Promise of parsed data structure
     */
    parseContentAsync(content: string, basePath?: string, options?: AsyncParseOptions): Promise<ParsedHLedgerData>;
    
    /**
     * Parse multiple files asynchronously with controlled concurrency
     * @param filePaths - Array of file paths to parse
     * @param options - Async parsing options
     * @returns Promise of combined parsed data
     */
    parseFilesAsync(filePaths: string[], options?: AsyncParseOptions): Promise<ParsedHLedgerData>;
    
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
 * Interface for storing and retrieving HLedger data
 * Responsible for managing all parsed data in memory
 */
export interface IDataStore {
    // === Data Management ===
    
    /**
     * Add an account to the store
     */
    addAccount(account: string): void;
    
    /**
     * Add a defined account (from account directive)
     */
    addDefinedAccount(account: string): void;
    
    /**
     * Add a used account (from transactions)
     */
    addUsedAccount(account: string): void;
    
    /**
     * Add a payee to the store
     */
    addPayee(payee: string): void;
    
    /**
     * Add a tag to the store
     */
    addTag(tag: string): void;
    
    /**
     * Add a commodity to the store
     */
    addCommodity(commodity: string): void;
    
    /**
     * Set an account alias
     */
    setAlias(alias: string, target: string): void;
    
    /**
     * Set the default commodity
     */
    setDefaultCommodity(commodity: string): void;
    
    /**
     * Set the last transaction date
     */
    setLastDate(date: string): void;
    
    // === Data Retrieval ===
    
    /**
     * Get all accounts (defined + used)
     */
    getAccounts(): string[];
    
    /**
     * Get only defined accounts
     */
    getDefinedAccounts(): string[];
    
    /**
     * Get only used accounts
     */
    getUsedAccounts(): string[];
    
    /**
     * Get undefined accounts (used but not defined)
     */
    getUndefinedAccounts(): string[];
    
    /**
     * Get all payees
     */
    getPayees(): string[];
    
    /**
     * Get all tags
     */
    getTags(): string[];
    
    /**
     * Get all commodities
     */
    getCommodities(): string[];
    
    /**
     * Get all aliases as a Map
     */
    getAliases(): Map<string, string>;
    
    /**
     * Get the default commodity
     */
    getDefaultCommodity(): string | null;
    
    /**
     * Get the last transaction date
     */
    getLastDate(): string | null;
    
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
 * Interface for tracking usage frequency statistics
 * Responsible for maintaining usage counters for prioritization
 */
export interface IUsageTracker {
    // === Usage Tracking ===
    
    /**
     * Increment usage count for an account
     */
    incrementAccountUsage(account: string): void;
    
    /**
     * Increment usage count for a payee
     */
    incrementPayeeUsage(payee: string): void;
    
    /**
     * Increment usage count for a tag
     */
    incrementTagUsage(tag: string): void;
    
    /**
     * Increment usage count for a commodity
     */
    incrementCommodityUsage(commodity: string): void;
    
    // === Sorted Results ===
    
    /**
     * Get accounts sorted by usage frequency (most used first)
     */
    getAccountsByUsage(): Array<{account: string, count: number}>;
    
    /**
     * Get payees sorted by usage frequency (most used first)
     */
    getPayeesByUsage(): Array<{payee: string, count: number}>;
    
    /**
     * Get tags sorted by usage frequency (most used first)
     */
    getTagsByUsage(): Array<{tag: string, count: number}>;
    
    /**
     * Get commodities sorted by usage frequency (most used first)
     */
    getCommoditiesByUsage(): Array<{commodity: string, count: number}>;
    
    // === Individual Usage Retrieval ===
    
    /**
     * Get usage count for a specific account
     */
    getAccountUsage(account: string): number;
    
    /**
     * Get usage count for a specific payee
     */
    getPayeeUsage(payee: string): number;
    
    /**
     * Get usage count for a specific tag
     */
    getTagUsage(tag: string): number;
    
    /**
     * Get usage count for a specific commodity
     */
    getCommodityUsage(commodity: string): number;
    
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
    findHLedgerFiles(dir: string, recursive?: boolean): string[];
    
    /**
     * Scan workspace for hledger files
     * @param workspacePath - Workspace root path
     * @returns Array of file paths
     */
    scanWorkspace(workspacePath: string): string[];
}

/**
 * Data structure returned by parser containing all extracted information
 */
export interface ParsedHLedgerData {
    /** All accounts (union of defined and used) */
    accounts: Set<string>;
    
    /** Accounts defined with 'account' directive */
    definedAccounts: Set<string>;
    
    /** Accounts used in transactions */
    usedAccounts: Set<string>;
    
    /** Payees extracted from transaction descriptions */
    payees: Set<string>;
    
    /** Tags extracted from comments */
    tags: Set<string>;
    
    /** Commodities (currencies) found */
    commodities: Set<string>;
    
    /** Account aliases */
    aliases: Map<string, string>;
    
    /** Default commodity from 'D' directive */
    defaultCommodity: string | null;
    
    /** Last transaction date encountered */
    lastDate: string | null;
    
    /** Usage statistics for accounts */
    accountUsage: Map<string, number>;
    
    /** Usage statistics for payees */
    payeeUsage: Map<string, number>;
    
    /** Usage statistics for tags */
    tagUsage: Map<string, number>;
    
    /** Usage statistics for commodities */
    commodityUsage: Map<string, number>;
}

/**
 * Configuration manager interface that coordinates all components
 * This replaces the old IHLedgerConfig interface
 */
export interface IConfigManager {
    // === File Operations ===
    
    /**
     * Parse a file and update internal state
     */
    parseFile(filePath: string): void;
    
    /**
     * Parse content and update internal state
     */
    parseContent(content: string, basePath?: string): void;
    
    /**
     * Scan workspace for files and parse them
     */
    scanWorkspace(workspacePath: string): void;
    
    // === Data Access Methods (for backward compatibility) ===
    
    getAccounts(): string[];
    getDefinedAccounts(): string[];
    getUsedAccounts(): string[];
    getUndefinedAccounts(): string[];
    getPayees(): string[];
    getTags(): string[];
    getCommodities(): string[];
    getAliases(): Map<string, string>;
    getDefaultCommodity(): string | null;
    getLastDate(): string | null;
    
    // === Usage-Based Methods ===
    
    getAccountsByUsage(): Array<{account: string, count: number}>;
    getPayeesByUsage(): Array<{payee: string, count: number}>;
    getTagsByUsage(): Array<{tag: string, count: number}>;
    getCommoditiesByUsage(): Array<{commodity: string, count: number}>;
    
    // === Legacy Properties (for backward compatibility) ===
    
    /** @deprecated Use getAccounts() instead */
    readonly accounts: Set<string>;
    
    /** @deprecated Use getDefinedAccounts() instead */
    readonly definedAccounts: Set<string>;
    
    /** @deprecated Use getUsedAccounts() instead */
    readonly usedAccounts: Set<string>;
    
    /** @deprecated Use getPayees() instead */
    readonly payees: Set<string>;
    
    /** @deprecated Use getTags() instead */
    readonly tags: Set<string>;
    
    /** @deprecated Use getCommodities() instead */
    readonly commodities: Set<string>;
    
    /** @deprecated Use getAliases() instead */
    readonly aliases: Map<string, string>;
    
    /** @deprecated Use getDefaultCommodity() instead */
    readonly defaultCommodity: string | null;
    
    /** @deprecated Use getLastDate() instead */
    readonly lastDate: string | null;
    
    /** @deprecated Internal usage tracking - use getAccountsByUsage() instead */
    readonly accountUsageCount: Map<string, number>;
    
    /** @deprecated Internal usage tracking - use getPayeesByUsage() instead */
    readonly payeeUsageCount: Map<string, number>;
    
    /** @deprecated Internal usage tracking - use getTagsByUsage() instead */
    readonly tagUsageCount: Map<string, number>;
    
    /** @deprecated Internal usage tracking - use getCommoditiesByUsage() instead */
    readonly commodityUsageCount: Map<string, number>;
}