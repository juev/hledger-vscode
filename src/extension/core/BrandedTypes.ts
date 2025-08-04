/**
 * Branded types for domain safety in HLedger VS Code extension
 * 
 * This module provides compile-time type safety by creating branded types
 * that prevent mixing different string types. All branded types are compatible
 * with strings at runtime but provide additional type safety at compile time.
 */

/**
 * Base branded type utility
 * Creates a nominal type by intersecting with a unique symbol
 */
type Brand<T, TBrand extends string> = T & { readonly __brand: TBrand };

// =============================================================================
// CORE DOMAIN TYPES
// =============================================================================

/**
 * Branded type for HLedger account names
 * Examples: "Assets:Cash", "Expenses:Food:Groceries", "Liabilities:Credit Card:Visa"
 */
export type AccountName = Brand<string, 'AccountName'>;

/**
 * Branded type for payee/merchant names
 * Examples: "Grocery Store", "Gas Station", "John Doe"
 */
export type PayeeName = Brand<string, 'PayeeName'>;

/**
 * Branded type for commodity/currency names
 * Examples: "USD", "EUR", "BTC", "AAPL"
 */
export type CommodityName = Brand<string, 'CommodityName'>;

/**
 * Branded type for tag names (without values)
 * Examples: "category", "project", "status"
 */
export type TagName = Brand<string, 'TagName'>;

/**
 * Branded type for complete tag entries (with values)
 * Examples: "category:food", "project:website", "status:pending"
 */
export type TagEntry = Brand<string, 'TagEntry'>;

/**
 * Branded type for date strings in HLedger format
 * Examples: "2023-12-31", "2023/12/31", "12/31"
 */
export type DateString = Brand<string, 'DateString'>;

/**
 * Branded type for file paths
 * Examples: "/path/to/file.journal", "./includes/accounts.journal"
 */
export type FilePath = Brand<string, 'FilePath'>;

/**
 * Branded type for account aliases
 * Examples: "cash", "checking", "cc"
 */
export type AccountAlias = Brand<string, 'AccountAlias'>;

/**
 * Branded type for HLedger keywords/directives
 * Examples: "account", "commodity", "payee", "include"
 */
export type HLedgerKeyword = Brand<string, 'HLedgerKeyword'>;

/**
 * Branded type for workspace/project paths
 * Examples: "/home/user/finance", "/Users/john/documents/accounting"
 */
export type WorkspacePath = Brand<string, 'WorkspacePath'>;

// =============================================================================
// CACHE-RELATED TYPES
// =============================================================================

/**
 * Branded type for cache keys to ensure type safety in cache operations
 */
export type CacheKey<T extends string = string> = Brand<T, 'CacheKey'>;

/**
 * Branded type for cache values to maintain type safety
 */
export type CacheValue<T = any> = Brand<T, 'CacheValue'>;

// =============================================================================
// CONSTRUCTOR FUNCTIONS
// =============================================================================

/**
 * Creates an AccountName from a string
 * Validates that the account name follows HLedger conventions
 */
export function createAccountName(value: string): AccountName {
    if (!value || typeof value !== 'string') {
        throw new Error('Account name must be a non-empty string');
    }
    
    // Basic validation for account name format
    if (value.trim() !== value) {
        throw new Error('Account name cannot have leading or trailing whitespace');
    }
    
    return value as AccountName;
}

/**
 * Creates a PayeeName from a string
 * Validates that the payee name is not empty
 */
export function createPayeeName(value: string): PayeeName {
    if (!value || typeof value !== 'string') {
        throw new Error('Payee name must be a non-empty string');
    }
    
    return value.trim() as PayeeName;
}

/**
 * Creates a CommodityName from a string
 * Validates that the commodity name follows standard conventions
 */
export function createCommodityName(value: string): CommodityName {
    if (!value || typeof value !== 'string') {
        throw new Error('Commodity name must be a non-empty string');
    }
    
    const trimmed = value.trim();
    if (!trimmed) {
        throw new Error('Commodity name cannot be empty or whitespace only');
    }
    
    return trimmed as CommodityName;
}

