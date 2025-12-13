/**
 * Types and interfaces for tabular data import feature
 */

import { AccountName, PayeeName, UsageCount } from '../types';

// ==================== Custom Error Types ====================

/**
 * Error thrown when a journal file is not found.
 * Used to differentiate expected failures (no journal) from unexpected errors.
 */
export class JournalNotFoundError extends Error {
    readonly name = 'JournalNotFoundError' as const;
    readonly path: string;

    constructor(path: string) {
        super(`Journal not found: ${path}`);
        this.path = path;
        Object.setPrototypeOf(this, JournalNotFoundError.prototype);
    }
}

/**
 * Error thrown when a journal file cannot be accessed (permission denied, etc.).
 * Used to differentiate access issues from other errors.
 */
export class JournalAccessError extends Error {
    readonly name = 'JournalAccessError' as const;
    readonly path: string;
    readonly reason: string;

    constructor(path: string, reason: string) {
        super(`Cannot access journal ${path}: ${reason}`);
        this.path = path;
        this.reason = reason;
        Object.setPrototypeOf(this, JournalAccessError.prototype);
    }
}

/**
 * Type guard to check if an error is a journal-related error.
 * Returns true for JournalNotFoundError or JournalAccessError.
 */
export function isJournalError(
    error: unknown
): error is JournalNotFoundError | JournalAccessError {
    return (
        error instanceof JournalNotFoundError ||
        error instanceof JournalAccessError
    );
}

// ==================== End Custom Error Types ====================

/**
 * Payee-to-account mapping from journal history.
 * Tracks which accounts are used with each payee for import resolution.
 */
export interface PayeeAccountHistory {
    /** Map of payee name to accounts used with that payee */
    readonly payeeAccounts: ReadonlyMap<PayeeName, ReadonlySet<AccountName>>;

    /** Usage frequency for payee-account pairs (for ranking). Key format: "payee::account" */
    readonly pairUsage: ReadonlyMap<string, UsageCount>;
}

/** Supported delimiters for tabular data */
export type Delimiter = '\t' | ',' | ';' | '|';

/** Column type detection result */
export type ColumnType =
    | 'date'
    | 'description'
    | 'payee'
    | 'amount'
    | 'debit'
    | 'credit'
    | 'account'
    | 'category'
    | 'memo'
    | 'reference'
    | 'balance'
    | 'currency'
    | 'unknown';

/** Confidence level for detection */
export type ConfidenceLevel = 'high' | 'medium' | 'low';

/** Source of account resolution */
export type AccountResolutionSource =
    | 'category'
    | 'history'
    | 'pattern'
    | 'sign'
    | 'default';

/** Column mapping configuration */
export interface ColumnMapping {
    readonly index: number;
    readonly type: ColumnType;
    readonly headerName: string;
    readonly confidence: number; // 0.0-1.0
}

/** Parsed tabular row */
export interface ParsedRow {
    readonly cells: readonly string[];
    readonly lineNumber: number;
}

/** Parsed tabular data */
export interface ParsedTabularData {
    readonly headers: readonly string[];
    readonly rows: readonly ParsedRow[];
    readonly delimiter: Delimiter;
    readonly columnMappings: readonly ColumnMapping[];
}

/** Account resolution result */
export interface AccountResolution {
    readonly account: string;
    readonly confidence: number; // 0.0-1.0
    readonly source: AccountResolutionSource;
}

/** Transaction to generate */
export interface ImportedTransaction {
    readonly date: string; // YYYY-MM-DD format
    readonly description: string;
    readonly amount: number;
    readonly amountFormatted: string;
    readonly currency?: string;
    readonly sourceAccount: AccountResolution;
    readonly targetAccount: string; // Balancing account
    readonly memo?: string;
    readonly reference?: string;
    readonly lineNumber: number; // Original CSV line for error reporting
}

