import * as vscode from 'vscode';
import { CompletionType } from '../types';
import { NumberFormatService, NumberFormat } from '../services/NumberFormatService';
import { HLedgerConfig } from '../HLedgerConfig';
import { RegexPatterns } from '../RegexPatterns';

export enum LineContext {
    LineStart = 'line_start',           // Beginning of line - only dates allowed
    AfterDate = 'after_date',           // After date - payee/description  
    InPosting = 'in_posting',           // Indented line - accounts (expense/income categories)
    AfterAmount = 'after_amount',       // After amount - only currency allowed
    InComment = 'in_comment',           // Cursor is in a comment (after ; or #)
    InTagValue = 'in_tag_value',        // Cursor is after a tag name and colon
    Forbidden = 'forbidden'             // Forbidden zone - no completions allowed
}

/**
 * Type guard for LineContext validation.
 */
export const isLineContext = (value: string): value is LineContext => {
    return Object.values(LineContext).includes(value as LineContext);
};

export interface PositionInfo {
    lineText: string;
    character: number;
    beforeCursor: string;
    afterCursor: string;
}

export interface StrictCompletionContext {
    lineContext: LineContext;
    allowedTypes: CompletionType[];
    suppressAll: boolean;
    position: PositionInfo;
}

/**
 * LRU Cache implementation for RegExp patterns with memory limit
 */
class RegexCache {
    private readonly maxSize: number;
    private cache = new Map<string, RegExp>();

    constructor(maxSize = 50) {
        this.maxSize = maxSize;
    }

    get(key: string): RegExp | undefined {
        const value = this.cache.get(key);
        if (value !== undefined) {
            // Move to end (LRU behavior)
            this.cache.delete(key);
            this.cache.set(key, value);
        }
        return value;
    }

    set(key: string, value: RegExp): void {
        if (this.cache.has(key)) {
            this.cache.delete(key);
        } else if (this.cache.size >= this.maxSize) {
            // Remove least recently used (first item)
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        this.cache.set(key, value);
    }

    clear(): void {
        this.cache.clear();
    }

    size(): number {
        return this.cache.size;
    }
}

export class StrictPositionAnalyzer {
    private readonly numberFormatService: NumberFormatService;
    private readonly config: HLedgerConfig;
    private readonly patternCache = new RegexCache(50); // Limit to prevent memory leaks

    private static readonly STRICT_PATTERNS = {
        // Strict date patterns - only at line beginning
        DATE_LINE_START: RegexPatterns.DATE_LINE_START,

        // Date with optional status marker (*!) - without payee
        DATE_WITH_STATUS: RegexPatterns.DATE_WITH_STATUS,

        // After date with payee - includes status markers and Unicode support
        AFTER_DATE_PATTERN: RegexPatterns.AFTER_DATE_PATTERN,

        // Date with status and space (ready for payee input)
        DATE_WITH_STATUS_AND_SPACE: RegexPatterns.DATE_WITH_STATUS_AND_SPACE,

        // SPECIAL PATTERNS FOR DIGIT "0" with Unicode support
        ZERO_START: RegexPatterns.ZERO_START,                  // Just "0"
        ZERO_MONTH: RegexPatterns.ZERO_MONTH,                  // "01" through "09"
        ZERO_PARTIAL_DATE: RegexPatterns.ZERO_PARTIAL_DATE,    // "01-", "01-15"
        
        // Account on indented line with Unicode support
        ACCOUNT_INDENTED: /^\s{2,}([\p{L}][\p{L}\p{N}:_-]*)$/u,
        
        // NOTE: Amount patterns are now dynamically generated based on detected formats
        // The following patterns will be replaced by format-aware equivalents:
        // AMOUNT_PATTERN - replaced by createForbiddenZonePattern()
        // CURRENCY_AFTER_AMOUNT - replaced by createCurrencyTriggerPattern() 
        // FORBIDDEN_AFTER_AMOUNT - replaced by createForbiddenZonePattern()
    };
    
