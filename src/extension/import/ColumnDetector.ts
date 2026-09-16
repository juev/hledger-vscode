/**
 * Column type detector with header pattern matching and content analysis
 * Supports multi-language headers (English, Russian)
 */

import { ColumnType, ColumnMapping, ParsedRow } from './types';

/** Header patterns for column type detection */
interface HeaderPatterns {
    readonly date: readonly RegExp[];
    readonly description: readonly RegExp[];
    readonly payee: readonly RegExp[];
    readonly amount: readonly RegExp[];
    readonly debit: readonly RegExp[];
    readonly credit: readonly RegExp[];
    readonly account: readonly RegExp[];
    readonly category: readonly RegExp[];
    readonly memo: readonly RegExp[];
    readonly reference: readonly RegExp[];
    readonly balance: readonly RegExp[];
    readonly currency: readonly RegExp[];
}

/** Default header patterns (English and Russian) */
const DEFAULT_PATTERNS: HeaderPatterns = {
    date: [
        /^date$/i,
        /^transaction[\s_-]?date$/i,
        /^posting[\s_-]?date$/i,
        /^value[\s_-]?date$/i,
        /^effective[\s_-]?date$/i,
        /^book[\s_-]?date$/i,
        /^trans[\s_-]?date$/i,
        /^дата$/i,
        /^дата[\s_-]?операции$/i,
        /^дата[\s_-]?транзакции$/i,
    ],
    description: [
        /^description$/i,
        /^desc$/i,
        /^narrative$/i,
        /^details$/i,
        /^particulars$/i,
        /^text$/i,
        /^transaction[\s_-]?description$/i,
        /^trans[\s_-]?desc$/i,
        /^описание$/i,
        /^назначение$/i,
        /^детали$/i,
        /^комментарий$/i,
    ],
    payee: [
        /^payee$/i,
        /^merchant$/i,
        /^vendor$/i,
        /^recipient$/i,
        /^beneficiary$/i,
        /^counterparty$/i,
        /^name$/i,
        /^получатель$/i,
        /^плательщик$/i,
        /^контрагент$/i,
        /^торговая[\s_-]?точка$/i,
    ],
    amount: [
        /^amount$/i,
        /^sum$/i,
        /^value$/i,
        /^total$/i,
        /^transaction[\s_-]?amount$/i,
        /^trans[\s_-]?amount$/i,
        /^сумма$/i,
        /^сумма[\s_-]?операции$/i,
        /^сумма[\s_-]?транзакции$/i,
    ],
    debit: [
        /^debit$/i,
        /^dr$/i,
        /^withdrawal$/i,
        /^out$/i,
        /^expense$/i,
        /^debit[\s_-]?amount$/i,
        /^money[\s_-]?out$/i,
        /^дебет$/i,
        /^расход$/i,
        /^списание$/i,
        /^снятие$/i,
    ],
    credit: [
        /^credit$/i,
        /^cr$/i,
        /^deposit$/i,
        /^in$/i,
        /^income$/i,
        /^credit[\s_-]?amount$/i,
        /^money[\s_-]?in$/i,
        /^кредит$/i,
        /^приход$/i,
        /^поступление$/i,
        /^зачисление$/i,
    ],
    account: [
        /^account$/i,
        /^account[\s_-]?name$/i,
        /^account[\s_-]?number$/i,
        /^acct$/i,
        /^счет$/i,
        /^счёт$/i,
        /^номер[\s_-]?счета$/i,
    ],
    category: [
        /^category$/i,
        /^type$/i,
        /^transaction[\s_-]?type$/i,
        /^trans[\s_-]?type$/i,
        /^classification$/i,
        /^tag$/i,
        /^label$/i,
        /^категория$/i,
        /^тип$/i,
        /^тип[\s_-]?операции$/i,
        /^MCC$/i,
    ],
    memo: [
        /^memo$/i,
        /^note$/i,
        /^notes$/i,
        /^comment$/i,
        /^comments$/i,
        /^remark$/i,
        /^remarks$/i,
        /^примечание$/i,
        /^заметка$/i,
    ],
    reference: [
        /^reference$/i,
        /^ref$/i,
        /^id$/i,
        /^transaction[\s_-]?id$/i,
        /^trans[\s_-]?id$/i,
        /^check[\s_-]?number$/i,
        /^check[\s_-]?#$/i,
        /^chk[\s_-]?#$/i,
        /^номер[\s_-]?транзакции$/i,
        /^референс$/i,
        /^номер[\s_-]?документа$/i,
    ],
    balance: [
        /^balance$/i,
        /^running[\s_-]?balance$/i,
        /^available[\s_-]?balance$/i,
        /^ending[\s_-]?balance$/i,
        /^баланс$/i,
        /^остаток$/i,
    ],
    currency: [
        /^currency$/i,
        /^curr$/i,
        /^ccy$/i,
        /^валюта$/i,
    ],
};

