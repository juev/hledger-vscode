import * as vscode from 'vscode';
import { LSPStatus } from './LSPManager';

export class LSPStatusBar implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.item.command = 'hledger.lsp.restart';
    this.update(LSPStatus.NotInstalled);
    this.item.show();
  }

  update(status: LSPStatus): void {
    switch (status) {
      case LSPStatus.Running:
        this.item.text = '$(server) HLedger LSP';
        this.item.tooltip = 'HLedger Language Server: Running';
        this.item.backgroundColor = undefined;
        break;
      case LSPStatus.Starting:
        this.item.text = '$(sync~spin) HLedger LSP';
        this.item.tooltip = 'HLedger Language Server: Starting...';
        this.item.backgroundColor = undefined;
        break;
      case LSPStatus.Downloading:
        this.item.text = '$(sync~spin) HLedger LSP';
        this.item.tooltip = 'HLedger Language Server: Downloading...';
        this.item.backgroundColor = undefined;
        break;
      case LSPStatus.Error:
        this.item.text = '$(warning) HLedger LSP';
        this.item.tooltip = 'HLedger Language Server: Error (click to restart)';
        this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        break;
      case LSPStatus.NotInstalled:
        this.item.text = '$(cloud-download) HLedger LSP';
        this.item.tooltip = 'HLedger Language Server: Not Installed';
        this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        break;
      case LSPStatus.Stopped:
        this.item.text = '$(debug-stop) HLedger LSP';
        this.item.tooltip = 'HLedger Language Server: Stopped';
        this.item.backgroundColor = undefined;
        break;
    }
  }

  dispose(): void {
    this.item.dispose();
  }
}