/** Import options from configuration */
export interface ImportOptions {
    readonly dateFormat?: DateFormat;
    readonly defaultDebitAccount: string;
    readonly defaultCreditAccount: string;
    readonly defaultBalancingAccount: string;
    readonly invertAmounts: boolean;
    readonly useJournalHistory: boolean;
    readonly merchantPatterns: Record<string, string>;
    readonly categoryMapping: Record<string, string>;
}

/** Supported date formats */
export type DateFormat =
    | 'auto'
    | 'YYYY-MM-DD'
    | 'YYYY/MM/DD'
    | 'DD/MM/YYYY'
    | 'MM/DD/YYYY'
    | 'DD.MM.YYYY'
    | 'DD-MM-YYYY';

/** Import result with statistics */
export interface ImportResult {
    readonly transactions: readonly ImportedTransaction[];
    readonly warnings: readonly ImportWarning[];
    readonly errors: readonly ImportError[];
    readonly statistics: ImportStatistics;
}

/** Import warning */
export interface ImportWarning {
    readonly lineNumber: number;
    readonly message: string;
    readonly field?: string;
}

/** Import error */
export interface ImportError {
    readonly lineNumber: number;
    readonly message: string;
    readonly field?: string;
    readonly fatal: boolean;
}

/** Import statistics */
export interface ImportStatistics {
    readonly totalRows: number;
    readonly processedRows: number;
    readonly skippedRows: number;
    readonly autoDetectedAccounts: number;
    readonly todoAccounts: number;
    readonly detectionSources: Record<AccountResolutionSource, number>;
}

/** Parser options */
export interface TabularDataParserOptions {
    readonly skipEmptyRows: boolean;
    readonly trimCells: boolean;
    readonly hasHeader: boolean;
}

/** Default parser options */
export const DEFAULT_PARSER_OPTIONS: TabularDataParserOptions = {
    skipEmptyRows: true,
    trimCells: true,
    hasHeader: true,
};

/** Default import options */
export const DEFAULT_IMPORT_OPTIONS: ImportOptions = {
    dateFormat: 'auto',
    defaultDebitAccount: 'expenses:unknown',
    defaultCreditAccount: 'income:unknown',
    defaultBalancingAccount: 'TODO:account',
    invertAmounts: false,
    useJournalHistory: true,
    merchantPatterns: {},
    categoryMapping: {},
};

