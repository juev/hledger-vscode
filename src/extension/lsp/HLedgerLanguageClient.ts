import * as vscode from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  Executable,
  State,
} from "vscode-languageclient/node";
import { mapVSCodeSettingsToLSP, VSCodeSettings } from "./settingsMapper";
import { AccountCompletionController } from "../completion/AccountCompletionController";

export enum LanguageClientState {
  Stopped = "stopped",
  Starting = "starting",
  Running = "running",
}

export interface PayeeAccountHistoryResult {
  payeeAccounts: Record<string, string[]>;
  pairUsage: Record<string, number>;
}

function isValidPayeeAccountHistory(data: unknown): data is PayeeAccountHistoryResult {
  if (typeof data !== "object" || data === null) {
    return false;
  }
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.payeeAccounts === "object" &&
    obj.payeeAccounts !== null &&
    !Array.isArray(obj.payeeAccounts) &&
    typeof obj.pairUsage === "object" &&
    obj.pairUsage !== null &&
    !Array.isArray(obj.pairUsage)
  );
}

export interface ServerOptionsConfig {
  debug?: boolean;
}

export function createServerOptions(
  binaryPath: string,
  config?: ServerOptionsConfig
): Executable {
  const args: string[] = [];
  if (config?.debug) {
    args.push("--debug");
  }

  return {
    command: binaryPath,
    args,
  };
}

/**
 * Recursively removes undefined values from an object.
 * IMPORTANT: This function assumes the input is a tree structure (no circular references).
 * VS Code settings are always tree-structured, so this is safe for our use case.
 */
function filterUndefined<T extends object>(obj: T): Partial<T> {
  const result: Partial<T> = {};
  for (const key of Object.keys(obj) as Array<keyof T>) {
    const value = obj[key];
    if (value !== undefined) {
      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        const filtered = filterUndefined(value as object);
        if (Object.keys(filtered).length > 0) {
          result[key] = filtered as T[keyof T];
        }
      } else {
        result[key] = value;
      }
    }
  }
  return result;
}

function getVSCodeSettings(): VSCodeSettings {
  const config = vscode.workspace.getConfiguration("hledger");

  const rawSettings = {
    features: {
      hover: config.get<boolean>("features.hover"),
      completion: config.get<boolean>("features.completion"),
      formatting: config.get<boolean>("features.formatting"),
      diagnostics: config.get<boolean>("features.diagnostics"),
      semanticTokens: config.get<boolean>("features.semanticTokens"),
      codeActions: config.get<boolean>("features.codeActions"),
      foldingRanges: config.get<boolean>("features.foldingRanges"),
      documentLinks: config.get<boolean>("features.documentLinks"),
      workspaceSymbol: config.get<boolean>("features.workspaceSymbol"),
      inlineCompletion: config.get<boolean>("features.inlineCompletion"),
      codeLens: config.get<boolean>("features.codeLens"),
      inlayHints: config.get<boolean>("features.inlayHints"),
    },
    inlayHints: {
      inferredAmounts: config.get<boolean>("inlayHints.inferredAmounts"),
      runningBalances: config.get<boolean>("inlayHints.runningBalances"),
      costExpansion: config.get<boolean>("inlayHints.costExpansion"),
    },
    autoCompletion: {
      enabled: config.get<boolean>("autoCompletion.enabled"),
      maxResults: config.get<number>("autoCompletion.maxResults"),
      maxAccountResults: config.get<number>("autoCompletion.maxAccountResults"),
      transactionTemplates: {
        enabled: config.get<boolean>("autoCompletion.transactionTemplates.enabled"),
      },
    },
    completion: {
      snippets: config.get<boolean>("completion.snippets"),
      fuzzyMatching: config.get<boolean>("completion.fuzzyMatching"),
      showCounts: config.get<boolean>("completion.showCounts"),
      maxResults: config.get<number>("completion.maxResults"),
      includeNotes: config.get<boolean>("completion.includeNotes"),
    },
    diagnostics: {
      enabled: config.get<boolean>("diagnostics.enabled"),
      checkBalance: config.get<boolean>("diagnostics.checkBalance"),
      balanceTolerance: config.get<number>("diagnostics.balanceTolerance"),
      undeclaredAccounts: config.get<boolean>("diagnostics.undeclaredAccounts"),
      undeclaredCommodities: config.get<boolean>("diagnostics.undeclaredCommodities"),
      unbalancedTransactions: config.get<boolean>("diagnostics.unbalancedTransactions"),
    },
    formatting: {
      amountAlignmentColumn: config.get<number>("formatting.amountAlignmentColumn"),
      indentSize: config.get<number>("formatting.indentSize"),
      alignAmounts: config.get<boolean>("formatting.alignAmounts"),
      amountAlignmentMode: config.get<string>("formatting.amountAlignmentMode"),
      minAlignmentColumn: config.get<number>("formatting.minAlignmentColumn"),
      amountAlignmentTarget: config.get<"cost" | "posting">("formatting.amountAlignmentTarget"),
    },
    cli: {
      enabled: config.get<boolean>("cli.enabled"),
      path: config.get<string>("cli.path"),
      timeout: config.get<number>("cli.timeout"),
    },
    limits: {
      maxFileSizeBytes: config.get<number>("limits.maxFileSizeBytes"),
      maxIncludeDepth: config.get<number>("limits.maxIncludeDepth"),
    },
  };

  const filtered = filterUndefined(rawSettings);

  // Runtime validation: Ensure result is a plain object (not Array)
  if (typeof filtered === 'object' && filtered !== null && !Array.isArray(filtered)) {
    return filtered as VSCodeSettings;
  }

  throw new Error('Invalid settings structure after filtering');
}

