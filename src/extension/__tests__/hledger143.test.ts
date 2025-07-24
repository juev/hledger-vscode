import { HLedgerConfig } from '../main';

describe('hledger 1.43 Compliance', () => {
    let config: HLedgerConfig;
    
    beforeEach(() => {
        config = new HLedgerConfig();
    });
    
    describe('Date Format Support', () => {
        it('should parse all supported date formats', () => {
            const content = `
2025-01-15 * Transaction with dash separator
    Assets:Cash    100
    
2025/01/16 * Transaction with slash separator  
    Assets:Cash    100
    
2025.01.17 * Transaction with dot separator
    Assets:Cash    100
    
01-18 * Transaction with short date dash
    Assets:Cash    100
    
01/19 * Transaction with short date slash
    Assets:Cash    100
    
01.20 * Transaction with short date dot
    Assets:Cash    100
`;
            
            config.parseContent(content);
            
            // Should have captured the last date (01.20)
            expect(config.getLastDate()).toBe('01.20');
            
            // Should have found all accounts
            expect(config.getAccounts()).toContain('Assets:Cash');
        });
    });
    
    describe('Payee|Note Format', () => {
        it('should parse payee|note format correctly', () => {
            const content = `
2025-01-15 * Store Name|Purchase details ; category:shopping
    Assets:Cash    -100
    Expenses:Shopping    100
`;
            
            config.parseContent(content);
            
            const payees = config.getPayees();
            expect(payees).toContain('Store Name');
            // Should not contain the full "Store Name|Purchase details"
            expect(payees).not.toContain('Store Name|Purchase details');
        });
    });
    
    describe('Cost/Price Notation Support', () => {
        it('should parse postings with @ unit cost', () => {
            const content = `
2025-01-15 * Currency Exchange
    Assets:USD    100 USD @ 95.50 RUB
    Assets:RUB    -9550 RUB
`;
            
            config.parseContent(content);
            
            const accounts = config.getAccounts();
            expect(accounts).toContain('Assets:USD');
            expect(accounts).toContain('Assets:RUB');
        });
        
        it('should parse postings with @@ total cost', () => {
            const content = `
2025-01-15 * Stock Purchase  
    Assets:Stocks    10 AAPL @@ 1500.00 USD
    Assets:Cash    -1500.00 USD
`;
            
            config.parseContent(content);
            
            const accounts = config.getAccounts();
            expect(accounts).toContain('Assets:Stocks');
            expect(accounts).toContain('Assets:Cash');
        });
    });
    
    describe('Balance Assertions Support', () => {
        it('should parse postings with = balance assertion', () => {
            const content = `
2025-01-15 * Balance Check
    Assets:Checking    = 2500.00 RUB
    Expenses:Fees    25.00 RUB
`;
            
            config.parseContent(content);
            
            const accounts = config.getAccounts();
            expect(accounts).toContain('Assets:Checking');
            expect(accounts).toContain('Expenses:Fees');
        });
        
        it('should parse postings with == strict balance assertion', () => {
            const content = `
2025-01-15 * Strict Balance Check
    Assets:Savings    == 10000.00 RUB
    Income:Interest    -100.00 RUB
`;
            
            config.parseContent(content);
            
            const accounts = config.getAccounts();
            expect(accounts).toContain('Assets:Savings');
            expect(accounts).toContain('Income:Interest');
        });
    });
    
    describe('Complex Parsing', () => {
        it('should handle postings with cost, balance assertion, and comment', () => {
            const content = `
2025-01-15 * Complex Transaction
    Assets:Investment    10 SHARES @ 150.00 USD = 1500.00 USD ; cost:total
    Assets:Cash    -1500.00 USD == 5000.00 USD ; #investment
`;
            
            config.parseContent(content);
            
            const accounts = config.getAccounts();
            expect(accounts).toContain('Assets:Investment');
            expect(accounts).toContain('Assets:Cash');
            
            const tags = config.getTags();
            expect(tags).toContain('cost');
            expect(tags).toContain('investment');
        });
    });
    
    describe('Posting Date Tags', () => {
        it('should parse date: tags in posting comments', () => {
            const content = `
2025-01-15 * Transaction with posting date
    Assets:Bank    100 ; date:2025-01-20
    Expenses:Test    -100
`;
            
            config.parseContent(content);
            
            // Should have captured the posting date
            expect(config.getLastDate()).toBe('2025-01-20');
        });
    });
});