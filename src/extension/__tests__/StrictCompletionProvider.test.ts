// StrictCompletionProvider.test.ts - Integration tests for strict completion provider
import * as vscode from 'vscode';
import { StrictCompletionProvider } from '../StrictCompletionProvider';
import { HLedgerConfig } from '../HLedgerConfig';
import { HLedgerParser } from '../HLedgerParser';
import { SimpleProjectCache } from '../SimpleProjectCache';

// Import MockTextDocument from the mock
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

describe('StrictCompletionProvider Integration', () => {
  let provider: StrictCompletionProvider;
  let config: HLedgerConfig;

  beforeEach(() => {
    const parser = new HLedgerParser();
    const cache = new SimpleProjectCache();
    config = new HLedgerConfig(parser, cache);
    provider = new StrictCompletionProvider(config);
  });

  const mockCompletionContext: vscode.CompletionContext = {
    triggerKind: vscode.CompletionTriggerKind.Invoke,
    triggerCharacter: undefined,
  };

  const mockCancellationToken: vscode.CancellationToken = {
    isCancellationRequested: false,
    onCancellationRequested: () => new vscode.Disposable(() => {}),
  };

  describe('Date completions', () => {
    it('should provide date completions at line beginning', () => {
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
      expect(Array.isArray(completions)).toBe(true);
      expect(completions.length).toBeGreaterThan(0);

      // Should contain date-related completions
      const hasDateCompletions = completions.some(
        (item) => item.kind === vscode.CompletionItemKind.Constant
      );
      expect(hasDateCompletions).toBe(true);
    });

    it('should provide date completions for zero at line start', () => {
      const document = new MockTextDocument(['0']);
      const position = new vscode.Position(0, 1);

      const result = provider.provideCompletionItems(
        document,
        position,
        mockCancellationToken,
        mockCompletionContext
      );
      const completions = getItems(result);

      expect(completions).toBeDefined();
      expect(completions.length).toBeGreaterThan(0);
    });

    it('should not provide date completions in middle of line', () => {
      const document = new MockTextDocument(['  2024']);
      const position = new vscode.Position(0, 6);

      const result = provider.provideCompletionItems(
        document,
        position,
        mockCancellationToken,
        mockCompletionContext
      );
      const completions = getItems(result);

      expect(completions.length).toBe(0);
    });
  });

  describe('Account completions', () => {
    it('should provide account completions on indented lines', () => {
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
      expect(Array.isArray(completions)).toBe(true);
      // Note: Actual account completions depend on parsed data
    });

    it('should not provide account completions on non-indented lines', () => {
      const document = new MockTextDocument(['Assets']);
      const position = new vscode.Position(0, 6);

      const result = provider.provideCompletionItems(
        document,
        position,
        mockCancellationToken,
        mockCompletionContext
      );
      const completions = getItems(result);

      expect(completions.length).toBe(0);
    });
  });

  describe('Commodity completions', () => {
    it('should provide commodity completions after amount + single space', () => {
      const document = new MockTextDocument(['  Assets:Cash  100.00 U']);
      const position = new vscode.Position(0, 23);

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

    it('should not provide commodity completions after amount + two spaces', () => {
      const document = new MockTextDocument(['  Assets:Cash  100.00  ']);
      const position = new vscode.Position(0, 24);

      const result = provider.provideCompletionItems(
        document,
        position,
        mockCancellationToken,
        mockCompletionContext
      );
      const completions = getItems(result);

      expect(completions.length).toBe(0);
    });
  });

  describe('Forbidden zones', () => {
    it('should suppress all completions after amount + two spaces', () => {
      const document = new MockTextDocument(['  Assets:Cash  100.00  ']);
      const position = new vscode.Position(0, 24);

      const result = provider.provideCompletionItems(
        document,
        position,
        mockCancellationToken,
        mockCompletionContext
      );
      const completions = getItems(result);

      expect(completions.length).toBe(0);
    });

    it('should suppress completions in middle of words', () => {
      const document = new MockTextDocument(['  Assets:Cash']);
      const position = new vscode.Position(0, 5); // Middle of "Assets" (between 's' and 'e')

      const result = provider.provideCompletionItems(
        document,
        position,
        mockCancellationToken,
        mockCompletionContext
      );
      const completions = getItems(result);

      expect(completions.length).toBe(0);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty lines gracefully', () => {
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

    it('should handle positions beyond line length', () => {
      const document = new MockTextDocument(['2024']);
      const position = new vscode.Position(0, 10);

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

    it('should handle multiline documents', () => {
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
    });
  });

  describe('Performance', () => {
    it('should provide completions quickly', () => {
      const document = new MockTextDocument(['2024-01-15 Test']);
      const position = new vscode.Position(0, 4);

      const startTime = Date.now();

      // Run completion 100 times
      for (let i = 0; i < 100; i++) {
        provider.provideCompletionItems(
          document,
          position,
          mockCancellationToken,
          mockCompletionContext
        );
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete 100 requests in under 200ms
      expect(duration).toBeLessThan(200);
    });
  });

  describe('Payee query extraction', () => {
    // Tests for correct payee query extraction from date lines
    // Bug fix: the regex should not capture the date portion

    beforeEach(() => {
      // Populate config with test payees using parseContent
      // Multiple uses of each payee increase usage count for sorting
      const testJournal = `
2024-01-01 Amazon
  Assets:Cash  -100 USD
  Expenses:Shopping

2024-01-02 Amazon
  Assets:Cash  -50 USD
  Expenses:Shopping

2024-01-03 Amazon
  Assets:Cash  -75 USD
  Expenses:Shopping

2024-01-04 Amazon
  Assets:Cash  -25 USD
  Expenses:Shopping

2024-01-05 Amazon
  Assets:Cash  -30 USD
  Expenses:Shopping

2024-01-06 Amazon Purchase
  Assets:Cash  -200 USD
  Expenses:Shopping

2024-01-07 Amazon Purchase
  Assets:Cash  -150 USD
  Expenses:Shopping

2024-01-08 Amazon Purchase
  Assets:Cash  -100 USD
  Expenses:Shopping

2024-01-09 Amazon Prime
  Assets:Cash  -15 USD
  Expenses:Subscription

2024-01-10 Amazon Prime
  Assets:Cash  -15 USD
  Expenses:Subscription

2024-01-11 Grocery Store
  Assets:Cash  -80 USD
  Expenses:Food

2024-01-12 Grocery Store
  Assets:Cash  -90 USD
  Expenses:Food

2024-01-13 Grocery Store
  Assets:Cash  -70 USD
  Expenses:Food

2024-01-14 Grocery Store
  Assets:Cash  -60 USD
  Expenses:Food

2024-01-15 Test Payee
  Assets:Cash  -10 USD
  Expenses:Other
`;
      config.parseContent(testJournal, '/test');
    });

    it('should extract empty query after date and space', () => {
      // Input: "2024-01-15 " -> Expected query: ""
      const document = new MockTextDocument(['2024-01-15 ']);
      const position = new vscode.Position(0, 11);

      const result = provider.provideCompletionItems(
        document,
        position,
        mockCancellationToken,
        mockCompletionContext
      );
      const completions = getItems(result);

      // With empty query, all payees should be returned (at least the 5 we defined)
      expect(completions).toBeDefined();
      expect(completions.length).toBeGreaterThanOrEqual(5);
    });

    it('should extract partial payee name after date', () => {
      // Input: "2024-01-15 Ama" -> Expected query: "Ama"
      const document = new MockTextDocument(['2024-01-15 Ama']);
      const position = new vscode.Position(0, 14);

      const result = provider.provideCompletionItems(
        document,
        position,
        mockCancellationToken,
        mockCompletionContext
      );
      const completions = getItems(result);

      // Should filter to only Amazon-related payees (at least 3)
      expect(completions).toBeDefined();
      expect(completions.length).toBeGreaterThanOrEqual(3);
      // Verify Amazon-related payees are included
      const labels = completions.map((c) => c.label.toString());
      expect(labels).toContain('Amazon');
      expect(labels).toContain('Amazon Purchase');
      expect(labels).toContain('Amazon Prime');
    });

    it('should extract multi-word payee name after date', () => {
      // Input: "2024-01-15 Amazon Pur" -> Expected query: "Amazon Pur"
      // This was the failing case - the date was being captured
      const document = new MockTextDocument(['2024-01-15 Amazon Pur']);
      const position = new vscode.Position(0, 21);

      const result = provider.provideCompletionItems(
        document,
        position,
        mockCancellationToken,
        mockCompletionContext
      );
      const completions = getItems(result);

      // Should filter to "Amazon Purchase" only (matches "Amazon Pur")
      expect(completions).toBeDefined();
      expect(completions.length).toBeGreaterThan(0);
      // The most relevant match should be "Amazon Purchase"
      const labels = completions.map((c) => c.label.toString());
      expect(labels).toContain('Amazon Purchase');
    });

    it('should extract empty query after date with status marker and space', () => {
      // Input: "2024-01-15 * " -> Expected query: ""
      const document = new MockTextDocument(['2024-01-15 * ']);
      const position = new vscode.Position(0, 13);

      const result = provider.provideCompletionItems(
        document,
        position,
        mockCancellationToken,
        mockCompletionContext
      );
      const completions = getItems(result);

      // With empty query, all payees should be returned (at least the 5 we defined)
      expect(completions).toBeDefined();
      expect(completions.length).toBeGreaterThanOrEqual(5);
    });

    it('should extract payee name after date with cleared status marker', () => {
      // Input: "2024-01-15 * Amazon" -> Expected query: "Amazon"
      const document = new MockTextDocument(['2024-01-15 * Amazon']);
      const position = new vscode.Position(0, 19);

      const result = provider.provideCompletionItems(
        document,
        position,
        mockCancellationToken,
        mockCompletionContext
      );
      const completions = getItems(result);

      // Should filter to Amazon-related payees (at least 3)
      expect(completions).toBeDefined();
      expect(completions.length).toBeGreaterThanOrEqual(3);
      const labels = completions.map((c) => c.label.toString());
      expect(labels).toContain('Amazon');
    });

    it('should extract multi-word payee after date with pending status marker', () => {
      // Input: "2024-01-15 ! Amazon Purchase" -> Expected query: "Amazon Purchase"
      const document = new MockTextDocument(['2024-01-15 ! Amazon Purchase']);
      const position = new vscode.Position(0, 28);

      const result = provider.provideCompletionItems(
        document,
        position,
        mockCancellationToken,
        mockCompletionContext
      );
      const completions = getItems(result);

      expect(completions).toBeDefined();
      // Should match "Amazon Purchase" exactly
      const labels = completions.map((c) => c.label.toString());
      expect(labels).toContain('Amazon Purchase');
    });

    it('should extract payee after short date format', () => {
      // Input: "01-15 Test" -> Expected query: "Test"
      const document = new MockTextDocument(['01-15 Test']);
      const position = new vscode.Position(0, 10);

      const result = provider.provideCompletionItems(
        document,
        position,
        mockCancellationToken,
        mockCompletionContext
      );
      const completions = getItems(result);

      // Should filter to Test-related payees
      expect(completions).toBeDefined();
      const labels = completions.map((c) => c.label.toString());
      expect(labels).toContain('Test Payee');
    });

    it('should extract payee after date with slash separator', () => {
      // Input: "2024/01/15 Test" -> Expected query: "Test"
      const document = new MockTextDocument(['2024/01/15 Test']);
      const position = new vscode.Position(0, 15);

      const result = provider.provideCompletionItems(
        document,
        position,
        mockCancellationToken,
        mockCompletionContext
      );
      const completions = getItems(result);

      // Should filter to Test-related payees
      expect(completions).toBeDefined();
      const labels = completions.map((c) => c.label.toString());
      expect(labels).toContain('Test Payee');
    });

    it('should NOT include date in payee query - regression test', () => {
      // The bug: when typing "2024-01-15 Amazon Pur", the query was
      // incorrectly extracted as "2024-01-15 Amazon Pur" instead of "Amazon Pur"
      // This caused no matches because no payee contains "2024"
      const document = new MockTextDocument(['2024-01-15 Grocery']);
      const position = new vscode.Position(0, 18);

      const result = provider.provideCompletionItems(
        document,
        position,
        mockCancellationToken,
        mockCompletionContext
      );
      const completions = getItems(result);

      // Should match "Grocery Store" since query is "Grocery"
      // If bug exists, query would be "2024-01-15 Grocery" and no match found
      expect(completions).toBeDefined();
      expect(completions.length).toBeGreaterThan(0);
      const labels = completions.map((c) => c.label.toString());
      expect(labels).toContain('Grocery Store');
    });
  });

  describe('Strict rules enforcement', () => {
    it('should enforce exactly one completion type per position', () => {
      const testCases = [
        { document: ['2024'], position: new vscode.Position(0, 4), expectedType: 'date' },
        { document: ['  Assets'], position: new vscode.Position(0, 8), expectedType: 'account' },
        {
          document: ['  Assets:Cash  100.00 U'],
          position: new vscode.Position(0, 23),
          expectedType: 'commodity',
        },
      ];

      testCases.forEach(({ document: lines, position, expectedType }) => {
        const document = new MockTextDocument(lines);
        const result = provider.provideCompletionItems(
          document,
          position,
          mockCancellationToken,
          mockCompletionContext
        );
        const completions = getItems(result);

        // Should have completions for the expected type
        expect(completions).toBeDefined();

        // All completions should be of the same kind (single type per position rule)
        if (completions.length > 0) {
          const firstKind = completions[0]!.kind;
          const allSameKind = completions.every((item) => item.kind === firstKind);
          expect(allSameKind).toBe(true);
        }
      });
    });

    it('should respect minimum trigger requirements', () => {
      // Test that contextual triggers work
      const contextualTriggers = [':', '@', ';'];

      contextualTriggers.forEach((trigger) => {
        // These should not cause errors when used appropriately
        const document = new MockTextDocument([`  Assets${trigger}`]);
        const position = new vscode.Position(0, 8 + trigger.length);

        const result = provider.provideCompletionItems(document, position, mockCancellationToken, {
          ...mockCompletionContext,
          triggerCharacter: trigger,
        });
        const completions = getItems(result);

        expect(completions).toBeDefined();
      });
    });
  });
});
