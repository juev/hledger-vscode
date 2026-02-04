// main.ts - Entry point for hledger extension (LSP-based)

import * as vscode from "vscode";
import { HLedgerEnterCommand } from "./HLedgerEnterCommand";
import { HLedgerTabCommand } from "./HLedgerTabCommand";
import { HLedgerCliCommands } from "./HLedgerCliCommands";
import { HLedgerCliService } from "./services/HLedgerCliService";
import { HLedgerImportCommands } from "./HLedgerImportCommands";
import { LSPManager, StartupChecker } from "./lsp";
import { InlineCompletionProvider } from "./inline/InlineCompletionProvider";

export function activate(context: vscode.ExtensionContext): void {
  try {
    // Initialize LSP Manager
    const lspManager = new LSPManager(context);
    context.subscriptions.push(lspManager);

    const startupChecker = new StartupChecker(lspManager);

    // Start LSP immediately if available (non-blocking)
    void (async (): Promise<void> => {
      if (await lspManager.isServerAvailable()) {
        try {
          await lspManager.start();
          console.log("HLedger LSP server started successfully");
        } catch (error) {
          console.error("Failed to start HLedger LSP server:", error);
          vscode.window.showWarningMessage(
            `HLedger Language Server failed to start: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    })();

    // Check for updates in background (non-blocking)
    void (async (): Promise<void> => {
      const result = await startupChecker.checkOnActivation();

      if (result.action === "install" && result.latestVersion) {
        const shouldInstall = await startupChecker.showInstallNotification(
          result.latestVersion
        );
        if (shouldInstall) {
          try {
            await startupChecker.performInstall();
            console.log("HLedger LSP server installed and started successfully");
          } catch (error) {
            console.error("Failed to install HLedger LSP server:", error);
          }
        }
      } else if (
        result.action === "update" &&
        result.currentVersion &&
        result.latestVersion
      ) {
        const shouldUpdate = await startupChecker.showUpdateNotification(
          result.currentVersion,
          result.latestVersion
        );
        if (shouldUpdate) {
          try {
            await startupChecker.performUpdate();
            console.log("HLedger LSP server updated and started successfully");
          } catch (error) {
            console.error("Failed to update HLedger LSP server:", error);
          }
        } else {
          startupChecker.markUpdateDeclinedThisSession();
        }
      } else if (result.action === "error") {
        console.error("Failed to check for LSP updates:", result.error);
      }
    })();

    // Register command to position cursor after template insertion
    context.subscriptions.push(
      vscode.commands.registerTextEditorCommand(
        "hledger.positionCursorAfterTemplate",
        (editor, _edit, line: number, column: number) => {
          const maxLine = editor.document.lineCount - 1;
          const safeLine = Math.min(Math.max(0, line), maxLine);
          const lineText = editor.document.lineAt(safeLine).text;
          const safeColumn = Math.min(Math.max(0, column), lineText.length);
          const newPosition = new vscode.Position(safeLine, safeColumn);
          editor.selection = new vscode.Selection(newPosition, newPosition);
        },
      ),
    );

    // Register Enter key handler for smart indentation
    const enterCommand = new HLedgerEnterCommand();
    context.subscriptions.push(enterCommand);

    // Register Tab key handler for amount alignment positioning
    const tabCommand = new HLedgerTabCommand();
    context.subscriptions.push(tabCommand);

    // Register inline completion provider (ghost text)
    const inlineProvider = new InlineCompletionProvider(() =>
      lspManager.getLanguageClient(),
    );
    context.subscriptions.push(
      vscode.languages.registerInlineCompletionItemProvider(
        { language: "hledger" },
        inlineProvider,
      ),
    );
    context.subscriptions.push(inlineProvider);

    // Register manual completion commands
    context.subscriptions.push(
      vscode.commands.registerCommand("hledger.triggerDateCompletion", () => {
        vscode.commands.executeCommand("editor.action.triggerSuggest");
      }),
    );

    context.subscriptions.push(
      vscode.commands.registerCommand(
        "hledger.triggerAccountCompletion",
        () => {
          vscode.commands.executeCommand("editor.action.triggerSuggest");
        },
      ),
    );

    // Create CLI service and commands
    const cliService = new HLedgerCliService();
    const cliCommands = new HLedgerCliCommands(cliService);
    context.subscriptions.push(cliService);
    context.subscriptions.push(cliCommands);

    // Register CLI commands
    context.subscriptions.push(
      vscode.commands.registerCommand("hledger.cli.balance", async () => {
        await cliCommands.insertBalance();
      }),
    );

    context.subscriptions.push(
      vscode.commands.registerCommand("hledger.cli.stats", async () => {
        await cliCommands.insertStats();
      }),
    );

    context.subscriptions.push(
      vscode.commands.registerCommand(
        "hledger.cli.incomestatement",
        async () => {
          await cliCommands.insertIncomestatement();
        },
      ),
    );

    // Create import commands (without HLedgerConfig dependency)
    const importCommands = new HLedgerImportCommands();
    context.subscriptions.push(importCommands);

    // Register import commands
    context.subscriptions.push(
      vscode.commands.registerCommand(
        "hledger.import.fromSelection",
        async () => {
          await importCommands.importFromSelection();
        },
      ),
    );

    context.subscriptions.push(
      vscode.commands.registerCommand("hledger.import.fromFile", async () => {
        await importCommands.importFromFile();
      }),
    );

    // Register LSP commands
    context.subscriptions.push(
      vscode.commands.registerCommand("hledger.lsp.update", async () => {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: "Checking for updates...",
            cancellable: false,
          },
          async (progress) => {
            try {
              const { hasUpdate, currentVersion, latestVersion } =
                await lspManager.checkForUpdates();

              if (hasUpdate) {
                const answer = await vscode.window.showInformationMessage(
                  `Update available: ${currentVersion ?? "not installed"} → ${latestVersion}`,
                  "Update",
                  "Cancel"
                );

                if (answer === "Update") {
                  await lspManager.stop();
                  await lspManager.download(progress);
                  await lspManager.start();
                  vscode.window.showInformationMessage(
                    `Updated to ${latestVersion}`
                  );
                }
              } else {
                vscode.window.showInformationMessage(
                  `Already up to date (${latestVersion})`
                );
              }
            } catch (error) {
              vscode.window.showErrorMessage(
                `Failed to check for updates: ${error instanceof Error ? error.message : String(error)}`
              );
            }
          }
        );
      })
    );

    context.subscriptions.push(
      vscode.commands.registerCommand("hledger.lsp.showVersion", async () => {
        const version = await lspManager.getVersion();
        const status = lspManager.getStatus();

        if (version) {
          vscode.window.showInformationMessage(
            `HLedger Language Server: ${version} (${status})`
          );
        } else {
          vscode.window.showInformationMessage(
            "HLedger Language Server: not installed"
          );
        }
      })
    );

    context.subscriptions.push(
      vscode.commands.registerCommand("hledger.lsp.restart", async () => {
        try {
          await lspManager.restart();
          vscode.window.showInformationMessage(
            "HLedger Language Server restarted"
          );
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to restart language server: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      })
    );

  } catch (error) {
    console.error("HLedger extension activation failed:", error);
  }
}

export function deactivate(): void {
  // Cleanup happens automatically through context.subscriptions
}
