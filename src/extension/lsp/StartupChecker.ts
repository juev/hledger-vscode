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
  private updateDeclinedThisSession = false;

  constructor(private readonly lspManager: LSPManagerLike) {}

  async checkOnActivation(): Promise<CheckResult> {
    if (hasCustomLSPPath()) {
      return { action: "none" };
    }

    if (!isLSPUpdateCheckEnabled()) {
      return { action: "none" };
    }

    if (this.updateDeclinedThisSession) {
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

  markUpdateDeclinedThisSession(): void {
    this.updateDeclinedThisSession = true;
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
