import { StrictCompletionContext, LineContext } from './StrictPositionAnalyzer';
import { CompletionType } from '../types';

export class CompletionSuppressor {
    
    shouldSuppressAll(context: StrictCompletionContext): boolean {
        // Explicit suppression
        if (context.suppressAll) {
            return true;
        }
        
        // Suppression in forbidden zones
        if (this.isInForbiddenZone(context)) {
            return true;
        }
        
        // Suppression after amount + two spaces
        if (this.isAfterAmount(context)) {
            return true;
        }
        
        // Suppression in middle of word
        if (this.isInMiddleOfWord(context)) {
            return true;
        }
        
        return false;
    }
    
    filterAllowedTypes(context: StrictCompletionContext): CompletionType[] {
        if (this.shouldSuppressAll(context)) {
            return [];
        }
        
        // Return only allowed types for this context
        return context.allowedTypes.filter(type => this.isTypeAllowed(type, context));
    }
    
    private isInForbiddenZone(context: StrictCompletionContext): boolean {
        return context.lineContext === LineContext.Forbidden;
    }
    
    private isAfterAmount(context: StrictCompletionContext): boolean {
        const beforeCursor = context.position.beforeCursor;
        
        // Check pattern: digits + two or more spaces
        return /^\s*.*\d+(\.\d+)?\s{2,}/.test(beforeCursor);
    }
    
    private isInMiddleOfWord(context: StrictCompletionContext): boolean {
        const { beforeCursor, afterCursor } = context.position;
        
        // Check if we are in the middle of a word
        const beforeEndsWithWord = /[A-Za-z0-9]$/.test(beforeCursor);
        const afterStartsWithWord = /^[A-Za-z0-9]/.test(afterCursor);
        
        return beforeEndsWithWord && afterStartsWithWord;
    }
    
    private isTypeAllowed(type: CompletionType, context: StrictCompletionContext): boolean {
        switch (context.lineContext) {
            case LineContext.LineStart:
                // Only dates allowed at line beginning
                return type === 'date';
                
            case LineContext.InPosting:
                // Only accounts allowed on indented lines
                return type === 'account';
                
            case LineContext.AfterAmount:
                // Only currencies allowed after amounts
                return type === 'commodity';
                
            case LineContext.AfterDate:
                // Only payee completions allowed after date + space
                return type === 'payee';
                
            case LineContext.InComment:
                // Only tag name completions allowed in comments
                return type === 'tag';
                
            case LineContext.InTagValue:
                // Only tag value completions allowed after tag name and colon
                return type === 'tag_value';
                
            case LineContext.Forbidden:
                // Nothing allowed in forbidden zones
                return false;
                
            default:
                return false;
        }
    }
}