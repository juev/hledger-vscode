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

  return filterUndefined(rawSettings) as VSCodeSettings;
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
    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), timeout);
    });

    try {
      const requestPromise = this.client.sendRequest<PayeeAccountHistoryResult>(
        'hledger/payeeAccountHistory',
        { textDocument: { uri } }
      );

      return await Promise.race([requestPromise, timeoutPromise]);
    } catch (error) {
      console.error('LSP payee account history request failed:', error);
      return null;
    }
  }

  dispose(): void {
    if (this.client !== null) {
      this.client.stop().catch(() => {});
      this.client = null;
    }
    this.state = LanguageClientState.Stopped;
  }
}