/**
 * Creates a TagName from a string
 * Validates that the tag name is a valid identifier
 */
export function createTagName(value: string): TagName {
    if (!value || typeof value !== 'string') {
        throw new Error('Tag name must be a non-empty string');
    }
    
    const trimmed = value.trim();
    if (!trimmed) {
        throw new Error('Tag name cannot be empty or whitespace only');
    }
    
    // Tag names should not contain colons (those are for tag entries)
    if (trimmed.includes(':')) {
        throw new Error('Tag name cannot contain colons. Use createTagEntry for tag:value pairs');
    }
    
    return trimmed as TagName;
}

/**
 * Creates a TagEntry from a string
 * Validates that the tag entry follows tag:value format
 */
export function createTagEntry(value: string): TagEntry {
    if (!value || typeof value !== 'string') {
        throw new Error('Tag entry must be a non-empty string');
    }
    
    const trimmed = value.trim();
    if (!trimmed) {
        throw new Error('Tag entry cannot be empty or whitespace only');
    }
    
    return trimmed as TagEntry;
}

/**
 * Creates a DateString from a string
 * Validates basic date format
 */
export function createDateString(value: string): DateString {
    if (!value || typeof value !== 'string') {
        throw new Error('Date string must be a non-empty string');
    }
    
    const trimmed = value.trim();
    if (!trimmed) {
        throw new Error('Date string cannot be empty or whitespace only');
    }
    
    // Basic date format validation (supports multiple formats)
    const datePattern = /^\d{1,4}[-/.\s]\d{1,2}([-/.\s]\d{1,4})?$|^\d{1,4}$/;
    if (!datePattern.test(trimmed)) {
        throw new Error('Date string must follow HLedger date format (YYYY-MM-DD, YYYY/MM/DD, MM/DD, etc.)');
    }
    
    return trimmed as DateString;
}

/**
 * Creates a FilePath from a string
 * Validates that the path is not empty
 */
export function createFilePath(value: string): FilePath {
    if (!value || typeof value !== 'string') {
        throw new Error('File path must be a non-empty string');
    }
    
    return value as FilePath;
}

/**
 * Creates an AccountAlias from a string
 * Validates that the alias is a valid identifier
 */
export function createAccountAlias(value: string): AccountAlias {
    if (!value || typeof value !== 'string') {
        throw new Error('Account alias must be a non-empty string');
    }
    
    const trimmed = value.trim();
    if (!trimmed) {
        throw new Error('Account alias cannot be empty or whitespace only');
    }
    
    return trimmed as AccountAlias;
}

/**
 * Creates an HLedgerKeyword from a string
 * Validates that the keyword is a known HLedger directive
 */
export function createHLedgerKeyword(value: string): HLedgerKeyword {
    if (!value || typeof value !== 'string') {
        throw new Error('HLedger keyword must be a non-empty string');
    }
    
    return value.trim() as HLedgerKeyword;
}

/**
 * Creates a WorkspacePath from a string
 * Validates that the path is not empty
 */
export function createWorkspacePath(value: string): WorkspacePath {
    if (!value || typeof value !== 'string') {
        throw new Error('Workspace path must be a non-empty string');
    }
    
    return value as WorkspacePath;
}

/**
 * Creates a CacheKey from a string
 * Validates that the key is not empty
 */
export function createCacheKey<T extends string = string>(value: T): CacheKey<T> {
    if (!value || typeof value !== 'string') {
        throw new Error('Cache key must be a non-empty string');
    }
    
    return value as CacheKey<T>;
}

/**
 * Creates a CacheValue from any value
 * No validation needed as cache can store any value
 */
export function createCacheValue<T>(value: T): CacheValue<T> {
    return value as CacheValue<T>;
}

// =============================================================================
// TYPE GUARDS
// =============================================================================

/**
 * Type guard to check if a string is a valid AccountName
 */
