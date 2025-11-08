// HLedgerCliService.ts - CLI integration for hledger commands

import * as vscode from 'vscode';
import * as child_process from 'child_process';
import { promisify } from 'util';

const exec = promisify(child_process.exec);

export class HLedgerCliService {
    private hledgerPath: string | null = null;
    private config: vscode.WorkspaceConfiguration;

    constructor() {
        this.config = vscode.workspace.getConfiguration('hledger');
        this.initializeHledgerPath();
    }

    private async initializeHledgerPath(): Promise<void> {
        const customPath = this.config.get<string>('cli.path', '');
        if (customPath) {
            this.hledgerPath = customPath;
            return;
        }

        // Try to find hledger in PATH
        try {
            const command = process.platform === 'win32' ? 'where hledger' : 'which hledger';
            const { stdout } = await exec(command);
            const resolvedPath = stdout.trim().split(/\r?\n/)[0] ?? '';
            this.hledgerPath = resolvedPath || null;
        } catch (error) {
            // hledger not found in PATH
            this.hledgerPath = null;
        }
    }

    public async isHledgerAvailable(): Promise<boolean> {
        if (this.hledgerPath === null) {
            await this.initializeHledgerPath();
        }
        return this.hledgerPath !== null;
    }

    public async getHledgerPath(): Promise<string | null> {
        if (this.hledgerPath === null) {
            await this.initializeHledgerPath();
        }
        return this.hledgerPath;
    }

    public async executeCommand(command: string, journalFile: string): Promise<string> {
        const hledgerPath = await this.getHledgerPath();
        if (!hledgerPath) {
            throw new Error('hledger executable not found. Please install hledger or configure the path in settings.');
        }

        try {
            const fullCommand = `"${hledgerPath}" -f "${journalFile}" ${command}`;
            const { stdout, stderr } = await exec(fullCommand);

            if (stderr) {
                console.warn('hledger stderr:', stderr);
            }

            return stdout;
        } catch (error: any) {
            if (error.stderr) {
                throw new Error(`hledger command failed: ${error.stderr}`);
            }
            throw new Error(`Failed to execute hledger command: ${error.message}`);
        }
    }

    public async runBalance(journalFile: string, extraArgs: string = ''): Promise<string> {
        return this.executeCommand(`bs ${extraArgs}`, journalFile);
    }

    public async runStats(journalFile: string): Promise<string> {
        return this.executeCommand('stats', journalFile);
    }

    public async runIncomestatement(journalFile: string, extraArgs: string = ''): Promise<string> {
        return this.executeCommand(`incomestatement ${extraArgs}`, journalFile);
    }

    public formatAsComment(output: string, command: string): string {
        const lines = output.trim().split('\n');
        const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

        let comment = `; hledger ${command} - ${timestamp}\n`;
        comment += '; ' + '='.repeat(50) + '\n';

        for (const line of lines) {
            if (line.trim()) {
                comment += `; ${line}\n`;
            }
            // Skip empty lines to avoid extra spacing
        }

        comment += '; ' + '='.repeat(50) + '\n\n';
        return comment;
    }
}