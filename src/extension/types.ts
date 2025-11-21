// types.ts - Modern types and interfaces with branded types
// Enhanced with type safety and domain modeling

/**
 * Forward declaration for ParsedHLedgerData (imported from HLedgerParser).
 * This avoids circular dependency while maintaining type safety.
 * Represents all parsed data from hledger files with immutable readonly collections.
 */
interface ParsedHLedgerData {
    readonly accounts: ReadonlySet<AccountName>;
    readonly definedAccounts: ReadonlySet<AccountName>;
    readonly usedAccounts: ReadonlySet<AccountName>;
    readonly payees: ReadonlySet<PayeeName>;
    readonly tags: ReadonlySet<TagName>;
    readonly commodities: ReadonlySet<CommodityCode>;
    readonly aliases: ReadonlyMap<AccountName, AccountName>;
    readonly accountUsage: ReadonlyMap<AccountName, UsageCount>;
    readonly payeeUsage: ReadonlyMap<PayeeName, UsageCount>;
    readonly tagUsage: ReadonlyMap<TagName, UsageCount>;
    readonly commodityUsage: ReadonlyMap<CommodityCode, UsageCount>;
    readonly tagValues: ReadonlyMap<TagName, ReadonlySet<TagValue>>;
    readonly tagValueUsage: ReadonlyMap<string, UsageCount>;
    readonly defaultCommodity: CommodityCode | null;
    readonly lastDate: string | null;
}

/**
 * Type aliases for domain modeling.
 * Simple type aliases provide better documentation without the overhead of branded types.
 */

/** Type alias for hledger account names (e.g., 'Assets:Cash', 'Expenses:Food') */
export type AccountName = string;

/** Type alias for transaction payee names (e.g., 'Grocery Store', 'Coffee Shop') */
export type PayeeName = string;

/** Type alias for hledger tag names (e.g., 'category', 'project') */
export type TagName = string;

/** Type alias for hledger tag values (e.g., 'work', 'personal', 'urgent') */
export type TagValue = string;

/** Type alias for commodity codes (e.g., 'USD', 'EUR', '$') */
export type CommodityCode = string;

/** Type alias for file system paths */
export type FilePath = string;

/** Type alias for workspace directory paths */
export type WorkspacePath = string;
export type CompletionScore = number;
export type UsageCount = number;
export type CacheKey = string;
export type LineNumber = number;
export type CharacterPosition = number;
export type DocumentVersion = number;

/**
 * Interface for tag:value pairs used in hledger comments.
 * Represents the relationship between tag names and their associated values.
 */
export interface TagValuePair {
    readonly tag: TagName;
    readonly value: TagValue;
}

// Enhanced completion context interface with type safety
export interface CompletionContext {
    readonly type: CompletionType;
    readonly query: string;
    readonly position?: CompletionPosition;
    readonly document?: DocumentReference | undefined;
    readonly range?: CompletionRange;
    readonly isCaseSensitive?: boolean;
}

/**
 * Range interface for text replacement in completions.
 * Defines the span of text that should be replaced by the completion.
 */
export interface CompletionRange {
    readonly start: CompletionPosition;
    readonly end: CompletionPosition;
}

/**
 * Completion type enumeration for better type safety.
 * Defines all possible completion types in hledger files.
 */
export type CompletionType = 
    | 'account'
    | 'payee' 
    | 'tag'
    | 'tag_value'
    | 'commodity'
    | 'date'
    | 'none'
    | 'keyword';

/**
 * Type guard for CompletionType validation.
 */
export const isCompletionType = (value: string): value is CompletionType => {
    return ['account', 'payee', 'tag', 'tag_value', 'commodity', 'date', 'keyword'].includes(value);
};

/**
 * Position interface for completion context with branded types.
 * Uses branded number types for better type safety.
 */
export interface CompletionPosition {
    readonly line: LineNumber;
    readonly character: CharacterPosition;
}

/**
 * Document reference interface with enhanced type safety.
 * Provides readonly access to document metadata.
 */
export interface DocumentReference {
    readonly uri: FilePath;
    readonly languageId: string;
    readonly version?: DocumentVersion;
}

// Type-safe cache value union for all possible cache values
export type CacheValue = 
    | string
    | number
    | boolean
    | null
    | undefined
    | ParsedHLedgerData
    | Set<AccountName>
    | Set<PayeeName>
    | Set<TagName>
    | Set<TagValue>
    | Set<CommodityCode>
    | Map<string, UsageCount>
    | ReadonlyArray<string>
    | Record<string, unknown>;

