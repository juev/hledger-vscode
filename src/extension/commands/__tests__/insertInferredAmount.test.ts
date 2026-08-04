import type { Mock } from "vitest";
import * as vscode from "vscode";
import { insertInferredAmount } from "../insertInferredAmount";

interface MockLSPClient {
  sendRequest: Mock;
}

const ACTION = {
  title: "Insert inferred amount (20.50 USD)",
  kind: "quickfix.hledger.insertInferredAmount",
  edit: {
    changes: {
      "file:///test.journal": [
        {
          range: {
            start: { line: 2, character: 17 },
            end: { line: 2, character: 17 },
          },
          newText: "   20.50 USD",
        },
      ],
    },
  },
};

describe("insertInferredAmount", () => {
  let mockClient: MockLSPClient;
  let applyEditMock: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = { sendRequest: vi.fn() };

    applyEditMock = vi.fn().mockResolvedValue(true);
    (vscode.workspace as any).applyEdit = applyEditMock;

    (vscode.window as any).activeTextEditor = {
      document: {
        uri: { toString: () => "file:///test.journal" },
        languageId: "hledger",
      },
      selection: { active: new vscode.Position(2, 17) },
    };
  });

  it("asks the server for the inferred amount action at the cursor", async () => {
    mockClient.sendRequest.mockResolvedValue([ACTION]);

    await insertInferredAmount(() => mockClient);

    expect(mockClient.sendRequest).toHaveBeenCalledWith(
      "textDocument/codeAction",
      expect.objectContaining({
        textDocument: { uri: "file:///test.journal" },
        range: {
          start: { line: 2, character: 17 },
          end: { line: 2, character: 17 },
        },
        context: {
          diagnostics: [],
          only: ["quickfix.hledger.insertInferredAmount"],
        },
      }),
    );
    expect(applyEditMock).toHaveBeenCalled();
  });

  it("ignores actions of other kinds", async () => {
    mockClient.sendRequest.mockResolvedValue([
      { ...ACTION, kind: "quickfix", title: "Fix final posting amount" },
    ]);

    await insertInferredAmount(() => mockClient);

    expect(applyEditMock).not.toHaveBeenCalled();
  });

  it("applies the edit even when the server keys it by a differently encoded uri", async () => {
    mockClient.sendRequest.mockResolvedValue([
      {
        ...ACTION,
        edit: { changes: { "file:///test%2Ejournal": ACTION.edit.changes["file:///test.journal"] } },
      },
    ]);

    await insertInferredAmount(() => mockClient);

    expect(applyEditMock).toHaveBeenCalled();
  });

  it("does nothing when the server offers no action", async () => {
    mockClient.sendRequest.mockResolvedValue([]);

    await insertInferredAmount(() => mockClient);

    expect(applyEditMock).not.toHaveBeenCalled();
  });

  it("does nothing when the request times out", async () => {
    mockClient.sendRequest.mockImplementation(() => new Promise(() => {}));

    await insertInferredAmount(() => mockClient, 10);

    expect(applyEditMock).not.toHaveBeenCalled();
  });

  it("does nothing when the request fails", async () => {
    mockClient.sendRequest.mockRejectedValue(new Error("server gone"));

    await insertInferredAmount(() => mockClient);

    expect(applyEditMock).not.toHaveBeenCalled();
  });

  it("does nothing without an LSP client", async () => {
    await insertInferredAmount(() => null);

    expect(applyEditMock).not.toHaveBeenCalled();
  });

  it("does nothing in a non-hledger document", async () => {
    (vscode.window as any).activeTextEditor = {
      document: {
        uri: { toString: () => "file:///notes.md" },
        languageId: "markdown",
      },
      selection: { active: new vscode.Position(0, 0) },
    };
    mockClient.sendRequest.mockResolvedValue([ACTION]);

    await insertInferredAmount(() => mockClient);

    expect(mockClient.sendRequest).not.toHaveBeenCalled();
    expect(applyEditMock).not.toHaveBeenCalled();
  });

  it("moves the cursor past the inserted amount", async () => {
    mockClient.sendRequest.mockResolvedValue([ACTION]);

    await insertInferredAmount(() => mockClient);

    const editor = vscode.window.activeTextEditor as unknown as {
      selection: vscode.Selection;
    };
    expect(editor.selection.active.line).toBe(2);
    expect(editor.selection.active.character).toBe(17 + "   20.50 USD".length);
  });
});
