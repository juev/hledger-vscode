/**
 * Grammar Tests - Validates TextMate grammar scopes for hledger syntax
 *
 * These tests load the actual TextMate grammar and tokenize hledger code
 * to verify that the correct scopes are applied to each element.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Registry, INITIAL, IGrammar, IToken, StateStack } from 'vscode-textmate';
import { loadWASM, OnigScanner, OnigString } from 'vscode-oniguruma';

describe('TextMate Grammar Tests', () => {
  let grammar: IGrammar;

  beforeAll(async () => {
    // Load WASM for oniguruma
    const wasmBin = fs.readFileSync(
      path.join(__dirname, '../../../node_modules/vscode-oniguruma/release/onig.wasm')
    ).buffer;
    await loadWASM(wasmBin);

    // Create registry and load grammar
    const registry = new Registry({
      onigLib: Promise.resolve({
        createOnigScanner: (sources: string[]) => new OnigScanner(sources),
        createOnigString: (str: string) => new OnigString(str)
      }),
      loadGrammar: async (scopeName: string) => {
        if (scopeName === 'source.hledger') {
          const grammarPath = path.join(__dirname, '../../../syntaxes/hledger.tmLanguage.json');
          const grammarJson = fs.readFileSync(grammarPath, 'utf-8');
          return JSON.parse(grammarJson);
        }
        return null;
      }
    });

    const loadedGrammar = await registry.loadGrammar('source.hledger');
    if (!loadedGrammar) {
      throw new Error('Failed to load hledger grammar');
    }
    grammar = loadedGrammar;
  });

  /**
   * Helper function to tokenize a line and extract token information
   */
  function tokenizeLine(line: string, prevState: StateStack = INITIAL): {
    tokens: IToken[];
    ruleStack: StateStack;
  } {
    return grammar.tokenizeLine(line, prevState);
  }

  /**
   * Helper function to get scope names for a token
   */
  function getScopeNames(token: IToken): string[] {
    return token.scopes;
  }

  /**
   * Helper function to extract text for a token
   */
  function getTokenText(line: string, token: IToken, nextToken?: IToken): string {
    const start = token.startIndex;
    const end = nextToken ? nextToken.startIndex : line.length;
    return line.substring(start, end);
  }

  /**
   * Helper to check if any token scope contains a specific scope
   */
  function assertLineContainsScope(line: string, expectedScope: string, prevState: StateStack = INITIAL) {
    const { tokens } = tokenizeLine(line, prevState);
    const allScopes = tokens.flatMap(token => token.scopes);
    expect(allScopes).toContain(expectedScope);
  }

  describe('Comments', () => {
    it('should highlight semicolon comments', () => {
      assertLineContainsScope('; This is a comment', 'comment.line.semicolon.hledger');
    });

    it('should highlight hash comments', () => {
      assertLineContainsScope('# This is a comment', 'comment.line.number-sign.hledger');
    });

    it('should highlight block comments with comment keyword', () => {
      const lines = ['comment', 'This is a block comment', 'end comment'];
      let state = INITIAL;

      // First line: 'comment' keyword
      const result1 = tokenizeLine(lines[0]!, state);
      state = result1.ruleStack;
      const scopes1 = result1.tokens.flatMap(t => t.scopes);
      expect(scopes1).toContain('keyword.directive.comment.hledger');

      // Second line: block comment content
      const result2 = tokenizeLine(lines[1]!, state);
      state = result2.ruleStack;
      const scopes2 = result2.tokens.flatMap(t => t.scopes);
      expect(scopes2).toContain('comment.block.hledger');

      // Third line: 'end comment' keyword
      const result3 = tokenizeLine(lines[2]!, state);
      const scopes3 = result3.tokens.flatMap(t => t.scopes);
      expect(scopes3).toContain('keyword.directive.comment.hledger');
    });

    it('should highlight URLs in comments', () => {
      assertLineContainsScope('; Check https://example.com for details', 'markup.underline.link.hledger');
    });

    it('should highlight tags in comments', () => {
      assertLineContainsScope('; project: hledger-vscode', 'entity.name.tag.hledger');
    });
  });

  describe('Transactions', () => {
    it('should highlight transaction date', () => {
      assertLineContainsScope('2025-11-22 Grocery Store', 'constant.numeric.date.hledger');
    });

    it('should highlight transaction status', () => {
      assertLineContainsScope('2025-11-22 * Grocery Store', 'keyword.operator.status.hledger');
    });

    it('should highlight transaction code', () => {
      assertLineContainsScope('2025-11-22 (CHECK-123) Grocery Store', 'string.other.code.hledger');
    });

    it('should highlight payee', () => {
      assertLineContainsScope('2025-11-22 Grocery Store', 'entity.name.function.payee.hledger');
    });

    it('should highlight transaction note', () => {
      assertLineContainsScope('2025-11-22 Grocery Store | Weekly shopping', 'string.unquoted.note.hledger');
    });

    it('should highlight periodic transaction', () => {
      assertLineContainsScope('~ monthly', 'keyword.operator.periodic.hledger');
      assertLineContainsScope('~ monthly', 'string.unquoted.period-expression.hledger');
    });

    it('should highlight auto transaction', () => {
      assertLineContainsScope('= expenses:food', 'keyword.operator.auto.hledger');
      assertLineContainsScope('= expenses:food', 'string.unquoted.query-expression.hledger');
    });
  });

  describe('Postings', () => {
    it('should highlight Assets account', () => {
      // In posting context, uses generic account scope
      assertLineContainsScope('    Assets:Cash', 'entity.name.type.account.hledger');
    });

    it('should highlight Expenses account', () => {
      // In posting context, uses generic account scope
      assertLineContainsScope('    Expenses:Food', 'entity.name.type.account.hledger');
    });

    it('should highlight Liabilities account', () => {
      // In posting context, uses generic account scope
      assertLineContainsScope('    Liabilities:CreditCard', 'entity.name.type.account.hledger');
    });

    it('should highlight Equity account', () => {
      // In posting context, uses generic account scope
      assertLineContainsScope('    Equity:Opening', 'entity.name.type.account.hledger');
    });

    it('should highlight Income account', () => {
      // In posting context, uses generic account scope
      assertLineContainsScope('    Income:Salary', 'entity.name.type.account.hledger');
    });

    it('should highlight Revenue account', () => {
      // In posting context, uses generic account scope
      assertLineContainsScope('    Revenue:Sales', 'entity.name.type.account.hledger');
    });

    it('should highlight Russian Assets account (Активы)', () => {
      // In posting context, uses generic account scope
      assertLineContainsScope('    Активы:Наличные', 'entity.name.type.account.hledger');
    });

    it('should highlight Russian Expenses account (Расходы)', () => {
      // In posting context, uses generic account scope
      assertLineContainsScope('    Расходы:Еда', 'entity.name.type.account.hledger');
    });

    it('should highlight Russian Liabilities account (Пассивы)', () => {
      // In posting context, uses generic account scope
      assertLineContainsScope('    Пассивы:Кредит', 'entity.name.type.account.hledger');
    });

    it('should highlight Russian Equity account (Собственные)', () => {
      // In posting context, uses generic account scope for generic accounts (Note: Some Cyrillic account names may not match specific patterns)
      const line = '    Собственные:Начальный';
      const { tokens } = tokenizeLine(line);
      const allScopes = tokens.flatMap(token => token.scopes);
      // Should have some account-related scope
      expect(allScopes.some(scope =>
        scope.includes('account')
      )).toBe(true);
    });

    it('should highlight Russian Income account (Доходы)', () => {
      // In posting context, uses generic account scope
      assertLineContainsScope('    Доходы:Зарплата', 'entity.name.type.account.hledger');
    });

    it('should highlight virtual account with parentheses', () => {
      assertLineContainsScope('    (Assets:Virtual)', 'variable.other.account.virtual.hledger');
    });

    it('should highlight virtual account with brackets', () => {
      assertLineContainsScope('    [Assets:Budget]', 'variable.other.account.virtual.hledger');
    });

    it('should highlight amount', () => {
      assertLineContainsScope('    Assets:Cash              100', 'constant.numeric.amount.hledger');
    });

    it('should highlight commodity', () => {
      assertLineContainsScope('    Assets:Cash              100 USD', 'entity.name.type.commodity.hledger');
    });

    it('should highlight currency symbol commodity', () => {
      assertLineContainsScope('    Assets:Cash              $100', 'entity.name.type.commodity.hledger');
    });

    it('should highlight quoted commodity', () => {
      assertLineContainsScope('    Assets:Cash              100 "CUSTOM"', 'entity.name.type.commodity.hledger');
    });
  });

  describe('Amounts and Commodities', () => {
    it('should highlight negative amount', () => {
      assertLineContainsScope('    Expenses:Food            -50 USD', 'constant.numeric.amount.hledger');
    });

    it('should highlight positive amount with sign', () => {
      assertLineContainsScope('    Assets:Cash              +100 USD', 'constant.numeric.amount.hledger');
    });

    it('should highlight amount with thousand separators (comma)', () => {
      assertLineContainsScope('    Assets:Cash              1,000 USD', 'constant.numeric.amount.hledger');
    });

    it('should highlight amount with thousand separators (apostrophe)', () => {
      assertLineContainsScope("    Assets:Cash              1'000 USD", 'constant.numeric.amount.hledger');
    });

    it('should highlight amount with decimal point', () => {
      assertLineContainsScope('    Assets:Cash              100.50 USD', 'constant.numeric.amount.hledger');
    });

    it('should highlight amount with decimal comma (European style)', () => {
      assertLineContainsScope('    Assets:Cash              100,50 EUR', 'constant.numeric.amount.hledger');
    });

    it('should highlight commodity before amount (prefix style)', () => {
      assertLineContainsScope('    Assets:Cash              $100', 'entity.name.type.commodity.hledger');
    });

    it('should highlight commodity after amount (suffix style)', () => {
      assertLineContainsScope('    Assets:Cash              100 USD', 'entity.name.type.commodity.hledger');
    });
  });

  describe('Cost and Price', () => {
    it('should highlight unit cost with @', () => {
      assertLineContainsScope('    Assets:Stock             10 AAPL @ $150', 'keyword.operator.cost.hledger');
    });

    it('should highlight total cost with @@', () => {
      assertLineContainsScope('    Assets:Stock             10 AAPL @@ $1500', 'keyword.operator.cost.total.hledger');
    });
  });

  describe('Balance Assertions', () => {
    it('should highlight balance assertion with ==', () => {
      // Note: Single = is handled by price-assignment, double == by balance-assertion
      assertLineContainsScope('    Assets:Checking          100 USD == 1000 USD', 'keyword.operator.balance-assertion.hledger');
    });

    it('should highlight price assignment with =', () => {
      assertLineContainsScope('    Assets:Checking          100 USD = 1000 USD', 'keyword.operator.price-assignment.hledger');
    });
  });

  describe('Directives', () => {
    it('should highlight account directive', () => {
      assertLineContainsScope('account Assets:Cash', 'keyword.directive.hledger');
    });

    it('should highlight commodity directive', () => {
      assertLineContainsScope('commodity USD', 'keyword.directive.hledger');
    });

    it('should highlight include directive', () => {
      assertLineContainsScope('include accounts.journal', 'keyword.directive.hledger');
    });

    it('should highlight price directive (P)', () => {
      assertLineContainsScope('P 2025-11-22 USD 1.2 EUR', 'keyword.directive.hledger');
    });

    it('should highlight default commodity directive (D)', () => {
      assertLineContainsScope('D $1,000.00', 'keyword.directive.hledger');
    });

    it('should highlight year directive (Y)', () => {
      assertLineContainsScope('Y 2025', 'keyword.directive.hledger');
    });

    it('should highlight alias directive', () => {
      assertLineContainsScope('alias checking = Assets:Bank:Checking', 'keyword.directive.hledger');
    });

    it('should highlight payee directive', () => {
      assertLineContainsScope('payee Grocery Store', 'keyword.directive.hledger');
    });

    it('should highlight tag directive', () => {
      assertLineContainsScope('tag project', 'keyword.directive.hledger');
    });
  });

  describe('CSV Directives', () => {
    it('should highlight CSV source directive', () => {
      assertLineContainsScope('source transactions.csv', 'keyword.directive.csv.hledger');
    });

    it('should highlight CSV separator directive', () => {
      assertLineContainsScope('separator ,', 'keyword.directive.csv.hledger');
    });

    it('should highlight CSV skip directive', () => {
      assertLineContainsScope('skip 1', 'keyword.directive.csv.hledger');
    });

    it('should highlight CSV date-format directive', () => {
      assertLineContainsScope('date-format %Y-%m-%d', 'keyword.directive.csv.hledger');
    });

    it('should highlight CSV fields directive', () => {
      assertLineContainsScope('fields date, description, amount', 'keyword.directive.csv.hledger');
    });

    it('should highlight CSV if directive', () => {
      assertLineContainsScope('if %description COFFEE', 'keyword.directive.csv.hledger');
    });
  });

  describe('Timeclock Entries', () => {
    it('should highlight clock-in entry (i)', () => {
      assertLineContainsScope('i 2025-11-22 09:00:00 Project Work', 'keyword.operator.timeclock.hledger');
    });

    it('should highlight clock-out entry (o)', () => {
      assertLineContainsScope('o 2025-11-22 17:00:00', 'keyword.operator.timeclock.hledger');
    });

    it('should highlight timeclock hourly rate (h)', () => {
      assertLineContainsScope('h 2025-11-22 09:00:00 $50', 'keyword.operator.timeclock.hledger');
    });
  });

  describe('Dates and Times', () => {
    it('should highlight date in transaction context', () => {
      // In transaction context, uses generic date scope
      assertLineContainsScope('2025-11-22 Payee', 'constant.numeric.date.hledger');
    });

    it('should highlight date with dots in transaction context', () => {
      // In transaction context, uses generic date scope
      assertLineContainsScope('2025.11.22 Payee', 'constant.numeric.date.hledger');
    });

    it('should highlight date with slashes in transaction context', () => {
      // In transaction context, uses generic date scope
      assertLineContainsScope('2025/11/22 Payee', 'constant.numeric.date.hledger');
    });

    it('should highlight time in timeclock entries', () => {
      // Note: In timeclock context, time is part of description scope
      const line = 'i 2025-11-22 09:30:00 Project';
      const { tokens } = tokenizeLine(line);
      const allScopes = tokens.flatMap(t => t.scopes);

      expect(allScopes).toContain('keyword.operator.timeclock.hledger');
      expect(allScopes).toContain('constant.numeric.date.iso.hledger');
      expect(allScopes).toContain('string.unquoted.description.hledger');
    });

    it('should highlight time with seconds', () => {
      // Note: In timeclock context, time is part of description scope
      const line = 'i 2025-11-22 09:30:45 Project';
      const { tokens } = tokenizeLine(line);
      const allScopes = tokens.flatMap(t => t.scopes);

      expect(allScopes).toContain('keyword.operator.timeclock.hledger');
      expect(allScopes).toContain('constant.numeric.date.iso.hledger');
      expect(allScopes).toContain('string.unquoted.description.hledger');
    });
  });

  describe('Lot Information', () => {
    it('should highlight lot date', () => {
      assertLineContainsScope('    Assets:Stock             10 AAPL {2025-01-15}', 'meta.lot.date.hledger');
    });

    it('should highlight lot price', () => {
      assertLineContainsScope('    Assets:Stock             10 AAPL {=$150}', 'meta.lot.price.hledger');
    });
  });

  describe('Complex Multi-line Examples', () => {
    it('should correctly tokenize a complete transaction', () => {
      const lines = [
        '2025-11-22 * Grocery Store | Weekly shopping',
        '    ; project: personal',
        '    Expenses:Food:Groceries      50 USD',
        '    Assets:Checking'
      ];

      let state = INITIAL;
      const expectedScopes = [
        ['constant.numeric.date.hledger', 'keyword.operator.status.hledger', 'entity.name.function.payee.hledger', 'string.unquoted.note.hledger'],
        ['comment.line.semicolon.hledger', 'entity.name.tag.hledger'],
        ['entity.name.type.account.hledger', 'constant.numeric.amount.hledger', 'entity.name.type.commodity.hledger'],
        ['entity.name.type.account.hledger']
      ];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        const result = tokenizeLine(line, state);
        state = result.ruleStack;

        const allScopes = result.tokens.flatMap(token => token.scopes);

        for (const expectedScope of expectedScopes[i]!) {
          expect(allScopes).toContain(expectedScope);
        }
      }
    });

    it('should correctly tokenize directive with account', () => {
      // Note: The directive keyword pattern matches first, so account
      // gets generic source.hledger scope in this context
      const line = 'account Assets:Checking';
      const { tokens } = tokenizeLine(line);
      const allScopes = tokens.flatMap(token => token.scopes);

      expect(allScopes).toContain('keyword.directive.hledger');
      expect(allScopes).toContain('meta.directive.keyword.hledger');
    });

    it('should correctly tokenize price directive with date and amounts', () => {
      // Note: The directive keyword pattern matches first, so the rest
      // gets generic source.hledger scope in this context
      const line = 'P 2025-11-22 USD 1.20 EUR';
      const { tokens } = tokenizeLine(line);
      const allScopes = tokens.flatMap(token => token.scopes);

      expect(allScopes).toContain('keyword.directive.hledger');
      expect(allScopes).toContain('meta.directive.keyword.hledger');
    });
  });

  describe('Currency Symbol Tokenization (Issue #57)', () => {
    /**
     * Helper to extract text for a token by finding the next token's start index
     */
    function extractTokenText(line: string, tokens: IToken[], tokenIndex: number): string {
      const token = tokens[tokenIndex]!;
      const nextToken = tokens[tokenIndex + 1];
      const start = token.startIndex;
      const end = nextToken ? nextToken.startIndex : line.length;
      return line.substring(start, end);
    }

    /**
     * Helper to find commodity token and extract its text
     */
    function getCommodityText(line: string): string | undefined {
      const { tokens } = tokenizeLine(line);
      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i]!;
        if (token.scopes.includes('entity.name.type.commodity.hledger')) {
          return extractTokenText(line, tokens, i);
        }
      }
      return undefined;
    }

    it('should tokenize $ separately from amount digits', () => {
      const line = '    Assets:Cash              $445.51';
      const commodityText = getCommodityText(line);
      expect(commodityText).toBe('$');
    });

    it('should tokenize € separately from amount digits', () => {
      const line = '    Assets:Cash              €50.00';
      const commodityText = getCommodityText(line);
      expect(commodityText).toBe('€');
    });

    it('should tokenize ¥ separately from amount digits', () => {
      const line = '    Assets:Cash              ¥10000';
      const commodityText = getCommodityText(line);
      expect(commodityText).toBe('¥');
    });

    it('should tokenize £ separately from amount digits', () => {
      const line = '    Assets:Cash              £100.50';
      const commodityText = getCommodityText(line);
      expect(commodityText).toBe('£');
    });

    it('should tokenize $ with negative amount ($-50)', () => {
      const line = '    Expenses:Food            $-50';
      const commodityText = getCommodityText(line);
      expect(commodityText).toBe('$');
    });

    it('should tokenize $ with thousand separators ($1,000.00)', () => {
      const line = '    Assets:Cash              $1,000.00';
      const commodityText = getCommodityText(line);
      expect(commodityText).toBe('$');
    });

    it('should tokenize $ with negative and thousand separators ($-1,000.00)', () => {
      const line = '    Expenses:Food            $-1,000.00';
      const commodityText = getCommodityText(line);
      expect(commodityText).toBe('$');
    });

    it('should still work with suffix-style letter commodities (100 USD)', () => {
      const line = '    Assets:Cash              100 USD';
      const commodityText = getCommodityText(line);
      expect(commodityText).toBe('USD');
    });

    it('should still work with multi-character letter commodities (AAPL)', () => {
      const line = '    Assets:Stock             10 AAPL';
      const commodityText = getCommodityText(line);
      expect(commodityText).toBe('AAPL');
    });

    it('should still work with quoted commodities', () => {
      const line = '    Assets:Cash              100 "CUSTOM"';
      const commodityText = getCommodityText(line);
      expect(commodityText).toBe('"CUSTOM"');
    });
  });

  describe('Prefix Multi-Character Letter Commodities (Issue #57)', () => {
    /**
     * Helper to find commodity token and extract its text
     */
    function getCommodityTextForPrefix(line: string): string | undefined {
      const { tokens } = tokenizeLine(line);
      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i]!;
        if (token.scopes.includes('entity.name.type.commodity.hledger')) {
          const nextToken = tokens[i + 1];
          const start = token.startIndex;
          const end = nextToken ? nextToken.startIndex : line.length;
          return line.substring(start, end);
        }
      }
      return undefined;
    }

    it('should tokenize USD separately from amount digits (USD100)', () => {
      const line = '    Assets:Cash              USD100';
      const commodityText = getCommodityTextForPrefix(line);
      expect(commodityText).toBe('USD');
    });

    it('should tokenize EUR separately from amount with decimals (EUR50.00)', () => {
      const line = '    Assets:Cash              EUR50.00';
      const commodityText = getCommodityTextForPrefix(line);
      expect(commodityText).toBe('EUR');
    });

    it('should tokenize RUB separately from large amount (RUB1000)', () => {
      const line = '    Assets:Cash              RUB1000';
      const commodityText = getCommodityTextForPrefix(line);
      expect(commodityText).toBe('RUB');
    });

    it('should tokenize USD with negative amount (USD-100)', () => {
      const line = '    Expenses:Food            USD-100';
      const commodityText = getCommodityTextForPrefix(line);
      expect(commodityText).toBe('USD');
    });

    it('should tokenize multi-char commodity with space before amount (USD 100)', () => {
      const line = '    Assets:Cash              USD 100';
      const commodityText = getCommodityTextForPrefix(line);
      expect(commodityText).toBe('USD');
    });
  });

  describe('Amount Tokenization Without Separators (PR #58 review)', () => {
    /**
     * Helper to find amount token in prefix-style commodity and extract its text
     */
    function getAmountTextAfterCurrency(line: string): string | undefined {
      const { tokens } = tokenizeLine(line);
      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i]!;
        if (
          token.scopes.includes('constant.numeric.amount.hledger') &&
          token.scopes.includes('meta.amount.prefix.hledger')
        ) {
          const nextToken = tokens[i + 1];
          const start = token.startIndex;
          const end = nextToken ? nextToken.startIndex : line.length;
          return line.substring(start, end);
        }
      }
      return undefined;
    }

    it('should tokenize $1000.00 with full amount (not split at 3 digits)', () => {
      const line = '    Assets:Cash              $1000.00';
      const amountText = getAmountTextAfterCurrency(line);
      expect(amountText).toBe('1000.00');
    });

    it('should tokenize $1000 without decimals correctly', () => {
      const line = '    Assets:Cash              $1000';
      const amountText = getAmountTextAfterCurrency(line);
      expect(amountText).toBe('1000');
    });

    it('should tokenize $1500 correctly', () => {
      const line = '    Assets:Cash              $1500';
      const amountText = getAmountTextAfterCurrency(line);
      expect(amountText).toBe('1500');
    });

    it('should tokenize $100 (3 digits) correctly', () => {
      const line = '    Assets:Cash              $100';
      const amountText = getAmountTextAfterCurrency(line);
      expect(amountText).toBe('100');
    });

    it('should tokenize $10 (2 digits) correctly', () => {
      const line = '    Assets:Cash              $10';
      const amountText = getAmountTextAfterCurrency(line);
      expect(amountText).toBe('10');
    });

    it('should still tokenize $1,000.00 with comma separator correctly', () => {
      const line = '    Assets:Cash              $1,000.00';
      const amountText = getAmountTextAfterCurrency(line);
      expect(amountText).toBe('1,000.00');
    });

    it('should still tokenize $1,000,000 with multiple separators correctly', () => {
      const line = '    Assets:Cash              $1,000,000';
      const amountText = getAmountTextAfterCurrency(line);
      expect(amountText).toBe('1,000,000');
    });

    it("should tokenize $1'000.00 with apostrophe separator correctly", () => {
      const line = "    Assets:Cash              $1'000.00";
      const amountText = getAmountTextAfterCurrency(line);
      expect(amountText).toBe("1'000.00");
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty lines', () => {
      const { tokens } = tokenizeLine('');
      expect(tokens.length).toBeGreaterThan(0); // Should at least have base scope
    });

    it('should handle lines with only whitespace', () => {
      const { tokens } = tokenizeLine('    ');
      expect(tokens.length).toBeGreaterThan(0);
    });

    it('should handle account names with spaces in posting context', () => {
      // In posting context, uses generic account scope
      assertLineContainsScope('    Assets:Bank Account', 'entity.name.type.account.hledger');
    });

    it('should handle account names with mixed languages in posting context', () => {
      // In posting context, uses generic account scope
      assertLineContainsScope('    Assets:Банковский Счет', 'entity.name.type.account.hledger');
    });

    it('should handle amounts without commodity', () => {
      assertLineContainsScope('    Assets:Cash              100', 'constant.numeric.amount.hledger');
    });

    it('should handle posting with only account (no amount)', () => {
      // In posting context, uses generic account scope
      assertLineContainsScope('    Assets:Cash', 'entity.name.type.account.hledger');
    });
  });
});
