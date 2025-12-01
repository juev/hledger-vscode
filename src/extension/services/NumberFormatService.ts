// NumberFormatService.ts - International number formatting support for hledger
// Provides parsing, validation, and pattern generation for different number formats
// Supports decimal marks (period, comma) and group separators (space, comma, period)

import { Result, ValidationResult, success, failure, validationSuccess, validationFailure, isFailure } from '../types';

/**
 * Interface defining the structure of a number format.
 * Supports international number formatting with customizable decimal and group separators.
 */
export interface NumberFormat {
    /** The decimal separator character (e.g., '.', ',') */
    readonly decimalMark: '.' | ',';
    /** The group separator character for thousands grouping (e.g., ' ', ',', '.') */
    readonly groupSeparator: ' ' | ',' | '.' | '';
    /** Number of decimal places (e.g., 2 for currency) */
    readonly decimalPlaces: number;
    /** Whether to include group separators in formatted numbers */
    readonly useGrouping: boolean;
}

/**
 * Interface for commodity format templates used in hledger.
 * Represents format definitions like "1 000,00 EUR" or "$1,234.56"
 */
export interface CommodityFormat {
    /** The parsed number format information */
    readonly format: NumberFormat;
    /** The commodity symbol or code (e.g., 'EUR', 'USD', '$') */
    readonly symbol: string;
    /** Whether the symbol appears before the number */
    readonly symbolBefore: boolean;
    /** Space between symbol and number (if any) */
    readonly symbolSpacing: boolean;
    /** The original template string */
    readonly template: string;
}

/**
 * Interface for parsed amount information.
 * Represents a successfully parsed number with its components.
 */
export interface ParsedAmount {
    /** The numeric value as a number */
    readonly value: number;
    /** The integer part of the number */
    readonly integerPart: string;
    /** The decimal part of the number (if any) */
    readonly decimalPart?: string;
    /** The format that was used to parse this amount */
    readonly format: NumberFormat;
    /** The original input string */
    readonly original: string;
}

/**
 * Default number formats for common international conventions.
 * These represent the most widely used formatting patterns globally.
 *
 * Note: Indian numbering (1,00,00,000.00) uses non-uniform grouping (3,2,2...)
 * which is handled by the flexible amount validation regex in HLedgerDiagnosticsProvider,
 * not by this service's pattern generation.
 */
export const DEFAULT_NUMBER_FORMATS: readonly NumberFormat[] = [
    // US/UK format: 1,234.56
    { decimalMark: '.', groupSeparator: ',', decimalPlaces: 2, useGrouping: true },
    // European format: 1 234,56
    { decimalMark: ',', groupSeparator: ' ', decimalPlaces: 2, useGrouping: true },
    // European format: 1.234,56
    { decimalMark: ',', groupSeparator: '.', decimalPlaces: 2, useGrouping: true },
    // Swiss format: 1'234.56
    { decimalMark: '.', groupSeparator: '', decimalPlaces: 2, useGrouping: false },
    // Simple formats without grouping
    { decimalMark: '.', groupSeparator: '', decimalPlaces: 2, useGrouping: false },
    { decimalMark: ',', groupSeparator: '', decimalPlaces: 2, useGrouping: false }
] as const;

/**
 * Service class providing comprehensive international number formatting support.
 * Handles parsing, validation, and pattern generation for different number formats.
 * 
 * Key features:
 * - Unicode-aware number parsing with \p{N} patterns
 * - Support for various decimal marks and group separators
 * - Commodity format template parsing
 * - Regex pattern generation for completion systems
 * - Robust validation and error handling
 * - Integration with existing hledger format conventions
 */
export class NumberFormatService {
    private readonly formats: readonly NumberFormat[];
    private readonly patternCache = new Map<string, RegExp>();

    /**
     * Creates a new NumberFormatService instance.
     * @param customFormats Optional array of custom number formats to use instead of defaults
     */
    constructor(customFormats?: readonly NumberFormat[]) {
        this.formats = customFormats || DEFAULT_NUMBER_FORMATS;
    }

