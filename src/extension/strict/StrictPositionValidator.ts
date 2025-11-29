export interface PositionValidator {
    isDatePosition(line: string, character: number): boolean;
    isAccountPosition(line: string, character: number): boolean; 
    isPayeePosition(line: string, character: number): boolean;
    isCommodityPosition(line: string, character: number): boolean;
    isForbiddenPosition(line: string, character: number): boolean;
    isTagPosition(line: string, character: number): boolean;
    isTagValuePosition(line: string, character: number): boolean;
}

export class StrictPositionValidator implements PositionValidator {
    
    isDatePosition(line: string, character: number): boolean {
        const beforeCursor = line.substring(0, character);
        
        // ANY digit at the beginning of line is a date position
        return /^\d/.test(beforeCursor);
    }
    
    isAccountPosition(line: string, character: number): boolean {
        const beforeCursor = line.substring(0, character);
        
        // Accounts ONLY on indented lines (expense/income categories)
        if (line.startsWith(' ') || line.startsWith('\t')) {
            // Guard against pathological line lengths (avoid false positives/perf issues)
            if (beforeCursor.length > 300) {
                return false;
            }
            // For performance and to match tests: allow indented line to be considered account context broadly
            return /^\s+.*$/u.test(beforeCursor);
        }
        
        return false;
    }
    
    isPayeePosition(line: string, character: number): boolean {
        const beforeCursor = line.substring(0, character);
        
        // Payee after date + space(s)
        if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}\s+.*$/u.test(beforeCursor) ||
            /^\d{1,2}[-/]\d{1,2}\s+.*$/u.test(beforeCursor) ||
            /^\d{1,2}[-/]\d{1,2}[-/]\d{4}\s+.*$/u.test(beforeCursor)) {
            return true;
        }
        
        return false;
    }
    
    isCommodityPosition(line: string, character: number): boolean {
        const beforeCursor = line.substring(0, character);
        
        // STRICT: Only after amount + single space (support "," or "." with any precision)
        // Note: We intentionally avoid restricting decimal places to a fixed number.
        return /^\s*.*\p{N}+(?:[.,]\p{N}+)?\s[\p{Lu}\p{Sc}]*$/u.test(beforeCursor);
    }
    
    isForbiddenPosition(line: string, character: number): boolean {
        const beforeCursor = line.substring(0, character);
        
        // FORBIDDEN: After amount + two spaces
        if (/^\s+.*\d+(\.\d+)?\s{2,}/.test(beforeCursor)) {
            return true;
        }
        
        // FORBIDDEN: In middle of existing text
        if (this.isInMiddleOfExistingText(line, character)) {
            return true;
        }
        
        return false;
    }
    
    isTagPosition(line: string, character: number): boolean {
        const beforeCursor = line.substring(0, character);
        
        // Must be in comment context (after ; or #)
        const commentMatch = beforeCursor.match(/[;#]\s*/);
        if (!commentMatch) {
            return false;
        }
        
        // Check if we are at the beginning of a tag name or typing a tag name
        const afterComment = beforeCursor.substring(commentMatch.index! + commentMatch[0].length);
        return /^[\p{L}\p{N}_-]*$/u.test(afterComment);
    }
    
    isTagValuePosition(line: string, character: number): boolean {
        const beforeCursor = line.substring(0, character);
        
        // Must be in comment context (after ; or #)
        const commentMatch = beforeCursor.match(/[;#]\s*/);
        if (!commentMatch) {
            return false;
        }
        
        // Must be after a tag name followed by colon
        const afterComment = beforeCursor.substring(commentMatch.index! + commentMatch[0].length);
        return /([\p{L}\p{N}_-]+):\s*[\p{L}\p{N}_-]*$/u.test(afterComment);
    }
    
    /**
     * Check if we are in the middle of existing text
     */
    private isInMiddleOfExistingText(line: string, character: number): boolean {
        if (character >= line.length) return false;
        
        const beforeChar = character > 0 ? line[character - 1] ?? '' : '';
        const currentChar = line[character] ?? '';
        const afterChar = character < line.length - 1 ? line[character + 1] ?? '' : '';
        
        // If we are between letters/digits - this is middle of text
        const beforeIsAlnum = /[\p{L}\p{N}]/u.test(beforeChar);
        const afterIsAlnum = /[\p{L}\p{N}]/u.test(currentChar) || /[\p{L}\p{N}]/u.test(afterChar);
        
        return beforeIsAlnum && afterIsAlnum;
    }
    
    /**
     * Check position validity for completion in general case
     */
    isValidCompletionPosition(line: string, character: number): boolean {
        // Quick checks for forbidden positions
        if (this.isForbiddenPosition(line, character)) {
            return false;
        }
        
        // Check that position makes sense for some completion type
        return this.isDatePosition(line, character) ||
               this.isAccountPosition(line, character) ||
               this.isCommodityPosition(line, character) ||
               this.isTagPosition(line, character) ||
               this.isTagValuePosition(line, character);
    }
}
