import * as vscode from "vscode";
import type { LanguageClient, Middleware } from "vscode-languageclient/node";
import type { CompletionList as ProtocolCompletionList, Range as ProtocolRange } from "vscode-languageserver-protocol";
import { ProtocolRequestType } from "vscode-languageserver-protocol";

export const SHOW_ALL_ACCOUNTS = "hledger.completion.showAllAccounts";
const ACCEPT_ACCOUNT = "hledger.completion.acceptAccount";
const TRIGGER_SUGGESTIONS = "hledger.completion.trigger";
const HIDE_SUGGESTIONS = "hledger.completion.hide";
const ACCOUNT_CONTEXT = "hledger.completion.accountContext";

interface ScopedCompletionResult {
  completionList: ProtocolCompletionList;
  accountRange?: ProtocolRange;
}

const SCOPED_COMPLETION_METHOD = "hledger/completion";
const SCOPED_COMPLETION = new ProtocolRequestType<unknown, ScopedCompletionResult, never, void, void>(SCOPED_COMPLETION_METHOD);

interface AccountInput {
  document: vscode.TextDocument;
  range: vscode.Range;
  scope: "nonzero" | "all";
}

interface PreparedCompletion {
  document: vscode.TextDocument;
  version: number;
  position: vscode.Position;
  result: ScopedCompletionResult;
}

function supportsAccountScope(client: LanguageClient): boolean {
  const experimental: unknown = client.initializeResult?.capabilities.experimental;
  if (typeof experimental !== "object" || experimental === null) {
    return false;
  }
  const capability: unknown = (experimental as Record<string, unknown>)["hledgerCompletion"];
  return typeof capability === "object" && capability !== null &&
    (capability as Record<string, unknown>)["accountScope"] === true;
}

