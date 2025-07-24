// Basic functional tests without VSCode dependencies
describe('TypeScript compilation and basic logic', () => {
    it('should have proper TypeScript types', () => {
        // Test that our constants are properly typed
        const { HLEDGER_KEYWORDS, DEFAULT_COMMODITIES } = require('../types');
        
        expect(Array.isArray(HLEDGER_KEYWORDS)).toBe(true);
        expect(Array.isArray(DEFAULT_COMMODITIES)).toBe(true);
        expect(HLEDGER_KEYWORDS.length).toBeGreaterThan(0);
        expect(DEFAULT_COMMODITIES.length).toBeGreaterThan(0);
    });
    
    it('should export main classes', () => {
        const main = require('../main');
        
        expect(typeof main.HLedgerConfig).toBe('function');
        expect(typeof main.WorkspaceCache).toBe('function');
        expect(typeof main.getConfig).toBe('function');
        expect(typeof main.activate).toBe('function');
        expect(typeof main.deactivate).toBe('function');
    });
    
    it('should have working regex patterns', () => {
        // Test account regex
        const accountPattern = /^\s+([A-Za-z\u0400-\u04FF][A-Za-z\u0400-\u04FF0-9:_\-\s]*?)(?:\s{2,}|\t|$)/;
        
        expect(accountPattern.test('    Assets:Bank    100')).toBe(true);
        expect(accountPattern.test('    Активы:Наличные    100')).toBe(true);
        expect(accountPattern.test('Assets:Bank')).toBe(false); // No leading spaces
        
        // Test date regex
        const datePattern = /^(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2})/;
        
        expect(datePattern.test('2025-01-15')).toBe(true);
        expect(datePattern.test('01-15')).toBe(true);
        expect(datePattern.test('2025/01/15')).toBe(true);
        expect(datePattern.test('invalid')).toBe(false);
    });
    
    it('should parse basic hledger directives', () => {
        // Test directive patterns
        const accountDirective = /^account\s+([^;]+)/;
        const commodityDirective = /^commodity\s+(.+)/;
        const aliasDirective = /^alias\s+([^=]+)\s*=\s*(.+)/;
        
        expect(accountDirective.test('account Assets:Bank')).toBe(true);
        expect(commodityDirective.test('commodity USD')).toBe(true);
        expect(aliasDirective.test('alias Активы = Assets')).toBe(true);
        
        const accountMatch = 'account Assets:Bank ; type:Asset'.match(accountDirective);
        expect(accountMatch?.[1].trim()).toBe('Assets:Bank');
        
        const aliasMatch = 'alias Активы = Assets'.match(aliasDirective);
        expect(aliasMatch?.[1].trim()).toBe('Активы');
        expect(aliasMatch?.[2].trim()).toBe('Assets');
    });
});