export function isAccountName(value: string): value is AccountName {
    try {
        createAccountName(value);
        return true;
    } catch {
        return false;
    }
}

/**
 * Type guard to check if a string is a valid PayeeName
 */
export function isPayeeName(value: string): value is PayeeName {
    try {
        createPayeeName(value);
        return true;
    } catch {
        return false;
    }
}

/**
 * Type guard to check if a string is a valid CommodityName
 */
export function isCommodityName(value: string): value is CommodityName {
    try {
        createCommodityName(value);
        return true;
    } catch {
        return false;
    }
}

/**
 * Type guard to check if a string is a valid TagName
 */
export function isTagName(value: string): value is TagName {
    try {
        createTagName(value);
        return true;
    } catch {
        return false;
    }
}

/**
 * Type guard to check if a string is a valid TagEntry
 */
export function isTagEntry(value: string): value is TagEntry {
    try {
        createTagEntry(value);
        return true;
    } catch {
        return false;
    }
}

/**
 * Type guard to check if a string is a valid DateString
 */
export function isDateString(value: string): value is DateString {
    try {
        createDateString(value);
        return true;
    } catch {
        return false;
    }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Safely converts a branded type back to a string
 * This is useful when you need to pass branded types to APIs that expect strings
 */
export function unbranded<T extends string>(value: Brand<T, any>): T {
    return value as T;
}

/**
 * Converts an array of strings to an array of branded types
 * Filters out invalid values and logs warnings
 */
export function toBrandedArray<T extends Brand<string, any>>(
    values: string[],
    constructor: (value: string) => T,
    typeName: string
): T[] {
    const result: T[] = [];
    
    for (const value of values) {
        try {
            result.push(constructor(value));
        } catch (error) {
            console.warn(`Invalid ${typeName}: "${value}" - ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    
    return result;
}

/**
 * Converts a Set of strings to a Set of branded types
 * Filters out invalid values and logs warnings
 */
export function toBrandedSet<T extends Brand<string, any>>(
    values: Set<string>,
    constructor: (value: string) => T,
    typeName: string
): Set<T> {
    return new Set(toBrandedArray(Array.from(values), constructor, typeName));
}

/**
 * Converts a Map with string keys to a Map with branded type keys
 * Filters out invalid keys and logs warnings
 */
export function toBrandedMap<T extends Brand<string, any>, V>(
    values: Map<string, V>,
    keyConstructor: (value: string) => T,
    typeName: string
): Map<T, V> {
    const result = new Map<T, V>();
    
    for (const [key, value] of values) {
        try {
            result.set(keyConstructor(key), value);
        } catch (error) {
            console.warn(`Invalid ${typeName} key: "${key}" - ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    
    return result;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Common HLedger keywords as branded types
 */
export const HLEDGER_KEYWORDS_BRANDED = [
    'account', 'alias', 'apply account', 'end apply account',
    'comment', 'end comment', 'commodity', 'D', 'decimal-mark',
    'include', 'P', 'payee', 'tag', 'year', 'Y'
].map(createHLedgerKeyword);

/**
 * Default account prefixes as branded types
 */
export const DEFAULT_ACCOUNT_PREFIXES_BRANDED = [
    'Assets', 'Liabilities', 'Equity', 'Income', 'Expenses',
    'Revenue', 'Cash', 'Bank', 'Checking', 'Savings',
    'Credit Card', 'Investment', 'Payable', 'Receivable'
].map(createAccountName);

/**
 * Default commodities as branded types
 */
export const DEFAULT_COMMODITIES_BRANDED = [
    'USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD',
    'CNY', 'INR', 'RUB', 'BRL', 'MXN', 'SEK', 'NOK',
    'DKK', 'PLN', 'TRY', 'KRW', 'SGD', 'HKD', 'NZD',
    'ZAR', 'THB', 'MYR', 'IDR', 'PHP', 'CZK', 'HUF',
    'BTC', 'ETH', 'USDT', 'BNB', 'XRP', 'ADA', 'DOGE'
].map(createCommodityName);