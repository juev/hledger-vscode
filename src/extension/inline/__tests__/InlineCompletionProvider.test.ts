import {
  Position,
  Range,
  MockTextDocument,
  InlineCompletionTriggerKind,
  CancellationToken,
} from "../../../__mocks__/vscode";
import { InlineCompletionProvider } from "../InlineCompletionProvider";

const createMockCancellationToken = (): CancellationToken => ({
  isCancellationRequested: false,
  onCancellationRequested: jest.fn(),
});

const createMockContext = () => ({
  triggerKind: InlineCompletionTriggerKind.Automatic,
  selectedCompletionInfo: undefined,
});

describe("InlineCompletionProvider", () => {
  describe("template completion via LSP", () => {
    it("should call textDocument/inlineCompletion for posting lines", async () => {
      const mockSendRequest = jest.fn().mockResolvedValue({
        items: [
          {
            insertText: "    expenses:food  $50.00\n    assets:cash",
            range: {
              start: { line: 1, character: 0 },
              end: { line: 1, character: 4 },
            },
          },
        ],
      });

      const mockClient = {
        sendRequest: mockSendRequest,
      };

      const mockClientProvider = {
        getClient: () => mockClient,
      };

      const provider = new InlineCompletionProvider(mockClientProvider as any);

      const document = new MockTextDocument([
        "2024-01-15 Grocery Store",
        "    ", // posting line with indent - cursor here
      ]);

      const position = new Position(1, 4);
      const context = createMockContext();
      const token = createMockCancellationToken();

      const result = await provider.provideInlineCompletionItems(
        document as any,
        position as any,
        context as any,
        token
      );

      expect(mockSendRequest).toHaveBeenCalledWith(
        "textDocument/inlineCompletion",
        expect.objectContaining({
          textDocument: expect.objectContaining({ uri: expect.any(String) }),
          position: { line: 1, character: 4 },
          context: { triggerKind: 2 },
        })
      );

      expect(result).toBeDefined();
      expect(result).toHaveLength(1);
      expect(result![0].insertText).toBe("    expenses:food  $50.00\n    assets:cash");
    });

    it("should return undefined when LSP returns empty items", async () => {
      const mockSendRequest = jest.fn().mockResolvedValue({
        items: [],
      });

      const mockClient = {
        sendRequest: mockSendRequest,
      };

      const mockClientProvider = {
        getClient: () => mockClient,
      };

      const provider = new InlineCompletionProvider(mockClientProvider as any);

      const document = new MockTextDocument([
        "2024-01-15 Unknown Payee",
        "    ",
      ]);

      const position = new Position(1, 4);
      const context = createMockContext();
      const token = createMockCancellationToken();

      const result = await provider.provideInlineCompletionItems(
        document as any,
        position as any,
        context as any,
        token
      );

      expect(result).toBeUndefined();
    });

    it("should return undefined when client is not available", async () => {
      const mockClientProvider = {
        getClient: () => null,
      };

      const provider = new InlineCompletionProvider(mockClientProvider as any);

      const document = new MockTextDocument([
        "2024-01-15 Grocery Store",
        "    ",
      ]);

      const position = new Position(1, 4);
      const context = createMockContext();
      const token = createMockCancellationToken();

      const result = await provider.provideInlineCompletionItems(
        document as any,
        position as any,
        context as any,
        token
      );

      expect(result).toBeUndefined();
    });

    it("should return undefined when LSP request fails", async () => {
      const mockSendRequest = jest.fn().mockRejectedValue(new Error("LSP error"));

      const mockClient = {
        sendRequest: mockSendRequest,
      };

      const mockClientProvider = {
        getClient: () => mockClient,
      };

      const provider = new InlineCompletionProvider(mockClientProvider as any);

      const document = new MockTextDocument([
        "2024-01-15 Grocery Store",
        "    ",
      ]);

      const position = new Position(1, 4);
      const context = createMockContext();
      const token = createMockCancellationToken();

      const result = await provider.provideInlineCompletionItems(
        document as any,
        position as any,
        context as any,
        token
      );

      expect(result).toBeUndefined();
    });

    it("should NOT call LSP for non-indented lines", async () => {
      const mockSendRequest = jest.fn();

      const mockClient = {
        sendRequest: mockSendRequest,
      };

      const mockClientProvider = {
        getClient: () => mockClient,
      };

      const provider = new InlineCompletionProvider(mockClientProvider as any);

      const document = new MockTextDocument([
        "2024-01-15 Gro", // typing on transaction header line
      ]);

      const position = new Position(0, 14);
      const context = createMockContext();
      const token = createMockCancellationToken();

      await provider.provideInlineCompletionItems(
        document as any,
        position as any,
        context as any,
        token
      );

      expect(mockSendRequest).not.toHaveBeenCalledWith(
        "textDocument/inlineCompletion",
        expect.anything()
      );
    });
  });

  describe("payee completion (local cache)", () => {
    it("should provide payee completion from cache", async () => {
      const mockSendRequest = jest.fn().mockResolvedValue({
        payees: ["Grocery Store", "Gas Station"],
        templates: [],
      });

      const mockClient = {
        sendRequest: mockSendRequest,
      };

      const mockClientProvider = {
        getClient: () => mockClient,
      };

      const provider = new InlineCompletionProvider(mockClientProvider as any);

      const document = new MockTextDocument([
        "2024-01-15 Gro", // typing payee prefix
      ]);

      const position = new Position(0, 14);
      const context = createMockContext();
      const token = createMockCancellationToken();

      const result = await provider.provideInlineCompletionItems(
        document as any,
        position as any,
        context as any,
        token
      );

      expect(result).toBeDefined();
      expect(result).toHaveLength(1);
      expect(result![0].insertText).toBe("cery Store");
    });
  });
});
