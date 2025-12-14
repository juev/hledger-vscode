// HLedgerCliCommands.ts - CLI command handlers for hledger

import * as vscode from "vscode";
import * as fs from "fs";
import { HLedgerCliService } from "./services/HLedgerCliService";

export class HLedgerCliCommands implements vscode.Disposable {
  private cliService: HLedgerCliService;

  constructor(cliService: HLedgerCliService) {
    this.cliService = cliService;
  }

  /**
   * Cleanup method to prevent memory leaks.
   * Note: This class doesn't hold disposable resources directly,
   * but implements Disposable for consistency with the lifecycle pattern.
   */
  dispose(): void {
    // No resources to dispose - cliService is disposed separately
  }

  public async insertBalance(): Promise<void> {
    await this.insertCliReport("balance");
  }

  public async insertStats(): Promise<void> {
    await this.insertCliReport("stats");
  }

  public async insertIncomestatement(): Promise<void> {
    await this.insertCliReport("incomestatement");
  }

  private async insertCliReport(command: string): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage("No active editor found.");
      return;
    }

    const document = editor.document;
    if (document.languageId !== "hledger") {
      vscode.window.showErrorMessage(
        "This command is only available in hledger files.",
      );
      return;
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Running hledger ${command}...`,
        cancellable: false,
      },
      async () => {
        try {
          const cliAvailable = await this.ensureCliAvailable();
          if (!cliAvailable) {
            return;
          }

          // Get the journal file path
          const journalFile = this.getJournalFilePath(document);

          // Execute the command
          let output: string;
          let cliCommandName: string;
          switch (command) {
            case "balance":
              output = await this.cliService.runBalance(journalFile);
              cliCommandName = "bs";
              break;
            case "stats":
              output = await this.cliService.runStats(journalFile);
              cliCommandName = "stats";
              break;
            case "incomestatement":
              output = await this.cliService.runIncomestatement(journalFile);
              cliCommandName = "incomestatement";
              break;
            default:
              throw new Error(`Unknown command: ${command}`);
          }

          // Format as comment and insert
          const comment = this.cliService.formatAsComment(
            output,
            cliCommandName,
          );
          await this.insertCommentAtCursor(editor, comment);

          vscode.window.showInformationMessage(
            `hledger ${cliCommandName} report inserted successfully.`,
          );
        } catch (error: unknown) {
          vscode.window.showErrorMessage(
            `Failed to run hledger ${command}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      },
    );
  }

  private async ensureCliAvailable(): Promise<boolean> {
    let isAvailable = await this.cliService.isHledgerAvailable();
    if (isAvailable) {
      return true;
    }

    const installMessage =
      "hledger CLI not found. Would you like to install it?";

    while (!isAvailable) {
      const installChoice = await vscode.window.showInformationMessage(
        installMessage,
        "Open Installation Guide",
        "Configure Path",
      );

      if (installChoice === "Open Installation Guide") {
        void vscode.env.openExternal(
          vscode.Uri.parse("https://hledger.org/install.html"),
        );
        return false;
      }

      if (installChoice === "Configure Path") {
        const config = vscode.workspace.getConfiguration("hledger");
        const customPath = await vscode.window.showInputBox({
          prompt: "Enter the path to hledger executable",
          placeHolder: "/usr/local/bin/hledger",
        });

        const trimmedPath = customPath?.trim();
        if (!trimmedPath) {
          return false;
        }

        await config.update(
          "cli.path",
          trimmedPath,
          vscode.ConfigurationTarget.Global,
        );

        isAvailable = await this.cliService.isHledgerAvailable();
        if (isAvailable) {
          return true;
        }

        vscode.window.showErrorMessage(
          "Configured hledger path could not be verified. Please check the path and try again.",
        );
        continue;
      }

      return false;
    }

    return true;
  }

  /**
   * Sanitizes journal file path for shell safety.
   *
   * Prevents command injection through malicious paths containing
   * shell metacharacters in environment variables or configuration settings.
   *
   * @param filePath - Journal file path from untrusted source
   * @returns Sanitized path if valid
   * @throws Error if path contains shell metacharacters or is inaccessible
   */
  private sanitizeJournalPath(filePath: string): string {
    // Dangerous shell metacharacters (excluding backslash for Windows path compatibility)
    const dangerousChars = /[;|&`$()[\]{}^"<>]/;

    if (dangerousChars.test(filePath)) {
      throw new Error(`Path contains shell metacharacters: ${filePath}`);
    }

    try {
      fs.accessSync(filePath, fs.constants.R_OK);
    } catch {
      throw new Error(`Path does not exist or is not accessible: ${filePath}`);
    }

    return filePath;
  }

  /**
   * Resolves journal file path with security validation.
   *
   * Priority order:
   * 1. LEDGER_FILE environment variable (validated)
   * 2. hledger.cli.journalFile setting (validated)
   * 3. Current file (trusted - from VS Code)
   *
   * @param document - Current text document
   * @returns Journal file path
   */
  private getJournalFilePath(document: vscode.TextDocument): string {
    // First, try to get from environment variable LEDGER_FILE
    const ledgerFileFromEnv = process.env.LEDGER_FILE;
    if (ledgerFileFromEnv?.trim()) {
      return this.sanitizeJournalPath(ledgerFileFromEnv.trim());
    }

    // Second, try to get from extension configuration
    const config = vscode.workspace.getConfiguration("hledger");
    const journalFileFromConfig = config.get<string>("cli.journalFile", "");
    if (journalFileFromConfig?.trim()) {
      return this.sanitizeJournalPath(journalFileFromConfig.trim());
    }

    // Current file is trusted (from VS Code URI), skip validation
    return document.uri.fsPath;
  }

  private async insertCommentAtCursor(
    editor: vscode.TextEditor,
    comment: string,
  ): Promise<void> {
    const position = editor.selection.active;
    await editor.edit((editBuilder) => {
      editBuilder.insert(position, comment);
    });
  }
}
