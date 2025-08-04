// Re-export interfaces from core module for backward compatibility
export type { IConfigManager as IHLedgerConfig } from './core';
import type { IConfigManager } from './core';
import type { FilePath, WorkspacePath } from './core/BrandedTypes';

// Re-export branded types for external use
export type {
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
} from './core/BrandedTypes';

// Re-export branded type constructors and utilities
export {
    createAccountName,
    createPayeeName,
    createCommodityName,
    createTagName,
    createTagEntry,
    createDateString,
    createFilePath,
    createAccountAlias,
    createHLedgerKeyword,
    createWorkspacePath,
    createCacheKey,
    createCacheValue,
    isAccountName,
    isPayeeName,
    isCommodityName,
    isTagName,
    isTagEntry,
    isDateString,
    unbranded,
    toBrandedArray,
    toBrandedSet,
    toBrandedMap,
    HLEDGER_KEYWORDS_BRANDED,
    DEFAULT_ACCOUNT_PREFIXES_BRANDED,
    DEFAULT_COMMODITIES_BRANDED
} from './core/BrandedTypes';

export interface IProjectCache {
    getConfig(projectPath: WorkspacePath): IConfigManager | null;
    initializeProject(projectPath: WorkspacePath): IConfigManager;
    hasProject(projectPath: WorkspacePath): boolean;
    findProjectForFile(filePath: FilePath): WorkspacePath | null;
    clear(): void;
}

export interface IWorkspaceCache {
    isValid(workspacePath: WorkspacePath): boolean;
    update(workspacePath: WorkspacePath): void;
    getConfig(): IConfigManager | null;
    invalidate(): void;
}

export interface AccountSuggestion {
    account: string; // Keep as string for VS Code completion API compatibility
    kind: string;
    detail: string;
    priority: string;
}

export const HLEDGER_KEYWORDS = [
    'account', 'alias', 'apply account', 'end apply account',
    'comment', 'end comment', 'commodity', 'D', 'decimal-mark',
    'include', 'P', 'payee', 'tag', 'year', 'Y'
] as const;

export const DEFAULT_ACCOUNT_PREFIXES = [
    'Assets', 'Liabilities', 'Equity', 'Income', 'Expenses',
    'Revenue', 'Cash', 'Bank', 'Checking', 'Savings',
    'Credit Card', 'Investment', 'Payable', 'Receivable'
] as const;

export const DEFAULT_COMMODITIES = [
    'USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD',
    'CNY', 'INR', 'RUB', 'BRL', 'MXN', 'SEK', 'NOK',
    'DKK', 'PLN', 'TRY', 'KRW', 'SGD', 'HKD', 'NZD',
    'ZAR', 'THB', 'MYR', 'IDR', 'PHP', 'CZK', 'HUF',
    'BTC', 'ETH', 'USDT', 'BNB', 'XRP', 'ADA', 'DOGE'
] as const;