    /**
     * Parses an amount string using the best matching format.
     * Attempts to parse with each known format until successful.
     * 
     * @param input The input string to parse (e.g., "1,234.56", "1 234,56")
     * @returns Result containing ParsedAmount on success, or Error on failure
     * 
     * @example
     * ```typescript
     * const service = new NumberFormatService();
     * const result = service.parseAmount("1,234.56");
     * if (result.success) {
     *   console.log(result.data.value); // 1234.56
     * }
     * ```
     */
    parseAmount(input: string): Result<ParsedAmount> {
        if (!input || typeof input !== 'string') {
            return failure(new Error('Input must be a non-empty string'));
        }

        const trimmedInput = input.trim();
        if (!trimmedInput) {
            return failure(new Error('Input cannot be empty or whitespace only'));
        }

        // Try each format until one succeeds
        for (const format of this.formats) {
            const result = this.tryParseWithFormat(trimmedInput, format);
            if (result.success) {
                return result;
            }
        }

        return failure(new Error(`Unable to parse amount: "${input}" does not match any known number format`));
    }

    /**
     * Creates a regex pattern for matching amounts in the specified format.
     * Uses Unicode-aware patterns for international number support.
     *
     * Supports hledger amount formats:
     * - Sign placement: -100, +100, $-100, -$100
     * - Scientific notation: 1E3, 1e-6, 1E+3
     * - Trailing decimal: 10. (disambiguates integer from decimal)
     * - Currency symbols: $100, €100, ₽100
     *
     * @param format The number format to create a pattern for
     * @returns RegExp pattern that matches numbers in the specified format
     *
     * @example
     * ```typescript
     * const service = new NumberFormatService();
     * const usFormat = { decimalMark: '.', groupSeparator: ',', decimalPlaces: 2, useGrouping: true };
     * const pattern = service.createAmountPattern(usFormat);
     * console.log(pattern.test("1,234.56")); // true
     * console.log(pattern.test("$-1,234.56")); // true
     * console.log(pattern.test("1E3")); // true
     * ```
     */
    createAmountPattern(format: NumberFormat): RegExp {
        const cacheKey = this.getFormatCacheKey(format);
        const cached = this.patternCache.get(cacheKey);
        if (cached) {
            return cached;
        }

        const { decimalMark, groupSeparator, useGrouping } = format;

        // Escape special regex characters
        const escapeRegex = (char: string): string => {
            return char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        };

        const escapedDecimalMark = escapeRegex(decimalMark);
        const escapedGroupSeparator = useGrouping && groupSeparator ? escapeRegex(groupSeparator) : '';

        // Extended pattern components for hledger amount formats
        // Sign can appear before currency or after currency (before number)
        const signPattern = '[+-]?';
        // Currency symbols: Unicode currency symbols (Sc category)
        const currencyPattern = '[\\p{Sc}]?';
        // Scientific notation: E or e followed by optional sign and digits
        const scientificPattern = '(?:[Ee][+-]?\\p{N}+)?';

        let pattern: string;

        if (useGrouping && groupSeparator) {
            // Pattern for grouped numbers with Unicode digit support
            // Matches: 1,234.56 or 1 234,56 or -$1,234.56 depending on format
            // Support crypto amounts with many decimal places (up to 12)
            // Pattern: [sign]? [currency]? [sign]? grouped_number [decimal]? [scientific]?
            const groupPattern = `\\p{N}{1,3}(?:${escapedGroupSeparator}\\p{N}{3})*`;
            // Decimal part: optional, allows trailing decimal (10.) or decimal with digits
            const decimalPattern = `(?:${escapedDecimalMark}\\p{N}{0,12})?`;
            pattern = `^${signPattern}${currencyPattern}${signPattern}${groupPattern}${decimalPattern}${scientificPattern}$`;
        } else {
            // Pattern for simple numbers without grouping
            // Matches: 1234.56 or $-1234.56 or 1E3 depending on format
            // Pattern: [sign]? [currency]? [sign]? integer [decimal]? [scientific]?
            const integerPattern = '\\p{N}+';
            // Decimal part: optional, allows trailing decimal (10.) or decimal with digits
            const decimalPattern = `(?:${escapedDecimalMark}\\p{N}{0,12})?`;
            pattern = `^${signPattern}${currencyPattern}${signPattern}${integerPattern}${decimalPattern}${scientificPattern}$`;
        }

        const regex = new RegExp(pattern, 'u');
        this.patternCache.set(cacheKey, regex);
        return regex;
    }

