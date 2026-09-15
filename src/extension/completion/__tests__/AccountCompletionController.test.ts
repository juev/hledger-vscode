import * as vscode from "vscode";
import type { LanguageClient } from "vscode-languageclient/node";
import { AccountCompletionController } from "../AccountCompletionController";

describe("AccountCompletionController", () => {
  let controller: AccountCompletionController;
  let text: string;
  let version: number;
  let document: vscode.TextDocument;
  let editor: vscode.TextEditor;
  let changeDocument: (event: vscode.TextDocumentChangeEvent) => void;
  let changeSelection: (event: vscode.TextEditorSelectionChangeEvent) => void;
  let changeEditor: (editor: vscode.TextEditor | undefined) => void;
  let accept: (original?: vscode.Command) => Promise<void>;
  let trigger: () => Promise<void>;
  let hide: () => Promise<void>;
  let sendRequest: ReturnType<typeof vi.fn>;
  let client: LanguageClient;
  const context = { triggerKind: vscode.CompletionTriggerKind.Invoke, triggerCharacter: undefined };
  const token = new vscode.CancellationTokenSource().token;
  const next = vi.fn().mockResolvedValue(new vscode.CompletionList([]));

  function response(labels = ["assets:active"], account = true) {
    return {
      completionList: { isIncomplete: true, items: labels.map(label => ({ label })) },
      ...(account ? { accountRange: { start: { line: 1, character: 4 }, end: { line: 1, character: text.length } } } : {}),
    };
  }

  function position(character = text.length): void {
    editor.selection = new vscode.Selection(1, character, 1, character);
    editor.selections = [editor.selection];
  }

  function provide(cancellation = token, target = document) {
    return controller.middleware.provideCompletionItem!(target, editor.selection.active, context, cancellation, next);
  }

  function edit(start: number, end: number, replacement: string): void {
    text = text.slice(0, start) + replacement + text.slice(end);
    version++;
    changeDocument({ document, reason: undefined, contentChanges: [{ range: new vscode.Range(1, start, 1, end), rangeOffset: start, rangeLength: end - start, text: replacement }] });
    position(start + replacement.length);
    changeSelection({ textEditor: editor, selections: editor.selections, kind: undefined });
  }

  function lastScope(): unknown {
    return sendRequest.mock.calls[sendRequest.mock.calls.length - 1]?.[1].accountScope;
  }

  beforeEach(() => {
    text = "    assets:";
    version = 1;
    document = {
      languageId: "hledger", uri: vscode.Uri.file("/test.journal"),
      get version() { return version; },
      getText: (range?: vscode.Range) => range ? text.slice(range.start.character, range.end.character) : text,
    } as vscode.TextDocument;
    editor = { document } as vscode.TextEditor;
    position();
    Object.defineProperty(vscode.window, "activeTextEditor", { value: editor, writable: true, configurable: true });
    vi.mocked(vscode.workspace.onDidChangeTextDocument).mockImplementation(listener => {
      changeDocument = listener;
      return { dispose: vi.fn() };
    });
    vi.mocked(vscode.window.onDidChangeTextEditorSelection).mockImplementation(listener => {
      changeSelection = listener;
      return { dispose: vi.fn() };
    });
    vi.mocked(vscode.window.onDidChangeActiveTextEditor).mockImplementation(listener => {
      changeEditor = listener;
      return { dispose: vi.fn() };
    });
    vi.mocked(vscode.commands.registerCommand).mockImplementation((name, callback) => {
      if (name === "hledger.completion.acceptAccount") { accept = callback; }
      if (name === "hledger.completion.trigger") { trigger = callback; }
      if (name === "hledger.completion.hide") { hide = callback; }
      return { dispose: vi.fn() };
    });
    vi.mocked(vscode.commands.executeCommand).mockResolvedValue(undefined);
    sendRequest = vi.fn().mockImplementation(async () => response());
    client = {
      initializeResult: { capabilities: { experimental: { hledgerCompletion: { accountScope: true } } } },
      sendRequest,
      code2ProtocolConverter: { asCompletionParams: (doc: vscode.TextDocument, pos: vscode.Position) => ({ textDocument: { uri: doc.uri.toString() }, position: pos }) },
      protocol2CodeConverter: { asCompletionResult: async (list: ReturnType<typeof response>["completionList"]) => new vscode.CompletionList(list.items.map(item => new vscode.CompletionItem(item.label)), list.isIncomplete) },
      handleFailedRequest: vi.fn().mockReturnValue(null),
    } as unknown as LanguageClient;
    controller = new AccountCompletionController(() => client);
  });

  afterEach(() => { controller.dispose(); });

  it("starts with nonzero accounts and exposes an expansion action even for an empty list", async () => {
    sendRequest.mockResolvedValue(response([]));
    const result = await provide();
    expect(result).toMatchObject({ items: [], isIncomplete: true });
    expect(lastScope()).toBe("nonzero");
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith("setContext", "hledger.completion.accountContext", true);
    const results = vi.mocked(vscode.window.createStatusBarItem).mock.results;
    const bar = results[results.length - 1]?.value;
    expect(bar.text).toBe("Accounts: nonzero");
    expect(bar.command).toBe("hledger.completion.showAllAccounts");
    expect(bar.show).toHaveBeenCalled();
  });

  it("fetches all accounts once and reopens suggestions using that response", async () => {
    await provide();
    sendRequest.mockResolvedValue(response(["assets:active", "assets:zero", "assets:unused"]));
    await controller.showAll();
    expect(lastScope()).toBe("all");
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith("hideSuggestWidget");
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith("editor.action.triggerSuggest");
    const result = await provide();
    expect(result).toMatchObject({ items: [{ label: "assets:active" }, { label: "assets:zero" }, { label: "assets:unused" }] });
    expect(sendRequest).toHaveBeenCalledTimes(2);
    expect(text).toBe("    assets:");
    // Recomputing an open list keeps its scope.
    await provide();
    expect(lastScope()).toBe("all");
  });

  it("starts a fresh short/full cycle after Escape closes suggestions", async () => {
    for (let cycle = 0; cycle < 2; cycle++) {
      await provide();
      expect(lastScope()).toBe("nonzero");
      await controller.showAll();
      await provide();
      expect(lastScope()).toBe("all");
      await hide();
      expect(vscode.commands.executeCommand).toHaveBeenLastCalledWith("hideSuggestWidget");
    }
    await provide();
    expect(lastScope()).toBe("nonzero");
    expect(text).toBe("    assets:");
  });

  it("starts with nonzero accounts when manually reopening a closed list", async () => {
    await controller.showAll();
    // The closed-widget binding must discard even a prepared full response.
    await trigger();
    expect(vscode.commands.executeCommand).toHaveBeenLastCalledWith("editor.action.triggerSuggest");
    await provide();
    expect(lastScope()).toBe("nonzero");
    expect(text).toBe("    assets:");
  });

  it("does not reopen suggestions when Escape cancels a pending expansion", async () => {
    await provide();
    let resolve!: (value: ReturnType<typeof response>) => void;
    sendRequest.mockReturnValueOnce(new Promise(done => { resolve = done; }));
    const pending = controller.showAll();
    const requestToken = sendRequest.mock.calls[sendRequest.mock.calls.length - 1]?.[2] as vscode.CancellationToken;
    await hide();
    expect(requestToken.isCancellationRequested).toBe(true);
    resolve(response(["assets:active", "assets:unused"]));
    await pending;
    expect(vscode.commands.executeCommand).not.toHaveBeenCalledWith("editor.action.triggerSuggest");
    await provide();
    expect(lastScope()).toBe("nonzero");
  });

  it("keeps all accounts while typing colons, Unicode, single spaces and Backspace", async () => {
    await controller.showAll();
    await provide();
    for (const addition of ["🪙", ":", "現金", " ", "bank"]) {
      edit(text.length, text.length, addition);
      await provide();
      expect(lastScope()).toBe("all");
    }
    edit(text.length - 1, text.length, "");
    await provide();
    expect(lastScope()).toBe("all");
  });

  it.each(["  ", "\t", "\n"])("resets after the account separator %j", async separator => {
    await controller.showAll();
    await provide();
    edit(text.length, text.length, separator);
    await provide();
    expect(lastScope()).toBe("nonzero");
  });

  it("resets on an edit outside the account", async () => {
    await controller.showAll();
    edit(0, 0, " ");
    await provide();
    expect(lastScope()).toBe("nonzero");
  });

  it("resets when the cursor leaves the account", async () => {
    await controller.showAll();
    position(1);
    changeSelection({ textEditor: editor, selections: editor.selections, kind: undefined });
    position();
    await provide();
    expect(lastScope()).toBe("nonzero");
  });

  it("resets on an editor change even when returning to the original account", async () => {
    await controller.showAll();
    changeEditor(undefined);
    changeEditor(editor);
    await provide();
    expect(lastScope()).toBe("nonzero");
  });

  it("resets after accepting an item and preserves the server's command", async () => {
    const original = { title: "Original", command: "server.afterCompletion", arguments: [42] };
    const item = new vscode.CompletionItem("assets:active");
    item.command = original;
    vi.spyOn(client.protocol2CodeConverter, "asCompletionResult").mockResolvedValue(new vscode.CompletionList([item]));
    await controller.showAll();
    const result = await provide() as vscode.CompletionList;
    expect(result.items[0]?.command).toMatchObject({ command: "hledger.completion.acceptAccount", arguments: [original] });
    await accept(original);
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith("server.afterCompletion", 42);
    await provide();
    expect(lastScope()).toBe("nonzero");
  });

  it("does not carry full scope to completion requested for another document", async () => {
    await controller.showAll();
    await provide(token, { ...document, uri: vscode.Uri.file("/other.journal") });
    expect(lastScope()).toBe("nonzero");
    await provide();
    await provide();
    expect(lastScope()).toBe("all");
  });

  it("keeps full scope when another consumer requests completion elsewhere in the active document", async () => {
    await controller.showAll();
    sendRequest.mockResolvedValueOnce(response(["Payee"], false));
    const result = await controller.middleware.provideCompletionItem!(document, new vscode.Position(0, 0), context, token, next);
    expect(result).toMatchObject({ items: [{ label: "Payee" }] });
    expect(lastScope()).toBe("nonzero");
    await provide();
    await provide();
    expect(lastScope()).toBe("all");
  });

  it.each([undefined, {}, { hledgerCompletion: { accountScope: false } }])("falls back to standard completion for unsupported capability %j", async experimental => {
    Object.assign(client.initializeResult!.capabilities, { experimental });
    await provide();
    expect(next).toHaveBeenCalled();
    expect(sendRequest).not.toHaveBeenCalled();
    await controller.showAll();
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(expect.stringContaining("updated HLedger Language Server"));
  });

  it("passes rules completion to the existing provider", async () => {
    await provide(token, { ...document, languageId: "hledger-rules" });
    expect(next).toHaveBeenCalled();
    expect(sendRequest).not.toHaveBeenCalled();
  });

  it("leaves payee results alone and does not expand them", async () => {
    sendRequest.mockResolvedValue(response(["Payee"], false));
    const result = await provide() as vscode.CompletionList;
    expect(result.items[0]?.command).toBeUndefined();
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith("setContext", "hledger.completion.accountContext", false);
    await controller.showAll();
    expect(vscode.commands.executeCommand).not.toHaveBeenCalledWith("hideSuggestWidget");
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(expect.stringContaining("account name"));
  });

  it("discards a cancelled provider response", async () => {
    const source = new vscode.CancellationTokenSource();
    const pending = provide(source.token);
    source.cancel();
    expect(await pending).toBeNull();
    expect(vscode.commands.executeCommand).not.toHaveBeenCalledWith("setContext", "hledger.completion.accountContext", true);
    source.dispose();
  });

  it.each(["initial", "incomplete"])("keeps an %s response when typing advances before the server replies", async phase => {
    if (phase === "incomplete") {
      await controller.showAll();
      await provide();
    }
    const previous = response();
    let resolve!: (value: ReturnType<typeof response>) => void;
    sendRequest.mockReturnValueOnce(new Promise(done => { resolve = done; }));
    const pending = provide();
    edit(text.length, text.length, "a");
    resolve(previous);

    // VS Code needs the incomplete list to request results for the new prefix.
    // Returning null here makes it keep only the built-in word suggestions.
    expect(await pending).toMatchObject({ items: [{ label: "assets:active" }], isIncomplete: true });
    await provide();
    expect(lastScope()).toBe(phase === "incomplete" ? "all" : "nonzero");
    expect(vscode.commands.executeCommand).toHaveBeenLastCalledWith("setContext", "hledger.completion.accountContext", true);
  });

  it("keeps an incomplete list when typing advances during conversion", async () => {
    let resolve!: (value: vscode.CompletionList) => void;
    vi.spyOn(client.protocol2CodeConverter, "asCompletionResult").mockImplementationOnce(() => {
      edit(text.length, text.length, "a");
      return new Promise(done => { resolve = done; });
    });
    const pending = provide();
    await vi.waitFor(() => { expect(resolve).toBeDefined(); });
    resolve(new vscode.CompletionList([new vscode.CompletionItem("assets:active")], true));
    expect(await pending).toMatchObject({ items: [{ label: "assets:active" }], isIncomplete: true });
  });

  it.each(["cancelled", "edited"])("does not report a server cancellation after the request is %s", async reason => {
    const source = new vscode.CancellationTokenSource();
    let reject!: (error: Error) => void;
    sendRequest.mockReturnValueOnce(new Promise((_, fail) => { reject = fail; }));
    const pending = provide(source.token);
    if (reason === "cancelled") {
      source.cancel();
    } else {
      edit(text.length, text.length, "a");
    }
    reject(Object.assign(new Error("context canceled"), { code: 0 }));
    expect(await pending).toBeNull();
    expect(client.handleFailedRequest).not.toHaveBeenCalled();
    source.dispose();
  });

  it("returns suggestions to concurrent consumers at the same document position", async () => {
    let resolve!: (value: ReturnType<typeof response>) => void;
    sendRequest.mockReturnValueOnce(new Promise(done => { resolve = done; }));
    const suggestions = provide();
    const otherConsumer = await provide();
    resolve(response());
    expect(otherConsumer).toMatchObject({ items: [{ label: "assets:active" }] });
    expect(await suggestions).toMatchObject({ items: [{ label: "assets:active" }] });
  });

  it("keeps suggestions and the expansion shortcut when a concurrent request is cancelled", async () => {
    const source = new vscode.CancellationTokenSource();
    const suggestions = provide();
    const otherConsumer = provide(source.token);
    source.cancel();
    expect(await otherConsumer).toBeNull();
    expect(await suggestions).toMatchObject({ items: [{ label: "assets:active" }] });
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith("setContext", "hledger.completion.accountContext", true);
    source.dispose();
  });

  it("discards an expansion if the document changes while it is pending", async () => {
    let resolve!: (value: ReturnType<typeof response>) => void;
    sendRequest.mockReturnValue(new Promise(done => { resolve = done; }));
    const pending = controller.showAll();
    const requestToken = sendRequest.mock.calls[0]?.[2] as vscode.CancellationToken;
    edit(text.length, text.length, "a");
    expect(requestToken.isCancellationRequested).toBe(true);
    resolve(response());
    await pending;
    expect(vscode.commands.executeCommand).not.toHaveBeenCalledWith("hideSuggestWidget");
  });

  it("discards an older result when a newer request completes first", async () => {
    let resolve!: (value: ReturnType<typeof response>) => void;
    sendRequest.mockReturnValueOnce(new Promise(done => { resolve = done; }));
    const older = provide();
    await controller.showAll();
    resolve(response());
    expect(await older).toBeNull();
    await provide();
    await provide();
    expect(lastScope()).toBe("all");
  });

  it("reports expansion failure without replacing current suggestions", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    sendRequest.mockRejectedValue(new Error("offline"));
    await controller.showAll();
    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(expect.stringContaining("Could not load"));
    expect(vscode.commands.executeCommand).not.toHaveBeenCalledWith("hideSuggestWidget");
    expect(await provide()).toBeNull();
    expect(client.handleFailedRequest).toHaveBeenCalledWith(
      expect.objectContaining({ method: "hledger/completion" }), token, expect.any(Error), null,
    );
  });

  it("discards pending work after disposal", async () => {
    const pending = provide();
    controller.dispose();
    expect(await pending).toBeNull();
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith("setContext", "hledger.completion.accountContext", false);
  });
});
