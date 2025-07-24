import { HLedgerConfig } from '../main';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('fs');

describe('HLedgerConfig', () => {
    let config: HLedgerConfig;
    
    beforeEach(() => {
        config = new HLedgerConfig();
        jest.clearAllMocks();
    });
    
    describe('parseContent', () => {
        it('should parse account directives', () => {
            const content = `
account Assets:Bank
account Expenses:Food
account Активы:Наличные
`;
            
            config.parseContent(content);
            
            expect(config.getAccounts()).toEqual(expect.arrayContaining([
                'Assets:Bank',
                'Expenses:Food',
                'Активы:Наличные'
            ]));
            expect(config.getDefinedAccounts()).toEqual(expect.arrayContaining([
                'Assets:Bank',
                'Expenses:Food',
                'Активы:Наличные'
            ]));
        });
        
        it('should parse aliases', () => {
            const content = `
alias Активы = Assets
alias Расходы = Expenses
`;
            
            config.parseContent(content);
            
            const aliases = config.getAliases();
            expect(aliases.get('Активы')).toBe('Assets');
            expect(aliases.get('Расходы')).toBe('Expenses');
            expect(config.getAccounts()).toEqual(expect.arrayContaining([
                'Активы', 'Assets', 'Расходы', 'Expenses'
            ]));
        });
        
        it('should parse commodity directives', () => {
            const content = `
commodity RUB
commodity 1,000.00 USD
commodity EUR
`;
            
            config.parseContent(content);
            
            expect(config.getCommodities()).toEqual(expect.arrayContaining([
                'RUB', '1,000.00 USD', 'EUR'
            ]));
        });
        
        it('should parse default commodity', () => {
            const content = `D 1000.00 RUB`;
            
            config.parseContent(content);
            
            expect(config.defaultCommodity).toBe('1000.00 RUB');
        });
        
        it('should extract dates from transactions', () => {
            const content = `
2025-01-15 Test transaction
    Assets:Cash    100
    Expenses:Food  -100
    
01-16 Short date
    Assets:Cash    50
    Expenses:Food  -50
`;
            
            config.parseContent(content);
            
            expect(config.getLastDate()).toBe('01-16');
        });
        
        it('should extract accounts from transactions', () => {
            const content = `
2025-01-15 Test
    Assets:Cash         100.50 RUB
    Expenses:Food       -50.25 RUB
    Активы:Наличные     25
`;
            
            config.parseContent(content);
            
            expect(config.getUsedAccounts()).toEqual(expect.arrayContaining([
                'Assets:Cash',
                'Expenses:Food',
                'Активы:Наличные'
            ]));
        });
        
        it('should handle include directives', () => {
            const content = `include other.journal`;
            const mockFileContent = `account Assets:Included`;
            
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.readFileSync as jest.Mock).mockReturnValue(mockFileContent);
            
            config.parseContent(content, '/test/path');
            
            expect(fs.readFileSync).toHaveBeenCalledWith(
                path.resolve('/test/path', 'other.journal'),
                'utf8'
            );
            expect(config.getAccounts()).toContain('Assets:Included');
        });
        
        it('should handle comments', () => {
            const content = `
; This is a comment
# This is also a comment
account Assets:Bank ; inline comment
`;
            
            config.parseContent(content);
            
            expect(config.getAccounts()).toContain('Assets:Bank');
            expect(config.getAccounts()).toHaveLength(1);
        });
    });
    
    describe('getUndefinedAccounts', () => {
        it('should return accounts used but not defined', () => {
            const content = `
account Assets:Bank

2025-01-15 Test
    Assets:Bank      100
    Assets:Cash      -50
    Expenses:Food    -50
`;
            
            config.parseContent(content);
            
            expect(config.getUndefinedAccounts()).toEqual(expect.arrayContaining([
                'Assets:Cash',
                'Expenses:Food'
            ]));
            expect(config.getUndefinedAccounts()).not.toContain('Assets:Bank');
        });
    });
    
    describe('parseFile', () => {
        it('should handle non-existent files gracefully', () => {
            (fs.existsSync as jest.Mock).mockReturnValue(false);
            
            expect(() => config.parseFile('/non/existent/file.journal')).not.toThrow();
            expect(config.getAccounts()).toHaveLength(0);
        });
        
        it('should handle file read errors gracefully', () => {
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.readFileSync as jest.Mock).mockImplementation(() => {
                throw new Error('Permission denied');
            });
            
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            
            config.parseFile('/error/file.journal');
            
            expect(consoleSpy).toHaveBeenCalledWith(
                'Error parsing file:',
                '/error/file.journal',
                expect.any(Error)
            );
            
            consoleSpy.mockRestore();
        });
    });
});