export function createClientOptions(): LanguageClientOptions {
  const vsCodeSettings = getVSCodeSettings();
  const lspSettings = mapVSCodeSettingsToLSP(vsCodeSettings);

  return {
    documentSelector: [
      { scheme: "file", language: "hledger" },
      { scheme: "file", language: "hledger-rules" },
    ],
    initializationOptions: lspSettings,
    synchronize: {
      configurationSection: "hledger",
    },
  };
}

export class HLedgerLanguageClient implements vscode.Disposable {
  private readonly binaryPath: string;
  private readonly config: ServerOptionsConfig;
  private client: LanguageClient | null = null;
  private accountCompletion: AccountCompletionController | null = null;
  private state: LanguageClientState = LanguageClientState.Stopped;
  private stateSubscription: vscode.Disposable | null = null;
  /**
   * The in-flight `client.start()`. `stop()` waits for it so the shutdown is
   * not attempted while the library is still in its Starting state, where it
   * refuses to stop and would leave the server process running.
   */
  private pendingStart: Promise<void> | null = null;

  constructor(binaryPath: string, config?: ServerOptionsConfig) {
    this.binaryPath = binaryPath;
    this.config = config ?? {};
  }

  getState(): LanguageClientState {
    return this.state;
  }

  isReady(): boolean {
    return this.state === LanguageClientState.Running && this.client !== null;
  }

  getServerPath(): string {
    return this.binaryPath;
  }

