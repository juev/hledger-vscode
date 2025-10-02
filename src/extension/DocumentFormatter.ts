// DocumentFormatter.ts - Comprehensive document formatting for hledger files
// Provides full formatting functionality including tabs to spaces, indentation, and comment alignment

import {
    Result, success, failure, isFailure,
    LineNumber, CharacterPosition,
    isLineNumber, isCharacterPosition
} from './types';
import { NumberFormatService, ParsedAmount } from './services/NumberFormatService';

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
 * Interface representing a formatted line with its components
 */
export interface FormattedLine {
    /** The original line content */
    readonly originalLine: string;
    /** The formatted line content */
    readonly formattedLine: string;
    /** The line number in the file */
    readonly lineNumber: LineNumber;
    /** Whether this line is a transaction header */
    readonly isTransactionHeader: boolean;
    /** Whether this line is a posting line */
    readonly isPosting: boolean;
    /** Whether this line is a comment at start of line */
    readonly isStartComment: boolean;
    /** Whether this line contains an inline comment */
    readonly hasInlineComment: boolean;
    /** The position of inline comment if present */
    readonly commentPosition?: CharacterPosition;
}

/**
 * Interface representing a transaction with all its formatting information
 */
export interface FormattedTransaction {
    /** The transaction header line */
    readonly header: FormattedLine;
    /** All posting lines in this transaction */
    readonly postings: FormattedLine[];
    /** The calculated alignment column for amounts */
    readonly amountAlignmentColumn: CharacterPosition;
    /** The calculated alignment column for inline comments */
    readonly commentAlignmentColumn: CharacterPosition;
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
export const DEFAULT_AMOUNT_FORMATTING_OPTIONS: AmountFormattingOptions = {
    minSpacing: 2,
    preserveExistingAlignment: true,
    useCommodityFormatting: true
} as const;

/**
 * Interface for document formatting options
 */
export interface DocumentFormattingOptions {
    /** Number of spaces to replace tabs with */
    readonly tabWidth: number;
    /** Number of spaces for posting indentation */
    readonly postingIndent: number;
    /** Minimum spaces between account name and amount */
    readonly minAmountSpacing: number;
    /** Whether to preserve existing alignment when already well-formatted */
    readonly preserveExistingAlignment: boolean;
}

/**
 * Default formatting options following hledger best practices
 */
export const DEFAULT_FORMATTING_OPTIONS: DocumentFormattingOptions = {
    tabWidth: 4,
    postingIndent: 4,
    minAmountSpacing: 2,
    preserveExistingAlignment: true
} as const;

/**
 * Service class for comprehensive formatting of hledger documents.
 *
 * Features:
 * - Convert tabs to spaces consistently
 * - Apply proper posting indentation (4 spaces)
 * - Align inline comments within transactions
 * - Align amounts in posting columns
 * - Preserve start-of-line comments unchanged
 * - Handle various transaction formats and edge cases
 */
export class DocumentFormatter {
    private readonly options: DocumentFormattingOptions;
    private readonly numberFormatService: NumberFormatService;
    private readonly amountOptions: AmountFormattingOptions;

    /**
     * Creates a new DocumentFormatter instance.
     *
     * @param options Optional formatting options
     * @param numberFormatService Optional number format service
     */
    constructor(
        options: Partial<DocumentFormattingOptions> = {},
        numberFormatService?: NumberFormatService
    ) {
        this.options = { ...DEFAULT_FORMATTING_OPTIONS, ...options };
        this.numberFormatService = numberFormatService || new NumberFormatService();
        this.amountOptions = DEFAULT_AMOUNT_FORMATTING_OPTIONS;
    }

