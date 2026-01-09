// InlineCompletionProvider.test.ts - Tests for inline ghost text completions
import * as vscode from "vscode";
import {
  Position,
  MockTextDocument,
  Range,
  InlineCompletionTriggerKind,
  SnippetString,
} from "../../../__mocks__/vscode";
import { InlineCompletionProvider } from "../InlineCompletionProvider";
import { HLedgerConfig } from "../../HLedgerConfig";
import {
  PayeeName,
  AccountName,
  CommodityCode,
  UsageCount,
  TransactionTemplate,
} from "../../types";

describe("InlineCompletionProvider", () => {
  let provider: InlineCompletionProvider;
  let mockConfig: jest.Mocked<HLedgerConfig>;

  // Helper to create mock templates
  function createTemplate(
    payee: string,
    postings: {
      account: string;
      amount: string | null;
      commodity: string | null;
    }[],
    usageCount: number = 1,
    lastUsedDate: string | null = "2024-12-24",
  ): TransactionTemplate {
    return {
      payee: payee as PayeeName,
      postings: postings.map((p) => ({
        account: p.account as AccountName,
        amount: p.amount,
        commodity: p.commodity as CommodityCode | null,
      })),
      usageCount: usageCount as UsageCount,
      lastUsedDate,
    };
  }

  // Create mock inline completion context
  function createInlineContext(): vscode.InlineCompletionContext {
    return {
      triggerKind: InlineCompletionTriggerKind.Automatic,
      selectedCompletionInfo: undefined,
    } as vscode.InlineCompletionContext;
  }

  // Create mock cancellation token
  function createCancellationToken() {
    return {
      isCancellationRequested: false,
      onCancellationRequested: jest.fn(),
    };
  }

  beforeEach(() => {
    mockConfig = {
      getConfigForDocument: jest.fn(),
      getPayeesByUsage: jest.fn().mockReturnValue([]),
      getTemplatesForPayee: jest.fn().mockReturnValue([]),
      getAmountAlignmentColumn: jest.fn().mockReturnValue(40),
    } as unknown as jest.Mocked<HLedgerConfig>;

    provider = new InlineCompletionProvider(mockConfig);
  });

  describe("payee completion", () => {
    it("should return single most-used payee match as ghost text", () => {
      mockConfig.getPayeesByUsage.mockReturnValue([
        "Магазин" as PayeeName,
        "Маркет" as PayeeName,
        "Маша" as PayeeName,
      ]);

      const document = new MockTextDocument(["2024-12-23 Маг"]);
      const position = new Position(0, 14);

      const result = provider.provideInlineCompletionItems(
        document,
        position,
        createInlineContext(),
        createCancellationToken(),
      );

      expect(result).toBeDefined();
      expect(result).toHaveLength(1);
      const item = result![0]!;
      expect(item.insertText).toBe("азин"); // Only remainder
    });

    it("should match case-insensitively", () => {
      mockConfig.getPayeesByUsage.mockReturnValue(["Coffee Shop" as PayeeName]);

      const document = new MockTextDocument(["2024-12-23 coff"]);
      const position = new Position(0, 15);

      const result = provider.provideInlineCompletionItems(
        document,
        position,
        createInlineContext(),
        createCancellationToken(),
      );

      expect(result).toBeDefined();
      expect(result).toHaveLength(1);
      const item = result![0]!;
      // Should return remainder preserving original case
      expect(item.insertText).toBe("ee Shop");
    });

    it("should return undefined when no payee matches prefix", () => {
      mockConfig.getPayeesByUsage.mockReturnValue(["Coffee Shop" as PayeeName]);

      const document = new MockTextDocument(["2024-12-23 Xyz"]);
      const position = new Position(0, 14);

      const result = provider.provideInlineCompletionItems(
        document,
        position,
        createInlineContext(),
        createCancellationToken(),
      );

      expect(result).toBeUndefined();
    });

    it("should return undefined when cursor at end of exact payee match on same line", () => {
      mockConfig.getPayeesByUsage.mockReturnValue(["Coffee Shop" as PayeeName]);

      const document = new MockTextDocument(["2024-12-23 Coffee Shop"]);
      const position = new Position(0, 22);

      // Cursor at end of complete payee on same line - no inline completion
      // (template only triggers on empty line after header)
      const result = provider.provideInlineCompletionItems(
        document,
        position,
        createInlineContext(),
        createCancellationToken(),
      );

      // Should return undefined - no template on same line as payee
      expect(result).toBeUndefined();
    });

    it("should handle Unicode payees correctly", () => {
      mockConfig.getPayeesByUsage.mockReturnValue([
        "Продуктовый магазин" as PayeeName,
      ]);

      const document = new MockTextDocument(["2024-12-23 Прод"]);
      const position = new Position(0, 15);

      const result = provider.provideInlineCompletionItems(
        document,
        position,
        createInlineContext(),
        createCancellationToken(),
      );

      expect(result).toBeDefined();
      expect(result).toHaveLength(1);
      const item = result![0]!;
      expect(item.insertText).toBe("уктовый магазин");
    });

    it("should use first (most-used) payee when multiple match", () => {
      // Payees are already sorted by usage, so first one is most used
      mockConfig.getPayeesByUsage.mockReturnValue([
        "Store Alpha" as PayeeName, // Most used
        "Store Beta" as PayeeName,
        "Store Charlie" as PayeeName,
      ]);

      const document = new MockTextDocument(["2024-12-23 Store"]);
      const position = new Position(0, 16);

      const result = provider.provideInlineCompletionItems(
        document,
        position,
        createInlineContext(),
        createCancellationToken(),
      );

      expect(result).toBeDefined();
      expect(result).toHaveLength(1);
      const item = result![0]!;
      expect(item.insertText).toBe(" Alpha");
    });
  });

  describe("template completion", () => {
    // Template completion is now triggered on EMPTY LINE after transaction header
    // This prevents template from being auto-accepted with payee completion

    it("should return template ghost text on empty line after header", () => {
      mockConfig.getPayeesByUsage.mockReturnValue(["Coffee Shop" as PayeeName]);
      mockConfig.getTemplatesForPayee.mockReturnValue([
        createTemplate(
          "Coffee Shop",
          [
            {
              account: "Expenses:Food:Coffee",
              amount: "5.00 USD",
              commodity: "USD",
            },
            { account: "Assets:Cash", amount: null, commodity: null },
          ],
          10,
        ),
      ]);

      const document = new MockTextDocument(["2024-12-23 Coffee Shop", ""]);
      const position = new Position(1, 0); // On empty line after header

      const result = provider.provideInlineCompletionItems(
        document,
        position,
        createInlineContext(),
        createCancellationToken(),
      );

      expect(result).toBeDefined();
      expect(result).toHaveLength(1);
      const item = result![0]!;
      expect(item.insertText).toBeInstanceOf(SnippetString);
      const snippetValue = (item.insertText as SnippetString).value;
      // First line should NOT start with newline (cursor already on new line)
      expect(snippetValue).toMatch(/^    Expenses:Food:Coffee/);
      expect(snippetValue).toContain("Assets:Cash");
    });

    it("should format template with proper indentation", () => {
      mockConfig.getPayeesByUsage.mockReturnValue(["Coffee Shop" as PayeeName]);
      mockConfig.getTemplatesForPayee.mockReturnValue([
        createTemplate("Coffee Shop", [
          { account: "Expenses:Food", amount: "5.00", commodity: null },
          { account: "Assets:Cash", amount: null, commodity: null },
        ]),
      ]);

      const document = new MockTextDocument(["2024-12-23 Coffee Shop", ""]);
      const position = new Position(1, 0); // On empty line

      const result = provider.provideInlineCompletionItems(
        document,
        position,
        createInlineContext(),
        createCancellationToken(),
      );

      expect(result).toBeDefined();
      expect(result).toHaveLength(1);
      const item = result![0]!;
      expect(item.insertText).toBeInstanceOf(SnippetString);
      const snippetValue = (item.insertText as SnippetString).value;
      // First line: 4-space indentation, no leading newline
      expect(snippetValue).toMatch(/^    Expenses:Food/);
      // Second line: newline + 4-space indentation
      expect(snippetValue).toContain("\n    Assets:Cash");
    });

    it("should include amounts in template ghost text", () => {
      mockConfig.getPayeesByUsage.mockReturnValue([
        "Grocery Store" as PayeeName,
      ]);
      mockConfig.getTemplatesForPayee.mockReturnValue([
        createTemplate("Grocery Store", [
          { account: "Expenses:Food", amount: "100 RUB", commodity: "RUB" },
          { account: "Assets:Wallet", amount: null, commodity: null },
        ]),
      ]);

      const document = new MockTextDocument(["2024-12-23 Grocery Store", ""]);
      const position = new Position(1, 0); // On empty line

      const result = provider.provideInlineCompletionItems(
        document,
        position,
        createInlineContext(),
        createCancellationToken(),
      );

      expect(result).toBeDefined();
      expect(result).toHaveLength(1);
      const item = result![0]!;
      expect(item.insertText).toBeInstanceOf(SnippetString);
      const snippetValue = (item.insertText as SnippetString).value;
      expect(snippetValue).toContain("${1:100} RUB");
    });

    it("should return undefined when no templates for payee", () => {
      mockConfig.getPayeesByUsage.mockReturnValue(["New Store" as PayeeName]);
      mockConfig.getTemplatesForPayee.mockReturnValue([]);

      const document = new MockTextDocument(["2024-12-23 New Store", ""]);
      const position = new Position(1, 0); // On empty line

      const result = provider.provideInlineCompletionItems(
        document,
        position,
        createInlineContext(),
        createCancellationToken(),
      );

      expect(result).toBeUndefined();
    });

    it("should NOT return template on same line as payee", () => {
      mockConfig.getPayeesByUsage.mockReturnValue(["Store" as PayeeName]);
      mockConfig.getTemplatesForPayee.mockReturnValue([
        createTemplate("Store", [
          { account: "Expenses:Shopping", amount: "50 USD", commodity: "USD" },
          { account: "Assets:Bank", amount: null, commodity: null },
        ]),
      ]);

      const document = new MockTextDocument(["2024-12-23 Store", ""]);
      const position = new Position(0, 16); // On same line as payee (not empty line)

      const result = provider.provideInlineCompletionItems(
        document,
        position,
        createInlineContext(),
        createCancellationToken(),
      );

      // Should return undefined - no payee prefix, no template on same line
      expect(result).toBeUndefined();
    });

    it("should use most frequently used template when multiple exist", () => {
      mockConfig.getPayeesByUsage.mockReturnValue(["Store" as PayeeName]);
      mockConfig.getTemplatesForPayee.mockReturnValue([
        createTemplate(
          "Store",
          [
            {
              account: "Expenses:Shopping",
              amount: "50 USD",
              commodity: "USD",
            },
            { account: "Assets:Bank", amount: null, commodity: null },
          ],
          100, // Most used
        ),
        createTemplate(
          "Store",
          [
            {
              account: "Expenses:Groceries",
              amount: "30 USD",
              commodity: "USD",
            },
            { account: "Assets:Cash", amount: null, commodity: null },
          ],
          10,
        ),
      ]);

      const document = new MockTextDocument(["2024-12-23 Store", ""]);
      const position = new Position(1, 0); // On empty line

      const result = provider.provideInlineCompletionItems(
        document,
        position,
        createInlineContext(),
        createCancellationToken(),
      );

      expect(result).toBeDefined();
      expect(result).toHaveLength(1);
      const item = result![0]!;
      expect(item.insertText).toBeInstanceOf(SnippetString);
      const snippetValue = (item.insertText as SnippetString).value;
      expect(snippetValue).toContain("Expenses:Shopping");
      expect(snippetValue).not.toContain("Expenses:Groceries");
    });

    it("should handle Unicode template content", () => {
      mockConfig.getPayeesByUsage.mockReturnValue(["Магазин" as PayeeName]);
      mockConfig.getTemplatesForPayee.mockReturnValue([
        createTemplate("Магазин", [
          { account: "Расходы:Продукты", amount: "1000 RUB", commodity: "RUB" },
          { account: "Активы:Наличные", amount: null, commodity: null },
        ]),
      ]);

      const document = new MockTextDocument(["2024-12-23 Магазин", ""]);
      const position = new Position(1, 0); // On empty line

      const result = provider.provideInlineCompletionItems(
        document,
        position,
        createInlineContext(),
        createCancellationToken(),
      );

      expect(result).toBeDefined();
      expect(result).toHaveLength(1);
      const item = result![0]!;
      expect(item.insertText).toBeInstanceOf(SnippetString);
      const snippetValue = (item.insertText as SnippetString).value;
      expect(snippetValue).toContain("Расходы:Продукты");
      expect(snippetValue).toContain("Активы:Наличные");
    });

    it("should have correct range when cursor is not at column 0", () => {
      mockConfig.getPayeesByUsage.mockReturnValue(["Coffee Shop" as PayeeName]);
      mockConfig.getTemplatesForPayee.mockReturnValue([
        createTemplate("Coffee Shop", [
          { account: "Expenses:Food", amount: "5.00", commodity: null },
          { account: "Assets:Cash", amount: null, commodity: null },
        ]),
      ]);

      // User typed 2 spaces on empty line before ghost text appears
      const document = new MockTextDocument(["2024-12-23 Coffee Shop", "  "]);
      const position = new Position(1, 2); // Cursor at column 2 (after 2 spaces)

      const result = provider.provideInlineCompletionItems(
        document,
        position,
        createInlineContext(),
        createCancellationToken(),
      );

      expect(result).toBeDefined();
      expect(result).toHaveLength(1);
      const item = result![0]!;

      // Range should start at column 0 to replace any typed spaces
      expect(item.range?.start.line).toBe(1);
      expect(item.range?.start.character).toBe(0);
      // Range should end at cursor position
      expect(item.range?.end.line).toBe(1);
      expect(item.range?.end.character).toBe(2);

      // Ghost text should still have proper 4-space indentation
      expect(item.insertText).toBeInstanceOf(SnippetString);
      const snippetValue = (item.insertText as SnippetString).value;
      expect(snippetValue).toMatch(/^    Expenses:Food/);
    });

    describe("SnippetString with tabstops", () => {
      it("should return SnippetString for template completion", () => {
        mockConfig.getPayeesByUsage.mockReturnValue([
          "Coffee Shop" as PayeeName,
        ]);
        mockConfig.getTemplatesForPayee.mockReturnValue([
          createTemplate("Coffee Shop", [
            { account: "Expenses:Food", amount: "5.00 USD", commodity: "USD" },
            { account: "Assets:Cash", amount: null, commodity: null },
          ]),
        ]);

        const document = new MockTextDocument(["2024-12-23 Coffee Shop", ""]);
        const position = new Position(1, 0);

        const result = provider.provideInlineCompletionItems(
          document,
          position,
          createInlineContext(),
          createCancellationToken(),
        );

        expect(result).toBeDefined();
        expect(result).toHaveLength(1);
        const item = result![0]!;
        expect(item.insertText).toBeInstanceOf(SnippetString);
      });

      it("should include tabstop for amount field", () => {
        mockConfig.getPayeesByUsage.mockReturnValue([
          "Coffee Shop" as PayeeName,
        ]);
        mockConfig.getTemplatesForPayee.mockReturnValue([
          createTemplate("Coffee Shop", [
            { account: "Expenses:Food", amount: "5.00 USD", commodity: "USD" },
            { account: "Assets:Cash", amount: null, commodity: null },
          ]),
        ]);

        const document = new MockTextDocument(["2024-12-23 Coffee Shop", ""]);
        const position = new Position(1, 0);

        const result = provider.provideInlineCompletionItems(
          document,
          position,
          createInlineContext(),
          createCancellationToken(),
        );

        const snippet = result![0]!.insertText as SnippetString;
        // Amount in tabstop, commodity outside: ${1:5.00} USD
        expect(snippet.value).toContain("${1:5.00} USD");
      });

      it("should have sequential tabstops for multiple amounts", () => {
        mockConfig.getPayeesByUsage.mockReturnValue(["Transfer" as PayeeName]);
        mockConfig.getTemplatesForPayee.mockReturnValue([
          createTemplate("Transfer", [
            { account: "Assets:Bank", amount: "100 USD", commodity: "USD" },
            { account: "Assets:Cash", amount: "-100 USD", commodity: "USD" },
          ]),
        ]);

        const document = new MockTextDocument(["2024-12-23 Transfer", ""]);
        const position = new Position(1, 0);

        const result = provider.provideInlineCompletionItems(
          document,
          position,
          createInlineContext(),
          createCancellationToken(),
        );

        const snippet = result![0]!.insertText as SnippetString;
        // Should have $1 for first amount, $2 for second; commodity outside tabstop
        expect(snippet.value).toContain("${1:100} USD");
        expect(snippet.value).toContain("${2:-100} USD");
      });

      it("should include final tabstop $0 for exiting snippet mode", () => {
        mockConfig.getPayeesByUsage.mockReturnValue([
          "Coffee Shop" as PayeeName,
        ]);
        mockConfig.getTemplatesForPayee.mockReturnValue([
          createTemplate("Coffee Shop", [
            { account: "Expenses:Food", amount: "5.00 USD", commodity: "USD" },
            { account: "Assets:Cash", amount: null, commodity: null },
          ]),
        ]);

        const document = new MockTextDocument(["2024-12-23 Coffee Shop", ""]);
        const position = new Position(1, 0);

        const result = provider.provideInlineCompletionItems(
          document,
          position,
          createInlineContext(),
          createCancellationToken(),
        );

        const snippet = result![0]!.insertText as SnippetString;
        expect(snippet.value).toContain("$0");
      });

      it("should escape special snippet characters in account names", () => {
        mockConfig.getPayeesByUsage.mockReturnValue([
          "Special Store" as PayeeName,
        ]);
        mockConfig.getTemplatesForPayee.mockReturnValue([
          createTemplate("Special Store", [
            {
              account: "Expenses:Store$Name",
              amount: "10 USD",
              commodity: "USD",
            },
            { account: "Assets:Cash", amount: null, commodity: null },
          ]),
        ]);

        const document = new MockTextDocument(["2024-12-23 Special Store", ""]);
        const position = new Position(1, 0);

        const result = provider.provideInlineCompletionItems(
          document,
          position,
          createInlineContext(),
          createCancellationToken(),
        );

        const snippet = result![0]!.insertText as SnippetString;
        // $ should be escaped as \$
        expect(snippet.value).toContain("Expenses:Store\\$Name");
      });

      it("should escape curly braces in account names", () => {
        mockConfig.getPayeesByUsage.mockReturnValue([
          "Bracket Store" as PayeeName,
        ]);
        mockConfig.getTemplatesForPayee.mockReturnValue([
          createTemplate("Bracket Store", [
            {
              account: "Expenses:Store}Name",
              amount: "10 USD",
              commodity: "USD",
            },
            { account: "Assets:Cash", amount: null, commodity: null },
          ]),
        ]);

        const document = new MockTextDocument([
          "2024-12-23 Bracket Store",
          "",
        ]);
        const position = new Position(1, 0);

        const result = provider.provideInlineCompletionItems(
          document,
          position,
          createInlineContext(),
          createCancellationToken(),
        );

        const snippet = result![0]!.insertText as SnippetString;
        // } should be escaped as \}
        expect(snippet.value).toContain("Expenses:Store\\}Name");
      });

      it("should handle prefix commodity symbols like $ in amount values", () => {
        mockConfig.getPayeesByUsage.mockReturnValue([
          "Dollar Store" as PayeeName,
        ]);
        mockConfig.getTemplatesForPayee.mockReturnValue([
          createTemplate("Dollar Store", [
            { account: "Expenses:Food", amount: "$10.00", commodity: "$" },
            { account: "Assets:Cash", amount: null, commodity: null },
          ]),
        ]);

        const document = new MockTextDocument(["2024-12-23 Dollar Store", ""]);
        const position = new Position(1, 0);

        const result = provider.provideInlineCompletionItems(
          document,
          position,
          createInlineContext(),
          createCancellationToken(),
        );

        const snippet = result![0]!.insertText as SnippetString;
        // $ is prefix commodity, extracted and placed outside tabstop
        expect(snippet.value).toContain("${1:10.00} $");
        // Should NOT duplicate $ symbol
        expect(snippet.value).not.toContain("${1:\\$10.00} $");
      });

      it("should not have command for cursor positioning (snippet handles it)", () => {
        mockConfig.getPayeesByUsage.mockReturnValue([
          "Coffee Shop" as PayeeName,
        ]);
        mockConfig.getTemplatesForPayee.mockReturnValue([
          createTemplate("Coffee Shop", [
            { account: "Expenses:Food", amount: "5.00 USD", commodity: "USD" },
            { account: "Assets:Cash", amount: null, commodity: null },
          ]),
        ]);

        const document = new MockTextDocument(["2024-12-23 Coffee Shop", ""]);
        const position = new Position(1, 0);

        const result = provider.provideInlineCompletionItems(
          document,
          position,
          createInlineContext(),
          createCancellationToken(),
        );

        const item = result![0]!;
        // No command needed when using SnippetString - tabstops handle cursor
        expect(item.command).toBeUndefined();
      });

      it("should only have tabstops for postings with amounts", () => {
        mockConfig.getPayeesByUsage.mockReturnValue([
          "Coffee Shop" as PayeeName,
        ]);
        mockConfig.getTemplatesForPayee.mockReturnValue([
          createTemplate("Coffee Shop", [
            { account: "Expenses:Food", amount: "5.00 USD", commodity: "USD" },
            { account: "Assets:Cash", amount: null, commodity: null },
          ]),
        ]);

        const document = new MockTextDocument(["2024-12-23 Coffee Shop", ""]);
        const position = new Position(1, 0);

        const result = provider.provideInlineCompletionItems(
          document,
          position,
          createInlineContext(),
          createCancellationToken(),
        );

        const snippet = result![0]!.insertText as SnippetString;
        // Only one tabstop (for the amount on first posting)
        // Should have $1 but not $2
        expect(snippet.value).toMatch(/\$\{1:/);
        expect(snippet.value).not.toMatch(/\$\{2:/);
        // Should have Assets:Cash without tabstop
        expect(snippet.value).toContain("Assets:Cash");
        expect(snippet.value).not.toContain("Assets:Cash  ${");
      });

      it("should align amounts to configured alignment column", () => {
        // Set alignment column to 50
        mockConfig.getAmountAlignmentColumn.mockReturnValue(50);

        mockConfig.getPayeesByUsage.mockReturnValue(["Store" as PayeeName]);
        mockConfig.getTemplatesForPayee.mockReturnValue([
          createTemplate("Store", [
            { account: "Expenses:Food", amount: "100 USD", commodity: "USD" },
            { account: "Assets:Cash", amount: null, commodity: null },
          ]),
        ]);

        const document = new MockTextDocument(["2024-12-23 Store", ""]);
        const position = new Position(1, 0);

        const result = provider.provideInlineCompletionItems(
          document,
          position,
          createInlineContext(),
          createCancellationToken(),
        );

        const snippet = result![0]!.insertText as SnippetString;
        // "    Expenses:Food" is 4 + 13 = 17 characters
        // To align to column 50, need 50 - 17 = 33 spaces
        // But minimum is 2 spaces, so calculate expected spacing
        const indent = "    "; // 4 spaces
        const account = "Expenses:Food";
        const expectedSpaces = Math.max(2, 50 - (indent.length + account.length));
        const expectedSpacing = " ".repeat(expectedSpaces);

        expect(snippet.value).toContain(
          `${indent}${account}${expectedSpacing}\${1:100} USD`,
        );
      });

      it("should use minimum 2 spaces when account is longer than alignment column", () => {
        // Set alignment column to 30
        mockConfig.getAmountAlignmentColumn.mockReturnValue(30);

        mockConfig.getPayeesByUsage.mockReturnValue(["Store" as PayeeName]);
        mockConfig.getTemplatesForPayee.mockReturnValue([
          createTemplate("Store", [
            {
              account: "Expenses:Food:Groceries:Supermarket",
              amount: "100 USD",
              commodity: "USD",
            },
            { account: "Assets:Cash", amount: null, commodity: null },
          ]),
        ]);

        const document = new MockTextDocument(["2024-12-23 Store", ""]);
        const position = new Position(1, 0);

        const result = provider.provideInlineCompletionItems(
          document,
          position,
          createInlineContext(),
          createCancellationToken(),
        );

        const snippet = result![0]!.insertText as SnippetString;
        // Account "Expenses:Food:Groceries:Supermarket" (35 chars) + 4 indent = 39
        // This exceeds alignment column 30, so minimum 2 spaces should be used
        expect(snippet.value).toContain(
          "    Expenses:Food:Groceries:Supermarket  ${1:100} USD",
        );
      });
    });
  });

  describe("edge cases", () => {
    it("should return undefined for indented lines", () => {
      mockConfig.getPayeesByUsage.mockReturnValue(["Coffee Shop" as PayeeName]);

      const document = new MockTextDocument([
        "2024-12-23 Transaction",
        "    Expenses:Cof",
      ]);
      const position = new Position(1, 17);

      const result = provider.provideInlineCompletionItems(
        document,
        position,
        createInlineContext(),
        createCancellationToken(),
      );

      expect(result).toBeUndefined();
    });

    it("should return undefined for empty line without transaction header above", () => {
      mockConfig.getPayeesByUsage.mockReturnValue(["Coffee Shop" as PayeeName]);

      // Empty line at start of document - no previous line to check
      const document = new MockTextDocument([""]);
      const position = new Position(0, 0);

      const result = provider.provideInlineCompletionItems(
        document,
        position,
        createInlineContext(),
        createCancellationToken(),
      );

      expect(result).toBeUndefined();
    });

    it("should return undefined for empty line after non-header line", () => {
      mockConfig.getPayeesByUsage.mockReturnValue(["Coffee Shop" as PayeeName]);

      // Empty line after comment, not transaction header
      const document = new MockTextDocument(["; comment", ""]);
      const position = new Position(1, 0);

      const result = provider.provideInlineCompletionItems(
        document,
        position,
        createInlineContext(),
        createCancellationToken(),
      );

      expect(result).toBeUndefined();
    });

    it("should call getConfigForDocument with correct parameters", () => {
      const document = new MockTextDocument(["2024-12-23 Test"]);
      const position = new Position(0, 15);

      provider.provideInlineCompletionItems(
        document,
        position,
        createInlineContext(),
        createCancellationToken(),
      );

      expect(mockConfig.getConfigForDocument).toHaveBeenCalledWith(
        document,
        position.line,
      );
    });

    it("should set correct range for completion", () => {
      mockConfig.getPayeesByUsage.mockReturnValue(["Coffee Shop" as PayeeName]);

      const document = new MockTextDocument(["2024-12-23 Coff"]);
      const position = new Position(0, 15);

      const result = provider.provideInlineCompletionItems(
        document,
        position,
        createInlineContext(),
        createCancellationToken(),
      );

      expect(result).toBeDefined();
      expect(result).toHaveLength(1);
      const item = result![0]!;
      expect(item.range).toBeDefined();
      // Range should start at cursor position
      expect(item.range?.start.line).toBe(0);
      expect(item.range?.start.character).toBe(15);
    });
  });
});