    constructor(numberFormatService: NumberFormatService, config: HLedgerConfig) {
        this.numberFormatService = numberFormatService;
        this.config = config;
    }

    /**
     * Cleanup method to prevent memory leaks
     */
    public dispose(): void {
        this.patternCache.clear();
    }
    
    /**
     * Gets format-aware amount patterns with caching to prevent memory leaks.
     * Returns cached patterns for different contexts: forbidden zone, currency trigger, etc.
     */
    private getAmountPatterns(): {
        forbiddenZone: RegExp;
        currencyTrigger: RegExp;
        afterAmountTwoSpaces: RegExp;
        afterAmountSingleSpace: RegExp;
    } {
        const cacheKey = 'amount-patterns';

        // Try to get cached patterns
        const forbiddenZone = this.patternCache.get(`${cacheKey}-forbidden`);
        const currencyTrigger = this.patternCache.get(`${cacheKey}-currency`);
        const afterAmountTwoSpaces = this.patternCache.get(`${cacheKey}-two-spaces`);
        const afterAmountSingleSpace = this.patternCache.get(`${cacheKey}-single-space`);

        // If all patterns are cached, return them
        if (forbiddenZone && currencyTrigger && afterAmountTwoSpaces && afterAmountSingleSpace) {
            return {
                forbiddenZone,
                currencyTrigger,
                afterAmountTwoSpaces,
                afterAmountSingleSpace
            };
        }

        // Get supported formats from the NumberFormatService
        const formats = this.numberFormatService.getSupportedFormats();

        // Create pattern variants for different decimal marks
        const createAmountPatternForFormat = (format: NumberFormat): string => {
            const { decimalMark, groupSeparator, useGrouping } = format;

            // Escape special regex characters
            const escapeRegex = (char: string): string => {
                return char.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
            };

            const escapedDecimalMark = escapeRegex(decimalMark);

            if (useGrouping && groupSeparator) {
                const escapedGroupSeparator = escapeRegex(groupSeparator);
                // Pattern for grouped numbers: 1,234.56 or 1 234,56
                return `\\p{N}{1,3}(?:${escapedGroupSeparator}\\p{N}{3})*(?:${escapedDecimalMark}\\p{N}{1,4})?`;
            } else {
                // Pattern for simple numbers: 1234.56 or 1234,56
                return `\\p{N}+(?:${escapedDecimalMark}\\p{N}{1,4})?`;
            }
        };

        // Generate patterns for all supported formats
        const amountPatternVariants = formats.map(createAmountPatternForFormat);
        const amountPattern = `(?:${amountPatternVariants.join('|')})`;

        // Create and cache specific patterns for different contexts
        const patterns = {
            // Forbidden zone: after amount + two or more spaces
            forbiddenZone: (() => {
                const pattern = new RegExp(`^${amountPattern}\\s{2,}.*$`, 'u');
                this.patternCache.set(`${cacheKey}-forbidden`, pattern);
                return pattern;
            })(),

            // Currency trigger: after amount + single space (+ optional currency)
            currencyTrigger: (() => {
                const pattern = new RegExp(`^${amountPattern}\\s([\\p{Lu}\\p{Sc}$€£¥₽]*)?$`, 'u');
                this.patternCache.set(`${cacheKey}-currency`, pattern);
                return pattern;
            })(),

            // After amount with two or more spaces (for detection)
            afterAmountTwoSpaces: (() => {
                const pattern = new RegExp(`^${amountPattern}\\s{2,}$`, 'u');
                this.patternCache.set(`${cacheKey}-two-spaces`, pattern);
                return pattern;
            })(),

            // After amount with single space (for detection)
            afterAmountSingleSpace: (() => {
                const pattern = new RegExp(`^${amountPattern}\\s$`, 'u');
                this.patternCache.set(`${cacheKey}-single-space`, pattern);
                return pattern;
            })()
        };

        return patterns;
    }