    /**
     * Formats hledger content with comprehensive formatting rules.
     *
     * @param content The hledger file content to format
     * @returns Result containing formatted content or error
     */
    formatContent(content: string): Result<string> {
        if (typeof content !== 'string') {
            return failure(new Error('Content must be a string'));
        }

        try {
            // Step 1: Convert tabs to spaces
            const tabsConverted = this.convertTabsToSpaces(content);

            // Step 2: Parse and format transactions
            const formatResult = this.formatTransactions(tabsConverted);
            if (!formatResult.success) {
                return formatResult;
            }

            return success(formatResult.data);
        } catch (error) {
            return failure(new Error(`Failed to format content: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
    }

    /**
     * Converts all tabs in the content to spaces.
     *
     * @param content The content to process
     * @returns Content with tabs converted to spaces
     */
    private convertTabsToSpaces(content: string): string {
        return content.replace(/\t/g, ' '.repeat(this.options.tabWidth));
    }

    /**
     * Formats transactions in the content with proper indentation and alignment.
     *
     * @param content The content to format (tabs already converted)
     * @returns Result containing formatted content or error
     */
    private formatTransactions(content: string): Result<string> {
        const lines = content.split('\n');
        const formattedLines = [...lines];
        let currentTransaction: FormattedTransaction | null = null;
        const transactions: FormattedTransaction[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i]!;
            const trimmedLine = line.trim();
            const lineNumber = createLineNumber(i + 1);

            // Check if this is a transaction header
            if (this.isTransactionHeader(trimmedLine)) {
                // Save previous transaction if exists
                if (currentTransaction) {
                    transactions.push(currentTransaction);
                }

                // Start new transaction
                const formattedLine: FormattedLine = {
                    originalLine: line,
                    formattedLine: line, // Headers stay as-is
                    lineNumber,
                    isTransactionHeader: true,
                    isPosting: false,
                    isStartComment: false,
                    hasInlineComment: this.hasInlineComment(line)
                };

                currentTransaction = {
                    header: formattedLine,
                    postings: [],
                    amountAlignmentColumn: createCharacterPosition(0),
                    commentAlignmentColumn: createCharacterPosition(0)
                };
            }
            // Check if this is a posting line
            else if (currentTransaction && this.isPostingLine(line)) {
                const formattedPosting = this.formatPostingLine(line, lineNumber);
                currentTransaction.postings.push(formattedPosting);
            }
            // End transaction on empty line or new directive
            else if (currentTransaction && (trimmedLine === '' || this.isDirective(trimmedLine))) {
                transactions.push(currentTransaction);
                currentTransaction = null;
            }
        }

        // Don't forget the last transaction
        if (currentTransaction) {
            transactions.push(currentTransaction);
        }

        // Calculate alignment columns and apply formatting
        return this.applyTransactionFormatting(formattedLines, transactions);
    }

    /**
     * Formats a single posting line with proper indentation.
     *
     * @param line The posting line to format
     * @param lineNumber The line number
     * @returns Formatted posting line
     */
    private formatPostingLine(line: string, lineNumber: LineNumber): FormattedLine {
        const trimmedLine = line.trim();
        const isStartComment = trimmedLine.startsWith(';');

        // Handle start-of-line comments (preserve as-is)
        if (isStartComment) {
            return {
                originalLine: line,
                formattedLine: line,
                lineNumber,
                isTransactionHeader: false,
                isPosting: true, // Still part of transaction structure
                isStartComment: true,
                hasInlineComment: false
            };
        }

        // Apply proper posting indentation
        const hasInlineComment = this.hasInlineComment(trimmedLine);
        let formattedLine = line;

        // Ensure proper indentation (exactly postingIndent spaces)
        const currentIndent = line.length - line.replace(/^\s+/, '').length;
        if (currentIndent !== this.options.postingIndent) {
            formattedLine = ' '.repeat(this.options.postingIndent) + trimmedLine;
        }

        return {
            originalLine: line,
            formattedLine,
            lineNumber,
            isTransactionHeader: false,
            isPosting: true,
            isStartComment: false,
            hasInlineComment,
            commentPosition: hasInlineComment ? this.findCommentPosition(trimmedLine) : undefined
        };
    }

    /**
     * Applies formatting to all transactions including amount and comment alignment.
     *
     * @param lines The array of all lines (will be modified)
     * @param transactions Array of formatted transactions
     * @returns Result containing formatted content or error
     */
    private applyTransactionFormatting(lines: string[], transactions: FormattedTransaction[]): Result<string> {
        // Calculate document-wide alignment columns
        const amountAlignmentColumn = this.calculateDocumentAmountAlignment(transactions);
        const commentAlignmentColumn = this.calculateDocumentCommentAlignment(transactions);

        // Apply formatting for each transaction
        for (const transaction of transactions) {
            // Apply posting formatting
            for (const posting of transaction.postings) {
                if (!posting.isStartComment) {
                    const finalFormattedLine = this.applyFinalFormatting(
                        posting.formattedLine,
                        amountAlignmentColumn,
                        commentAlignmentColumn
                    );
                    lines[posting.lineNumber - 1] = finalFormattedLine;
                }
            }
        }

        return success(lines.join('\n'));
    }

    /**
     * Applies final formatting including amount and comment alignment.
     *
     * @param line The posting line to format
     * @param amountAlignmentColumn The alignment column for amounts
     * @param commentAlignmentColumn The alignment column for comments
     * @returns Final formatted line
     */
    private applyFinalFormatting(
        line: string,
        amountAlignmentColumn: CharacterPosition,
        commentAlignmentColumn: CharacterPosition
    ): string {
        // Simple amount alignment within this single posting line
        line = this.alignAmountInLine(line, amountAlignmentColumn);

        // Apply comment alignment if inline comment exists
        if (this.hasInlineComment(line)) {
            line = this.alignInlineComment(line, commentAlignmentColumn);
        }

        return line;
    }

    /**
     * Aligns amount within a single posting line to the specified column.
     *
     * @param line The posting line to format
     * @param amountAlignmentColumn The target alignment column for amounts
     * @returns Line with aligned amount
     */
    private alignAmountInLine(line: string, amountAlignmentColumn: CharacterPosition): string {
        // Skip if this is a comment-only line
        if (line.trimStart().startsWith(';')) {
            return line;
        }

        // Find comment position first
        const commentIndex = line.indexOf(';');
        const hasComment = commentIndex !== -1;
        const beforeComment = hasComment ? line.substring(0, commentIndex) : line;
        const comment = hasComment ? line.substring(commentIndex) : '';

        // Split the line into account and amount parts
        const trimmedBefore = beforeComment.trim();
        // More flexible pattern to match amounts
        const match = trimmedBefore.match(/^(.*?)(\s+)(.+)$/);

        if (!match) {
            return line; // No amount found, return as-is
        }

        const accountName = match[1].trim();
        const amount = match[3].trim();

        if (!accountName || !amount) {
            return line; // Invalid format, return as-is
        }

        // Check if the amount part looks like an amount (contains numbers)
        if (!/[\p{N}]/u.test(amount)) {
            return line; // Doesn't look like an amount, return as-is
        }

        // Calculate spacing needed to align amount (align by number, not sign)
        const accountLength = this.options.postingIndent + accountName.length;

        // Check if amount starts with a sign
        const hasSign = amount.startsWith('-') || amount.startsWith('+');
        const amountWithoutSign = hasSign ? amount.substring(1) : amount;
        const sign = hasSign ? amount[0] : '';

        // Calculate spacing for the amount without sign
        const spacingNeeded = Math.max(2, amountAlignmentColumn - accountLength - (hasSign ? 1 : 0));

        // Reconstruct the line with sign before spacing
        const indent = ' '.repeat(this.options.postingIndent);
        const spacing = ' '.repeat(spacingNeeded);
        const alignedLine = `${indent}${accountName}${spacing}${sign}${amountWithoutSign}${comment}`;

        return alignedLine;
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
     * Calculates the optimal alignment column for a transaction's postings.
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
            Math.max(maxAccountLength + this.amountOptions.minSpacing, 40)
        );

        return alignmentColumn;
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
     * Calculates the optimal alignment column for amounts across all transactions.
     *
     * @param transactions Array of all transactions
     * @returns The optimal alignment column for amounts
     */
    private calculateDocumentAmountAlignment(transactions: FormattedTransaction[]): CharacterPosition {
        let maxAccountLength = 0;

        for (const transaction of transactions) {
            for (const posting of transaction.postings) {
                if (!posting.isStartComment && posting.formattedLine.trim()) {
                    // Extract account name from posting line
                    const line = posting.formattedLine;
                    const trimmedLine = line.trim();

                    // Look for amount in the line
                    const commentIndex = trimmedLine.indexOf(';');
                    const beforeComment = commentIndex !== -1 ? trimmedLine.substring(0, commentIndex) : trimmedLine;

                    // Match pattern: accountname + whitespace + amount
                    const match = beforeComment.match(/^(.*?)(\s+)(.+)$/);

                    if (match) {
                        const accountName = match[1].trim();
                        const amount = match[3].trim();

                        // Check if the amount part looks like an amount (contains numbers)
                        if (/[\p{N}]/u.test(amount)) {
                            const accountLength = this.options.postingIndent + accountName.length;
                            maxAccountLength = Math.max(maxAccountLength, accountLength);
                        }
                    }
                }
            }
        }

        // Add minimum spacing and ensure reasonable alignment
        const alignmentColumn = createCharacterPosition(
            Math.max(maxAccountLength + this.options.minAmountSpacing, 40)
        );

        return alignmentColumn;
    }

    /**
     * Calculates the optimal alignment column for inline comments across all transactions.
     *
     * @param transactions Array of all transactions
     * @returns The optimal alignment column for comments
     */
    private calculateDocumentCommentAlignment(transactions: FormattedTransaction[]): CharacterPosition {
        let maxCommentPosition = 0;

        for (const transaction of transactions) {
            for (const posting of transaction.postings) {
                if (posting.hasInlineComment && posting.commentPosition) {
                    maxCommentPosition = Math.max(maxCommentPosition, posting.commentPosition);
                }
            }
        }

        // Add some padding and ensure reasonable alignment
        return createCharacterPosition(Math.max(maxCommentPosition + 2, 60));
    }

    /**
     * Checks if a line is a transaction header.
     */
    private isTransactionHeader(trimmedLine: string): boolean {
        return /^(\d{4}[-\/\.]\d{1,2}[-\/\.]\d{1,2}|\d{1,2}[-\/\.]\d{1,2})/.test(trimmedLine);
    }

    /**
     * Checks if a line is a posting line.
     */
    private isPostingLine(line: string): boolean {
        return line.startsWith(' ') && !line.trimStart().startsWith(';');
    }

    /**
     * Checks if a line is a directive.
     */
    private isDirective(trimmedLine: string): boolean {
        const directives = ['account', 'commodity', 'payee', 'tag', 'alias', 'include', 'year', 'D '];
        return directives.some(directive => trimmedLine.startsWith(directive));
    }

    /**
     * Checks if a line contains an inline comment.
     */
    private hasInlineComment(line: string): boolean {
        return line.includes(';') && !line.trimStart().startsWith(';');
    }

    /**
     * Finds the position of an inline comment in a line.
     */
    private findCommentPosition(line: string): CharacterPosition {
        const commentIndex = line.indexOf(';');
        return createCharacterPosition(commentIndex);
    }

    /**
     * Aligns inline comment to the specified column.
     *
     * @param line The line containing an inline comment
     * @param commentAlignmentColumn The target alignment column for the comment
     * @returns Line with aligned comment
     */
    private alignInlineComment(line: string, commentAlignmentColumn: CharacterPosition): string {
        const commentIndex = line.indexOf(';');
        if (commentIndex === -1) {
            return line;
        }

        const beforeComment = line.substring(0, commentIndex);
        const comment = line.substring(commentIndex);
        const trimmedBefore = beforeComment.trimEnd();

        // Calculate spaces needed to align comment
        const currentLength = trimmedBefore.length;
        const spacesNeeded = Math.max(1, commentAlignmentColumn - currentLength);

        return trimmedBefore + ' '.repeat(spacesNeeded) + comment;
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

/**
 * Creates a default DocumentFormatter instance.
 * Convenience function for common use cases.
 *
 * @param options Optional formatting options
 * @returns New DocumentFormatter with default configuration
 */
export function createDocumentFormatter(options?: Partial<DocumentFormattingOptions>): DocumentFormatter {
    return new DocumentFormatter(options);
}