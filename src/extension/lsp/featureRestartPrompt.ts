import * as vscode from "vscode";

const RESTART_ACTION = "Restart Server";

/**
 * The Language Server decides which capabilities to register during the
 * initialize handshake, so a `hledger.features.*` toggle only takes effect
 * after a restart. Everything else under `hledger.*` is re-read by the server
 * on configuration change and needs no prompt.
 */
export function registerFeatureRestartPrompt(): vscode.Disposable {
  return vscode.workspace.onDidChangeConfiguration(async (event) => {
    if (!event.affectsConfiguration("hledger.features")) {
      return;
    }

    const action = await vscode.window.showInformationMessage(
      "HLedger feature settings changed. Restart the Language Server to apply them.",
      RESTART_ACTION,
    );
    if (action === RESTART_ACTION) {
      await vscode.commands.executeCommand("hledger.lsp.restart");
    }
  });
}
