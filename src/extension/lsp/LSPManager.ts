import * as vscode from "vscode";
import * as fs from "fs";
import { BinaryManager } from "./BinaryManager";
import { HLedgerLanguageClient, LanguageClientState, PayeeAccountHistoryResult } from "./HLedgerLanguageClient";
import { hasCustomLSPPath, getCustomLSPPath } from "./lspConfig";

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
  update(
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
  /**
   * Serializes start/stop/restart. Each operation waits for the previous one,
   * so a second restart cannot build a second client on top of a start that is
   * still in flight — which used to leave a live server process unreferenced.
   */
  private lifecycle: Promise<void> = Promise.resolve();

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
    const installed = await this.binaryManager.isInstalled();
    // A start or a download may already have reported a newer state; the disk
    // check must not overwrite it.
    if (this.status !== LSPStatus.NotInstalled) {
      return;
    }
    this.setStatus(installed ? LSPStatus.Stopped : LSPStatus.NotInstalled);
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
    if (hasCustomLSPPath()) {
      // The managed binary may not exist at all, so the configured server is
      // the one whose version matters.
      return this.binaryManager.getVersionOfBinary(this.getBinaryPath());
    }
    return this.binaryManager.getInstalledVersion();
  }

  getBinaryPath(): string {
    const customPath = getCustomLSPPath();
    if (customPath !== null) {
      return customPath;
    }
    return this.binaryManager.getBinaryPath();
  }

  async download(
    progress?: vscode.Progress<{ message?: string; increment?: number }>
  ): Promise<void> {
    this.setStatus(LSPStatus.Downloading);

    try {
      await this.downloadBinary(progress);
      this.setStatus(LSPStatus.Stopped);
    } catch (error) {
      this.setStatus(LSPStatus.Error);
      throw error;
    }
  }

  async update(
    progress?: vscode.Progress<{ message?: string; increment?: number }>
  ): Promise<void> {
    const previousStatus = this.status;
    const wasRunning =
      this.client !== null &&
      this.client.getState() === LanguageClientState.Running;
    let stoppedForInstall = false;
    let installCompleted = false;

    this.setStatus(LSPStatus.Downloading);

    try {
      await this.downloadBinary(progress, async () => {
        if (wasRunning) {
          await this.stop();
          stoppedForInstall = true;
        }
      });
      installCompleted = true;
      await this.start();
    } catch (error) {
      if (stoppedForInstall && !installCompleted) {
        try {
          await this.start();
        } catch {
          this.setStatus(LSPStatus.Error);
        }
      } else if (!stoppedForInstall && this.status !== LSPStatus.Error) {
        // A failed start already reported Error; restoring the status from
        // before the update would hide it from the status bar.
        this.setStatus(previousStatus);
      }
      throw error;
    }
  }

  private async downloadBinary(
    progress?: vscode.Progress<{ message?: string; increment?: number }>,
    beforeInstall?: () => Promise<void>,
  ): Promise<void> {
    progress?.report({ message: "Fetching latest release..." });
    let previousPercent = 0;
    await this.binaryManager.download((percent) => {
      const delta = percent - previousPercent;
      progress?.report({
        message: `Downloading... ${percent}%`,
        increment: delta,
      });
      previousPercent = percent;
    }, beforeInstall);
  }

  async checkForUpdates(): Promise<{ hasUpdate: boolean; currentVersion: string | null; latestVersion: string }> {
    const currentVersion = await this.getVersion();
    const latestRelease = await this.binaryManager.getLatestRelease();

    return {
      // An unreadable version is not an update: the caller checks installation
      // separately, and forcing a download here would replace a working custom
      // binary with the managed one.
      hasUpdate: currentVersion !== null && currentVersion !== latestRelease.version,
      currentVersion,
      latestVersion: latestRelease.version,
    };
  }

  /**
   * Queue a lifecycle transition behind the previous one.
   *
   * `run` receives the client it should operate on, or null when there is
   * nothing to stop. Both values are read at the moment the operation actually
   * runs, not when it was requested.
   */
  private queueLifecycle<P>(
    run: () => Promise<P>,
  ): Promise<P> {
    const result = this.lifecycle.then(run, run);
    // Keep the chain itself alive: a rejected step must not poison the next one.
    this.lifecycle = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  async start(): Promise<void> {
    return this.queueLifecycle(async () => {
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

      // Reuse the client when a previous start was interrupted: its own state
      // machine tolerates being stopped while starting, a fresh object does not.
      let client = this.client;
      if (client === null) {
        const debug = vscode.workspace.getConfiguration("hledger.lsp").get<boolean>("debug") ?? false;
        client = new HLedgerLanguageClient(binaryPath, { debug });
        this.client = client;
      }

      try {
        await client.start();
        this.setStatus(LSPStatus.Running);
      } catch (error) {
        this.setStatus(LSPStatus.Error);
        this.client = null;
        throw error;
      }
    });
  }

  async stop(): Promise<void> {
    return this.queueLifecycle(async () => {
      const client = this.client;
      if (client === null) {
        return;
      }

      try {
        await client.stop();
      } finally {
        // Undo the assignment start() made for this client, whoever it is now.
        if (this.client === client) {
          this.client = null;
        }
        this.setStatus(LSPStatus.Stopped);
      }
    });
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
    this.binaryManager.dispose();
    if (this.client !== null) {
      this.client.dispose();
      this.client = null;
    }
    this.setStatus(LSPStatus.Stopped);
  }
}
