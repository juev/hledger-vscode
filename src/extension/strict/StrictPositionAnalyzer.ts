import * as vscode from 'vscode';
import { CompletionType } from '../types';

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

export class StrictPositionAnalyzer {
    private static readonly STRICT_PATTERNS = {
        // Strict date patterns - only at line beginning
        DATE_LINE_START: /^(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2})$/u,
        
        // Date with optional status marker (*!) - without payee
        DATE_WITH_STATUS: /^(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2})\s*[*!]?\s*$/u,
        
        // After date with payee - includes status markers and Unicode support
        AFTER_DATE_PATTERN: /^(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2})\s*[*!]?\s+[\p{L}\p{N}\s\p{P}]*$/u,
        
        // Date with status and space (ready for payee input)
        DATE_WITH_STATUS_AND_SPACE: /^(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2})\s*[*!]?\s+$/u,
        
        // SPECIAL PATTERNS FOR DIGIT "0" with Unicode support
        ZERO_START: /^0$/u,                                    // Just "0"
        ZERO_MONTH: /^0[1-9]$/u,                              // "01" through "09"
        ZERO_PARTIAL_DATE: /^0[1-9][-/]?\d{0,2}$/u,          // "01-", "01-15"
        
        // Account on indented line with Unicode support
        ACCOUNT_INDENTED: /^\s{2,}([\p{L}][\p{L}\p{N}:_-]*)$/u,
        
        // Amount pattern (digits + minimum two spaces)
        AMOUNT_PATTERN: /^\d+(\.\d{2})?\s{2,}$/u,
        
        // Currency after amount with single space - Unicode currency symbols
        CURRENCY_AFTER_AMOUNT: /^\d+(\.\d{2})?\s([\p{Lu}]{3}|[\p{Sc}$€£¥₽])$/u,
        
        // Forbidden zone: after amount + two or more spaces
        FORBIDDEN_AFTER_AMOUNT: /^\d+(\.\d{2})?\s{2,}.*$/u
    };
    
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
        if (this.isInCommentContext(lineText, cursorPos)) {
            // Check if we are after a tag name and colon
            if (this.isInTagValueContext(lineText, cursorPos)) {
                return LineContext.InTagValue;
            }
            return LineContext.InComment;
        }
        
        // Priority 2: Check forbidden zone - after amount + two or more spaces
        if (/\d+(\.\d+)?\s{2,}/.test(beforeCursor)) {
            return LineContext.Forbidden;
        }
        
        // Priority 3: Check currency position (after amount + single space)
        // Only match if we have posting indentation + account + amount + space + currency
        // Pattern: "  Account  123.45 USD" but NOT date patterns like "2024-01-15 Amazon"
        if (/^\s+[\p{L}\p{N}:_-]+\s+\d+(\.\d+)?\s+[\p{Lu}\p{Sc}$€£¥₽]*$/u.test(beforeCursor)) {
            return LineContext.AfterAmount;
        }
        
        // Priority 4: Check indented line for accounts
        if (lineText.startsWith(' ') || lineText.startsWith('\t')) {
            return LineContext.InPosting;
        }
        
        // Priority 5: CRITICAL FIX - Check after date + space BEFORE line start detection
        // This ensures proper payee completion after date + space
        if (this.isAfterDateWithSpace(beforeCursor)) {
            return LineContext.AfterDate;
        }
        
        // Priority 6: Check line beginning for dates - ANY digit at line start triggers date completion
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
        
        // Get text after comment marker
        const afterComment = beforeCursor.substring(commentStart + 1);
        
        // Check if we have a tag name followed by colon
        // Pattern: optional whitespace, tag name (letters/numbers/underscore), colon, optional whitespace
        const tagValuePattern = /^\s*[\p{L}\p{N}_]+:\s*[\p{L}\p{N}\s]*$/u;
        return tagValuePattern.test(afterComment);
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