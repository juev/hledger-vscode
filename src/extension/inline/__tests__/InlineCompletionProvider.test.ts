// InlineCompletionProvider.test.ts - Tests for inline ghost text completions
import * as vscode from "vscode";
import {
  Position,
  MockTextDocument,
  Range,
  InlineCompletionTriggerKind,
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
      expect(result![0].insertText).toBe("азин"); // Only remainder
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
      // Should return remainder preserving original case
      expect(result![0].insertText).toBe("ee Shop");
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

    it("should return undefined when prefix matches entire payee", () => {
      mockConfig.getPayeesByUsage.mockReturnValue(["Coffee Shop" as PayeeName]);

      const document = new MockTextDocument(["2024-12-23 Coffee Shop"]);
      const position = new Position(0, 22);

      // This is now a template context, but no templates exist
      mockConfig.getTemplatesForPayee.mockReturnValue([]);

      const result = provider.provideInlineCompletionItems(
        document,
        position,
        createInlineContext(),
        createCancellationToken(),
      );

      // No remainder to show and no templates - should return undefined
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
      expect(result![0].insertText).toBe("уктовый магазин");
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
      expect(result![0].insertText).toBe(" Alpha");
    });
  });

  describe("template completion", () => {
    it("should return template ghost text for complete payee", () => {
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
      const position = new Position(0, 22);

      const result = provider.provideInlineCompletionItems(
        document,
        position,
        createInlineContext(),
        createCancellationToken(),
      );

      expect(result).toBeDefined();
      expect(result).toHaveLength(1);
      // Should include newline and posting lines
      expect(result![0].insertText).toContain("\n");
      expect(result![0].insertText).toContain("Expenses:Food:Coffee");
      expect(result![0].insertText).toContain("Assets:Cash");
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
      const position = new Position(0, 22);

      const result = provider.provideInlineCompletionItems(
        document,
        position,
        createInlineContext(),
        createCancellationToken(),
      );

      expect(result).toBeDefined();
      // Check for 4-space indentation
      expect(result![0].insertText).toContain("\n    Expenses:Food");
      expect(result![0].insertText).toContain("\n    Assets:Cash");
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
      const position = new Position(0, 24);

      const result = provider.provideInlineCompletionItems(
        document,
        position,
        createInlineContext(),
        createCancellationToken(),
      );

      expect(result).toBeDefined();
      expect(result![0].insertText).toContain("100 RUB");
    });

    it("should return undefined when no templates for payee", () => {
      mockConfig.getPayeesByUsage.mockReturnValue(["New Store" as PayeeName]);
      mockConfig.getTemplatesForPayee.mockReturnValue([]);

      const document = new MockTextDocument(["2024-12-23 New Store", ""]);
      const position = new Position(0, 20);

      const result = provider.provideInlineCompletionItems(
        document,
        position,
        createInlineContext(),
        createCancellationToken(),
      );

      expect(result).toBeUndefined();
    });

    it("should use most frequently used template when multiple exist", () => {
      mockConfig.getPayeesByUsage.mockReturnValue(["Store" as PayeeName]);
      // getTemplatesForPayee already returns sorted by usage (highest first)
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
      const position = new Position(0, 16);

      const result = provider.provideInlineCompletionItems(
        document,
        position,
        createInlineContext(),
        createCancellationToken(),
      );

      expect(result).toBeDefined();
      expect(result![0].insertText).toContain("Expenses:Shopping");
      expect(result![0].insertText).not.toContain("Expenses:Groceries");
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
      const position = new Position(0, 18);

      const result = provider.provideInlineCompletionItems(
        document,
        position,
        createInlineContext(),
        createCancellationToken(),
      );

      expect(result).toBeDefined();
      expect(result![0].insertText).toContain("Расходы:Продукты");
      expect(result![0].insertText).toContain("Активы:Наличные");
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

    it("should return undefined for empty lines", () => {
      mockConfig.getPayeesByUsage.mockReturnValue(["Coffee Shop" as PayeeName]);

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
      expect(result![0].range).toBeDefined();
      // Range should start at cursor position
      expect(result![0].range?.start.line).toBe(0);
      expect(result![0].range?.start.character).toBe(15);
    });
  });
});
