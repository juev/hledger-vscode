import * as vscode from "vscode";

export function getCustomLSPPath(): string | null {
  const customPath = vscode.workspace
    .getConfiguration("hledger.lsp")
    .get<string>("path");
  if (customPath !== undefined && customPath.trim() !== "") {
    return customPath.trim();
  }
  return null;
}

export function hasCustomLSPPath(): boolean {
  return getCustomLSPPath() !== null;
}

export function isLSPUpdateCheckEnabled(): boolean {
  return (
    vscode.workspace
      .getConfiguration("hledger.lsp")
      .get<boolean>("checkForUpdates") ?? true
  );
}