    /**
     * Gets a universal amount pattern with caching that matches amounts in any supported format.
     * Used for general amount detection in posting contexts.
     */
    private getUniversalAmountPattern(): RegExp {
        const cacheKey = 'universal-amount';
        const cached = this.patternCache.get(cacheKey);
        if (cached) {
            return cached;
        }

        const pattern = this.numberFormatService.createUniversalAmountPattern();
        this.patternCache.set(cacheKey, pattern);
        return pattern;
    }

    /**
     * Detects if a string contains an amount in any supported format.
     * More robust than hardcoded patterns, supports international formats.
     */
    private containsAmount(text: string): boolean {
        const universalPattern = this.getUniversalAmountPattern();

        // Look for amount patterns in the text
        // This matches standalone amounts or amounts followed by spaces/currency
        const cacheKey = 'amount-in-context';
        let amountInContextPattern = this.patternCache.get(cacheKey);

        if (!amountInContextPattern) {
            amountInContextPattern = new RegExp(
                `(^|\\s)(${universalPattern.source.replace(/^\^|\$$/g, '')})(\\s|$)`,
                'u'
            );
            this.patternCache.set(cacheKey, amountInContextPattern);
        }

        return amountInContextPattern.test(text);
    }
    
    analyzePosition(document: vscode.TextDocument, position: vscode.Position): StrictCompletionContext {
        const lineText = document.lineAt(position.line).text;
        const beforeCursor = lineText.substring(0, position.character);
        const afterCursor = lineText.substring(position.character);
        
        const positionInfo: PositionInfo = {
            lineText,
            character: position.character,
            beforeCursor,
            afterCursor
        };
        
        const lineContext = this.determineLineContext(lineText, position.character);
        return this.applyStrictRules(lineContext, beforeCursor, afterCursor, positionInfo);
    }
    
    private determineLineContext(lineText: string, cursorPos: number): LineContext {
        const beforeCursor = lineText.substring(0, cursorPos);
        
        // Priority 1: Check if we are in a comment (highest priority for tags)
        // Comments have highest priority because they can appear after amounts
        if (this.isInCommentContext(lineText, cursorPos)) {
            // Check if we are after a tag name and colon
            if (this.isInTagValueContext(lineText, cursorPos)) {
                return LineContext.InTagValue;
            }
            return LineContext.InComment;
        }
        
        // Priority 2: Check for indented line (posting context)
        if (lineText.startsWith(' ') || lineText.startsWith('\t')) {
            // For indented lines, we need to check if we're in specific amount-related contexts
            
            // Priority 2a: Check forbidden zone - after amount + two or more spaces
            // This is the most restrictive check within posting context
            if (this.isForbiddenZoneContext(beforeCursor)) {
                return LineContext.Forbidden;
            }
            
            // Priority 2b: Check currency position (after amount + single space + optional currency)
            // Match patterns with format-aware amount detection:
            // 1. "  Account  123.45 " or "  Account  123,45 " (cursor right after space)
            // 2. "  Account  123.45 USD" or "  Account  123,45 EUR" (cursor after existing currency)
            // 3. "  Account  123.45 U" (cursor after partial currency)
            // 4. "  Account  123 " (whole numbers)
            // 5. "  Account  123.456 BTC" or "  Account  123,456 BTC" (varying decimal precision)
            // Pattern: indentation + account + amount + space + optional currency symbols
            const universalAmountPattern = this.getUniversalAmountPattern();
            const accountNamePart = `[\\p{L}\\p{N}:_\-]+(?:\\s+[\\p{L}\\p{N}:_\-]+)*`;

            // Cache the account amount currency pattern
            const cacheKey = 'account-amount-currency';
            let accountAmountCurrencyPattern = this.patternCache.get(cacheKey);
            if (!accountAmountCurrencyPattern) {
                accountAmountCurrencyPattern = new RegExp(
                    `^\\s+${accountNamePart}\\s+(${universalAmountPattern.source.replace(/^\^|\$$/g, '')})\\s([\\p{Lu}\\p{Sc}$€£¥₽]*)?$`,
                    'u'
                );
                this.patternCache.set(cacheKey, accountAmountCurrencyPattern);
            }
            if (accountAmountCurrencyPattern.test(beforeCursor)) {
                return LineContext.AfterAmount;
            }
            
            // Priority 2c: Default to account completion for other indented contexts
            return LineContext.InPosting;
        }
        
        // Priority 3: CRITICAL FIX - Check after date + space BEFORE line start detection
        // This ensures proper payee completion after date + space
        if (this.isAfterDateWithSpace(beforeCursor)) {
            return LineContext.AfterDate;
        }
        
        // Priority 4: Check line beginning for dates - ANY digit at line start triggers date completion
        // This comes AFTER after-date detection to prevent conflicts
        if (cursorPos > 0 && this.isDateContext(lineText, cursorPos)) {
            return LineContext.LineStart;
        }
        
        // Default: Forbidden zone for unrecognized contexts
        return LineContext.Forbidden;
    }
    
