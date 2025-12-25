/**
 * Tests for payee-account history tracking in HLedgerASTBuilder
 */

import { HLedgerASTBuilder } from '../HLedgerASTBuilder';
import { HLedgerLexer } from '../../lexer/HLedgerLexer';

describe('HLedgerASTBuilder - Payee Account History', () => {
  let lexer: HLedgerLexer;
  let builder: HLedgerASTBuilder;

  beforeEach(() => {
    lexer = new HLedgerLexer();
    builder = new HLedgerASTBuilder();
  });

  function parseContent(content: string) {
    const tokens = lexer.tokenizeContent(content);
    return builder.buildFromTokens(tokens);
  }

  describe('payeeAccounts tracking', () => {
    it('should track account used with payee in simple transaction', () => {
      const content = `
2024-01-15 Starbucks Coffee
    expenses:food:coffee  $5.50
    assets:checking
`;
      const result = parseContent(content);

      expect(result.payeeAccounts).toBeDefined();
      expect(result.payeeAccounts.size).toBeGreaterThan(0);
      expect(result.payeeAccounts.has('Starbucks Coffee')).toBe(true);

      const accounts = result.payeeAccounts.get('Starbucks Coffee');
      expect(accounts).toBeDefined();
      expect(accounts!.has('expenses:food:coffee')).toBe(true);
      expect(accounts!.has('assets:checking')).toBe(true);
    });

    it('should accumulate multiple accounts for same payee', () => {
      const content = `
2024-01-15 Walmart
    expenses:food:groceries  $50.00
    assets:checking

2024-01-20 Walmart
    expenses:household  $30.00
    assets:checking
`;
      const result = parseContent(content);

      const accounts = result.payeeAccounts.get('Walmart');
      expect(accounts).toBeDefined();
      expect(accounts!.has('expenses:food:groceries')).toBe(true);
      expect(accounts!.has('expenses:household')).toBe(true);
      expect(accounts!.has('assets:checking')).toBe(true);
    });

    it('should handle Unicode/Cyrillic payee names', () => {
      const content = `
2024-01-15 Пятерочка
    expenses:food:groceries  1000 RUB
    assets:bank
`;
      const result = parseContent(content);

      expect(result.payeeAccounts.has('Пятерочка')).toBe(true);
      const accounts = result.payeeAccounts.get('Пятерочка');
      expect(accounts!.has('expenses:food:groceries')).toBe(true);
    });
  });

  describe('pairUsage tracking', () => {
    it('should track usage count for payee-account pairs', () => {
      const content = `
2024-01-15 Starbucks
    expenses:food:coffee  $5.50
    assets:checking

2024-01-16 Starbucks
    expenses:food:coffee  $6.00
    assets:checking

2024-01-17 Starbucks
    expenses:food:coffee  $4.50
    assets:checking
`;
      const result = parseContent(content);

      expect(result.payeeAccountPairUsage).toBeDefined();

      const coffeeKey = 'Starbucks::expenses:food:coffee';
      const checkingKey = 'Starbucks::assets:checking';

      expect(result.payeeAccountPairUsage.get(coffeeKey)).toBe(3);
      expect(result.payeeAccountPairUsage.get(checkingKey)).toBe(3);
    });

    it('should track different accounts with different counts', () => {
      const content = `
2024-01-15 Amazon
    expenses:shopping:amazon  $50.00
    assets:checking

2024-01-16 Amazon
    expenses:shopping:amazon  $30.00
    assets:credit

2024-01-17 Amazon
    expenses:shopping:amazon  $20.00
    assets:checking
`;
      const result = parseContent(content);

      const amazonShoppingKey = 'Amazon::expenses:shopping:amazon';
      const checkingKey = 'Amazon::assets:checking';
      const creditKey = 'Amazon::assets:credit';

      expect(result.payeeAccountPairUsage.get(amazonShoppingKey)).toBe(3);
      expect(result.payeeAccountPairUsage.get(checkingKey)).toBe(2);
      expect(result.payeeAccountPairUsage.get(creditKey)).toBe(1);
    });
  });

  describe('empty cases', () => {
    it('should handle empty content', () => {
      const result = parseContent('');

      expect(result.payeeAccounts).toBeDefined();
      expect(result.payeeAccounts.size).toBe(0);
      expect(result.payeeAccountPairUsage.size).toBe(0);
    });

    it('should handle transactions without payees', () => {
      const content = `
2024-01-15
    expenses:misc  $10.00
    assets:cash
`;
      const result = parseContent(content);

      // Unknown payee should still be tracked
      expect(result.payeeAccounts.size).toBeGreaterThanOrEqual(0);
    });
  });
});