/** Built-in category mappings */
export const BUILTIN_CATEGORY_MAPPING: Record<string, string> = {
    // English categories
    groceries: 'expenses:food:groceries',
    food: 'expenses:food',
    'food & dining': 'expenses:food:dining',
    restaurants: 'expenses:food:dining',
    dining: 'expenses:food:dining',
    shopping: 'expenses:shopping',
    'online shopping': 'expenses:shopping:online',
    entertainment: 'expenses:entertainment',
    subscriptions: 'expenses:subscriptions',
    streaming: 'expenses:subscriptions:streaming',
    transportation: 'expenses:transport',
    transport: 'expenses:transport',
    'gas & fuel': 'expenses:transport:fuel',
    fuel: 'expenses:transport:fuel',
    'public transit': 'expenses:transport:public',
    taxi: 'expenses:transport:taxi',
    'ride share': 'expenses:transport:rideshare',
    utilities: 'expenses:bills:utilities',
    bills: 'expenses:bills',
    'phone/internet': 'expenses:bills:telecom',
    internet: 'expenses:bills:internet',
    phone: 'expenses:bills:phone',
    rent: 'expenses:housing:rent',
    mortgage: 'expenses:housing:mortgage',
    housing: 'expenses:housing',
    healthcare: 'expenses:health',
    health: 'expenses:health',
    medical: 'expenses:health:medical',
    pharmacy: 'expenses:health:pharmacy',
    insurance: 'expenses:insurance',
    education: 'expenses:education',
    travel: 'expenses:travel',
    'hotels/lodging': 'expenses:travel:lodging',
    flights: 'expenses:travel:flights',
    'personal care': 'expenses:personal',
    clothing: 'expenses:clothing',
    fitness: 'expenses:health:fitness',
    gym: 'expenses:health:fitness',
    gifts: 'expenses:gifts',
    charity: 'expenses:charity',
    donations: 'expenses:charity',
    fees: 'expenses:fees',
    'bank fees': 'expenses:fees:bank',
    atm: 'expenses:fees:atm',
    salary: 'income:salary',
    payroll: 'income:salary',
    income: 'income',
    wages: 'income:salary',
    bonus: 'income:salary:bonus',
    interest: 'income:interest',
    dividends: 'income:dividends',
    refund: 'income:refunds',
    transfer: 'transfers',
    'internal transfer': 'transfers',
    // Russian categories
    продукты: 'expenses:food:groceries',
    еда: 'expenses:food',
    рестораны: 'expenses:food:dining',
    кафе: 'expenses:food:dining',
    покупки: 'expenses:shopping',
    развлечения: 'expenses:entertainment',
    транспорт: 'expenses:transport',
    такси: 'expenses:transport:taxi',
    топливо: 'expenses:transport:fuel',
    бензин: 'expenses:transport:fuel',
    коммунальные: 'expenses:bills:utilities',
    связь: 'expenses:bills:telecom',
    интернет: 'expenses:bills:internet',
    телефон: 'expenses:bills:phone',
    аренда: 'expenses:housing:rent',
    ипотека: 'expenses:housing:mortgage',
    здоровье: 'expenses:health',
    аптека: 'expenses:health:pharmacy',
    страхование: 'expenses:insurance',
    образование: 'expenses:education',
    путешествия: 'expenses:travel',
    одежда: 'expenses:clothing',
    фитнес: 'expenses:health:fitness',
    подарки: 'expenses:gifts',
    благотворительность: 'expenses:charity',
    комиссия: 'expenses:fees',
    зарплата: 'income:salary',
    доход: 'income',
    проценты: 'income:interest',
    дивиденды: 'income:dividends',
    возврат: 'income:refunds',
    перевод: 'transfers',
};

