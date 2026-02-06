import * as vscode from "vscode";
import { InlineCompletionProvider } from "../InlineCompletionProvider";

interface MockLSPClient {
  sendRequest: jest.Mock;
}

function createMockDocument(uri = "file:///test.journal"): vscode.TextDocument {
  return {
    uri: { toString: () => uri },
  } as unknown as vscode.TextDocument;
}

function createMockPosition(line = 0, character = 0): vscode.Position {
  return new vscode.Position(line, character);
}

function createMockContext(
  triggerKind: vscode.InlineCompletionTriggerKind = vscode.InlineCompletionTriggerKind.Automatic,
): vscode.InlineCompletionContext {
  return { triggerKind } as vscode.InlineCompletionContext;
}

function createMockToken(isCancelled = false): vscode.CancellationToken {
  return {
    isCancellationRequested: isCancelled,
    onCancellationRequested: jest.fn(() => ({ dispose: jest.fn() })),
  };
}

describe("InlineCompletionProvider", () => {
  let mockClient: MockLSPClient;

  beforeEach(() => {
    mockClient = {
      sendRequest: jest.fn(),
    };
  });

  describe("provideInlineCompletionItems", () => {
    it("returns undefined when client is null", async () => {
      const provider = new InlineCompletionProvider(() => null);

      const result = await provider.provideInlineCompletionItems(
        createMockDocument(),
        createMockPosition(),
        createMockContext(),
        createMockToken(),
      );

      expect(result).toBeUndefined();
    });

    it("returns undefined when cancellation is requested before sending", async () => {
      const provider = new InlineCompletionProvider(() => mockClient);

      const result = await provider.provideInlineCompletionItems(
        createMockDocument(),
        createMockPosition(),
        createMockContext(),
        createMockToken(true),
      );

      expect(result).toBeUndefined();
      expect(mockClient.sendRequest).not.toHaveBeenCalled();
    });

    it("returns undefined when cancellation is requested after response", async () => {
      let tokenCancelled = false;
      const token = {
        get isCancellationRequested() {
          return tokenCancelled;
        },
        onCancellationRequested: jest.fn(() => ({ dispose: jest.fn() })),
      };

      mockClient.sendRequest.mockImplementation(async () => {
        tokenCancelled = true;
        return { items: [{ insertText: "    Expenses:Food" }] };
      });

      const provider = new InlineCompletionProvider(() => mockClient);

      const result = await provider.provideInlineCompletionItems(
        createMockDocument(),
        createMockPosition(),
        createMockContext(),
        token,
      );

      expect(result).toBeUndefined();
    });

    it("returns undefined when response is null", async () => {
      mockClient.sendRequest.mockResolvedValue(null);
      const provider = new InlineCompletionProvider(() => mockClient);

      const result = await provider.provideInlineCompletionItems(
        createMockDocument(),
        createMockPosition(),
        createMockContext(),
        createMockToken(),
      );

      expect(result).toBeUndefined();
    });

    it("returns undefined when response has no items", async () => {
      mockClient.sendRequest.mockResolvedValue({ items: [] });
      const provider = new InlineCompletionProvider(() => mockClient);

      const result = await provider.provideInlineCompletionItems(
        createMockDocument(),
        createMockPosition(),
        createMockContext(),
        createMockToken(),
      );

      expect(result).toBeUndefined();
    });

    it("returns undefined when LSP request fails", async () => {
      mockClient.sendRequest.mockRejectedValue(new Error("LSP error"));
      const provider = new InlineCompletionProvider(() => mockClient);

      const result = await provider.provideInlineCompletionItems(
        createMockDocument(),
        createMockPosition(),
        createMockContext(),
        createMockToken(),
      );

      expect(result).toBeUndefined();
    });

    it("returns completion items from LSP response", async () => {
      mockClient.sendRequest.mockResolvedValue({
        items: [{ insertText: "    Expenses:Food  $10.00" }],
      });
      const provider = new InlineCompletionProvider(() => mockClient);
      const position = createMockPosition(1, 0);

      const result = await provider.provideInlineCompletionItems(
        createMockDocument(),
        position,
        createMockContext(),
        createMockToken(),
      );

      expect(result).toHaveLength(1);
      expect(result?.[0]?.insertText).toBe("    Expenses:Food  $10.00");
    });

    it("uses position as range when item has no range", async () => {
      mockClient.sendRequest.mockResolvedValue({
        items: [{ insertText: "test" }],
      });
      const provider = new InlineCompletionProvider(() => mockClient);
      const position = createMockPosition(5, 10);

      const result = await provider.provideInlineCompletionItems(
        createMockDocument(),
        position,
        createMockContext(),
        createMockToken(),
      );

      expect(result).toHaveLength(1);
      const item = result?.[0];
      expect(item?.range?.start.line).toBe(5);
      expect(item?.range?.start.character).toBe(10);
      expect(item?.range?.end.line).toBe(5);
      expect(item?.range?.end.character).toBe(10);
    });

    it("uses item range when provided", async () => {
      mockClient.sendRequest.mockResolvedValue({
        items: [
          {
            insertText: "test",
            range: {
              start: { line: 1, character: 0 },
              end: { line: 1, character: 5 },
            },
          },
        ],
      });
      const provider = new InlineCompletionProvider(() => mockClient);

      const result = await provider.provideInlineCompletionItems(
        createMockDocument(),
        createMockPosition(1, 5),
        createMockContext(),
        createMockToken(),
      );

      expect(result).toHaveLength(1);
      const item = result?.[0];
      expect(item?.range?.start.line).toBe(1);
      expect(item?.range?.start.character).toBe(0);
      expect(item?.range?.end.line).toBe(1);
      expect(item?.range?.end.character).toBe(5);
    });

    it("returns multiple completion items", async () => {
      mockClient.sendRequest.mockResolvedValue({
        items: [
          { insertText: "    Expenses:Food  $10.00" },
          { insertText: "    Assets:Cash  -$10.00" },
        ],
      });
      const provider = new InlineCompletionProvider(() => mockClient);

      const result = await provider.provideInlineCompletionItems(
        createMockDocument(),
        createMockPosition(),
        createMockContext(),
        createMockToken(),
      );

      expect(result).toHaveLength(2);
      expect(result?.[0]?.insertText).toBe("    Expenses:Food  $10.00");
      expect(result?.[1]?.insertText).toBe("    Assets:Cash  -$10.00");
    });

    it("sends correct LSP request parameters", async () => {
      mockClient.sendRequest.mockResolvedValue({ items: [] });
      const provider = new InlineCompletionProvider(() => mockClient);

      await provider.provideInlineCompletionItems(
        createMockDocument("file:///my/test.journal"),
        createMockPosition(3, 15),
        createMockContext(vscode.InlineCompletionTriggerKind.Invoke),
        createMockToken(),
      );

      expect(mockClient.sendRequest).toHaveBeenCalledWith(
        "textDocument/inlineCompletion",
        {
          textDocument: { uri: "file:///my/test.journal" },
          position: { line: 3, character: 15 },
          context: { triggerKind: 1 },
        },
      );
    });

    it("maps Automatic trigger kind to 2", async () => {
      mockClient.sendRequest.mockResolvedValue({ items: [] });
      const provider = new InlineCompletionProvider(() => mockClient);

      await provider.provideInlineCompletionItems(
        createMockDocument(),
        createMockPosition(),
        createMockContext(vscode.InlineCompletionTriggerKind.Automatic),
        createMockToken(),
      );

      expect(mockClient.sendRequest).toHaveBeenCalledWith(
        "textDocument/inlineCompletion",
        expect.objectContaining({
          context: { triggerKind: 2 },
        }),
      );
    });
  });

  describe("dispose", () => {
    it("does not throw", () => {
      const provider = new InlineCompletionProvider(() => null);
      expect(() => provider.dispose()).not.toThrow();
    });
  });
});
