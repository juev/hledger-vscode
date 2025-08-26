export interface PositionValidator {
    isDatePosition(line: string, character: number): boolean;
    isAccountPosition(line: string, character: number): boolean; 
    isPayeePosition(line: string, character: number): boolean;
    isCommodityPosition(line: string, character: number): boolean;
    isForbiddenPosition(line: string, character: number): boolean;
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
            // Check that we are at beginning of account name or its part
            return /^\s+[A-Za-z]?[A-Za-z0-9:_-]*$/.test(beforeCursor);
        }
        
        return false;
    }
    
    isPayeePosition(line: string, character: number): boolean {
        const beforeCursor = line.substring(0, character);
        
        // Payee after date + space(s)
        if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}\s+.*$/.test(beforeCursor) ||
            /^\d{1,2}[-/]\d{1,2}\s+.*$/.test(beforeCursor) ||
            /^\d{1,2}[-/]\d{1,2}[-/]\d{4}\s+.*$/.test(beforeCursor)) {
            return true;
        }
        
        return false;
    }
    
    isCommodityPosition(line: string, character: number): boolean {
        const beforeCursor = line.substring(0, character);
        
        // STRICT: Only after amount + single space
        return /^\s*.*\d+(\.\d+)?\s[A-Z]*$/.test(beforeCursor);
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
    
    /**
     * Special check for digit "0" at line beginning
     */
    private isZeroDateStart(beforeCursor: string, character: number): boolean {
        // "0" by itself - valid date beginning
        if (/^0$/.test(beforeCursor) && character <= 1) {
            return true;
        }
        
        // "01", "02", ... "09" - valid months
        if (/^0[1-9]$/.test(beforeCursor) && character <= 3) {
            return true;
        }
        
        // "01-", "01/", "02-" - valid partial dates
        if (/^0[1-9][-/]?\d{0,2}$/.test(beforeCursor) && character <= 6) {
            return true;
        }
        
        return false;
    }
    
    /**
     * Check if we are in the middle of existing text
     */
    private isInMiddleOfExistingText(line: string, character: number): boolean {
        if (character >= line.length) return false;
        
        const beforeChar = character > 0 ? line[character - 1] : '';
        const currentChar = line[character] || '';
        const afterChar = character < line.length - 1 ? line[character + 1] : '';
        
        // If we are between letters/digits - this is middle of text
        const beforeIsAlnum = /[A-Za-z0-9]/.test(beforeChar);
        const afterIsAlnum = /[A-Za-z0-9]/.test(currentChar) || /[A-Za-z0-9]/.test(afterChar);
        
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
               this.isCommodityPosition(line, character);
    }
}