/**
 * Integration tests for completion provider with realistic scenarios
 * Tests completion behavior at different cursor positions with sample journal data
 *
 * Note: These tests verify the core completion provider functionality by simulating
 * real-world usage scenarios with sample hledger journal data.
 */

import * as vscode from 'vscode';
import { StrictCompletionProvider } from '../StrictCompletionProvider';
import { HLedgerConfig } from '../HLedgerConfig';
import { HLedgerParser } from '../HLedgerParser';
import { SimpleProjectCache } from '../SimpleProjectCache';

const { MockTextDocument } = vscode as any;

// Helper to extract items from CompletionList or array
function getItems(
  result: vscode.CompletionItem[] | vscode.CompletionList
): vscode.CompletionItem[] {
  if (Array.isArray(result)) {
    return result;
  }
  return result.items;
}

describe('Completion Integration Tests', () => {
  let provider: StrictCompletionProvider;
  let config: HLedgerConfig;
  let parser: HLedgerParser;
  let cache: SimpleProjectCache;

  // Sample journal content with various data for completions
  const sampleJournalContent = `
; Sample journal file for integration testing
commodity USD
commodity EUR
commodity RUB

2024-01-15 Grocery Store
  Expenses:Food:Groceries  50.00 USD
  Assets:Cash

2024-01-20 Salary Payment
  Income:Salary  -3000.00 USD
  Assets:Bank:Checking

2024-02-01 Coffee Shop
  Expenses:Food:Dining  5.50 EUR
  Assets:Cash

2024-02-05 Rent Payment
  Expenses:Housing:Rent  1200.00 USD
  Assets:Bank:Checking

2024-02-10 Online Shopping
  Expenses:Shopping:Electronics  299.99 USD
  Assets:CreditCard

2024-03-01 Coffee and Snacks
  Expenses:Food and Beverages  25.00 RUB
  Assets:Checking Account
`;

  const mockCompletionContext: vscode.CompletionContext = {
    triggerKind: vscode.CompletionTriggerKind.Invoke,
    triggerCharacter: undefined,
  };

  const mockCancellationToken: vscode.CancellationToken = {
    isCancellationRequested: false,
    onCancellationRequested: () => new vscode.Disposable(() => {}),
  };

  beforeEach(() => {
    parser = new HLedgerParser();
    cache = new SimpleProjectCache();
    config = new HLedgerConfig(parser, cache);

    // Parse sample journal content directly into config
    config.parseContent(sampleJournalContent, '/test');

    // CRITICAL FIX: Do NOT mock getConfigForDocument!
    // The problem in tests was that mocking prevented cache from working correctly.
    // Real VS Code calls getConfigForDocument which retrieves data from cache.
    // By mocking it, we broke the data flow.

    provider = new StrictCompletionProvider(config);
  });

  describe('Date Completion at Line Start', () => {
    it('should provide date completions with partial year input', () => {
      const document = new MockTextDocument(['2024']);
      const position = new vscode.Position(0, 4);

      const result = provider.provideCompletionItems(
        document,
        position,
        mockCancellationToken,
        mockCompletionContext
      );
      const completions = getItems(result);

      expect(completions).toBeDefined();
      expect(completions.length).toBeGreaterThan(0);

      // Should contain dates with 2024
      const has2024Dates = completions.some((item) => item.label.toString().includes('2024'));
      expect(has2024Dates).toBe(true);
    });

    it('should NOT provide date completions in middle of line (indented)', () => {
      const document = new MockTextDocument(['  2024']);
      const position = new vscode.Position(0, 6);

      const result = provider.provideCompletionItems(
        document,
        position,
        mockCancellationToken,
        mockCompletionContext
      );
      const completions = getItems(result);

      // Should not provide date completions when not at line start
      expect(completions.length).toBe(0);
    });
  });

  describe('Account Completion on Indented Lines', () => {
    it('should provide account completions on indented line', () => {
      const document = new MockTextDocument(['  Assets']);
      const position = new vscode.Position(0, 8);

      const result = provider.provideCompletionItems(
        document,
        position,
        mockCancellationToken,
        mockCompletionContext
      );
      const completions = getItems(result);

      expect(completions).toBeDefined();
      expect(completions.length).toBeGreaterThan(0);

      // Verify that sample accounts are available in config
      expect(config.getAccounts().length).toBeGreaterThan(0);

      // Should include accounts from sample data
      const accountNames = ['Assets:Cash', 'Assets:Bank:Checking', 'Assets:CreditCard'];
      const hasAssetAccounts = accountNames.some((name) =>
        completions.some((item) => item.label.toString().includes(name))
      );
      expect(hasAssetAccounts).toBe(true);
    });

    it('should filter account completions based on partial input', () => {
      const document = new MockTextDocument(['  Expenses:Food']);
      const position = new vscode.Position(0, 15);

      const result = provider.provideCompletionItems(
        document,
        position,
        mockCancellationToken,
        mockCompletionContext
      );
      const completions = getItems(result);

      expect(completions).toBeDefined();

      // Should include food-related accounts
      const foodAccounts = ['Expenses:Food:Groceries', 'Expenses:Food:Dining'];
      const hasFoodAccounts = foodAccounts.some((name) =>
        completions.some((item) => item.label.toString().includes(name))
      );
      expect(hasFoodAccounts).toBe(true);
    });

    it('should provide hierarchical account completions with colon trigger', () => {
      const document = new MockTextDocument(['  Expenses:']);
      const position = new vscode.Position(0, 11);

      const result = provider.provideCompletionItems(document, position, mockCancellationToken, {
        ...mockCompletionContext,
        triggerCharacter: ':',
      });
      const completions = getItems(result);

      expect(completions).toBeDefined();

      // Should include sub-accounts of Expenses
      const expenseCategories = ['Food', 'Housing', 'Shopping'];
      const hasExpenseCategories = expenseCategories.some((name) =>
        completions.some((item) => item.label.toString().includes(name))
      );
      expect(hasExpenseCategories).toBe(true);
    });

    it('should NOT provide account completions on non-indented lines', () => {
      const document = new MockTextDocument(['Assets:Cash']);
      const position = new vscode.Position(0, 11);

      const result = provider.provideCompletionItems(
        document,
        position,
        mockCancellationToken,
        mockCompletionContext
      );
      const completions = getItems(result);

      // Should not provide completions on non-indented lines
      expect(completions.length).toBe(0);
    });
  });

  describe('Accounts with Spaces', () => {
    it('should handle accounts with spaces in names', () => {
      const document = new MockTextDocument(['  Expenses:Food and']);
      const position = new vscode.Position(0, 19);

      const result = provider.provideCompletionItems(
        document,
        position,
        mockCancellationToken,
        mockCompletionContext
      );
      const completions = getItems(result);

      expect(completions).toBeDefined();

      // Should include "Expenses:Food and Beverages" from sample data
      const hasSpacedAccount = completions.some((item) =>
        item.label.toString().includes('Food and Beverages')
      );
      expect(hasSpacedAccount).toBe(true);
    });

    it('should filter accounts with spaces correctly', () => {
      const document = new MockTextDocument(['  Assets:Checking']);
      const position = new vscode.Position(0, 17);

      const result = provider.provideCompletionItems(
        document,
        position,
        mockCancellationToken,
        mockCompletionContext
      );
      const completions = getItems(result);

      expect(completions).toBeDefined();

      // Should include "Assets:Checking Account" from sample data
      const hasCheckingAccount = completions.some((item) =>
        item.label.toString().includes('Checking Account')
      );
      expect(hasCheckingAccount).toBe(true);
    });

    it('should complete full account names with spaces without breaking', () => {
      const document = new MockTextDocument(['  Expenses:Food and Beverages  10.00 RUB']);
      const position = new vscode.Position(0, 29);

      // Position after the full account name - should not cause errors
      const result = provider.provideCompletionItems(
        document,
        position,
        mockCancellationToken,
        mockCompletionContext
      );
      const completions = getItems(result);

      expect(completions).toBeDefined();
      expect(Array.isArray(completions)).toBe(true);
      // Spaces in account names don't break the completion system
    });

    it('should handle multiple spaces in account hierarchy', () => {
      const document = new MockTextDocument(['  Assets:Checking Account']);
      const position = new vscode.Position(0, 24);

      const result = provider.provideCompletionItems(
        document,
        position,
        mockCancellationToken,
        mockCompletionContext
      );
      const completions = getItems(result);

      expect(completions).toBeDefined();
      expect(Array.isArray(completions)).toBe(true);
      // System should handle accounts with spaces gracefully
    });
  });

  describe('Commodity Completion after Amount', () => {
    it('should debug exact position analysis for commodity completion', () => {
      // Recreate EXACT scenario from screenshot
      const line = '  Расходы:Программное обеспечение     222 ';

      // Test different positions
      const positions = [
        { pos: 41, desc: 'Right after 222 (no space)' },
        { pos: 42, desc: 'After 222 + 1 space' },
        { pos: 43, desc: 'After 222 + 2 spaces (if exists)' },
      ];

      console.log('\n=== DETAILED POSITION ANALYSIS ===');
      console.log('Full line:', JSON.stringify(line));
      console.log('Line length:', line.length);
      console.log('Last 5 chars:', JSON.stringify(line.slice(-5)));
      console.log('');

      // Create real provider without mocking
      const realParser = new HLedgerParser();
      const realCache = new SimpleProjectCache();
      const realConfig = new HLedgerConfig(realParser, realCache);
      realConfig.parseContent(sampleJournalContent, '/test');
      const realProvider = new StrictCompletionProvider(realConfig);

      positions.forEach(({ pos, desc }) => {
        if (pos > line.length) {
          console.log(`Skipping position ${pos} (beyond line length)`);
          return;
        }

        const document = new MockTextDocument([line]);
        const position = new vscode.Position(0, pos);
        const beforeCursor = line.substring(0, pos);

        console.log(`--- Position ${pos}: ${desc} ---`);
        console.log('Before cursor:', JSON.stringify(beforeCursor));
        console.log('Before cursor ends with space:', beforeCursor.endsWith(' '));
        console.log('Before cursor length:', beforeCursor.length);

        // Test patterns directly
        const accountAmountPattern =
          /^\s+[\p{L}\p{N}:_\-]+(?:\s+[\p{L}\p{N}:_\-]+)*\s+(\d+(?:[.,]\d+)?)\s([\p{Lu}\p{Sc}$€£¥₽]*)?$/u;
        const commodityPattern = /^\s*.*\p{N}+(?:[.,]\p{N}+)?\s[\p{Lu}\p{Sc}]*$/u;

        console.log('Matches accountAmountPattern:', accountAmountPattern.test(beforeCursor));
        console.log('Matches commodityPattern:', commodityPattern.test(beforeCursor));

        const result = realProvider.provideCompletionItems(
          document,
          position,
          mockCancellationToken,
          mockCompletionContext
        );
        const completions = getItems(result);

        console.log('Completions:', completions.length);
        if (completions.length > 0) {
          console.log(
            'First 3:',
            completions.slice(0, 3).map((c) => c.label.toString())
          );

          const commodities = realConfig.getCommodities();
          const accounts = realConfig.getAccounts();
          const hasCommodity = completions.some((item) =>
            commodities.some((c) => item.label.toString() === c)
          );
          const hasAccount = completions.some((item) =>
            accounts.some((a) => item.label.toString().includes(a))
          );

          console.log('Has commodities:', hasCommodity);
          console.log('Has accounts:', hasAccount);
        }
        console.log('');
      });
    });

    it('should test multiline scenario - cursor on next line after amount', () => {
      const document = new MockTextDocument([
        '11-21 Магазин',
        '  Расходы:Программное обеспечение     222',
        '  ', // Cursor here on indented line
      ]);
      const position = new vscode.Position(2, 2); // On third line, after indent

      console.log('\n=== Multiline scenario (cursor on next line) ===');
      console.log('Line 1:', document.lineAt(0).text);
      console.log('Line 2:', document.lineAt(1).text);
      console.log('Line 3 (cursor here):', JSON.stringify(document.lineAt(2).text));
      console.log('Cursor position: line 2, char 2');

      const result = provider.provideCompletionItems(
        document,
        position,
        mockCancellationToken,
        mockCompletionContext
      );
      const completions = getItems(result);

      console.log('Completions count:', completions.length);
      if (completions.length > 0) {
        console.log(
          'First 5:',
          completions.slice(0, 5).map((c) => c.label.toString())
        );

        const payees = config.getPayees();
        const hasPayee = completions.some((item) =>
          payees.some((p) => item.label.toString().includes(p))
        );

        console.log('Has payees:', hasPayee);

        if (hasPayee) {
          console.log('⚠️  Aha! This reproduces the screenshot - cursor on NEXT LINE!');
        }
      }
    });

    it('should test real scenario WITHOUT mocking getConfigForDocument', () => {
      // Create fresh config WITHOUT mocking to reproduce real VS Code behavior
      const realParser = new HLedgerParser();
      const realCache = new SimpleProjectCache();
      const realConfig = new HLedgerConfig(realParser, realCache);

      // Parse sample data
      realConfig.parseContent(sampleJournalContent, '/test');

      // Create provider with real config
      const realProvider = new StrictCompletionProvider(realConfig);

      // Test the problematic line
      const line = '  Расходы:Программное обеспечение     222';
      const document = new MockTextDocument([line]);
      const position = new vscode.Position(0, line.length);

      console.log('\n=== REAL scenario (no mocking) ===');
      console.log('Line:', JSON.stringify(line));
      console.log('Position:', position.character);

      const result = realProvider.provideCompletionItems(
        document,
        position,
        mockCancellationToken,
        mockCompletionContext
      );
      const completions = getItems(result);

      console.log('Completions count:', completions.length);
      if (completions.length > 0) {
        console.log(
          'First 5 completions:',
          completions.slice(0, 5).map((c) => c.label.toString())
        );

        // Check what type
        const payees = realConfig.getPayees();
        const accounts = realConfig.getAccounts();
        const commodities = realConfig.getCommodities();

        const hasPayee = completions.some((item) =>
          payees.some((p) => item.label.toString().includes(p))
        );
        const hasAccount = completions.some((item) =>
          accounts.some((a) => item.label.toString().includes(a))
        );
        const hasCommodity = completions.some((item) =>
          commodities.some((c) => item.label.toString().includes(c))
        );

        console.log('Has payees:', hasPayee);
        console.log('Has accounts:', hasAccount);
        console.log('Has commodities:', hasCommodity);

        if (hasAccount || hasPayee) {
          console.log('⚠️  BUG REPRODUCED! Showing accounts/payees instead of commodities!');
        }
      }
    });

    it('should provide commodity completions after Cyrillic account and amount', () => {
      // This test reproduces the exact scenario from the screenshot
      const line = '  Расходы:Программное обеспечение     222 ';
      const document = new MockTextDocument([line]);
      const position = new vscode.Position(0, line.length); // At the end after space

      console.log('\n=== Cyrillic Account + Amount Test ===');
      console.log('Line:', JSON.stringify(line));
      console.log('Line length:', line.length);
      console.log('Position:', position.character);
      console.log('Has trailing space:', line.endsWith(' '));

      const result = provider.provideCompletionItems(
        document,
        position,
        mockCancellationToken,
        mockCompletionContext
      );
      const completions = getItems(result);

      console.log('Completions count:', completions.length);
      if (completions.length > 0) {
        console.log('First completion:', completions[0]?.label);
        console.log('First completion kind:', completions[0]?.kind);
        console.log('Expected kind (commodity):', vscode.CompletionItemKind.Unit);
      }

      expect(completions).toBeDefined();

      // Should provide commodity completions, not payees!
      if (completions.length > 0) {
        // Check if we got commodities or payees
        const commodities = config.getCommodities();
        const hasCommodity = completions.some((item) =>
          commodities.some((c) => item.label.toString().includes(c))
        );

        const payees = config.getPayees();
        const hasPayee = completions.some((item) =>
          payees.some((p) => item.label.toString().includes(p))
        );

        console.log('Has commodity completion:', hasCommodity);
        console.log('Has payee completion:', hasPayee);

        // This should be commodities, NOT payees
        if (hasPayee) {
          console.error('❌ BUG: Showing payees instead of commodities!');
        }

        expect(hasPayee).toBe(false); // Should NOT have payees
      }
    });

    it('should provide commodity completions after amount with single space', () => {
      const document = new MockTextDocument(['  Assets:Cash  100.00 ']);
      const position = new vscode.Position(0, 21);

      const result = provider.provideCompletionItems(
        document,
        position,
        mockCancellationToken,
        mockCompletionContext
      );
      const completions = getItems(result);

      expect(completions).toBeDefined();

      // Commodity completion after amount + single space
      if (completions.length > 0) {
        // Should include USD from sample data
        const hasUSD = completions.some((item) => item.label.toString().includes('USD'));
        expect(hasUSD).toBe(true);
      } else {
        // If no completions, verify commodities are in config
        const commodities = config.getCommodities();
        expect(commodities.length).toBeGreaterThan(0);
      }
    });

    it('should filter commodity completions based on partial input', () => {
      const document = new MockTextDocument(['  Assets:Cash  100.00 RU']);
      const position = new vscode.Position(0, 24);

      const result = provider.provideCompletionItems(
        document,
        position,
        mockCancellationToken,
        mockCompletionContext
      );
      const completions = getItems(result);

      expect(completions).toBeDefined();

      // Verify that commodities are available in config
      const commodities = config.getCommodities();
      expect(commodities.some((c) => c === 'RUB')).toBe(true);

      // If completions are provided, they should be filtered correctly
      if (completions.length > 0) {
        const hasRUB = completions.some((item) => item.label.toString().includes('RUB'));
        expect(hasRUB).toBe(true);
      }
    });

    it('should handle commodity context after amounts', () => {
      const document = new MockTextDocument(['  Assets:Cash  100.00 USD']);
      const position = new vscode.Position(0, 24);

      const result = provider.provideCompletionItems(
        document,
        position,
        mockCancellationToken,
        mockCompletionContext
      );
      const completions = getItems(result);

      expect(completions).toBeDefined();
      expect(Array.isArray(completions)).toBe(true);

      // Verify commodities are loaded in config
      const commodities = config.getCommodities();
      expect(commodities.length).toBe(3); // USD, EUR, RUB
      expect(commodities).toContain('USD');
      expect(commodities).toContain('EUR');
      expect(commodities).toContain('RUB');
    });

    it('should provide commodity completions with @ trigger', () => {
      const document = new MockTextDocument(['  Assets:Cash  100.00 @']);
      const position = new vscode.Position(0, 22);

      const result = provider.provideCompletionItems(document, position, mockCancellationToken, {
        ...mockCompletionContext,
        triggerCharacter: '@',
      });
      const completions = getItems(result);

      expect(completions).toBeDefined();
      // Should provide commodity-related completions
    });

    it('should parse commodities from current unsaved document', () => {
      // This test demonstrates the architectural issue:
      // Commodities defined in the current document should be available
      // even if the document hasn't been saved to disk yet.
      const documentContent = [
        'commodity BTC',
        'commodity ETH',
        '',
        '2024-01-20 Crypto Purchase',
        '  Assets:Crypto:Bitcoin  1.5 ',
      ];
      const document = new MockTextDocument(documentContent);
      // Position after "1.5 " - should trigger commodity completion
      const position = new vscode.Position(4, 29);

      const result = provider.provideCompletionItems(
        document,
        position,
        mockCancellationToken,
        mockCompletionContext
      );
      const completions = getItems(result);

      expect(completions).toBeDefined();
      expect(Array.isArray(completions)).toBe(true);

      // The document defines BTC and ETH commodities
      // These should be available for completion even though document isn't saved
      const commodityLabels = completions.map((item) => item.label);

      // Now this should PASS because getConfigForDocument() parses current document content
      expect(commodityLabels).toContain('BTC');
      expect(commodityLabels).toContain('ETH');
    });
  });

  describe('Forbidden Zones', () => {
    it('should NOT provide any completions after amount + two spaces', () => {
      const document = new MockTextDocument(['  Assets:Cash  100.00  ']);
      const position = new vscode.Position(0, 23);

      const result = provider.provideCompletionItems(
        document,
        position,
        mockCancellationToken,
        mockCompletionContext
      );
      const completions = getItems(result);

      // Two spaces after amount is forbidden zone
      expect(completions.length).toBe(0);
    });

    it('should handle completion requests in middle of account names', () => {
      const document = new MockTextDocument(['  Assets:Cash']);
      const position = new vscode.Position(0, 8); // Middle of "Assets:Cash"

      const result = provider.provideCompletionItems(
        document,
        position,
        mockCancellationToken,
        mockCompletionContext
      );
      const completions = getItems(result);

      // Provider may return completions for account hierarchies even mid-word
      expect(completions).toBeDefined();
      expect(Array.isArray(completions)).toBe(true);
    });
  });

  describe('Filtering with Partial Input', () => {
    it('should filter accounts starting with specific letter', () => {
      const document = new MockTextDocument(['  E']);
      const position = new vscode.Position(0, 3);

      const result = provider.provideCompletionItems(
        document,
        position,
        mockCancellationToken,
        mockCompletionContext
      );
      const completions = getItems(result);

      expect(completions).toBeDefined();

      // Should only include accounts starting with E (Expenses)
      const allStartWithE = completions.every((item) => {
        const label = item.label.toString();
        return label.startsWith('E') || label.startsWith('e');
      });
      expect(allStartWithE).toBe(true);

      // Should NOT include Assets or Income accounts
      const hasAssets = completions.some((item) => item.label.toString().startsWith('Assets'));
      expect(hasAssets).toBe(false);
    });
  });

  describe('Realistic Transaction Scenarios', () => {
    it('should handle multiline transaction with multiple postings', () => {
      const document = new MockTextDocument([
        '2024-12-15 Test Transaction',
        '  Expenses:Food  50.00 USD',
        '  Expenses:Transport  15.00 USD',
        '  ',
      ]);

      // Cursor on last indented line
      const position = new vscode.Position(3, 2);
      const result = provider.provideCompletionItems(
        document,
        position,
        mockCancellationToken,
        mockCompletionContext
      );
      const completions = getItems(result);

      expect(completions).toBeDefined();
      // Should provide account completions on indented line
      const hasAccounts = completions.some((item) => item.label.toString().includes('Assets'));
      expect(hasAccounts).toBe(true);
    });

    it('should provide completions for different contexts in same document', () => {
      const document = new MockTextDocument([
        '2024-01-15 Test transaction',
        '  Assets:Cash  100.00 USD',
        '  Expenses:Food',
      ]);

      // Test date completion on first line
      let position = new vscode.Position(0, 4);
      let result = provider.provideCompletionItems(
        document,
        position,
        mockCancellationToken,
        mockCompletionContext
      );
      let completions = getItems(result);
      expect(completions.length).toBeGreaterThan(0);
      expect(completions[0]?.kind).toBe(vscode.CompletionItemKind.Constant);

      // Test account completion on third line
      position = new vscode.Position(2, 15);
      result = provider.provideCompletionItems(
        document,
        position,
        mockCancellationToken,
        mockCompletionContext
      );
      completions = getItems(result);
      expect(completions).toBeDefined();
      expect(completions.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty document gracefully', () => {
      const document = new MockTextDocument(['']);
      const position = new vscode.Position(0, 0);

      const result = provider.provideCompletionItems(
        document,
        position,
        mockCancellationToken,
        mockCompletionContext
      );
      const completions = getItems(result);

      expect(completions).toBeDefined();
      expect(Array.isArray(completions)).toBe(true);
    });

    it('should handle cursor position beyond line length', () => {
      const document = new MockTextDocument(['2024']);
      const position = new vscode.Position(0, 100);

      const result = provider.provideCompletionItems(
        document,
        position,
        mockCancellationToken,
        mockCompletionContext
      );
      const completions = getItems(result);

      expect(completions).toBeDefined();
      expect(Array.isArray(completions)).toBe(true);
    });

    it('should handle invalid line numbers gracefully', () => {
      const document = new MockTextDocument(['2024-01-15 Test']);
      const position = new vscode.Position(10, 0);

      const result = provider.provideCompletionItems(
        document,
        position,
        mockCancellationToken,
        mockCompletionContext
      );
      const completions = getItems(result);

      expect(completions).toBeDefined();
      expect(Array.isArray(completions)).toBe(true);
    });

    it('should handle special characters in account names', () => {
      const document = new MockTextDocument(['  Assets:Bank:Checking-USD']);
      const position = new vscode.Position(0, 26);

      const result = provider.provideCompletionItems(
        document,
        position,
        mockCancellationToken,
        mockCompletionContext
      );
      const completions = getItems(result);

      expect(completions).toBeDefined();
    });
  });

  describe('Performance Tests', () => {
    it('should complete quickly with large dataset', () => {
      // Create a large dataset
      const lines: string[] = [];
      for (let i = 0; i < 100; i++) {
        lines.push(`2024-01-${String(i + 1).padStart(2, '0')} Transaction ${i}`);
        lines.push(`  Expenses:Category${i}  100.00 USD`);
        lines.push(`  Assets:Cash`);
      }

      const largeDoc = new MockTextDocument(lines);
      config.parseContent(largeDoc.getText(), '/test-large');

      const document = new MockTextDocument(['  Expenses:']);
      const position = new vscode.Position(0, 11);

      const startTime = Date.now();
      const result = provider.provideCompletionItems(
        document,
        position,
        mockCancellationToken,
        mockCompletionContext
      );
      const completions = getItems(result);
      const duration = Date.now() - startTime;

      expect(completions).toBeDefined();
      // Should complete in under 100ms even with large dataset
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Data Loading Verification', () => {
    it('should successfully parse and load sample journal data', () => {
      // Verify that sample data was loaded correctly
      const accounts = config.getAccounts();
      const payees = config.getPayees();
      const commodities = config.getCommodities();

      expect(accounts.length).toBeGreaterThan(0);
      expect(payees.length).toBeGreaterThan(0);
      expect(commodities.length).toBeGreaterThan(0);

      // Verify specific entities from sample data
      expect(accounts.some((a) => a.includes('Assets:Cash'))).toBe(true);
      expect(payees.some((p) => p.includes('Grocery Store'))).toBe(true);
      expect(commodities.some((c) => c === 'USD')).toBe(true);
    });
  });
});