/**
 * Enhanced generic cache interface with strong type safety.
 * Uses union type instead of 'any' for better type checking.
 */
export interface ISimpleCache<TKey extends string = CacheKey, TValue extends CacheValue = CacheValue> {
    get(key: TKey): TValue | null;
    set(key: TKey, value: TValue): void;
    has(key: TKey): boolean;
    delete(key: TKey): boolean;
    clear(): void;
    size(): number;
}

/**
 * Enhanced cache interface with TTL and size limits.
 * Extends ISimpleCache with advanced caching features for performance optimization.
 */
export interface IEnhancedCache<TKey extends string = CacheKey, TValue extends CacheValue = CacheValue> extends ISimpleCache<TKey, TValue> {
    readonly maxSize: number;
    readonly defaultTTL: number;
    setWithTTL(key: TKey, value: TValue, ttlMs: number): void;
    getStats(): CacheStats;
}

/**
 * Cache performance statistics interface.
 * Provides comprehensive metrics for cache performance monitoring.
 */
export interface CacheStats {
    readonly size: number;
    readonly hitCount: number;
    readonly missCount: number;
    readonly hitRate: number;
    readonly evictionCount: number;
}

// Basic constants for completion
export const DEFAULT_ACCOUNT_PREFIXES = [
    'Assets', 'Liabilities', 'Equity', 'Income', 'Expenses'
];

export const DEFAULT_COMMODITIES = [
    // Major world currencies (ISO 4217 codes)
    'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'INR', 'BRL', 'RUB', 'KRW', 'MXN', 'SGD', 'HKD', 'NOK', 'SEK', 'DKK', 'PLN', 'CZK', 'HUF', 'TRY', 'ZAR', 'NZD', 'THB',
    // Currency symbols (Unicode Currency Symbols block)
    '$', '€', '£', '¥', '₽', '₩', '₹', '₪', '¢', '¥', '₫', '₱', '₲', '₴', '₵', '₸', '₺', '₼', '₾', '₿',
    // Cryptocurrencies
    'BTC', 'ETH', 'LTC', 'BCH', 'ADA', 'DOT', 'XRP', 'DOGE', 'USDT', 'USDC', 'BNB', 'SOL', 'MATIC', 'AVAX',
    // Precious metals and commodities
    'XAU', 'XAG', 'XPT', 'XPD', 'OIL', 'GAS', 'GOLD', 'SILVER'
];

export const HLEDGER_KEYWORDS = [
    'account', 'alias', 'commodity', 'payee', 'tag', 'include', 'year', 
    'apply', 'end', 'default', 'format', 'note', 'assert', 'check'
] as const;

// Type-safe keyword type
export type HLedgerKeyword = typeof HLEDGER_KEYWORDS[number];

// Simple constructor functions for backward compatibility (now just identity functions)
export const createAccountName = (value: string): AccountName => value;
export const createPayeeName = (value: string): PayeeName => value;
export const createTagName = (value: string): TagName => value;
export const createTagValue = (value: string): TagValue => value;
export const createCommodityCode = (value: string): CommodityCode => value;
export const createFilePath = (value: string): FilePath => value;
export const createCacheKey = (value: string): CacheKey => value;
export const createCompletionScore = (value: number): CompletionScore => value;
export const createUsageCount = (value: number): UsageCount => value;
export const createLineNumber = (value: number): LineNumber => value;
export const createCharacterPosition = (value: number): CharacterPosition => value;
export const createDocumentVersion = (value: number): DocumentVersion => value;

// Modern Result type for better error handling
export type Result<T, E = Error> = 
    | { readonly success: true; readonly data: T }
    | { readonly success: false; readonly error: E };

// Helper functions for Result type
export const success = <T>(data: T): Result<T, never> => ({ success: true, data });
export const failure = <E>(error: E): Result<never, E> => ({ success: false, error });

// Type guard for Result
export const isSuccess = <T, E>(result: Result<T, E>): result is { success: true; data: T } => {
    return result.success;
};

export const isFailure = <T, E>(result: Result<T, E>): result is { success: false; error: E } => {
    return !result.success;
};

// Validation result type for input validation
export interface ValidationResult<T> {
    readonly isValid: boolean;
    readonly value?: T;
    readonly errors: readonly string[];
}

// Helper to create validation results
export const validationSuccess = <T>(value: T): ValidationResult<T> => ({
    isValid: true,
    value,
    errors: []
});

export const validationFailure = <T = never>(errors: string[]): ValidationResult<T> => ({
    isValid: false,
    errors
});