/**
 * Types and interfaces for tabular data import feature
 */

import { AccountName, PayeeName, UsageCount } from '../types';
import Decimal from 'decimal.js';

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
    /**
     * Confidence the column's own header earned, or 0 when the type was only
     * guessed from the values. Used to settle conflicts between columns: a
     * named header outranks a numeric column that merely looks like an amount.
     */
    readonly headerConfidence?: number;
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
    readonly amount: Decimal;
    readonly amountFormatted: string;
    readonly currency?: string;
    readonly sourceAccount: AccountResolution;
    readonly targetAccount: string; // Balancing account
    readonly memo?: string;
    readonly reference?: string;
    readonly lineNumber: number; // Original CSV line for error reporting
}

/**
 * Hint for interpreting comma in ambiguous amounts like "1,234".
 * - 'auto': Use heuristic (<=2 digits after comma = decimal separator)
 * - 'comma': Always treat comma as decimal separator (European format)
 * - 'period': Always treat comma as thousand separator (US format)
 */
export type DecimalSeparatorHint = 'auto' | 'comma' | 'period';

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
    /**
     * Hint for interpreting comma in ambiguous amounts.
     * Only applies when comma is the only separator (no period present).
     * @default 'auto'
     */
    readonly decimalSeparatorHint?: DecimalSeparatorHint;
}

/** Supported date formats */
export type DateFormat =
    | 'auto'
    | 'YYYY-MM-DD'
    | 'YYYY/MM/DD'
    | 'DD/MM/YYYY'
    | 'MM/DD/YYYY'
    | 'DD.MM.YYYY'
    | 'DD-MM-YYYY'
    | 'MM-DD-YYYY';

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

/**
 * Built-in merchant patterns (regex -> account).
 *
 * Every keyword is enclosed in ASCII-letter lookarounds rather than plain
 * `\b`: `\b` does not fire next to a Cyrillic letter, so `\bМТС\b` would never
 * match "ОПЛАТА МТС". Without a boundary, short keywords match inside unrelated
 * words: "IVI" hits "PRIVILEGE", "ATT" hits "MATTRESS".
 *
 * Matching is first-match-wins over the most specific pattern first, so the
 * longer entries below intentionally shadow the shorter ones they refine.
 */
