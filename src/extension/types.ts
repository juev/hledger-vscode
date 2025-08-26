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
    readonly defaultCommodity: CommodityCode | null;
    readonly lastDate: string | null;
}

/**
 * Branded types for type safety and domain modeling.
 * These provide compile-time guarantees that values represent specific domain concepts.
 */

/** Branded type for hledger account names (e.g., 'Assets:Cash', 'Expenses:Food') */
export type AccountName = string & { readonly __brand: 'AccountName' };

/** Branded type for transaction payee names (e.g., 'Grocery Store', 'Coffee Shop') */
export type PayeeName = string & { readonly __brand: 'PayeeName' };

/** Branded type for hledger tag names (e.g., 'category', 'project') */
export type TagName = string & { readonly __brand: 'TagName' };

/** Branded type for commodity codes (e.g., 'USD', 'EUR', '$') */
export type CommodityCode = string & { readonly __brand: 'CommodityCode' };

/** Branded type for file system paths */
export type FilePath = string & { readonly __brand: 'FilePath' };

/** Branded type for workspace directory paths */
export type WorkspacePath = string & { readonly __brand: 'WorkspacePath' };
export type CompletionScore = number & { readonly __brand: 'CompletionScore' };
export type UsageCount = number & { readonly __brand: 'UsageCount' };
export type CacheKey = string & { readonly __brand: 'CacheKey' };
export type LineNumber = number & { readonly __brand: 'LineNumber' };
export type CharacterPosition = number & { readonly __brand: 'CharacterPosition' };
export type DocumentVersion = number & { readonly __brand: 'DocumentVersion' };

/**
 * Legacy type aliases for backward compatibility.
 * These are deprecated in favor of more descriptive branded types.
 */

/** @deprecated Use AccountName instead for better type safety */
export type Account = AccountName;

/** @deprecated Use PayeeName instead for better type safety */
export type Payee = PayeeName;

/** @deprecated Use TagName instead for better type safety */
export type Tag = TagName;

/** @deprecated Use CommodityCode instead for better type safety */
export type Commodity = CommodityCode;

// Enhanced completion context interface with type safety
export interface CompletionContext {
    readonly type: CompletionType;
    readonly query: string;
    readonly position?: CompletionPosition;
    readonly document?: DocumentReference;
}

/**
 * Completion type enumeration for better type safety.
 * Defines all possible completion types in hledger files.
 */
export type CompletionType = 
    | 'account'
    | 'payee' 
    | 'tag'
    | 'commodity'
    | 'date'
    | 'keyword';

/**
 * Type guard for CompletionType validation.
 */
export const isCompletionType = (value: string): value is CompletionType => {
    return ['account', 'payee', 'tag', 'commodity', 'date', 'keyword'].includes(value);
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
    'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF',
    '$', '€', '£', '¥', '₽', 'BTC', 'ETH'
];

export const HLEDGER_KEYWORDS = [
    'account', 'alias', 'commodity', 'payee', 'tag', 'include', 'year', 
    'apply', 'end', 'default', 'format', 'note', 'assert', 'check'
] as const;

// Type-safe keyword type
export type HLedgerKeyword = typeof HLEDGER_KEYWORDS[number];

// Type guards for branded types with safe coercion
export const isAccountName = (value: string): value is AccountName => {
    return typeof value === 'string' && value.length > 0;
};

export const isPayeeName = (value: string): value is PayeeName => {
    return typeof value === 'string' && value.length > 0;
};

export const isTagName = (value: string): value is TagName => {
    return typeof value === 'string' && value.length > 0;
};

export const isCommodityCode = (value: string): value is CommodityCode => {
    return typeof value === 'string' && value.length > 0;
};

export const isFilePath = (value: string): value is FilePath => {
    return typeof value === 'string' && value.length > 0;
};

export const isCacheKey = (value: string): value is CacheKey => {
    return typeof value === 'string' && value.length > 0;
};

export const isCompletionScore = (value: number): value is CompletionScore => {
    return typeof value === 'number' && value >= 0 && isFinite(value);
};

export const isUsageCount = (value: number): value is UsageCount => {
    return typeof value === 'number' && value >= 0 && Number.isInteger(value);
};

export const isLineNumber = (value: number): value is LineNumber => {
    return typeof value === 'number' && value >= 0 && Number.isInteger(value);
};

export const isCharacterPosition = (value: number): value is CharacterPosition => {
    return typeof value === 'number' && value >= 0 && Number.isInteger(value);
};

export const isDocumentVersion = (value: number): value is DocumentVersion => {
    return typeof value === 'number' && value >= 1 && Number.isInteger(value);
};

// Branded type constructors with safe coercion for backward compatibility
export const createAccountName = (value: string): AccountName => {
    return value as AccountName;
};

export const createPayeeName = (value: string): PayeeName => {
    return value as PayeeName;
};

export const createTagName = (value: string): TagName => {
    return value as TagName;
};

export const createCommodityCode = (value: string): CommodityCode => {
    return value as CommodityCode;
};

export const createFilePath = (value: string): FilePath => {
    return value as FilePath;
};

export const createCacheKey = (value: string): CacheKey => {
    return value as CacheKey;
};

export const createCompletionScore = (value: number): CompletionScore => {
    return value as CompletionScore;
};

export const createUsageCount = (value: number): UsageCount => {
    return value as UsageCount;
};

export const createLineNumber = (value: number): LineNumber => {
    return value as LineNumber;
};

export const createCharacterPosition = (value: number): CharacterPosition => {
    return value as CharacterPosition;
};

export const createDocumentVersion = (value: number): DocumentVersion => {
    return value as DocumentVersion;
};

// Safe coercion functions for arrays and collections
export const coerceAccountNames = (values: string[]): AccountName[] => {
    return values as AccountName[];
};

export const coercePayeeNames = (values: string[]): PayeeName[] => {
    return values as PayeeName[];
};

export const coerceTagNames = (values: string[]): TagName[] => {
    return values as TagName[];
};

export const coerceCommodityCodes = (values: string[]): CommodityCode[] => {
    return values as CommodityCode[];
};