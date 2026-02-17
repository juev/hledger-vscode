import * as vscode from "vscode";
import {
  commands as mockCommands,
  createMockExtensionContext,
} from "../../__mocks__/vscode";

jest.mock("../lsp/LSPStatusBar", () => ({
  LSPStatusBar: jest.fn().mockImplementation(() => ({
    update: jest.fn(),
    dispose: jest.fn(),
  })),
}));

jest.mock("../lsp", () => ({
  LSPManager: jest.fn().mockImplementation(() => ({
    dispose: jest.fn(),
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
    isServerAvailable: jest.fn().mockResolvedValue(false),
    getLanguageClient: jest.fn().mockReturnValue(null),
    getStatus: jest.fn().mockReturnValue("stopped"),
    onStatusChange: jest.fn().mockReturnValue({ dispose: jest.fn() }),
  })),
  StartupChecker: jest.fn().mockImplementation(() => ({
    checkOnActivation: jest.fn().mockResolvedValue({ action: "none" }),
  })),
}));

jest.mock("../services/HLedgerCliService", () => ({
  HLedgerCliService: jest.fn().mockImplementation(() => ({
    dispose: jest.fn(),
  })),
}));

jest.mock("../HLedgerCliCommands", () => ({
  HLedgerCliCommands: jest.fn().mockImplementation(() => ({
    dispose: jest.fn(),
    insertBalance: jest.fn(),
    insertStats: jest.fn(),
    insertIncomestatement: jest.fn(),
  })),
}));

jest.mock("../HLedgerImportCommands", () => ({
  HLedgerImportCommands: jest.fn().mockImplementation(() => ({
    dispose: jest.fn(),
    importFromSelection: jest.fn(),
    importFromFile: jest.fn(),
  })),
}));

jest.mock("../inline/InlineCompletionProvider", () => ({
  InlineCompletionProvider: jest.fn().mockImplementation(() => ({
    dispose: jest.fn(),
    provideInlineCompletionItems: jest.fn(),
  })),
}));

import { activate } from "../main";

function getRegisteredCommandNames(): string[] {
  const fromRegisterCommand = (
    mockCommands.registerCommand as jest.Mock
  ).mock.calls.map((call: unknown[]) => call[0] as string);
  const fromRegisterTextEditorCommand = (
    mockCommands.registerTextEditorCommand as jest.Mock
  ).mock.calls.map((call: unknown[]) => call[0] as string);
  return [...fromRegisterCommand, ...fromRegisterTextEditorCommand];
}

describe("activate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should not register removed hledger.onEnter command", () => {
    const context =
      createMockExtensionContext() as unknown as vscode.ExtensionContext;
    activate(context);

    expect(getRegisteredCommandNames()).not.toContain("hledger.onEnter");
  });

  it("should not register removed hledger.onTab command", () => {
    const context =
      createMockExtensionContext() as unknown as vscode.ExtensionContext;
    activate(context);

    expect(getRegisteredCommandNames()).not.toContain("hledger.onTab");
  });

  it("should register hledger.positionCursorAfterTemplate command", () => {
    const context =
      createMockExtensionContext() as unknown as vscode.ExtensionContext;
    activate(context);

    const editorCommands = (
      mockCommands.registerTextEditorCommand as jest.Mock
    ).mock.calls.map((call: unknown[]) => call[0] as string);

    expect(editorCommands).toContain("hledger.positionCursorAfterTemplate");
  });

  it("should register hledger.getStarted command", () => {
    const context =
      createMockExtensionContext() as unknown as vscode.ExtensionContext;
    activate(context);

    expect(getRegisteredCommandNames()).toContain("hledger.getStarted");
  });

  it("should open walkthrough when hledger.getStarted is executed", () => {
    const context =
      createMockExtensionContext() as unknown as vscode.ExtensionContext;
    activate(context);

    const registerCalls = (mockCommands.registerCommand as jest.Mock).mock
      .calls;
    const getStartedCall = registerCalls.find(
      (call: unknown[]) => call[0] === "hledger.getStarted",
    );
    expect(getStartedCall).toBeDefined();

    const handler = getStartedCall![1] as () => void;
    handler();

    expect(mockCommands.executeCommand).toHaveBeenCalledWith(
      "workbench.action.openWalkthrough",
      "evsyukov.hledger#hledger.getStarted",
    );
  });
});
