// HLedgerCliCommands.ts - CLI command handlers for hledger

import * as vscode from 'vscode';
import { HLedgerCliService } from './services/HLedgerCliService';

export class HLedgerCliCommands {
    private cliService: HLedgerCliService;

    constructor(cliService: HLedgerCliService) {
        this.cliService = cliService;
    }

    public async insertBalance(): Promise<void> {
        await this.insertCliReport('balance');
    }

    public async insertStats(): Promise<void> {
        await this.insertCliReport('stats');
    }

    public async insertIncomestatement(): Promise<void> {
        await this.insertCliReport('incomestatement');
    }

    private async insertCliReport(command: string): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found.');
            return;
        }

        const document = editor.document;
        if (document.languageId !== 'hledger') {
            vscode.window.showErrorMessage('This command is only available in hledger files.');
            return;
        }

        try {
            // Check if hledger is available
            const isAvailable = await this.cliService.isHledgerAvailable();
            if (!isAvailable) {
                const installMessage = 'hledger CLI not found. Would you like to install it?';
                const installChoice = await vscode.window.showInformationMessage(
                    installMessage,
                    'Open Installation Guide',
                    'Configure Path'
                );

                if (installChoice === 'Open Installation Guide') {
                    vscode.env.openExternal(vscode.Uri.parse('https://hledger.org/install.html'));
                } else if (installChoice === 'Configure Path') {
                    const config = vscode.workspace.getConfiguration('hledger');
                    const customPath = await vscode.window.showInputBox({
                        prompt: 'Enter the path to hledger executable',
                        placeHolder: '/usr/local/bin/hledger'
                    });
                    if (customPath) {
                        await config.update('cli.path', customPath, vscode.ConfigurationTarget.Global);
                    }
                }
                return;
            }

            // Get the journal file path
            const journalFile = this.getJournalFilePath(document);

            // Execute the command
            let output: string;
            switch (command) {
                case 'balance':
                    output = await this.cliService.runBalance(journalFile);
                    break;
                case 'stats':
                    output = await this.cliService.runStats(journalFile);
                    break;
                case 'incomestatement':
                    output = await this.cliService.runIncomestatement(journalFile);
                    break;
                default:
                    throw new Error(`Unknown command: ${command}`);
            }

            // Format as comment and insert
            const comment = this.cliService.formatAsComment(output, command);
            await this.insertCommentAtCursor(editor, comment);

            vscode.window.showInformationMessage(`hledger ${command} report inserted successfully.`);

        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to run hledger ${command}: ${error.message}`);
        }
    }

    private getJournalFilePath(document: vscode.TextDocument): string {
        // First, try to get from environment variable LEDGER_FILE
        const ledgerFileFromEnv = process.env.LEDGER_FILE;
        if (ledgerFileFromEnv && ledgerFileFromEnv.trim()) {
            return ledgerFileFromEnv.trim();
        }

        // Second, try to get from extension configuration
        const config = vscode.workspace.getConfiguration('hledger');
        const journalFileFromConfig = config.get<string>('cli.journalFile', '');
        if (journalFileFromConfig && journalFileFromConfig.trim()) {
            return journalFileFromConfig.trim();
        }

        // Finally, use the current file as fallback
        return document.uri.fsPath;
    }

    private async insertCommentAtCursor(editor: vscode.TextEditor, comment: string): Promise<void> {
        const position = editor.selection.active;
        await editor.edit(editBuilder => {
            editBuilder.insert(position, comment);
        });
    }
}