    /**
     * Parses a commodity format template string.
     * Extracts format information from templates like "1 000,00 EUR" or "$1,234.56"
     * 
     * @param template The template string (e.g., "1 000,00 EUR", "$1,234.56")
     * @returns Result containing CommodityFormat on success, or Error on failure
     * 
     * @example
     * ```typescript
     * const service = new NumberFormatService();
     * const result = service.parseFormatTemplate("1 000,00 EUR");
     * if (result.success) {
     *   console.log(result.data.symbol); // "EUR"
     *   console.log(result.data.format.decimalMark); // ","
     * }
     * ```
     */
    parseFormatTemplate(template: string): Result<CommodityFormat> {
        if (!template || typeof template !== 'string') {
            return failure(new Error('Template must be a non-empty string'));
        }

        const trimmedTemplate = template.trim();
        if (!trimmedTemplate) {
            return failure(new Error('Template cannot be empty or whitespace only'));
        }

        // Pattern to match various commodity format templates
        // Supports: "1,234.56 USD", "USD 1,234.56", "$1,234.56", "1.234,56 EUR"
        const templatePattern = /^(?:([\p{Sc}\p{Lu}]+)\s*)?(\p{N}[^\p{Lu}\p{Sc}]*\p{N}|\p{N}+)(?:\s*([\p{Sc}\p{Lu}]+))?$/u;
        const match = templatePattern.exec(trimmedTemplate);

        if (!match) {
            return failure(new Error(`Invalid commodity format template: "${template}"`));
        }

        // Safe destructuring with null checks for regex capture groups
        const matchGroups = match.slice(1); // Skip the full match at index 0
        const prefixSymbol = matchGroups[0] || undefined;
        const numberPart = matchGroups[1];
        const suffixSymbol = matchGroups[2] || undefined;
        
        // Ensure we have a valid number part
        if (!numberPart) {
            return failure(new Error(`No number part found in template: "${template}"`));
        }
        
        const symbol = prefixSymbol || suffixSymbol || '';
        
        if (!symbol) {
            return failure(new Error(`No commodity symbol found in template: "${template}"`));
        }

        const symbolBefore = !!prefixSymbol;
        const symbolSpacing = symbolBefore 
            ? /\s/.test(template.substring(symbol.length, symbol.length + 2))
            : /\s/.test(template.substring(template.indexOf(numberPart) + numberPart.length, template.indexOf(symbol)));

        // Parse the number part to determine format
        const formatResult = this.extractFormatFromNumber(numberPart);
        if (!formatResult.success) {
            return failure(new Error(`Invalid number format in template: "${numberPart}"`));
        }

        const commodityFormat: CommodityFormat = {
            format: formatResult.data,
            symbol,
            symbolBefore,
            symbolSpacing,
            template: trimmedTemplate
        };

        return success(commodityFormat);
    }

    /**
     * Validates if a string represents a valid number in any supported format.
     * 
     * @param input The string to validate
     * @returns ValidationResult with detailed error information
     * 
     * @example
     * ```typescript
     * const service = new NumberFormatService();
     * const result = service.validateAmount("1,234.56");
     * if (result.isValid) {
     *   console.log("Valid number:", result.value);
     * } else {
     *   console.log("Errors:", result.errors);
     * }
     * ```
     */
    validateAmount(input: string): ValidationResult<ParsedAmount> {
        const parseResult = this.parseAmount(input);
        
        if (parseResult.success) {
            return validationSuccess(parseResult.data);
        } else {
            // Use type guard to safely access error property
            if (isFailure(parseResult)) {
                return validationFailure([parseResult.error.message]);
            }
            return validationFailure(['Unknown parsing error']);
        }
    }