/** Built-in merchant patterns (regex -> account) */
export const BUILTIN_MERCHANT_PATTERNS: Record<string, string> = {
    // Shopping
    'AMAZON|AMZN|АМАЗОН': 'expenses:shopping:amazon',
    'EBAY|ЕБЕЙ': 'expenses:shopping:ebay',
    'ALIEXPRESS|АЛИЭКСПРЕСС': 'expenses:shopping:aliexpress',
    'WALMART|ВОЛМАРТ': 'expenses:shopping:walmart',
    'TARGET': 'expenses:shopping:target',
    'COSTCO': 'expenses:shopping:costco',
    'IKEA|ИКЕА': 'expenses:shopping:ikea',

    // Groceries
    'WHOLE\\s*FOODS': 'expenses:food:groceries',
    'TRADER\\s*JOE': 'expenses:food:groceries',
    'KROGER': 'expenses:food:groceries',
    'SAFEWAY': 'expenses:food:groceries',
    'ALDI': 'expenses:food:groceries',
    'LIDL|ЛИДЛ': 'expenses:food:groceries',
    'ПЯТЕРОЧКА|PYATEROCHKA|5KA': 'expenses:food:groceries',
    'ПЕРЕКРЕСТОК|PEREKRESTOK': 'expenses:food:groceries',
    'МАГНИТ|MAGNIT': 'expenses:food:groceries',
    'ЛЕНТА|LENTA': 'expenses:food:groceries',
    'АШАН|AUCHAN': 'expenses:food:groceries',
    'METRO\\s*C': 'expenses:food:groceries',

    // Fast food & Restaurants
    'MCDONALD|МАКДОНАЛЬДС|MCD': 'expenses:food:dining:fastfood',
    'BURGER\\s*KING|БУРГЕР\\s*КИНГ': 'expenses:food:dining:fastfood',
    'KFC|КФС': 'expenses:food:dining:fastfood',
    'SUBWAY|САБВЕЙ': 'expenses:food:dining:fastfood',
    'STARBUCKS|СТАРБАКС': 'expenses:food:dining:coffee',
    'DUNKIN': 'expenses:food:dining:coffee',
    'DOMINO|ДОМИНОС': 'expenses:food:dining:delivery',
    'PIZZA\\s*HUT': 'expenses:food:dining:delivery',
    'UBER\\s*EATS': 'expenses:food:dining:delivery',
    'DOORDASH': 'expenses:food:dining:delivery',
    'GRUBHUB': 'expenses:food:dining:delivery',
    'ЯНДЕКС\\s*ЕДА|YANDEX\\s*EDA': 'expenses:food:dining:delivery',
    'DELIVERY\\s*CLUB': 'expenses:food:dining:delivery',

    // Subscriptions & Streaming
    'NETFLIX|НЕТФЛИКС': 'expenses:subscriptions:streaming',
    'SPOTIFY|СПОТИФАЙ': 'expenses:subscriptions:streaming',
    'APPLE\\s*MUSIC': 'expenses:subscriptions:streaming',
    'AMAZON\\s*PRIME': 'expenses:subscriptions:streaming',
    'DISNEY\\s*\\+|DISNEY\\s*PLUS': 'expenses:subscriptions:streaming',
    'HBO\\s*MAX': 'expenses:subscriptions:streaming',
    'HULU': 'expenses:subscriptions:streaming',
    'YOUTUBE\\s*PREMIUM': 'expenses:subscriptions:streaming',
    'КИНОПОИСК|KINOPOISK': 'expenses:subscriptions:streaming',
    'IVI': 'expenses:subscriptions:streaming',

    // Transportation
    'UBER(?!\\s*EATS)|УБЕР': 'expenses:transport:rideshare',
    'LYFT': 'expenses:transport:rideshare',
    'BOLT': 'expenses:transport:rideshare',
    'ЯНДЕКС\\s*ТАКСИ|YANDEX\\s*TAXI': 'expenses:transport:taxi',
    'GETT': 'expenses:transport:taxi',
    'SHELL': 'expenses:transport:fuel',
    'EXXON|ESSO': 'expenses:transport:fuel',
    'BP\\s': 'expenses:transport:fuel',
    'CHEVRON': 'expenses:transport:fuel',
    'ЛУКОЙЛ|LUKOIL': 'expenses:transport:fuel',
    'ГАЗПРОМ|GAZPROM': 'expenses:transport:fuel',
    'РОСНЕФТЬ|ROSNEFT': 'expenses:transport:fuel',

    // Utilities & Bills
    'VERIZON': 'expenses:bills:telecom',
    'AT\\s*&\\s*T|ATT': 'expenses:bills:telecom',
    'T-MOBILE': 'expenses:bills:telecom',
    'COMCAST|XFINITY': 'expenses:bills:internet',
    'МТС|MTS': 'expenses:bills:telecom',
    'БИЛАЙН|BEELINE': 'expenses:bills:telecom',
    'МЕГАФОН|MEGAFON': 'expenses:bills:telecom',
    'ТЕЛЕ2|TELE2': 'expenses:bills:telecom',

    // Income patterns
    'SALARY|PAYROLL|ЗАРПЛАТА|ЗП': 'income:salary',
    'DIRECT\\s*DEPOSIT|DIRECT\\s*DEP': 'income:salary',
    'DIVIDEND': 'income:dividends',
    'INTEREST\\s*PAYMENT': 'income:interest',
    'TAX\\s*REFUND|ВОЗВРАТ\\s*НАЛОГ': 'income:refunds:tax',

    // Transfers
    'TRANSFER|ПЕРЕВОД': 'transfers',
    'ZELLE': 'transfers',
    'VENMO': 'transfers',
    'PAYPAL\\s*TRANSFER': 'transfers',
    'СБП|SBP': 'transfers',
};
