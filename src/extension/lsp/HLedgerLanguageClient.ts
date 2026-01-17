import * as vscode from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  Executable,
  State,
} from "vscode-languageclient/node";

export enum LanguageClientState {
  Stopped = "stopped",
  Starting = "starting",
  Running = "running",
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

export function createClientOptions(): LanguageClientOptions {
  return {
    documentSelector: [{ language: "hledger" }],
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

  dispose(): void {
    if (this.client !== null) {
      this.client.stop().catch(() => {});
      this.client = null;
    }
    this.state = LanguageClientState.Stopped;
  }
}