/**
 * Column detector with header pattern matching and content analysis
 */
export class ColumnDetector {
    private readonly patterns: HeaderPatterns;

    constructor(customPatterns?: Partial<HeaderPatterns>) {
        this.patterns = customPatterns
            ? this.mergePatterns(DEFAULT_PATTERNS, customPatterns)
            : DEFAULT_PATTERNS;
    }

    /**
     * Detect column types from headers and sample data
     */
    detectColumns(
        headers: readonly string[],
        sampleRows: readonly ParsedRow[]
    ): ColumnMapping[] {
        const mappings: ColumnMapping[] = [];

        for (let i = 0; i < headers.length; i++) {
            const header = headers[i];
            // Skip undefined or empty headers - rely on content analysis
            if (!header?.trim()) continue;

            // Header matching wins whenever it recognises anything: it carries
            // the file author's intent, while content analysis can only guess.
            // Letting content outrank a recognised header is how a numeric
            // "Card Number" column used to be typed as the amount and displace
            // the real "Amount" column.
            const headerMatch = this.matchHeader(header);
            if (headerMatch.type !== 'unknown') {
                mappings.push({
                    index: i,
                    type: headerMatch.type,
                    headerName: header,
                    confidence: headerMatch.confidence,
                    headerConfidence: headerMatch.confidence,
                });
                continue;
            }

            const columnValues = sampleRows
                .slice(0, 20) // Sample first 20 rows
                .map((row) => (i < row.cells.length ? row.cells[i] : ''))
                .filter((v): v is string => v !== undefined && v.trim().length > 0);

            const contentMatch = this.analyzeColumnContent(columnValues);

            mappings.push({
                index: i,
                type: contentMatch.type,
                headerName: header,
                confidence: contentMatch.confidence,
                headerConfidence: 0,
            });
        }

        return this.resolveConflicts(mappings);
    }

    /**
     * Match header against known patterns with tiered confidence scoring
     * Priority: exact regex (0.95) > word boundary (0.75) > substring (0.55)
     */
    private matchHeader(header: string): { type: ColumnType; confidence: number } {
        const normalizedHeader = header.trim();

        // Try exact regex match first (highest confidence)
        for (const [type, patterns] of Object.entries(this.patterns)) {
            for (const pattern of patterns) {
                if (pattern.test(normalizedHeader)) {
                    return { type: type as ColumnType, confidence: 0.95 };
                }
            }
        }

        // Keywords for partial matching (English and Russian)
        const keywords: Record<string, ColumnType> = {
            date: 'date',
            дата: 'date',
            время: 'date',
            time: 'date',
            desc: 'description',
            описание: 'description',
            narr: 'description',
            amount: 'amount',
            sum: 'amount',
            сумма: 'amount',
            debit: 'debit',
            дебет: 'debit',
            credit: 'credit',
            кредит: 'credit',
            categ: 'category',
            категор: 'category',
            type: 'category',
            тип: 'category',
            memo: 'memo',
            note: 'memo',
            ref: 'reference',
            balance: 'balance',
            баланс: 'balance',
            currency: 'currency',
            валют: 'currency',
            payee: 'payee',
            merchant: 'payee',
            vendor: 'payee',
        };

        const lowerHeader = normalizedHeader.toLowerCase();

        // Try word boundary match (medium confidence)
        for (const [keyword, type] of Object.entries(keywords)) {
            if (this.matchesAtWordBoundary(lowerHeader, keyword)) {
                return { type, confidence: 0.75 };
            }
        }

        // Fall back to substring match (lower confidence)
        for (const [keyword, type] of Object.entries(keywords)) {
            if (lowerHeader.includes(keyword)) {
                return { type, confidence: 0.55 };
            }
        }

        return { type: 'unknown', confidence: 0 };
    }