    /**
     * Gets all supported number formats.
     * @returns Array of all number formats supported by this service
     */
    getSupportedFormats(): readonly NumberFormat[] {
        return this.formats;
    }

    /**
     * Creates a pattern that matches amounts in any supported format.
     * Useful for general number matching in completion systems.
     * 
     * @returns RegExp that matches numbers in any supported format
     */
    createUniversalAmountPattern(): RegExp {
        // Create a pattern that matches any of the supported formats
        const patterns = this.formats.map(format => {
            const pattern = this.createAmountPattern(format);
            // Remove ^ and $ anchors for combining
            return pattern.source.replace(/^\^|\$$/g, '');
        });

        const combinedPattern = `^(?:${patterns.join('|')})$`;
        return new RegExp(combinedPattern, 'u');
    }

    /**
     * Attempts to parse input with a specific format.
     * Internal method used by parseAmount.
     * 
     * @private
     * @param input The trimmed input string
     * @param format The format to try
     * @returns Result containing ParsedAmount on success
     */
    private tryParseWithFormat(input: string, format: NumberFormat): Result<ParsedAmount> {
        const pattern = this.createAmountPattern(format);
        
        if (!pattern.test(input)) {
            return failure(new Error(`Input does not match format pattern`));
        }

        try {
            const { decimalMark, groupSeparator, useGrouping } = format;
            
            // Remove group separators if present
            let cleanInput = input;
            if (useGrouping && groupSeparator) {
                // Use a more precise regex to remove group separators
                const groupSepRegex = new RegExp(this.escapeRegexChar(groupSeparator), 'g');
                cleanInput = cleanInput.replace(groupSepRegex, '');
            }

            // Replace decimal mark with period for parsing
            if (decimalMark !== '.') {
                cleanInput = cleanInput.replace(decimalMark, '.');
            }

            const numericValue = parseFloat(cleanInput);
            
            if (isNaN(numericValue) || !isFinite(numericValue)) {
                return failure(new Error(`Cannot convert to valid number: ${cleanInput}`));
            }

            // Extract parts with safe array access
            const parts = input.split(decimalMark);
            const integerPart = parts[0];
            if (!integerPart) {
                return failure(new Error(`Invalid number format: no integer part found in "${input}"`));
            }
            const decimalPart = parts.length > 1 ? parts[1] : undefined;

            // Create ParsedAmount with proper handling of optional properties for exactOptionalPropertyTypes
            const baseParsedAmount: ParsedAmount = {
                value: numericValue,
                integerPart,
                format,
                original: input
            };

            // Only add decimalPart if it exists to comply with exactOptionalPropertyTypes
            if (decimalPart !== undefined) {
                return success({
                    ...baseParsedAmount,
                    decimalPart
                });
            }

            return success(baseParsedAmount);

        } catch (error) {
            return failure(new Error(`Parse error: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
    }

    /**
     * Extracts format information from a number string.
     * Used internally by parseFormatTemplate.
     * 
     * @private
     * @param numberStr The number string to analyze
     * @returns Result containing the detected NumberFormat
     */
    private extractFormatFromNumber(numberStr: string): Result<NumberFormat> {
        // Determine decimal mark and group separator from the number
        const hasCommaDecimal = /\p{N},\p{N}{1,2}$/u.test(numberStr);
        const hasPeriodDecimal = /\p{N}\.\p{N}{1,2}$/u.test(numberStr);
        
        let decimalMark: '.' | ',';
        let groupSeparator: ' ' | ',' | '.' | '';
        let useGrouping = false;

        if (hasCommaDecimal) {
            decimalMark = ',';
            // Check for group separators before the decimal comma
            if (/\s/.test(numberStr)) {
                groupSeparator = ' ';
                useGrouping = true;
            } else if (/\./.test(numberStr.substring(0, numberStr.lastIndexOf(',')))) {
                groupSeparator = '.';
                useGrouping = true;
            } else {
                groupSeparator = '';
                useGrouping = false;
            }
        } else if (hasPeriodDecimal) {
            decimalMark = '.';
            // Check for group separators before the decimal period
            if (/,/.test(numberStr.substring(0, numberStr.lastIndexOf('.')))) {
                groupSeparator = ',';
                useGrouping = true;
            } else if (/\s/.test(numberStr)) {
                groupSeparator = ' ';
                useGrouping = true;
            } else {
                groupSeparator = '';
                useGrouping = false;
            }
        } else {
            // No decimal point - determine from grouping
            if (/,/.test(numberStr)) {
                decimalMark = '.';
                groupSeparator = ',';
                useGrouping = true;
            } else if (/\s/.test(numberStr)) {
                decimalMark = ',';
                groupSeparator = ' ';
                useGrouping = true;
            } else {
                // Default to period decimal mark
                decimalMark = '.';
                groupSeparator = '';
                useGrouping = false;
            }
        }

        // Determine decimal places from the decimal part
        let decimalPlaces = 2; // Default
        if (hasCommaDecimal) {
            const decimalPart = numberStr.substring(numberStr.lastIndexOf(',') + 1);
            decimalPlaces = decimalPart.length;
        } else if (hasPeriodDecimal) {
            const decimalPart = numberStr.substring(numberStr.lastIndexOf('.') + 1);
            decimalPlaces = decimalPart.length;
        }

        const format: NumberFormat = {
            decimalMark,
            groupSeparator,
            decimalPlaces,
            useGrouping
        };

        return success(format);
    }

    /**
     * Creates a cache key for a number format.
     * Used for caching compiled regex patterns.
     * 
     * @private
     * @param format The format to create a key for
     * @returns String cache key
     */
    private getFormatCacheKey(format: NumberFormat): string {
        return `${format.decimalMark}_${format.groupSeparator}_${format.useGrouping}_${format.decimalPlaces}`;
    }

    /**
     * Escapes a character for use in a regular expression.
     * 
     * @private
     * @param char The character to escape
     * @returns Escaped character string
     */
    private escapeRegexChar(char: string): string {
        return char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}

/**
 * Creates a default NumberFormatService instance.
 * Convenience function for common use cases.
 * 
 * @returns New NumberFormatService with default formats
 */
export function createNumberFormatService(): NumberFormatService {
    return new NumberFormatService();
}

/**
 * Type guard to check if an object is a valid NumberFormat.
 * 
 * @param obj The object to check
 * @returns True if the object is a valid NumberFormat
 */
export function isNumberFormat(obj: any): obj is NumberFormat {
    return typeof obj === 'object' &&
           obj !== null &&
           (obj.decimalMark === '.' || obj.decimalMark === ',') &&
           typeof obj.groupSeparator === 'string' &&
           typeof obj.decimalPlaces === 'number' &&
           typeof obj.useGrouping === 'boolean' &&
           obj.decimalPlaces >= 0 &&
           Number.isInteger(obj.decimalPlaces);
}

/**
 * Type guard to check if an object is a valid CommodityFormat.
 * 
 * @param obj The object to check
 * @returns True if the object is a valid CommodityFormat
 */
export function isCommodityFormat(obj: any): obj is CommodityFormat {
    return typeof obj === 'object' &&
           obj !== null &&
           isNumberFormat(obj.format) &&
           typeof obj.symbol === 'string' &&
           obj.symbol.length > 0 &&
           typeof obj.symbolBefore === 'boolean' &&
           typeof obj.symbolSpacing === 'boolean' &&
           typeof obj.template === 'string' &&
           obj.template.length > 0;
}