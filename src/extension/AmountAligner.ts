// AmountAligner.ts - Module for analyzing and formatting amounts in hledger files
// Provides functionality to align amounts in posting entries for better readability

import {
    Result, success, failure, isFailure,
    AccountName, LineNumber, CharacterPosition,
    isLineNumber, isCharacterPosition
} from './types';
import { NumberFormatService, ParsedAmount, CommodityFormat } from './services/NumberFormatService';

/**
 * Interface representing a posting line with amount information
 */
export interface PostingLine {
    /** The original line content */
    readonly originalLine: string;
    /** The line number in the file */
    readonly lineNumber: LineNumber;
    /** The account name part */
    readonly accountName: string;
    /** The amount part (including commodity) */
    readonly amountPart: string;
    /** The starting position of the account name */
    readonly accountPosition: CharacterPosition;
    /** The starting position of the amount */
    readonly amountPosition: CharacterPosition;
    /** Whether this line has an explicit amount */
    readonly hasAmount: boolean;
    /** The parsed amount if present */
    parsedAmount?: ParsedAmount;
}

/**
 * Interface representing a transaction block with posting lines
 */
export interface TransactionBlock {
    /** The transaction header line */
    readonly headerLine: string;
    /** The line number of the transaction header */
    readonly headerLineNumber: LineNumber;
    /** All posting lines in this transaction */
    readonly postings: PostingLine[];
    /** The calculated alignment column for amounts */
    readonly alignmentColumn: CharacterPosition;
}

/**
 * Interface for amount formatting options
 */
export interface AmountFormattingOptions {
    /** Minimum spaces between account name and amount */
    readonly minSpacing: number;
    /** Whether to preserve original spacing when already aligned */
    readonly preserveExistingAlignment: boolean;
    /** Whether to use commodity-specific formatting */
    readonly useCommodityFormatting: boolean;
}

/**
 * Default formatting options for amount alignment
 */
export const DEFAULT_FORMATTING_OPTIONS: AmountFormattingOptions = {
    minSpacing: 2,
    preserveExistingAlignment: true,
    useCommodityFormatting: true
} as const;

/**
 * Service class for analyzing and formatting amounts in hledger files.
 *
 * Features:
 * - Parse hledger files and identify transaction blocks
 * - Extract posting lines with amounts and calculate optimal alignment
 * - Format lines with right-aligned amounts while preserving account names
 * - Handle various amount formats and commodities
 * - Preserve comments and non-posting lines
 */
export class AmountAligner {
    private readonly numberFormatService: NumberFormatService;
    private readonly options: AmountFormattingOptions;

    /**
     * Creates a new AmountAligner instance.
     *
     * @param options Optional formatting options to customize alignment behavior
     * @param numberFormatService Optional number format service for amount parsing
     */
    constructor(
        options: Partial<AmountFormattingOptions> = {},
        numberFormatService?: NumberFormatService
    ) {
        this.options = { ...DEFAULT_FORMATTING_OPTIONS, ...options };
        this.numberFormatService = numberFormatService || new NumberFormatService();
    }

    /**
     * Parses hledger content and extracts transaction blocks with posting information.
     *
     * @param content The hledger file content to parse
     * @returns Result containing array of TransactionBlock or error
     */
    parseTransactions(content: string): Result<TransactionBlock[]> {
        if (typeof content !== 'string') {
            return failure(new Error('Content must be a string'));
        }

        if (content === null || content === undefined) {
            return failure(new Error('Content cannot be null or undefined'));
        }

        try {
            const lines = content.split('\n');
            const transactions: TransactionBlock[] = [];
            let currentTransaction: TransactionBlock | null = null;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i]!;
                const trimmedLine = line.trim();
                const lineNumber = createLineNumber(i + 1);

                // Check if this is a transaction header
                if (this.isTransactionHeader(trimmedLine)) {
                    // Save previous transaction if exists
                    if (currentTransaction) {
                        transactions.push(this.finalizeTransaction(currentTransaction));
                    }

                    // Start new transaction
                    currentTransaction = {
                        headerLine: line,
                        headerLineNumber: lineNumber,
                        postings: [],
                        alignmentColumn: createCharacterPosition(0) // Will be calculated later
                    };
                }
                // Check if this is a posting line within a transaction
                else if (currentTransaction && this.isPostingLine(line!)) {
                    const posting = this.parsePostingLine(line!, lineNumber);
                    if (posting) {
                        currentTransaction.postings.push(posting);
                    }
                }
                // End transaction on empty line or new directive
                else if (currentTransaction && (trimmedLine === '' || this.isDirective(trimmedLine))) {
                    transactions.push(this.finalizeTransaction(currentTransaction));
                    currentTransaction = null;
                }
            }

