import * as vscode from "vscode";
import * as fs from "fs";
import { BinaryManager } from "./BinaryManager";
import { HLedgerLanguageClient, LanguageClientState, PayeeAccountHistoryResult } from "./HLedgerLanguageClient";
import { hasCustomLSPPath, getCustomLSPPath } from "./lspConfig";
import { validatePathSafety } from "../security/shellValidation";

export interface LSPManagerLike {
  isServerAvailable(): Promise<boolean>;
  checkForUpdates(): Promise<{
    hasUpdate: boolean;
    currentVersion: string | null;
    latestVersion: string;
  }>;
  download(
    progress?: vscode.Progress<{ message?: string; increment?: number }>
  ): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
}

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

export type StatusChangeListener = (status: LSPStatus) => void;

export class LSPManager implements vscode.Disposable {
  private readonly storagePath: string;
  private readonly binaryManager: BinaryManager;
  private client: HLedgerLanguageClient | null = null;
  private status: LSPStatus = LSPStatus.NotInstalled;
  private statusListener: StatusChangeListener | null = null;

  constructor(context: LSPManagerContext) {
    this.storagePath = context.globalStorageUri.fsPath;
    this.binaryManager = new BinaryManager(this.storagePath);
    // Async initialization: status starts as NotInstalled and updates asynchronously.
    // This avoids blocking constructor. Status is queried lazily via isInstalled().
    this.initializeStatus().catch(() => {
      // Status remains NotInstalled on failure — safe fallback
    });
  }

  private async initializeStatus(): Promise<void> {
    if (await this.binaryManager.isInstalled()) {
      this.setStatus(LSPStatus.Stopped);
    } else {
      this.setStatus(LSPStatus.NotInstalled);
    }
  }

  getStatus(): LSPStatus {
    return this.status;
  }

  onStatusChange(listener: StatusChangeListener): vscode.Disposable {
    this.statusListener = listener;
    return new vscode.Disposable(() => {
      if (this.statusListener === listener) {
        this.statusListener = null;
      }
    });
  }

  private setStatus(status: LSPStatus): void {
    this.status = status;
    this.statusListener?.(status);
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

  getBinaryPath(): string {
    const customPath = getCustomLSPPath();
    if (customPath !== null) {
      validatePathSafety(customPath);
      return customPath;
    }
    return this.binaryManager.getBinaryPath();
  }

  async download(
    progress?: vscode.Progress<{ message?: string; increment?: number }>
  ): Promise<void> {
    this.setStatus(LSPStatus.Downloading);

    try {
      progress?.report({ message: "Fetching latest release..." });
      let previousPercent = 0;
      await this.binaryManager.download((percent) => {
        const delta = percent - previousPercent;
        progress?.report({ message: `Downloading... ${percent}%`, increment: delta });
        previousPercent = percent;
      });
      this.setStatus(LSPStatus.Stopped);
    } catch (error) {
      this.setStatus(LSPStatus.Error);
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

    if (hasCustomLSPPath()) {
      try {
        await fs.promises.access(binaryPath, fs.constants.X_OK);
      } catch {
        throw new Error(`Custom LSP binary not found at: ${binaryPath}`);
      }
    } else if (!await this.isServerAvailable()) {
      throw new Error("Language server is not installed. Run 'HLedger: Install/Update Language Server' first.");
    }

    this.setStatus(LSPStatus.Starting);

    try {
      const debug = vscode.workspace.getConfiguration("hledger.lsp").get<boolean>("debug") ?? false;
      this.client = new HLedgerLanguageClient(binaryPath, { debug });
      await this.client.start();
      this.setStatus(LSPStatus.Running);
    } catch (error) {
      this.setStatus(LSPStatus.Error);
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
    this.setStatus(LSPStatus.Stopped);
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

  async getPayeeAccountHistory(uri: string): Promise<PayeeAccountHistoryResult | null> {
    return this.client?.getPayeeAccountHistory(uri) ?? null;
  }

  dispose(): void {
    if (this.client !== null) {
      this.client.dispose();
      this.client = null;
    }
    this.setStatus(LSPStatus.Stopped);
  }
}