    /**
     * Check if keyword appears at word boundary in header
     * Word boundaries: start/end of string, underscore, hyphen, space, digit-to-letter transition
     */
    private matchesAtWordBoundary(header: string, keyword: string): boolean {
        // Build regex pattern with word boundary support for both Latin and Cyrillic
        // Standard \b doesn't work well with Cyrillic, so we use custom boundary detection
        const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        // Define word boundary characters (non-alphanumeric separators)
        const boundaryChars = '[\\s_\\-\\.\\,\\;\\:\\/\\|\\(\\)\\[\\]\\{\\}]';

        // Pattern matches keyword at:
        // 1. Start of string followed by keyword
        // 2. Keyword followed by end of string
        // 3. Keyword surrounded by boundary characters
        const patterns = [
            new RegExp(`^${escapedKeyword}${boundaryChars}`, 'i'),
            new RegExp(`${boundaryChars}${escapedKeyword}$`, 'i'),
            new RegExp(`^${escapedKeyword}$`, 'i'),
            new RegExp(`${boundaryChars}${escapedKeyword}${boundaryChars}`, 'i'),
        ];

        return patterns.some((pattern) => pattern.test(header));
    }

    /**
     * Analyze column content to determine type
     */
    private analyzeColumnContent(
        values: readonly string[]
    ): { type: ColumnType; confidence: number } {
        if (values.length === 0) {
            return { type: 'unknown', confidence: 0 };
        }

        // Count how many values match each type
        const typeCounts: Record<ColumnType, number> = {
            date: 0,
            description: 0,
            payee: 0,
            amount: 0,
            debit: 0,
            credit: 0,
            account: 0,
            category: 0,
            memo: 0,
            reference: 0,
            balance: 0,
            currency: 0,
            unknown: 0,
        };

        for (const value of values) {
            if (this.isDateLike(value)) typeCounts.date++;
            if (this.isAmountLike(value)) typeCounts.amount++;
            if (this.isCurrencyCode(value)) typeCounts.currency++;
            if (this.isReferenceLike(value)) typeCounts.reference++;
        }

        // Find the type with the highest count
        let bestType: ColumnType = 'unknown';
        let bestCount = 0;

        for (const [type, count] of Object.entries(typeCounts)) {
            if (count > bestCount) {
                bestCount = count;
                bestType = type as ColumnType;
            }
        }

        // Calculate confidence based on ratio of matches
        const confidence = values.length > 0 ? bestCount / values.length : 0;

        // If no strong match, treat as description (most common catch-all)
        if (confidence < 0.5 && bestType === 'unknown') {
            // Check if values are text-like (likely description)
            const textCount = values.filter(
                (v) => /[a-zA-Zа-яА-Я]{3,}/.test(v) && !this.isAmountLike(v)
            ).length;
            if (textCount / values.length > 0.5) {
                return { type: 'description', confidence: 0.5 };
            }
        }

        return { type: bestType, confidence };
    }

    /**
     * Check if a value looks like a date
     */
    private isDateLike(value: string): boolean {
        const datePatterns = [
            /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/, // YYYY-MM-DD or YYYY/MM/DD
            /^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}$/, // DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY
            /^\d{1,2}\/\d{1,2}\/\d{2,4}$/, // MM/DD/YYYY or DD/MM/YYYY
        ];

