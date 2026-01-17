import * as vscode from "vscode";
import * as fs from "fs";
import { BinaryManager } from "./BinaryManager";
import { HLedgerLanguageClient, LanguageClientState } from "./HLedgerLanguageClient";

export enum LSPStatus {
  NotInstalled = "not_installed",
  Downloading = "downloading",
  Starting = "starting",
  Running = "running",
  Stopped = "stopped",
  Error = "error",
}

interface LSPManagerContext {
  globalStorageUri: { fsPath: string };
  subscriptions: vscode.Disposable[];
}

export class LSPManager implements vscode.Disposable {
  private readonly storagePath: string;
  private readonly binaryManager: BinaryManager;
  private client: HLedgerLanguageClient | null = null;
  private status: LSPStatus = LSPStatus.NotInstalled;
  private statusBarItem: vscode.StatusBarItem | null = null;

  constructor(context: LSPManagerContext) {
    this.storagePath = context.globalStorageUri.fsPath;
    this.binaryManager = new BinaryManager(this.storagePath);
    this.initializeStatus();
  }

  private async initializeStatus(): Promise<void> {
    if (await this.binaryManager.isInstalled()) {
      this.status = LSPStatus.Stopped;
    } else {
      this.status = LSPStatus.NotInstalled;
    }
  }

  getStatus(): LSPStatus {
    return this.status;
  }

  getStoragePath(): string {
    return this.storagePath;
  }

  async isServerAvailable(): Promise<boolean> {
    return this.binaryManager.isInstalled();
  }

  async getVersion(): Promise<string | null> {
    return this.binaryManager.getInstalledVersion();
  }

  private static readonly SHELL_METACHAR_PATTERN = /[;&|`$()[\]{}^"<>]/;

  getBinaryPath(): string {
    const customPath = vscode.workspace.getConfiguration("hledger.lsp").get<string>("path");
    if (customPath && customPath.trim() !== "") {
      if (LSPManager.SHELL_METACHAR_PATTERN.test(customPath)) {
        throw new Error(`Custom LSP path contains shell metacharacters: ${customPath}`);
      }
      return customPath;
    }
    return this.binaryManager.getBinaryPath();
  }

  private hasCustomPath(): boolean {
    const customPath = vscode.workspace.getConfiguration("hledger.lsp").get<string>("path");
    return customPath !== undefined && customPath.trim() !== "";
  }

  async download(
    progress?: vscode.Progress<{ message?: string; increment?: number }>
  ): Promise<void> {
    this.status = LSPStatus.Downloading;

    try {
      progress?.report({ message: "Fetching latest release..." });
      await this.binaryManager.download((percent) => {
        progress?.report({ message: `Downloading... ${percent}%`, increment: percent });
      });
      this.status = LSPStatus.Stopped;
    } catch (error) {
      this.status = LSPStatus.Error;
      throw error;
    }
  }

  async checkForUpdates(): Promise<{ hasUpdate: boolean; currentVersion: string | null; latestVersion: string }> {
    const currentVersion = await this.getVersion();
    const latestRelease = await this.binaryManager.getLatestRelease();

    return {
      hasUpdate: currentVersion !== latestRelease.version,
      currentVersion,
      latestVersion: latestRelease.version,
    };
  }

  async start(): Promise<void> {
    if (this.client !== null && this.client.getState() === LanguageClientState.Running) {
      return;
    }

    const binaryPath = this.getBinaryPath();

    if (this.hasCustomPath()) {
      if (!fs.existsSync(binaryPath)) {
        throw new Error(`Custom LSP binary not found at: ${binaryPath}`);
      }
    } else if (!await this.isServerAvailable()) {
      throw new Error("Language server is not installed. Run 'HLedger: Download Language Server' first.");
    }

    this.status = LSPStatus.Starting;

    try {
      const debug = vscode.workspace.getConfiguration("hledger.lsp").get<boolean>("debug") ?? false;
      this.client = new HLedgerLanguageClient(this.getBinaryPath(), { debug });
      await this.client.start();
      this.status = LSPStatus.Running;
    } catch (error) {
      this.status = LSPStatus.Error;
      this.client = null;
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this.client === null) {
      return;
    }

    await this.client.stop();
    this.client = null;
    this.status = LSPStatus.Stopped;
  }

  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  getClient(): HLedgerLanguageClient | null {
    return this.client;
  }

  getLanguageClient(): { sendRequest<R>(method: string, params?: unknown): Promise<R> } | null {
    return this.client?.getClient() ?? null;
  }

  dispose(): void {
    if (this.client !== null) {
      this.client.dispose();
      this.client = null;
    }
    if (this.statusBarItem !== null) {
      this.statusBarItem.dispose();
      this.statusBarItem = null;
    }
    this.status = LSPStatus.Stopped;
  }
}
