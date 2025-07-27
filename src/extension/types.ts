export interface IHLedgerConfig {
    accounts: Set<string>;
    definedAccounts: Set<string>;
    usedAccounts: Set<string>;
    aliases: Map<string, string>;
    commodities: Set<string>;
    defaultCommodity: string | null;
    lastDate: string | null;
    payees: Set<string>; // Stores/payees
    tags: Set<string>;   // Tags/categories
    
    // Usage counters for frequency-based prioritization
    accountUsageCount: Map<string, number>;
    payeeUsageCount: Map<string, number>;
    tagUsageCount: Map<string, number>;
    commodityUsageCount: Map<string, number>;
    
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
    
    // Methods to get sorted lists by usage frequency
    getAccountsByUsage(): Array<{account: string, count: number}>;
    getPayeesByUsage(): Array<{payee: string, count: number}>;
    getTagsByUsage(): Array<{tag: string, count: number}>;
    getCommoditiesByUsage(): Array<{commodity: string, count: number}>;
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