        return datePatterns.some((pattern) => pattern.test(value.trim()));
    }

    /**
     * Check if a value looks like an amount
     */
    private isAmountLike(value: string): boolean {
        // Remove currency symbols and whitespace
        const cleaned = value.replace(/[$€£¥₽₴₸₹\s]/g, '').trim();

        // Identifiers such as card or account numbers are runs of digits far
        // longer than any real amount; without this bound a 16-digit card
        // number reads as a valid integer amount.
        if (/^\d{12,}$/.test(cleaned)) {
            return false;
        }

        // Check for various number formats
        const amountPatterns = [
            /^-?[\d,]+\.\d{1,2}$/, // 1,234.56 or -1,234.56
            /^-?[\d.]+,\d{1,2}$/, // 1.234,56 (European)
            /^-?[\d\s]+[.,]\d{1,2}$/, // 1 234.56 or 1 234,56
            /^-?\d+$/, // Integer
            /^\(-?[\d,.]+\)$/, // (1,234.56) negative notation
        ];

        return amountPatterns.some((pattern) => pattern.test(cleaned));
    }

    /**
     * Check if a value looks like a currency code
     */
    private isCurrencyCode(value: string): boolean {
        const trimmed = value.trim().toUpperCase();
        const currencyCodes = [
            'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'RUB', 'UAH', 'KZT', 'BYN',
            'CAD', 'AUD', 'CHF', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF',
            'TRY', 'BRL', 'MXN', 'INR', 'KRW', 'SGD', 'HKD', 'NZD', 'ZAR',
        ];
        return currencyCodes.includes(trimmed) || /^[A-Z]{3}$/.test(trimmed);
    }

    /**
     * Check if a value looks like a reference/ID
     */
    private isReferenceLike(value: string): boolean {
        const trimmed = value.trim();

        // A pure digit run of this length is a card or account number, not a
        // document reference, and putting it in the transaction header as a
        // code only adds noise that has to be deleted by hand.
        if (/^\d{12,}$/.test(trimmed)) {
            return false;
        }

        // Alphanumeric codes, typically 6+ characters
        return /^[A-Za-z0-9]{6,}$/.test(trimmed) && /\d/.test(trimmed);
    }

    /**
     * Merge custom patterns with defaults
     */
    private mergePatterns(
        defaults: HeaderPatterns,
        custom: Partial<HeaderPatterns>
    ): HeaderPatterns {
        const result: Record<string, RegExp[]> = {};

        for (const [key, patterns] of Object.entries(defaults)) {
            result[key] = [...patterns];
        }

        for (const [key, patterns] of Object.entries(custom)) {
            if (patterns) {
                result[key] = [...(result[key] ?? []), ...patterns];
            }
        }

        return result as unknown as HeaderPatterns;
    }

    /**
     * Resolve conflicts when several columns claim the same type.
     *
     * The best claim wins the type and the losers become `unknown`. A column
     * whose own header named the type outranks one that was only guessed from
     * its values, so a numeric "Check" column can never take the amount type
     * away from the column actually headed "Amount".
     */
    private resolveConflicts(mappings: ColumnMapping[]): ColumnMapping[] {
        const bestForType = new Map<ColumnType, ColumnMapping>();

        for (const mapping of mappings) {
            if (mapping.type === 'unknown') {
                continue;
            }

            const existing = bestForType.get(mapping.type);
            if (!existing || this.claimBeats(mapping, existing)) {
                bestForType.set(mapping.type, mapping);
            }
        }

        // Rebuild in column order; every column that lost its type keeps its
        // own entry, so the caller can still see which column it was.
        return mappings.map((mapping) => {
            if (mapping.type === 'unknown' || bestForType.get(mapping.type) === mapping) {
                return mapping;
            }
            return { ...mapping, type: 'unknown', confidence: 0 };
        });
    }

    /** True when `candidate` has a stronger claim to its type than `existing`. */
    private claimBeats(candidate: ColumnMapping, existing: ColumnMapping): boolean {
        const candidateHeader = candidate.headerConfidence ?? 0;
        const existingHeader = existing.headerConfidence ?? 0;

        // A header that names the type beats a guess made from the values.
        if ((candidateHeader > 0) !== (existingHeader > 0)) {
            return candidateHeader > 0;
        }

        if (candidate.confidence !== existing.confidence) {
            return candidate.confidence > existing.confidence;
        }

        return candidateHeader > existingHeader;
    }

    /**
     * Get mapping for a specific column type
     */
    static findMapping(
        mappings: readonly ColumnMapping[],
        type: ColumnType
    ): ColumnMapping | undefined {
        return mappings.find((m) => m.type === type);
    }

    /**
     * Check if required columns are present
     */
    static hasRequiredColumns(mappings: readonly ColumnMapping[]): {
        valid: boolean;
        missing: ColumnType[];
    } {
        const required: ColumnType[] = ['date'];
        const needsAmount = !mappings.some(
            (m) => m.type === 'debit' || m.type === 'credit'
        );

        if (needsAmount) {
            required.push('amount');
        }

        const missing = required.filter(
            (type) => !mappings.some((m) => m.type === type)
        );

        return {
            valid: missing.length === 0,
            missing,
        };
    }
}