export const BUILTIN_MERCHANT_PATTERNS: Record<string, string> = {
    // Shopping
    '(?<![A-Z0-9])(?:AMAZON|AMZN|АМАЗОН)(?![A-Z0-9])': 'expenses:shopping:amazon',
    '(?<![A-Z0-9])(?:EBAY|ЕБЕЙ)(?![A-Z0-9])': 'expenses:shopping:ebay',
    '(?<![A-Z0-9])(?:ALIEXPRESS|АЛИЭКСПРЕСС)(?![A-Z0-9])': 'expenses:shopping:aliexpress',
    '(?<![A-Z0-9])(?:WALMART|ВОЛМАРТ)(?![A-Z0-9])': 'expenses:shopping:walmart',
    '(?<![A-Z0-9])TARGET(?![A-Z0-9])': 'expenses:shopping:target',
    '(?<![A-Z0-9])COSTCO(?![A-Z0-9])': 'expenses:shopping:costco',
    '(?<![A-Z0-9])(?:IKEA|ИКЕА)(?![A-Z0-9])': 'expenses:shopping:ikea',

    // Groceries
    '(?<![A-Z0-9])WHOLE\\s*FOODS(?![A-Z0-9])': 'expenses:food:groceries',
    '(?<![A-Z0-9])TRADER\\s*JOE(?![A-Z0-9])': 'expenses:food:groceries',
    '(?<![A-Z0-9])KROGER(?![A-Z0-9])': 'expenses:food:groceries',
    '(?<![A-Z0-9])SAFEWAY(?![A-Z0-9])': 'expenses:food:groceries',
    '(?<![A-Z0-9])ALDI(?![A-Z0-9])': 'expenses:food:groceries',
    '(?<![A-Z0-9])(?:LIDL|ЛИДЛ)(?![A-Z0-9])': 'expenses:food:groceries',
    '(?<![A-Z0-9])(?:ПЯТЕРОЧКА|PYATEROCHKA|5KA)(?![A-Z0-9])': 'expenses:food:groceries',
    '(?<![A-Z0-9])(?:ПЕРЕКРЕСТОК|PEREKRESTOK)(?![A-Z0-9])': 'expenses:food:groceries',
    '(?<![A-Z0-9])(?:МАГНИТ|MAGNIT)(?![A-Z0-9])': 'expenses:food:groceries',
    '(?<![A-Z0-9])(?:ЛЕНТА|LENTA)(?![A-Z0-9])': 'expenses:food:groceries',
    '(?<![A-Z0-9])(?:АШАН|AUCHAN)(?![A-Z0-9])': 'expenses:food:groceries',
    '(?<![A-Z0-9])METRO\\s*C(?![A-Z0-9])': 'expenses:food:groceries',

    // Fast food & Restaurants
    '(?<![A-Z0-9])(?:MCDONALD|МАКДОНАЛЬДС|MCD)(?![A-Z0-9])': 'expenses:food:dining:fastfood',
    '(?<![A-Z0-9])(?:BURGER\\s*KING|БУРГЕР\\s*КИНГ)(?![A-Z0-9])': 'expenses:food:dining:fastfood',
    '(?<![A-Z0-9])(?:KFC|КФС)(?![A-Z0-9])': 'expenses:food:dining:fastfood',
    '(?<![A-Z0-9])(?:SUBWAY|САБВЕЙ)(?![A-Z0-9])': 'expenses:food:dining:fastfood',
    '(?<![A-Z0-9])(?:STARBUCKS|СТАРБАКС)(?![A-Z0-9])': 'expenses:food:dining:coffee',
    '(?<![A-Z0-9])DUNKIN(?![A-Z0-9])': 'expenses:food:dining:coffee',
    '(?<![A-Z0-9])(?:DOMINO|ДОМИНОС)(?![A-Z0-9])': 'expenses:food:dining:delivery',
    '(?<![A-Z0-9])PIZZA\\s*HUT(?![A-Z0-9])': 'expenses:food:dining:delivery',
    '(?<![A-Z0-9])UBER\\s*EATS(?![A-Z0-9])': 'expenses:food:dining:delivery',
    '(?<![A-Z0-9])DOORDASH(?![A-Z0-9])': 'expenses:food:dining:delivery',
    '(?<![A-Z0-9])GRUBHUB(?![A-Z0-9])': 'expenses:food:dining:delivery',
    '(?<![A-Z0-9])(?:ЯНДЕКС\\s*ЕДА|YANDEX\\s*EDA)(?![A-Z0-9])': 'expenses:food:dining:delivery',
    '(?<![A-Z0-9])DELIVERY\\s*CLUB(?![A-Z0-9])': 'expenses:food:dining:delivery',

    // Subscriptions & Streaming
    '(?<![A-Z0-9])AMAZON\\s*PRIME(?![A-Z0-9])': 'expenses:subscriptions:streaming',
    '(?<![A-Z0-9])(?:NETFLIX|НЕТФЛИКС)(?![A-Z0-9])': 'expenses:subscriptions:streaming',
    '(?<![A-Z0-9])(?:SPOTIFY|СПОТИФАЙ)(?![A-Z0-9])': 'expenses:subscriptions:streaming',
    '(?<![A-Z0-9])APPLE\\s*MUSIC(?![A-Z0-9])': 'expenses:subscriptions:streaming',
    '(?<![A-Z0-9])DISNEY\\s*(?:\\+|PLUS)(?![A-Z0-9])': 'expenses:subscriptions:streaming',
    '(?<![A-Z0-9])HBO\\s*MAX(?![A-Z0-9])': 'expenses:subscriptions:streaming',
    '(?<![A-Z0-9])HULU(?![A-Z0-9])': 'expenses:subscriptions:streaming',
    '(?<![A-Z0-9])YOUTUBE\\s*PREMIUM(?![A-Z0-9])': 'expenses:subscriptions:streaming',
    '(?<![A-Z0-9])(?:КИНОПОИСК|KINOPOISK)(?![A-Z0-9])': 'expenses:subscriptions:streaming',
    '(?<![A-Z0-9])IVI(?![A-Z0-9])': 'expenses:subscriptions:streaming',

    // Transportation
    '(?<![A-Z0-9])UBER(?!\\s*EATS)(?![A-Z0-9])|(?<![A-Z0-9])УБЕР(?![A-Z0-9])': 'expenses:transport:rideshare',
    '(?<![A-Z0-9])LYFT(?![A-Z0-9])': 'expenses:transport:rideshare',
    '(?<![A-Z0-9])BOLT(?![A-Z0-9])': 'expenses:transport:rideshare',
    '(?<![A-Z0-9])(?:ЯНДЕКС\\s*ТАКСИ|YANDEX\\s*TAXI)(?![A-Z0-9])': 'expenses:transport:taxi',
    '(?<![A-Z0-9])GETT(?![A-Z0-9])': 'expenses:transport:taxi',
    '(?<![A-Z0-9])SHELL(?![A-Z0-9])': 'expenses:transport:fuel',
    '(?<![A-Z0-9])(?:EXXON|ESSO)(?![A-Z0-9])': 'expenses:transport:fuel',
    '(?<![A-Z0-9])BP(?![A-Z0-9])': 'expenses:transport:fuel',
    '(?<![A-Z0-9])CHEVRON(?![A-Z0-9])': 'expenses:transport:fuel',
    '(?<![A-Z0-9])(?:ЛУКОЙЛ|LUKOIL)(?![A-Z0-9])': 'expenses:transport:fuel',
    '(?<![A-Z0-9])(?:ГАЗПРОМ|GAZPROM)(?![A-Z0-9])': 'expenses:transport:fuel',
    '(?<![A-Z0-9])(?:РОСНЕФТЬ|ROSNEFT)(?![A-Z0-9])': 'expenses:transport:fuel',

    // Utilities & Bills
    '(?<![A-Z0-9])VERIZON(?![A-Z0-9])': 'expenses:bills:telecom',
    '(?<![A-Z0-9])(?:AT\\s*&\\s*T|ATT)(?![A-Z0-9])': 'expenses:bills:telecom',
    '(?<![A-Z0-9])T-MOBILE(?![A-Z0-9])': 'expenses:bills:telecom',
    '(?<![A-Z0-9])(?:COMCAST|XFINITY)(?![A-Z0-9])': 'expenses:bills:internet',
    '(?<![A-Z0-9])(?:МТС|MTS)(?![A-Z0-9])': 'expenses:bills:telecom',
    '(?<![A-Z0-9])(?:БИЛАЙН|BEELINE)(?![A-Z0-9])': 'expenses:bills:telecom',
    '(?<![A-Z0-9])(?:МЕГАФОН|MEGAFON)(?![A-Z0-9])': 'expenses:bills:telecom',
    '(?<![A-Z0-9])(?:ТЕЛЕ2|TELE2)(?![A-Z0-9])': 'expenses:bills:telecom',

    // Income patterns
    '(?<![A-Z0-9])(?:SALARY|PAYROLL|ЗАРПЛАТА|ЗП)(?![A-Z0-9])': 'income:salary',
    '(?<![A-Z0-9])DIRECT\\s*(?:DEPOSIT|DEP)(?![A-Z0-9])': 'income:salary',
    '(?<![A-Z0-9])DIVIDEND(?![A-Z0-9])': 'income:dividends',
    '(?<![A-Z0-9])INTEREST\\s*PAYMENT(?![A-Z0-9])': 'income:interest',
    '(?<![A-Z0-9])(?:TAX\\s*REFUND|ВОЗВРАТ\\s*НАЛОГ)(?![A-Z0-9])': 'income:refunds:tax',

    // Transfers
    '(?<![A-Z0-9])(?:TRANSFER|ПЕРЕВОД)(?![A-Z0-9])': 'transfers',
    '(?<![A-Z0-9])ZELLE(?![A-Z0-9])': 'transfers',
    '(?<![A-Z0-9])VENMO(?![A-Z0-9])': 'transfers',
    '(?<![A-Z0-9])PAYPAL\\s*TRANSFER(?![A-Z0-9])': 'transfers',
    '(?<![A-Z0-9])(?:СБП|SBP)(?![A-Z0-9])': 'transfers',
};
