import * as vscode from 'vscode';

const HLEDGER_LANGUAGE_ID = 'hledger';

export class KeybindingHintsStatusBar implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem;
  private readonly disposables: vscode.Disposable[] = [];

  constructor() {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      99
    );
    this.item.text = '$(keyboard) ⌘K S: status · Tab: align · Enter: suggest';
    this.item.tooltip = 'HLedger keybindings: Cmd+K S cycles status, Tab aligns amount, Enter accepts suggestion';
    this.item.name = 'HLedger Keybinding Hints';

    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        this.updateVisibility(editor);
      })
    );

    this.updateVisibility(vscode.window.activeTextEditor);
  }

  private updateVisibility(editor: vscode.TextEditor | undefined): void {
    if (editor?.document.languageId === HLEDGER_LANGUAGE_ID) {
      this.item.show();
    } else {
      this.item.hide();
    }
  }

  dispose(): void {
    this.item.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
