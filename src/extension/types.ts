// Re-export interfaces from core module for backward compatibility
export type { IConfigManager as IHLedgerConfig } from './core';
import type { IConfigManager } from './core';

export interface IProjectCache {
    getConfig(projectPath: string): IConfigManager | null;
    initialize(projectPath: string): IConfigManager;
    hasProject(projectPath: string): boolean;
    findProjectForFile(filePath: string): string | null;
    clear(): void;
}

export interface IWorkspaceCache {
    isValid(workspacePath: string): boolean;
    update(workspacePath: string): void;
    getConfig(): IConfigManager | null;
    invalidate(): void;
}

export interface AccountSuggestion {
    account: string;
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