import type { Mock } from "vitest";
import * as vscode from "vscode";
import {
  commands as mockCommands,
  createMockExtensionContext,
} from "../../__mocks__/vscode";

// main.ts instantiates every mock below with `new`, so the implementations must
// be plain functions: an arrow function is not a constructor. Returning an
// object from a constructor call makes `new` yield that object.
vi.mock("../lsp/LSPStatusBar", () => ({
  LSPStatusBar: vi.fn().mockImplementation(function () {
    return {
      update: vi.fn(),
      dispose: vi.fn(),
    };
  }),
}));

vi.mock("../KeybindingHintsStatusBar", () => ({
  KeybindingHintsStatusBar: vi.fn().mockImplementation(function () {
    return {
      dispose: vi.fn(),
    };
  }),
}));

vi.mock("../lsp", () => ({
  LSPManager: vi.fn().mockImplementation(function () {
    return {
      dispose: vi.fn(),
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      isServerAvailable: vi.fn().mockResolvedValue(false),
      getLanguageClient: vi.fn().mockReturnValue(null),
      getStatus: vi.fn().mockReturnValue("stopped"),
      onStatusChange: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    };
  }),
  StartupChecker: vi.fn().mockImplementation(function () {
    return {
      checkOnActivation: vi.fn().mockResolvedValue({ action: "none" }),
    };
  }),
}));

vi.mock("../services/HLedgerCliService", () => ({
  HLedgerCliService: vi.fn().mockImplementation(function () {
    return {
      dispose: vi.fn(),
    };
  }),
}));

vi.mock("../HLedgerCliCommands", () => ({
  HLedgerCliCommands: vi.fn().mockImplementation(function () {
    return {
      dispose: vi.fn(),
      insertBalanceSheet: vi.fn(),
      insertStats: vi.fn(),
      insertIncomestatement: vi.fn(),
    };
  }),
}));

vi.mock("../HLedgerImportCommands", () => ({
  HLedgerImportCommands: vi.fn().mockImplementation(function () {
    return {
      dispose: vi.fn(),
      importFromSelection: vi.fn(),
      importFromFile: vi.fn(),
    };
  }),
}));

vi.mock("../inline/InlineCompletionProvider", () => ({
  InlineCompletionProvider: vi.fn().mockImplementation(function () {
    return {
      dispose: vi.fn(),
      provideInlineCompletionItems: vi.fn(),
    };
  }),
}));

import { activate } from "../main";

function getRegisteredCommandNames(): string[] {
  const fromRegisterCommand = (
    mockCommands.registerCommand as Mock
  ).mock.calls.map((call: unknown[]) => call[0] as string);
  const fromRegisterTextEditorCommand = (
    mockCommands.registerTextEditorCommand as Mock
  ).mock.calls.map((call: unknown[]) => call[0] as string);
  return [...fromRegisterCommand, ...fromRegisterTextEditorCommand];
}

describe("activate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      mockCommands.registerTextEditorCommand as Mock
    ).mock.calls.map((call: unknown[]) => call[0] as string);

    expect(editorCommands).toContain("hledger.positionCursorAfterTemplate");
  });

  it("should register hledger.getStarted command", () => {
    const context =
      createMockExtensionContext() as unknown as vscode.ExtensionContext;
    activate(context);

    expect(getRegisteredCommandNames()).toContain("hledger.getStarted");
  });

  it("should register status toggle commands", () => {
    const context =
      createMockExtensionContext() as unknown as vscode.ExtensionContext;
    activate(context);

    const registeredCommands = getRegisteredCommandNames();
    expect(registeredCommands).toContain("hledger.editor.cycleStatus");
    expect(registeredCommands).toContain("hledger.editor.setStatusUnmarked");
    expect(registeredCommands).toContain("hledger.editor.setStatusPending");
    expect(registeredCommands).toContain("hledger.editor.setStatusCleared");
  });

  it("should open walkthrough when hledger.getStarted is executed", () => {
    const context =
      createMockExtensionContext() as unknown as vscode.ExtensionContext;
    activate(context);

    const registerCalls = (mockCommands.registerCommand as Mock).mock
      .calls;
    const getStartedCall = registerCalls.find(
      (call: unknown[]) => call[0] === "hledger.getStarted",
    );
    if (!getStartedCall) {
      throw new Error("hledger.getStarted command not registered");
    }

    const handler = getStartedCall[1] as () => void;
    handler();

    expect(mockCommands.executeCommand).toHaveBeenCalledWith(
      "workbench.action.openWalkthrough",
      "evsyukov.hledger#hledger.getStarted",
    );
  });
});