/** Keeps scope while editing an account and resets it on explicit open/dismiss actions. */
export class AccountCompletionController implements vscode.Disposable {
  private readonly subscriptions: vscode.Disposable[] = [];
  private readonly statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 98);
  private input: AccountInput | undefined;
  private prepared: PreparedCompletion | undefined;
  private pendingExpansion: vscode.CancellationTokenSource | undefined;
  private requestSequence = 0;
  private disposed = false;

  constructor(private readonly getClient: () => LanguageClient | null) {
    this.statusBar.name = "HLedger Account Suggestions";
    this.statusBar.command = SHOW_ALL_ACCOUNTS;
    this.subscriptions.push(
      this.statusBar,
      vscode.workspace.onDidChangeTextDocument(event => this.onDocumentChange(event)),
      vscode.window.onDidChangeActiveTextEditor(() => this.reset()),
      vscode.window.onDidChangeTextEditorSelection(event => {
        if (this.input?.document === event.textEditor.document &&
          (event.selections.length !== 1 || !event.selections[0]?.isEmpty ||
            !this.input.range.contains(event.selections[0].active))) {
          this.reset();
        }
      }),
      vscode.commands.registerCommand(TRIGGER_SUGGESTIONS, async () => {
        this.reset();
        await vscode.commands.executeCommand("editor.action.triggerSuggest");
      }),
      vscode.commands.registerCommand(HIDE_SUGGESTIONS, async () => {
        this.reset();
        await vscode.commands.executeCommand("hideSuggestWidget");
      }),
      vscode.commands.registerCommand(ACCEPT_ACCOUNT, async (original?: vscode.Command) => {
        this.reset();
        if (original) {
          await vscode.commands.executeCommand(original.command, ...(original.arguments ?? []));
        }
      }),
    );
  }

  readonly middleware: Middleware = {
    provideCompletionItem: async (document, position, context, token, next) => {
      const client = this.getClient();
      if (!client || document.languageId !== "hledger" || !supportsAccountScope(client)) {
        return next(document, position, context, token);
      }
      // Programmatic completion away from the cursor must not change this input.
      const editor = vscode.window.activeTextEditor;
      const active = editor?.document === document && editor.selections.length === 1 &&
        editor.selection.isEmpty && editor.selection.active.isEqual(position);
      const scope = active && this.input?.document === document && this.input.range.contains(position)
        ? this.input.scope : "nonzero";
      // The suggest widget and other completion consumers can request the same
      // input concurrently. Only leaving the input or changing scope invalidates
      // their results; typing is handled by VS Code's incomplete-list retrigger.
      const sequence = active ? this.requestSequence : undefined;
      const version = document.version;
      try {
        const prepared = active ? this.prepared : undefined;
        if (active) {
          this.prepared = undefined;
        }
        const result = prepared?.document === document && prepared.version === version && prepared.position.isEqual(position)
          ? prepared.result
          : await this.request(client, document, position, context, scope, token);
        if (token.isCancellationRequested || this.disposed ||
          (active && (sequence !== this.requestSequence || vscode.window.activeTextEditor?.document !== document))) {
          return null;
        }
        // Keep the response for VS Code to retrigger after typing, but never
        // replace the current account range with coordinates from an older edit.
        if (active && document.version === version) {
          this.setInput(document, result.accountRange, scope);
        }
        const converted = await client.protocol2CodeConverter.asCompletionResult(
          result.completionList, client.initializeResult?.capabilities.completionProvider?.allCommitCharacters, token,
        );
        if (token.isCancellationRequested || this.disposed ||
          (active && sequence !== this.requestSequence)) {
          return null;
        }
        if (active && result.accountRange && converted) {
          for (const item of converted.items) {
            item.command = { command: ACCEPT_ACCOUNT, title: "Finish account completion", arguments: [item.command] };
          }
        }
        return converted;
      } catch (error) {
        // Some servers return a plain error for cancellation instead of an LSP
        // cancellation code. Obsolete requests must not surface that as a failure.
        if (token.isCancellationRequested || document.version !== version || this.disposed ||
          (active && sequence !== this.requestSequence)) {
          return null;
        }
        return client.handleFailedRequest(SCOPED_COMPLETION, token, error, null);
      }
    },
  };

  async showAll(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (editor?.document.languageId !== "hledger" || !editor.selection.isEmpty || editor.selections.length !== 1) {
      return;
    }
    const client = this.getClient();
    if (!client || !supportsAccountScope(client)) {
      await vscode.window.showInformationMessage("Showing all account suggestions requires an updated HLedger Language Server. Run 'HLedger: Install/Update Language Server'.");
      return;
    }
    this.pendingExpansion?.cancel();
    const source = new vscode.CancellationTokenSource();
    this.pendingExpansion = source;
    const sequence = ++this.requestSequence;
    const document = editor.document;
    const version = document.version;
    const position = editor.selection.active;
    try {
      const result = await this.request(client, document, position, { triggerKind: vscode.CompletionTriggerKind.Invoke, triggerCharacter: undefined }, "all", source.token);
      if (source.token.isCancellationRequested || this.disposed || sequence !== this.requestSequence ||
        document.version !== version || vscode.window.activeTextEditor !== editor || !editor.selection.active.isEqual(position)) {
        return;
      }
      if (!result.accountRange) {
        await vscode.window.showInformationMessage("Place the cursor in an account name to show all account suggestions.");
        return;
      }
      this.setInput(document, result.accountRange, "all");
      this.prepared = { document, version, position, result };
      await vscode.commands.executeCommand("hideSuggestWidget");
      if (sequence !== this.requestSequence || this.disposed) {
        return;
      }
      await vscode.commands.executeCommand("editor.action.triggerSuggest");
    } catch (error) {
      if (!source.token.isCancellationRequested) {
        console.warn("HLedger account completion expansion failed:", error);
        await vscode.window.showWarningMessage("Could not load all account suggestions. Check the HLedger Language Server output.");
      }
    } finally {
      if (this.pendingExpansion === source) {
        this.pendingExpansion = undefined;
      }
      source.dispose();
    }
  }

  private request(client: LanguageClient, document: vscode.TextDocument, position: vscode.Position,
    context: vscode.CompletionContext, accountScope: "nonzero" | "all", token: vscode.CancellationToken): Promise<ScopedCompletionResult> {
    return client.sendRequest<ScopedCompletionResult>(SCOPED_COMPLETION_METHOD, {
      ...client.code2ProtocolConverter.asCompletionParams(document, position, context), accountScope,
    }, token);
  }

  private setInput(document: vscode.TextDocument, range: ProtocolRange | undefined, scope: "nonzero" | "all"): void {
    this.input = range ? { document, range: new vscode.Range(range.start.line, range.start.character, range.end.line, range.end.character), scope } : undefined;
    this.updateContext();
  }

  private onDocumentChange(event: vscode.TextDocumentChangeEvent): void {
    if (event.contentChanges.length === 0) {
      return;
    }
    if (event.document === vscode.window.activeTextEditor?.document) {
      this.pendingExpansion?.cancel();
      this.prepared = undefined;
    }
    const input = this.input;
    if (input?.document !== event.document) {
      return;
    }
    const change = event.contentChanges[0];
    if (event.contentChanges.length !== 1 || !change || !input.range.contains(change.range) || /[\r\n\t]/.test(change.text)) {
      this.reset();
      return;
    }
    const end = input.range.end.character + change.text.length - (change.range.end.character - change.range.start.character);
    const range = new vscode.Range(input.range.start, new vscode.Position(input.range.end.line, end));
    // Two spaces (or a tab above) end the account and start the amount.
    if (/ {2,}/.test(event.document.getText(range))) {
      this.reset();
      return;
    }
    input.range = range;
  }

  private updateContext(): void {
    void vscode.commands.executeCommand("setContext", ACCOUNT_CONTEXT, !!this.input).then(undefined, (error: unknown) => {
      console.warn("HLedger account completion context update failed:", error);
    });
    if (this.input) {
      this.statusBar.text = this.input.scope === "all" ? "Accounts: all" : "Accounts: nonzero";
      this.statusBar.tooltip = this.input.scope === "all"
        ? "All matching accounts, including zero balances. Escape closes suggestions and resets to nonzero accounts."
        : "Show all account suggestions, including zero balances and unused declared accounts.";
      this.statusBar.show();
    } else {
      this.statusBar.hide();
    }
  }

  private reset(): void {
    ++this.requestSequence;
    this.pendingExpansion?.cancel();
    this.prepared = undefined;
    this.input = undefined;
    this.updateContext();
  }

  dispose(): void {
    this.disposed = true;
    this.reset();
    for (const subscription of this.subscriptions) {
      subscription.dispose();
    }
  }
}
