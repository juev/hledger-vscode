import * as vscode from "vscode";

export async function enterAndSuggest(): Promise<void> {
  try {
    await vscode.commands.executeCommand("type", { text: "\n" });
  } catch {
    // type command may fail in readonly editors — proceed to trigger anyway
  }
  await vscode.commands.executeCommand(
    "editor.action.inlineSuggest.trigger",
  );
}
