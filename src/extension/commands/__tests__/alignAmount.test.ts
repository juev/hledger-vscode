import * as vscode from "vscode";
import { alignAmount } from "../alignAmount";

interface MockLSPClient {
  sendRequest: jest.Mock;
}

describe("alignAmount", () => {
  let mockClient: MockLSPClient;
  let applyEditMock: jest.Mock;
  let executeCommandMock: jest.Mock;

  beforeEach(() => {
    mockClient = { sendRequest: jest.fn() };

    applyEditMock = jest.fn().mockResolvedValue(true);
    (vscode.workspace as any).applyEdit = applyEditMock;

    executeCommandMock = vscode.commands.executeCommand as jest.Mock;
    executeCommandMock.mockClear();

    (vscode.window as any).activeTextEditor = {
      document: {
        uri: { toString: () => "file:///test.journal" },
        languageId: "hledger",
      },
      selection: {
        active: new vscode.Position(1, 15),
      },
    };

    (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
      get: jest.fn((key: string, defaultValue?: unknown) => {
        if (key === "tabSize") return 4;
        if (key === "insertSpaces") return true;
        return defaultValue;
      }),
    });
  });

  it("applies edits when LSP returns formatting edits", async () => {
    const edits = [
      {
        range: {
          start: { line: 1, character: 15 },
          end: { line: 1, character: 15 },
        },
        newText: "                         ",
      },
    ];
    mockClient.sendRequest.mockResolvedValue(edits);

    await alignAmount(() => mockClient);

    expect(mockClient.sendRequest).toHaveBeenCalledWith(
      "textDocument/onTypeFormatting",
      expect.objectContaining({
        textDocument: { uri: "file:///test.journal" },
        position: { line: 1, character: 15 },
        ch: "\t",
        options: { tabSize: 4, insertSpaces: true },
      }),
    );
    expect(applyEditMock).toHaveBeenCalled();
    expect(executeCommandMock).not.toHaveBeenCalledWith("tab");
  });

  it("falls back to tab when LSP returns empty array", async () => {
    mockClient.sendRequest.mockResolvedValue([]);

    await alignAmount(() => mockClient);

    expect(applyEditMock).not.toHaveBeenCalled();
    expect(executeCommandMock).toHaveBeenCalledWith("tab");
  });

  it("falls back to tab when LSP returns null", async () => {
    mockClient.sendRequest.mockResolvedValue(null);

    await alignAmount(() => mockClient);

    expect(applyEditMock).not.toHaveBeenCalled();
    expect(executeCommandMock).toHaveBeenCalledWith("tab");
  });

  it("falls back to tab when LSP client unavailable", async () => {
    await alignAmount(() => null);

    expect(applyEditMock).not.toHaveBeenCalled();
    expect(executeCommandMock).toHaveBeenCalledWith("tab");
  });

  it("falls back to tab when LSP request throws", async () => {
    mockClient.sendRequest.mockRejectedValue(new Error("LSP error"));

    await alignAmount(() => mockClient);

    expect(applyEditMock).not.toHaveBeenCalled();
    expect(executeCommandMock).toHaveBeenCalledWith("tab");
  });

  it("falls back to tab when no active editor", async () => {
    (vscode.window as any).activeTextEditor = undefined;

    await alignAmount(() => mockClient);

    expect(mockClient.sendRequest).not.toHaveBeenCalled();
    expect(executeCommandMock).toHaveBeenCalledWith("tab");
  });

  it("falls back to tab for non-hledger files", async () => {
    (vscode.window as any).activeTextEditor = {
      document: {
        uri: { toString: () => "file:///test.txt" },
        languageId: "plaintext",
      },
      selection: { active: new vscode.Position(0, 0) },
    };

    await alignAmount(() => mockClient);

    expect(mockClient.sendRequest).not.toHaveBeenCalled();
    expect(executeCommandMock).toHaveBeenCalledWith("tab");
  });

  it("falls back to tab on LSP timeout", async () => {
    mockClient.sendRequest.mockReturnValue(new Promise(() => {}));

    await alignAmount(() => mockClient, 10);

    expect(applyEditMock).not.toHaveBeenCalled();
    expect(executeCommandMock).toHaveBeenCalledWith("tab");
  });
});
