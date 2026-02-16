import * as vscode from 'vscode';

export class Logger implements vscode.Disposable {
  private readonly channel: vscode.OutputChannel;

  constructor(channel: vscode.OutputChannel) {
    this.channel = channel;
  }

  info(message: string): void {
    this.channel.appendLine(`${this.timestamp()} [INFO] ${message}`);
  }

  error(message: string, error?: Error): void {
    const errorDetail = error ? `: ${error.message}` : '';
    this.channel.appendLine(`${this.timestamp()} [ERROR] ${message}${errorDetail}`);
  }

  debug(message: string): void {
    const isDebug = vscode.workspace
      .getConfiguration('hledger.lsp')
      .get<boolean>('debug', false);
    if (!isDebug) return;
    this.channel.appendLine(`${this.timestamp()} [DEBUG] ${message}`);
  }

  dispose(): void {
    this.channel.dispose();
  }

  private timestamp(): string {
    return `[${new Date().toISOString()}]`;
  }
}
