// Simple test to verify TypeScript compilation and basic functionality
import { HLedgerConfig } from '../main';
import { HLEDGER_KEYWORDS, DEFAULT_COMMODITIES } from '../types';

describe('Basic Functionality', () => {
    describe('HLedgerConfig', () => {
        let config: HLedgerConfig;
        
        beforeEach(() => {
            config = new HLedgerConfig();
        });
        
        it('should create instance with empty collections', () => {
            expect(config.getAccounts()).toEqual([]);
            expect(config.getDefinedAccounts()).toEqual([]);
            expect(config.getUsedAccounts()).toEqual([]);
            expect(config.getCommodities()).toEqual([]);
            expect(config.getLastDate()).toBeNull();
        });
        
        it('should parse simple account directive', () => {
            const content = `account Assets:Bank`;
            config.parseContent(content);
            
            expect(config.getAccounts()).toContain('Assets:Bank');
            expect(config.getDefinedAccounts()).toContain('Assets:Bank');
        });
        
        it('should parse commodity directive', () => {
            const content = `commodity USD`;
            config.parseContent(content);
            
            expect(config.getCommodities()).toContain('USD');
        });
        
        it('should extract account from posting', () => {
            const content = `
2025-01-15 Test
    Assets:Cash    100
    Expenses:Food  -100
`;
            config.parseContent(content);
            
            expect(config.getUsedAccounts()).toEqual(expect.arrayContaining(['Assets:Cash', 'Expenses:Food']));
            expect(config.getLastDate()).toBe('2025-01-15');
        });
    });

    describe('Constants', () => {
        it('should have hledger keywords', () => {
            expect(HLEDGER_KEYWORDS).toContain('account');
            expect(HLEDGER_KEYWORDS).toContain('commodity');
            expect(HLEDGER_KEYWORDS).toContain('include');
        });
        
        it('should have default commodities', () => {
            expect(DEFAULT_COMMODITIES).toContain('USD');
            expect(DEFAULT_COMMODITIES).toContain('EUR');
            expect(DEFAULT_COMMODITIES).toContain('BTC');
        });
    });
});