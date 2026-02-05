import * as vscode from "vscode";
import type { LSPManagerLike } from "./LSPManager";
import { hasCustomLSPPath, isLSPUpdateCheckEnabled } from "./lspConfig";

export type CheckAction = "install" | "update" | "none" | "error";

export interface CheckResult {
  action: CheckAction;
  currentVersion?: string | null;
  latestVersion?: string;
  error?: Error;
}

export class StartupChecker {
  private static readonly UPDATE_DECLINE_KEY = 'hledger.lsp.updateDeclinedUntil';
  // When user clicks "Later" on update notification, wait 7 days before reminding again
  // This balances keeping users up-to-date with not being overly intrusive
  private static readonly DECLINE_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

  constructor(
    private readonly lspManager: LSPManagerLike,
    private readonly context: vscode.ExtensionContext
  ) {}

  async checkOnActivation(): Promise<CheckResult> {
    if (hasCustomLSPPath()) {
      return { action: "none" };
    }

    if (!isLSPUpdateCheckEnabled()) {
      return { action: "none" };
    }

    if (this.isUpdateDeclined()) {
      return { action: "none" };
    }

    try {
      const isInstalled = await this.lspManager.isServerAvailable();
      const { hasUpdate, currentVersion, latestVersion } =
        await this.lspManager.checkForUpdates();

      if (!isInstalled) {
        return { action: "install", currentVersion, latestVersion };
      }

      if (hasUpdate) {
        return { action: "update", currentVersion, latestVersion };
      }

      return { action: "none" };
    } catch (error) {
      return {
        action: "error",
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  async showInstallNotification(latestVersion: string): Promise<boolean> {
    const answer = await vscode.window.showInformationMessage(
      `HLedger Language Server is not installed (latest: ${latestVersion})`,
      "Install",
      "Later"
    );
    return answer === "Install";
  }

  async showUpdateNotification(
    currentVersion: string,
    latestVersion: string
  ): Promise<boolean> {
    const answer = await vscode.window.showInformationMessage(
      `HLedger Language Server update available: ${currentVersion} → ${latestVersion}`,
      "Update",
      "Later"
    );
    return answer === "Update";
  }

  private isUpdateDeclined(): boolean {
    const declinedUntil = this.context.globalState.get<number>(
      StartupChecker.UPDATE_DECLINE_KEY,
      0
    );
    return Date.now() < declinedUntil;
  }

  markUpdateDeclined(): void {
    const declineUntil = Date.now() + StartupChecker.DECLINE_DURATION_MS;
    void this.context.globalState.update(
      StartupChecker.UPDATE_DECLINE_KEY,
      declineUntil
    );
  }

  async performInstall(): Promise<void> {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Installing HLedger Language Server...",
        cancellable: false,
      },
      async (progress) => {
        await this.lspManager.download(progress);
        await this.lspManager.start();
      }
    );
    vscode.window.showInformationMessage(
      "HLedger Language Server installed successfully"
    );
  }

  async performUpdate(): Promise<void> {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Updating HLedger Language Server...",
        cancellable: false,
      },
      async (progress) => {
        await this.lspManager.stop();
        await this.lspManager.download(progress);
        await this.lspManager.start();
      }
    );
    vscode.window.showInformationMessage(
      "HLedger Language Server updated successfully"
    );
  }
}
