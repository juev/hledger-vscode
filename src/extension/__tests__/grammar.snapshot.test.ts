/**
 * Grammar Snapshot Tests
 *
 * These tests create snapshots of tokenization results to ensure
 * that grammar changes don't unexpectedly alter syntax highlighting.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Registry, INITIAL, IGrammar, StateStack } from 'vscode-textmate';
import { loadWASM, OnigScanner, OnigString } from 'vscode-oniguruma';

describe('Grammar Snapshot Tests', () => {
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
   * Helper to tokenize multiple lines and create snapshot-friendly output
   */
  function tokenizeLines(lines: string[]): string {
    let state: StateStack = INITIAL;
    const results: string[] = [];

    for (const line of lines) {
      const { tokens, ruleStack } = grammar.tokenizeLine(line, state);
      state = ruleStack;

      results.push(`Line: ${line}`);

      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i]!;
        const nextToken = tokens[i + 1];
        const start = token.startIndex;
        const end = nextToken ? nextToken.startIndex : line.length;
        const text = line.substring(start, end);

        if (text.trim().length > 0) {
          results.push(`  Token: "${text}"`);
          results.push(`    Scopes: ${token.scopes.join(', ')}`);
        }
      }

      results.push('');
    }

    return results.join('\n');
  }

  describe('Transaction Snapshots', () => {
    it('should tokenize simple transaction correctly', () => {
      const lines = [
        '2025-11-22 Grocery Store',
        '    Expenses:Food              50 USD',
        '    Assets:Checking'
      ];

      const result = tokenizeLines(lines);
      expect(result).toMatchSnapshot();
    });

    it('should tokenize transaction with all features', () => {
      const lines = [
        '2025-11-22 * (CHECK-123) Grocery Store | Weekly shopping',
        '    ; project: personal',
        '    Expenses:Food:Groceries      50 USD',
        '    Assets:Checking             -50 USD = 1000 USD'
      ];

      const result = tokenizeLines(lines);
      expect(result).toMatchSnapshot();
    });

    it('should tokenize transaction with cost', () => {
      const lines = [
        '2025-11-22 Stock Purchase',
        '    Assets:Stock             10 AAPL @ $150',
        '    Assets:Cash             -$1500'
      ];

      const result = tokenizeLines(lines);
      expect(result).toMatchSnapshot();
    });

    it('should tokenize periodic transaction', () => {
      const lines = [
        '~ monthly',
        '    Expenses:Rent              1000 USD',
        '    Assets:Checking'
      ];

      const result = tokenizeLines(lines);
      expect(result).toMatchSnapshot();
    });

    it('should tokenize auto transaction', () => {
      const lines = [
        '= expenses:food',
        '    (Budget:Food)              1.0'
      ];

      const result = tokenizeLines(lines);
      expect(result).toMatchSnapshot();
    });
  });

  describe('Account Snapshots', () => {
    it('should tokenize different account types', () => {
      const lines = [
        '    Assets:Cash',
        '    Expenses:Food',
        '    Liabilities:CreditCard',
        '    Equity:Opening',
        '    Income:Salary',
        '    Revenue:Sales'
      ];

      const result = tokenizeLines(lines);
      expect(result).toMatchSnapshot();
    });

    it('should tokenize Russian account types', () => {
      const lines = [
        '    Активы:Наличные',
        '    Расходы:Еда',
        '    Пассивы:Кредит',
        '    Собственные:Начальный',
        '    Доходы:Зарплата'
      ];

      const result = tokenizeLines(lines);
      expect(result).toMatchSnapshot();
    });

    it('should tokenize virtual accounts', () => {
      const lines = [
        '    (Assets:Virtual Cash)',
        '    [Assets:Budget]'
      ];

      const result = tokenizeLines(lines);
      expect(result).toMatchSnapshot();
    });

    it('should tokenize account names with spaces', () => {
      const lines = [
        '    Assets:Bank Account',
        '    Expenses:Food Items',
        '    Assets:Банковский Счет'
      ];

      const result = tokenizeLines(lines);
      expect(result).toMatchSnapshot();
    });
  });

  describe('Directive Snapshots', () => {
    it('should tokenize account directive', () => {
      const lines = [
        'account Assets:Cash',
        '    note: Main cash account',
        '    alias: cash'
      ];

      const result = tokenizeLines(lines);
      expect(result).toMatchSnapshot();
    });

    it('should tokenize commodity directive', () => {
      const lines = [
        'commodity USD',
        '    format $1,000.00'
      ];

      const result = tokenizeLines(lines);
      expect(result).toMatchSnapshot();
    });

    it('should tokenize price directive', () => {
      const lines = [
        'P 2025-11-22 USD 1.2 EUR',
        'P 2025-11-22 AAPL $150.00'
      ];

      const result = tokenizeLines(lines);
      expect(result).toMatchSnapshot();
    });

    it('should tokenize various directives', () => {
      const lines = [
        'include accounts.journal',
        'D $1,000.00',
        'Y 2025',
        'alias checking = Assets:Bank:Checking',
        'payee Grocery Store',
        'tag project'
      ];

      const result = tokenizeLines(lines);
      expect(result).toMatchSnapshot();
    });
  });

  describe('Comment Snapshots', () => {
    it('should tokenize line comments', () => {
      const lines = [
        '; This is a semicolon comment',
        '# This is a hash comment',
        '; URL: https://example.com',
        '; project: hledger-vscode'
      ];

      const result = tokenizeLines(lines);
      expect(result).toMatchSnapshot();
    });

    it('should tokenize block comments', () => {
      const lines = [
        'comment',
        'This is a block comment',
        'with multiple lines',
        'and a URL: https://example.com',
        'and a tag: project: test',
        'end comment'
      ];

      const result = tokenizeLines(lines);
      expect(result).toMatchSnapshot();
    });
  });

  describe('Amount and Commodity Snapshots', () => {
    it('should tokenize different amount formats', () => {
      const lines = [
        '    Assets:Cash              100 USD',
        '    Assets:Cash              -50 USD',
        '    Assets:Cash              +100 USD',
        '    Assets:Cash              1,000 USD',
        "    Assets:Cash              1'000 CHF",
        '    Assets:Cash              100.50 USD',
        '    Assets:Cash              100,50 EUR'
      ];

      const result = tokenizeLines(lines);
      expect(result).toMatchSnapshot();
    });

    it('should tokenize commodity positions', () => {
      const lines = [
        '    Assets:Cash              $100',
        '    Assets:Cash              100 USD',
        '    Assets:Cash              €50',
        '    Assets:Cash              "CUSTOM COIN" 100'
      ];

      const result = tokenizeLines(lines);
      expect(result).toMatchSnapshot();
    });
  });

  describe('CSV Directive Snapshots', () => {
    it('should tokenize CSV directives', () => {
      const lines = [
        'source transactions.csv',
        'separator ,',
        'skip 1',
        'date-format %Y-%m-%d',
        'timezone UTC',
        'newest-first',
        'decimal-mark .',
        'fields date, description, amount',
        'if %description COFFEE'
      ];

      const result = tokenizeLines(lines);
      expect(result).toMatchSnapshot();
    });
  });

  describe('Timeclock Snapshots', () => {
    it('should tokenize timeclock entries', () => {
      const lines = [
        'i 2025-11-22 09:00:00 Project Work',
        'o 2025-11-22 17:00:00',
        'h 2025-11-22 09:00:00 $50'
      ];

      const result = tokenizeLines(lines);
      expect(result).toMatchSnapshot();
    });
  });

  describe('Complete Journal Snapshots', () => {
    it('should tokenize a complete journal file', () => {
      const lines = [
        '; Main journal file',
        '',
        'include accounts.journal',
        '',
        'commodity USD',
        '    format $1,000.00',
        '',
        'account Assets:Checking',
        '    note: Main checking account',
        '',
        '2025-11-22 * Opening Balance',
        '    Assets:Checking             $1000.00',
        '    Equity:Opening',
        '',
        '2025-11-23 Grocery Store | Weekly shopping',
        '    ; project: personal',
        '    Expenses:Food:Groceries      $50.00',
        '    Assets:Checking             -$50.00 = $950.00',
        '',
        'P 2025-11-23 EUR $1.20'
      ];

      const result = tokenizeLines(lines);
      expect(result).toMatchSnapshot();
    });
  });
});
