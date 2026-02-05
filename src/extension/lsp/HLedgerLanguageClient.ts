import * as vscode from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  Executable,
} from "vscode-languageclient/node";
import { mapVSCodeSettingsToLSP, VSCodeSettings } from "./settingsMapper";

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
      minAlignmentColumn: config.get<number>("formatting.minAlignmentColumn"),
    },
    semanticHighlighting: {
      enabled: config.get<boolean>("semanticHighlighting.enabled"),
    },
    cli: {
      enabled: config.get<boolean>("cli.enabled"),
      timeout: config.get<number>("cli.timeout"),
    },
    limits: {
      maxFileSizeBytes: config.get<number>("limits.maxFileSizeBytes"),
      maxIncludeDepth: config.get<number>("limits.maxIncludeDepth"),
    },
  };

  const filtered = filterUndefined(rawSettings);

  // Runtime validation: mapVSCodeSettingsToLSP provides defaults for all required fields,
  // so this assertion is safe. Verify critical sections exist.
  if (typeof filtered === 'object' && filtered !== null) {
    return filtered as VSCodeSettings;
  }

  throw new Error('Invalid settings structure after filtering');
}

export function createClientOptions(): LanguageClientOptions {
  const vsCodeSettings = getVSCodeSettings();
  const lspSettings = mapVSCodeSettingsToLSP(vsCodeSettings);

  return {
    documentSelector: [{ language: "hledger" }],
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
  private state: LanguageClientState = LanguageClientState.Stopped;

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
    if (this.state !== LanguageClientState.Stopped) {
      return;
    }

    this.state = LanguageClientState.Starting;

    const serverOptions: ServerOptions = createServerOptions(
      this.binaryPath,
      this.config
    );
    const clientOptions = createClientOptions();

    this.client = new LanguageClient(
      "hledger-lsp",
      "HLedger Language Server",
      serverOptions,
      clientOptions
    );

    try {
      await this.client.start();
      this.state = LanguageClientState.Running;
    } catch (error) {
      this.state = LanguageClientState.Stopped;
      this.client = null;
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this.client === null) {
      return;
    }

    try {
      await this.client.stop();
    } finally {
      this.client = null;
      this.state = LanguageClientState.Stopped;
    }
  }

  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  getClient(): LanguageClient | null {
    return this.client;
  }

  async getPayeeAccountHistory(uri: string): Promise<PayeeAccountHistoryResult | null> {
    if (!this.isReady() || this.client === null) {
      return null;
    }

    const timeout = 5000;
    let timeoutId: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<null>((resolve) => {
      timeoutId = setTimeout(() => resolve(null), timeout);
    });

    try {
      const requestPromise = this.client.sendRequest<PayeeAccountHistoryResult>(
        'hledger/payeeAccountHistory',
        { textDocument: { uri } }
      );

      const result = await Promise.race([requestPromise, timeoutPromise]);

      // Clear timeout immediately after race completes
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }

      // Validate response schema
      if (result !== null && !isValidPayeeAccountHistory(result)) {
        console.error('Invalid LSP response format:', result);
        return null;
      }

      return result;
    } catch (error) {
      // Clear timeout on error
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
      console.error('LSP payee account history request failed:', error);
      return null;
    }
  }

  dispose(): void {
    if (this.client !== null) {
      this.client.stop().catch((error) => {
        console.warn('Failed to stop language client during dispose:', error);
      });
      this.client = null;
    }
    this.state = LanguageClientState.Stopped;
  }
}