            // Don't forget the last transaction
            if (currentTransaction) {
                transactions.push(this.finalizeTransaction(currentTransaction));
            }

            return success(transactions);
        } catch (error) {
            return failure(new Error(`Failed to parse transactions: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
    }

    /**
     * Formats hledger content with aligned amounts.
     *
     * @param content The hledger file content to format
     * @returns Result containing formatted content or error
     */
    formatContent(content: string): Result<string> {
        if (typeof content !== 'string') {
            return failure(new Error('Content must be a string'));
        }

        const parseResult = this.parseTransactions(content);
        if (!parseResult.success) {
            if (isFailure(parseResult)) {
                return failure(parseResult.error);
            }
            return failure(new Error('Unknown parsing error'));
        }

        try {
            const transactions = parseResult.data;
            const lines = content.split('\n');
            const modifiedLines = [...lines];

            // Calculate document-wide alignment column
            const documentAlignmentColumn = this.calculateDocumentOptimalAlignment(transactions);

            // Apply formatting for each transaction using document-wide alignment
            for (const transaction of transactions) {
                this.applyTransactionFormatting(modifiedLines, transaction, documentAlignmentColumn);
            }

            return success(modifiedLines.join('\n'));
        } catch (error) {
            return failure(new Error(`Failed to format content: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
    }

    /**
     * Calculates the optimal alignment column for the entire document.
     * This ensures consistent alignment across all transactions.
     *
     * @param transactions Array of all transaction blocks to analyze
     * @returns The optimal alignment column position for the entire document
     */
    calculateDocumentOptimalAlignment(transactions: TransactionBlock[]): CharacterPosition {
        if (transactions.length === 0) {
            return createCharacterPosition(0);
        }

        // Find the maximum account name length among all postings with amounts across all transactions
        let maxAccountLength = 0;
        for (const transaction of transactions) {
            for (const posting of transaction.postings) {
                if (posting.hasAmount) {
                    const accountLength = posting.accountPosition + posting.accountName.length;
                    maxAccountLength = Math.max(maxAccountLength, accountLength);
                }
            }
        }

        // Add minimum spacing and ensure reasonable alignment
        const alignmentColumn = createCharacterPosition(
            Math.max(maxAccountLength + this.options.minSpacing, 40)
        );

        return alignmentColumn;
    }

    /**
     * Calculates the optimal alignment column for a transaction's postings.
     * This method is kept for backward compatibility but should use document-wide alignment when possible.
     *
     * @param postings Array of posting lines to analyze
     * @returns The optimal alignment column position
     */
    calculateOptimalAlignment(postings: PostingLine[]): CharacterPosition {
        if (postings.length === 0) {
            return createCharacterPosition(0);
        }

        // Find the maximum account name length among postings with amounts
        let maxAccountLength = 0;
        for (const posting of postings) {
            if (posting.hasAmount) {
                const accountLength = posting.accountPosition + posting.accountName.length;
                maxAccountLength = Math.max(maxAccountLength, accountLength);
            }
        }

        // Add minimum spacing and ensure reasonable alignment
        const alignmentColumn = createCharacterPosition(
            Math.max(maxAccountLength + this.options.minSpacing, 40)
        );

        return alignmentColumn;
    }

    /**
     * Checks if a line is a transaction header.
     *
     * @param trimmedLine The trimmed line content
     * @returns True if this is a transaction header
     */
    private isTransactionHeader(trimmedLine: string): boolean {
        // Transaction lines start with a date (full or short format)
        return /^(\d{4}[-\/\.]\d{1,2}[-\/\.]\d{1,2}|\d{1,2}[-\/\.]\d{1,2})/.test(trimmedLine);
    }

    /**
     * Checks if a line is a posting line.
     *
     * @param line The original line content
     * @returns True if this is a posting line
     */
    private isPostingLine(line: string): boolean {
        // Posting lines are indented (2+ spaces or tabs)
        // Accept both 2+ spaces and tabs to be more flexible with different formatting styles
        return line.startsWith('  ') || line.startsWith('\t');
    }

    /**
     * Checks if a line is a directive.
     *
     * @param trimmedLine The trimmed line content
     * @returns True if this is a directive
     */
    private isDirective(trimmedLine: string): boolean {
        const directives = ['account', 'commodity', 'payee', 'tag', 'alias', 'include', 'year', 'D '];
        return directives.some(directive => trimmedLine.startsWith(directive));
    }

    /**
     * Parses a posting line to extract account and amount information.
     *
     * @param line The original posting line
     * @param lineNumber The line number
     * @returns Parsed PostingLine or null if parsing fails
     */
    private parsePostingLine(line: string, lineNumber: LineNumber): PostingLine | null {
        const trimmedLine = line.trim();

        // Find the split point between account and amount
        // Look for 2+ spaces or a tab as separator
        const separatorMatch = trimmedLine.match(/(\S.*?)(?:\s{2,}|\t)(.*)/);

        if (!separatorMatch) {
            // No amount found, only account name
            const accountStartPos = this.findFirstNonWhitespacePosition(line);
            return {
                originalLine: line,
                lineNumber,
                accountName: trimmedLine,
                amountPart: '',
                accountPosition: createCharacterPosition(accountStartPos),
                amountPosition: createCharacterPosition(line.length),
                hasAmount: false
            };
        }

        const accountName = separatorMatch[1]?.trim() || '';
        const amountPart = separatorMatch[2]?.trim() || '';
        const accountStartPos = this.findFirstNonWhitespacePosition(line);
        const amountStartPos = accountStartPos + accountName.length + 2; // Approximate position

        const posting: PostingLine = {
            originalLine: line,
            lineNumber,
            accountName,
            amountPart,
            accountPosition: createCharacterPosition(accountStartPos),
            amountPosition: createCharacterPosition(amountStartPos),
            hasAmount: amountPart.length > 0
        };

        // Try to parse the amount if present
        if (amountPart && this.isAmountString(amountPart)) {
            const cleanAmount = this.cleanAmountString(amountPart);

            const parseResult = this.numberFormatService.parseAmount(cleanAmount);
            if (parseResult.success) {
                posting.parsedAmount = parseResult.data;
            } else {
                // Fallback: try to parse simple integers manually
                const simpleIntMatch = cleanAmount.match(/^[-+]?\p{N}+$/u);
                if (simpleIntMatch) {
                    const value = parseInt(cleanAmount, 10);
                    if (!isNaN(value) && isFinite(value)) {
                        posting.parsedAmount = {
                            value,
                            integerPart: cleanAmount,
                            format: {
                                decimalMark: '.',
                                groupSeparator: '',
                                decimalPlaces: 0,
                                useGrouping: false
                            },
                            original: cleanAmount
                        };
                    }
                }
            }
        }

        return posting;
    }

    /**
     * Finds the position of the first non-whitespace character.
     *
     * @param line The line to analyze
     * @returns Position of first non-whitespace character
     */
    private findFirstNonWhitespacePosition(line: string): number {
        const match = line.match(/^\s*/);
        return match ? match[0].length : 0;
    }

    /**
     * Checks if a string looks like an amount.
     *
     * @param str The string to check
     * @returns True if this appears to be an amount
     */
    private isAmountString(str: string): boolean {
        // Remove any leading commodity symbols and check if remaining part looks like a number
        const cleanStr = str.replace(/^[\p{Sc}$€£¥₽₩]/u, '').trim();
        return /[\p{N}]/u.test(cleanStr);
    }

    /**
     * Cleans an amount string for parsing by removing commodity symbols.
     *
     * @param amountStr The amount string to clean
     * @returns Cleaned amount string
     */
    private cleanAmountString(amountStr: string): string {
        // Remove commodity symbols but keep numbers, decimal marks, separators, and signs
        let cleaned = amountStr.replace(/^[\p{Sc}$€£¥₽₩]\s*/u, '').trim(); // Remove prefix symbols
        cleaned = cleaned.replace(/\s*[\p{Sc}$€£¥₽₩\p{L}]+$/u, '').trim(); // Remove suffix commodities
        return cleaned;
    }

    /**
     * Finalizes a transaction by calculating its alignment column.
     *
     * @param transaction The transaction to finalize
     * @returns TransactionBlock with calculated alignment
     */
    private finalizeTransaction(transaction: TransactionBlock): TransactionBlock {
        const alignmentColumn = this.calculateOptimalAlignment(transaction.postings);
        return {
            ...transaction,
            alignmentColumn
        };
    }

    /**
     * Applies formatting to a transaction's lines using document-wide alignment.
     *
     * @param lines The array of all lines (will be modified)
     * @param transaction The transaction to format
     * @param documentAlignmentColumn The document-wide alignment column to use
     */
    private applyTransactionFormatting(lines: string[], transaction: TransactionBlock, documentAlignmentColumn: CharacterPosition): void {
        for (const posting of transaction.postings) {
            if (posting.hasAmount) {
                const formattedLine = this.formatPostingLine(posting, documentAlignmentColumn);
                // Update the line in the array (convert to 0-based index)
                lines[posting.lineNumber - 1] = formattedLine;
            }
        }
    }

    /**
     * Formats a single posting line with proper amount alignment.
     *
     * @param posting The posting line to format
     * @param alignmentColumn The target alignment column
     * @returns Formatted posting line
     */
    private formatPostingLine(posting: PostingLine, alignmentColumn: CharacterPosition): string {
        if (!posting.hasAmount) {
            return posting.originalLine;
        }

        // Calculate the needed spacing to align the amount exactly at alignmentColumn
        const accountEndPos = posting.accountPosition + posting.accountName.length;
        const spacingNeeded = Math.max(this.options.minSpacing, alignmentColumn - accountEndPos);

        // Build the formatted line
        const indent = ' '.repeat(posting.accountPosition);
        const spacing = ' '.repeat(spacingNeeded);
        const formattedLine = `${indent}${posting.accountName}${spacing}${posting.amountPart}`;

        return formattedLine;
    }
}

// Helper functions for creating branded types
function createLineNumber(value: number): LineNumber {
    if (!isLineNumber(value)) {
        throw new Error(`Invalid line number: ${value}`);
    }
    return value as LineNumber;
}

function createCharacterPosition(value: number): CharacterPosition {
    if (!isCharacterPosition(value)) {
        throw new Error(`Invalid character position: ${value}`);
    }
    return value as CharacterPosition;
}

/**
 * Creates a default AmountAligner instance.
 * Convenience function for common use cases.
 *
 * @param options Optional formatting options
 * @returns New AmountAligner with default configuration
 */
export function createAmountAligner(options?: Partial<AmountFormattingOptions>): AmountAligner {
    return new AmountAligner(options);
}

/**
 * Type guard to check if an object is a valid PostingLine.
 */
export function isPostingLine(obj: any): obj is PostingLine {
    return typeof obj === 'object' &&
           obj !== null &&
           typeof obj.originalLine === 'string' &&
           typeof obj.accountName === 'string' &&
           typeof obj.amountPart === 'string' &&
           typeof obj.hasAmount === 'boolean';
}

/**
 * Type guard to check if an object is a valid TransactionBlock.
 */
export function isTransactionBlock(obj: any): obj is TransactionBlock {
    return typeof obj === 'object' &&
           obj !== null &&
           typeof obj.headerLine === 'string' &&
           Array.isArray(obj.postings) &&
           obj.postings.every(isPostingLine);
}