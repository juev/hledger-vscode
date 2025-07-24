export interface IHLedgerConfig {
    accounts: Set<string>;
    definedAccounts: Set<string>;
    usedAccounts: Set<string>;
    aliases: Map<string, string>;
    commodities: Set<string>;
    defaultCommodity: string | null;
    lastDate: string | null;
    payees: Set<string>; // Магазины/получатели платежей
    tags: Set<string>;   // Теги/категории
    
    parseFile(filePath: string): void;
    parseContent(content: string, basePath?: string): void;
    scanWorkspace(workspacePath: string): void;
    getAccounts(): string[];
    getDefinedAccounts(): string[];
    getUsedAccounts(): string[];
    getUndefinedAccounts(): string[];
    getCommodities(): string[];
    getAliases(): Map<string, string>;
    getLastDate(): string | null;
    getPayees(): string[];
    getTags(): string[];
}

export interface IProjectCache {
    getConfig(projectPath: string): IHLedgerConfig | null;
    initialize(projectPath: string): IHLedgerConfig;
    hasProject(projectPath: string): boolean;
    findProjectForFile(filePath: string): string | null;
    clear(): void;
}

export interface IWorkspaceCache {
    isValid(workspacePath: string): boolean;
    update(workspacePath: string): void;
    getConfig(): IHLedgerConfig | null;
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