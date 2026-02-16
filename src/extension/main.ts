// main.ts - Entry point for hledger extension (LSP-based)

import * as vscode from "vscode";
import { HLedgerCliCommands } from "./HLedgerCliCommands";
import { HLedgerCliService } from "./services/HLedgerCliService";
import { HLedgerImportCommands } from "./HLedgerImportCommands";
import { LSPManager, StartupChecker } from "./lsp";
import { alignAmount } from "./commands/alignAmount";
import { InlineCompletionProvider } from "./inline/InlineCompletionProvider";
import { Logger } from "./Logger";
import { LSPStatusBar } from "./lsp/LSPStatusBar";
import { formatErrorWithContext } from "./ErrorContext";

export function activate(context: vscode.ExtensionContext): void {
  try {
    const outputChannel = vscode.window.createOutputChannel("HLedger");
    const logger = new Logger(outputChannel);
    context.subscriptions.push(logger);

    // Initialize LSP Manager
    const lspManager = new LSPManager(context);
    context.subscriptions.push(lspManager);

    const statusBar = new LSPStatusBar();
    context.subscriptions.push(statusBar);
    context.subscriptions.push(
      lspManager.onStatusChange((status) => statusBar.update(status))
    );

    const startupChecker = new StartupChecker(lspManager, context);

    // Consolidated LSP initialization (non-blocking)
    void (async (): Promise<void> => {
      // First, check installation/update status
      const checkResult = await startupChecker.checkOnActivation();

      if (checkResult.action === "install" && checkResult.latestVersion) {
        const shouldInstall = await startupChecker.showInstallNotification(checkResult.latestVersion);
        if (shouldInstall) {
          try {
            await startupChecker.performInstall();
            logger.info("HLedger LSP server installed and started successfully");
          } catch (error) {
            logger.error("Failed to install HLedger LSP server", error instanceof Error ? error : undefined);
          }
        }
        return; // Either installed or user declined - done
      }

      if (checkResult.action === "update" && checkResult.currentVersion && checkResult.latestVersion) {
        // Server is installed but update available - start first, then offer update
        try {
          await lspManager.start();
          logger.info("HLedger LSP server started successfully");
        } catch (error) {
          logger.error("Failed to start HLedger LSP server", error instanceof Error ? error : undefined);
          // Don't show install/update prompt on start failure if we already know update is available
        }

        const shouldUpdate = await startupChecker.showUpdateNotification(
          checkResult.currentVersion,
          checkResult.latestVersion
        );
        if (shouldUpdate) {
          try {
            await startupChecker.performUpdate();
            logger.info("HLedger LSP server updated successfully");
          } catch (error) {
            logger.error("Failed to update HLedger LSP server", error instanceof Error ? error : undefined);
          }
        } else {
          startupChecker.markUpdateDeclined();
        }
        return;
      }

      if (checkResult.action === "error") {
        logger.error("Failed to check for LSP updates", checkResult.error instanceof Error ? checkResult.error : undefined);
        // Fall through to try starting server anyway
      }

      // No install/update needed or check failed - try to start if available
      if (await lspManager.isServerAvailable()) {
        try {
          await lspManager.start();
          logger.info("HLedger LSP server started successfully");
        } catch (error) {
          logger.error("Failed to start HLedger LSP server", error instanceof Error ? error : undefined);
          const action = await vscode.window.showErrorMessage(
            formatErrorWithContext(
              'HLedger Language Server failed to start',
              error instanceof Error ? error : undefined
            ),
            'Install/Update LSP',
            'Open Troubleshooting',
            'Report Issue'
          );
          if (action === 'Install/Update LSP') {
            try {
              await vscode.commands.executeCommand('hledger.lsp.update');
            } catch (updateError) {
              vscode.window.showErrorMessage(
                formatErrorWithContext(
                  'Failed to install/update LSP',
                  updateError instanceof Error ? updateError : undefined
                )
              );
            }
          } else if (action === 'Open Troubleshooting') {
            void vscode.env.openExternal(vscode.Uri.parse(
              'https://github.com/juev/hledger-vscode/blob/main/TROUBLESHOOTING.md'
            ));
          } else if (action === 'Report Issue') {
            void vscode.env.openExternal(vscode.Uri.parse(
              'https://github.com/juev/hledger-vscode/issues/new'
            ));
          }
        }
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

    // Create import commands with LSP manager for history
    const importCommands = new HLedgerImportCommands(() => lspManager);
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

    // Register editor commands
    context.subscriptions.push(
      vscode.commands.registerCommand(
        "hledger.editor.alignAmount",
        async () => {
          await alignAmount(() => lspManager.getLanguageClient());
        },
      ),
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
                formatErrorWithContext('Failed to check for updates', error instanceof Error ? error : undefined)
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
            formatErrorWithContext('Failed to restart language server', error instanceof Error ? error : undefined)
          );
        }
      })
    );

  } catch (error) {
    console.error("HLedger extension activation failed:", error); // Logger unavailable during activation failure
    void vscode.window.showErrorMessage(
      formatErrorWithContext('HLedger extension failed to activate', error instanceof Error ? error : undefined)
    );
  }
}

export function deactivate(): void {
  // Cleanup happens automatically through context.subscriptions
}
