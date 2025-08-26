import * as vscode from 'vscode';
import { CompletionType } from '../types';

export enum LineContext {
    LineStart = 'line_start',           // Beginning of line - only dates allowed
    AfterDate = 'after_date',           // After date - only payee (NOT USED)  
    InPosting = 'in_posting',           // Indented line - only accounts allowed
    AfterAmount = 'after_amount',       // After amount - only currency allowed
    Forbidden = 'forbidden'             // Forbidden zone - no completions allowed
}

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
        // Strict date pattern - only at line beginning
        DATE_LINE_START: /^(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2})$/,
        
        // Date with status marker
        DATE_WITH_STATUS: /^(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2})\s*[*!]?\s*$/,
        
        // SPECIAL PATTERNS FOR DIGIT "0"
        ZERO_START: /^0$/,                                    // Just "0"
        ZERO_MONTH: /^0[1-9]$/,                              // "01" through "09"
        ZERO_PARTIAL_DATE: /^0[1-9][-/]?\d{0,2}$/,          // "01-", "01-15"
        
        // Account on indented line  
        ACCOUNT_INDENTED: /^\s{2,}([A-Za-z][A-Za-z0-9:_-]*)$/,
        
        // Amount pattern (digits + minimum two spaces)
        AMOUNT_PATTERN: /^\d+(\.\d{2})?\s{2,}$/,
        
        // Currency after amount with single space
        CURRENCY_AFTER_AMOUNT: /^\d+(\.\d{2})?\s([A-Z]{3}|[$€£¥₽])$/,
        
        // Forbidden zone: after amount + two spaces
        FORBIDDEN_AFTER_AMOUNT: /^\d+(\.\d{2})?\s{2,}.*$/
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
        
        // Check forbidden zone (priority)
        if (StrictPositionAnalyzer.STRICT_PATTERNS.FORBIDDEN_AFTER_AMOUNT.test(beforeCursor)) {
            return LineContext.Forbidden;
        }
        
        // Check currency position (after amount + single space)
        if (StrictPositionAnalyzer.STRICT_PATTERNS.CURRENCY_AFTER_AMOUNT.test(beforeCursor)) {
            return LineContext.AfterAmount;
        }
        
        // Check indented line for accounts
        if (lineText.startsWith(' ') || lineText.startsWith('\t')) {
            return LineContext.InPosting;
        }
        
        // Check line beginning for dates (including special "0" handling)
        if (cursorPos <= 12 && this.isDateContext(lineText, cursorPos)) {
            return LineContext.LineStart;
        }
        
        // After date with status
        if (StrictPositionAnalyzer.STRICT_PATTERNS.DATE_WITH_STATUS.test(beforeCursor)) {
            return LineContext.AfterDate;
        }
        
        return LineContext.Forbidden;
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
                // NOT USED in new algorithm
                baseContext.suppressAll = true;
                break;
                
            case LineContext.InPosting:
                // Strictly only account completion on indented lines
                baseContext.allowedTypes = ['account'];
                break;
                
            case LineContext.AfterAmount:
                // Strictly only currency completion after amount + single space
                baseContext.allowedTypes = ['commodity'];
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
     */
    private isZeroDateContext(lineText: string, cursorPos: number): boolean {
        const beforeCursor = lineText.substring(0, cursorPos);
        
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
        
        // Check regular dates
        return StrictPositionAnalyzer.STRICT_PATTERNS.DATE_LINE_START.test(beforeCursor) ||
               /^\d{1,4}([-/]\d{0,2}([-/]\d{0,2})?)?$/.test(beforeCursor);
    }
}