    /**
     * Determines if cursor is positioned after a complete date with space (ready for payee input)
     * Supports Unicode characters in payee names
     */
    private isAfterDateWithSpace(beforeCursor: string): boolean {
        // Pattern: Date + optional status marker + space + optional payee characters
        // Examples: "2024-01-15 ", "2024-01-15 * ", "01/15 Amazon", "2024-12-31 ! Банк"
        return StrictPositionAnalyzer.STRICT_PATTERNS.AFTER_DATE_PATTERN.test(beforeCursor) ||
               StrictPositionAnalyzer.STRICT_PATTERNS.DATE_WITH_STATUS_AND_SPACE.test(beforeCursor);
    }
    
    /**
     * Determines if cursor is in a comment context (after ; or #)
     */
    private isInCommentContext(lineText: string, cursorPos: number): boolean {
        // Find the position of comment markers ; or #
        const semicolonIndex = lineText.indexOf(';');
        const hashIndex = lineText.indexOf('#');
        
        // Check if cursor is after a comment marker
        if (semicolonIndex !== -1 && cursorPos > semicolonIndex) {
            return true;
        }
        if (hashIndex !== -1 && cursorPos > hashIndex) {
            return true;
        }
        
        return false;
    }
    
    /**
     * Determines if cursor is in a forbidden zone - after amount + two or more spaces
     * Uses a simpler approach that checks for amount patterns followed by multiple spaces
     */
    private isForbiddenZoneContext(beforeCursor: string): boolean {
        // Simple patterns for common amount formats followed by two or more spaces
        const forbiddenPatterns = [
            // US format: 123.45 + two or more spaces (including crypto with many decimals)
            /\d+\.\d+\s{2,}/u,
            // European format: 123,45 + two or more spaces (including crypto with many decimals)
            /\d+,\d+\s{2,}/u,
            // Whole numbers: 123 + two or more spaces
            /\d+\s{2,}/u,
            // Grouped US format: 1,234.56 + two or more spaces
            /\d{1,3}(?:,\d{3})*\.\d+\s{2,}/u,
            // Grouped European format: 1.234,56 + two or more spaces or 1 234,56
            /\d{1,3}(?:[.\s]\d{3})*,\d+\s{2,}/u,
        ];
        
        // Test each pattern
        for (const pattern of forbiddenPatterns) {
            if (pattern.test(beforeCursor)) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Determines if cursor is after a tag name and colon (ready for tag value input)
     */
    private isInTagValueContext(lineText: string, cursorPos: number): boolean {
        const beforeCursor = lineText.substring(0, cursorPos);
        
        // Find the last comment marker position
        const lastSemicolon = beforeCursor.lastIndexOf(';');
        const lastHash = beforeCursor.lastIndexOf('#');
        const commentStart = Math.max(lastSemicolon, lastHash);
        
        if (commentStart === -1) {
            return false;
        }
        
        // Get text after comment marker up to cursor position
        const afterComment = beforeCursor.substring(commentStart + 1);
        
        // Look for the last tag pattern in the comment text
        // Pattern matches: " category:food, type:" where cursor is after the last colon
        // We need to find if there's a tag name followed by colon that extends to cursor position
        
        // Split by comma/semicolon to handle multiple tags, then check the last segment
        const segments = afterComment.split(/[,;]/);
        const lastSegment = segments[segments.length - 1];
        
        if (!lastSegment) {
            return false;
        }
        
        // Check if the last segment contains a tag name followed by colon
        // Pattern: optional whitespace, tag name (Unicode letters/numbers/underscore/hyphen/SPACE), colon, optional tag value
        const tagValuePattern = /^\s*([\p{L}\p{N}_\s-]+):\s*([^,;]*)$/u;
        const result = tagValuePattern.test(lastSegment);
        
        
        return result;
    }
    
    private applyStrictRules(
        context: LineContext, 
        beforeCursor: string, 
        afterCursor: string,
        position: PositionInfo
    ): StrictCompletionContext {
        
        const baseContext: StrictCompletionContext = {
            lineContext: context,
            allowedTypes: [],
            suppressAll: false,
            position
        };
        
        switch (context) {
            case LineContext.LineStart:
                // Strictly only date completion at line beginning
                baseContext.allowedTypes = ['date'];
                break;
                
            case LineContext.AfterDate:
                // Payee/description after date
                baseContext.allowedTypes = ['payee'];
                break;
                
            case LineContext.InPosting:
                // Strictly only account completion on indented lines
                baseContext.allowedTypes = ['account'];
                break;
                
            case LineContext.AfterAmount:
                // Strictly only currency completion after amount + single space
                baseContext.allowedTypes = ['commodity'];
                break;
                
            case LineContext.InComment:
                // Tag name completion in comments
                baseContext.allowedTypes = ['tag'];
                break;
                
            case LineContext.InTagValue:
                // Tag value completion after tag name and colon
                baseContext.allowedTypes = ['tag_value'];
                break;
                
            case LineContext.Forbidden:
                // Complete completion suppression
                baseContext.suppressAll = true;
                break;
        }
        
        return baseContext;
    }
    
    /**
     * Special handling for digit "0" at line beginning
     * Supports Unicode patterns for international date formats
     */
    private isZeroDateContext(lineText: string, cursorPos: number): boolean {
        const beforeCursor = lineText.substring(0, cursorPos);
        
        // Ensure we're not in an after-date context
        if (this.isAfterDateWithSpace(beforeCursor)) {
            return false;
        }
        
        // "0" by itself - valid date beginning
        if (StrictPositionAnalyzer.STRICT_PATTERNS.ZERO_START.test(beforeCursor)) {
            return cursorPos <= 1;
        }
        
        // "01", "02", ... "09" - valid months
        if (StrictPositionAnalyzer.STRICT_PATTERNS.ZERO_MONTH.test(beforeCursor)) {
            return cursorPos <= 3;
        }
        
        // "01-", "02-", etc. - valid partial dates
        if (StrictPositionAnalyzer.STRICT_PATTERNS.ZERO_PARTIAL_DATE.test(beforeCursor)) {
            return cursorPos <= 6;
        }
        
        return false;
    }
    
    private isDateContext(lineText: string, cursorPos: number): boolean {
        // Special handling for "0" at beginning
        if (this.isZeroDateContext(lineText, cursorPos)) {
            return true;
        }
        
        const beforeCursor = lineText.substring(0, cursorPos);
        
        // Check if this is a date-only context (no payee after space yet)
        // This prevents date completion when cursor is after date + space
        if (this.isAfterDateWithSpace(beforeCursor)) {
            return false;
        }
        
        // Check regular date patterns with Unicode support
        return StrictPositionAnalyzer.STRICT_PATTERNS.DATE_LINE_START.test(beforeCursor) ||
               StrictPositionAnalyzer.STRICT_PATTERNS.DATE_WITH_STATUS.test(beforeCursor) ||
               /^\d{1,4}([-/]\d{0,2}([-/]\d{0,2})?)?$/u.test(beforeCursor);
    }
}