// HLedgerCliService.ts - CLI integration for hledger commands

import * as vscode from 'vscode';
import * as child_process from 'child_process';
import { promisify } from 'util';

const exec = promisify(child_process.exec);
const execFile = promisify(child_process.execFile);

export class HLedgerCliService implements vscode.Disposable {
    private hledgerPath: string | null = null;
    private initializationPromise: Promise<void> | null = null;
    private initializationVersion = 0;
    private readonly configChangeDisposable: vscode.Disposable;

    constructor() {
        this.configChangeDisposable = vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration('hledger.cli.path')) {
                this.resetHledgerPath();
            }
        });

        void this.ensureInitialized().catch(error => {
            console.warn('Failed to initialize hledger path during construction:', error);
        });
    }

    public dispose(): void {
        this.configChangeDisposable.dispose();
    }

    private async ensureInitialized(): Promise<void> {
        if (this.hledgerPath !== null) {
            return;
        }

        await this.startInitialization();
    }

    private startInitialization(force = false): Promise<void> {
        if (!force && this.initializationPromise) {
            return this.initializationPromise;
        }

        const version = ++this.initializationVersion;
        const promise = (async () => {
            try {
                const resolvedPath = await this.resolveHledgerPath();
                if (this.initializationVersion === version) {
                    this.hledgerPath = resolvedPath;
                }
            } finally {
                if (this.initializationVersion === version) {
                    this.initializationPromise = null;
                }
            }
        })();

        this.initializationPromise = promise;
        return promise;
    }

    private async resolveHledgerPath(): Promise<string | null> {
        const customPath = vscode.workspace.getConfiguration('hledger').get<string>('cli.path', '').trim();
        if (customPath.length > 0) {
            return customPath;
        }

        // Try to find hledger in PATH
        try {
            const command = process.platform === 'win32' ? 'where hledger' : 'which hledger';
            const { stdout } = await exec(command);
            const resolvedPath = stdout.trim().split(/\r?\n/)[0] ?? '';
            return resolvedPath || null;
        } catch (error) {
            // hledger not found in PATH
            return null;
        }
    }

    private resetHledgerPath(): void {
        this.hledgerPath = null;
        const initialization = this.startInitialization(true);
        void initialization.catch(error => {
            console.warn('Failed to reinitialize hledger path after configuration change:', error);
        });
    }

    public async isHledgerAvailable(): Promise<boolean> {
        await this.ensureInitialized();
        return this.hledgerPath !== null;
    }

    public async getHledgerPath(): Promise<string | null> {
        await this.ensureInitialized();
        return this.hledgerPath;
    }

    public async executeCommand(subcommand: string, journalFile: string, args: string[] = []): Promise<string> {
        const hledgerPath = await this.getHledgerPath();
        if (!hledgerPath) {
            throw new Error('hledger executable not found. Please install hledger or configure the path in settings.');
        }

        try {
            const cliArgs = ['-f', journalFile, subcommand, ...args];
            const { stdout, stderr } = await execFile(hledgerPath, cliArgs, { maxBuffer: 10 * 1024 * 1024 });

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

    public async runBalance(journalFile: string, extraArgs: string[] = []): Promise<string> {
        return this.executeCommand('bs', journalFile, extraArgs);
    }

    public async runStats(journalFile: string): Promise<string> {
        return this.executeCommand('stats', journalFile);
    }

    public async runIncomestatement(journalFile: string, extraArgs: string[] = []): Promise<string> {
        return this.executeCommand('incomestatement', journalFile, extraArgs);
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
        }

        comment += '; ' + '='.repeat(50) + '\n\n';
        return comment;
    }
}