  async start(): Promise<void> {
    if (this.state === LanguageClientState.Running || this.pendingStart !== null) {
      return this.pendingStart ?? undefined;
    }

    const clientOptions = createClientOptions();
    this.accountCompletion = new AccountCompletionController(() => this.client);
    clientOptions.middleware = this.accountCompletion.middleware;

    const serverOptions: ServerOptions = createServerOptions(
      this.binaryPath,
      this.config
    );
    this.client = new LanguageClient(
      "hledger-lsp",
      "HLedger Language Server",
      serverOptions,
      clientOptions
    );
    this.state = LanguageClientState.Starting;

    const startedClient = this.client;
    // The library gives up on a server that keeps crashing and reports Stopped
    // on its own. Without this subscription the extension kept claiming the
    // server was running and never restarted it.
    this.stateSubscription = startedClient.onDidChangeState((event: { newState: State }) => {
      if (event.newState === State.Stopped && this.state === LanguageClientState.Running) {
        this.state = LanguageClientState.Stopped;
        this.disposeAccountCompletion();
        if (this.client === startedClient) {
          this.client = null;
        }
        this.disposeStateSubscription();
      }
    });

    const startPromise = startedClient
      .start()
      .then(() => {
        this.state = LanguageClientState.Running;
      })
      .catch((error: unknown) => {
        this.disposeAccountCompletion();
        this.disposeStateSubscription();
        this.client = null;
        this.state = LanguageClientState.Stopped;
        throw error;
      })
      .finally(() => {
        if (this.pendingStart === startPromise) {
          this.pendingStart = null;
        }
      });

    this.pendingStart = startPromise;
    return startPromise;
  }

  async stop(): Promise<void> {
    try {
      // A start that is still running must finish first: the library cannot be
      // stopped from its Starting state.
      await this.pendingStart;
    } catch {
      // The start failed on its own; it has already cleaned up.
    }

    this.disposeAccountCompletion();

    this.disposeStateSubscription();

    const client = this.client;
    if (client === null) {
      this.state = LanguageClientState.Stopped;
      return;
    }

    try {
      await client.stop();
    } catch (error) {
      // A failed shutdown must not leave the instance unusable: the reference
      // is dropped and the state reset, so the next start can retry.
      this.client = null;
      this.state = LanguageClientState.Stopped;
      throw error;
    }

    this.client = null;
    this.state = LanguageClientState.Stopped;
  }

  private disposeStateSubscription(): void {
    this.stateSubscription?.dispose();
    this.stateSubscription = null;
  }

  private disposeAccountCompletion(): void {
    this.accountCompletion?.dispose();
    this.accountCompletion = null;
  }

  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  getClient(): LanguageClient | null {
    return this.client;
  }

  async showAllAccountSuggestions(): Promise<void> {
    await this.accountCompletion?.showAll();
  }

  async getPayeeAccountHistory(uri: string): Promise<PayeeAccountHistoryResult | null> {
    if (!this.isReady() || this.client === null) {
      return null;
    }

    const timeout = 5000;
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<null>((resolve) => {
      timeoutId = setTimeout(() => {
        resolve(null);
        cancellationTokenSource.cancel();
      }, timeout);
    });

    try {
      const requestPromise = this.client.sendRequest<PayeeAccountHistoryResult>(
        'hledger/payeeAccountHistory',
        { textDocument: { uri } },
        cancellationTokenSource.token
      );

      const result = await Promise.race([requestPromise, timeoutPromise]);

      // Validate response schema
      if (result !== null && !isValidPayeeAccountHistory(result)) {
        console.error('Invalid LSP response format:', result);
        return null;
      }

      return result;
    } catch (error) {
      console.error('LSP payee account history request failed:', error);
      return null;
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
      cancellationTokenSource.dispose();
    }
  }

  /**
   * Disposes the language client.
   * Note: VS Code's Disposable interface requires synchronous dispose().
   * The underlying LanguageClient.stop() is async, so cleanup may not complete
   * before this method returns. In practice, this is acceptable because:
   * 1. The OS will clean up the process when VS Code exits
   * 2. The client reference is nulled to prevent further use
   */
  dispose(): void {
    this.disposeStateSubscription();
    this.accountCompletion?.dispose();
    this.accountCompletion = null;
    if (this.client !== null) {
      const clientToStop = this.client;
      this.client = null;
      this.state = LanguageClientState.Stopped;
      clientToStop.stop().catch((error) => {
        console.warn('Failed to stop language client during dispose:', error);
      });
    } else {
      this.state = LanguageClientState.Stopped;
    }
  }
}
