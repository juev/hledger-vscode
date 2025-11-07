import * as vscode from 'vscode';
import * as path from 'path';
import { execFile, ExecFileOptions } from 'child_process';

export interface HledgerRunOptions {
    readonly folder?: vscode.WorkspaceFolder;
    readonly cwd?: string;
    readonly env?: NodeJS.ProcessEnv;
    readonly cancellationToken?: vscode.CancellationToken;
    readonly input?: string;
    readonly suppressOutput?: boolean;
}

export class HledgerCliError extends Error {
    readonly command: string;
    readonly args: readonly string[];
    readonly stderr: string;
    readonly exitCode: number | null;

    constructor(message: string, command: string, args: readonly string[], stderr: string, exitCode: number | null) {
        super(message);
        this.name = 'HledgerCliError';
        this.command = command;
        this.args = args;
        this.stderr = stderr;
        this.exitCode = exitCode;
    }
}

export class HledgerCliService implements vscode.Disposable {
    private readonly output: vscode.OutputChannel;

    constructor(output?: vscode.OutputChannel) {
        this.output = output ?? vscode.window.createOutputChannel('HLedger CLI');
    }

    async run(args: string[], options: HledgerRunOptions = {}): Promise<string> {
        const { folder, cancellationToken } = options;
        const config = vscode.workspace.getConfiguration('hledger', folder);
        const executable = config.get<string>('cli.path', 'hledger').trim();
        if (!executable) {
            throw new Error('HLedger CLI path is not configured.');
        }

        const timeout = this.getTimeout(config);
        const commandArgs = [...this.getDefaultFileArgs(config, folder), ...args];

        const cwd = options.cwd ?? this.resolveCwd(folder);
        const execOptions: ExecFileOptions = {
            cwd,
            env: options.env ? { ...process.env, ...options.env } : process.env,
            timeout,
            maxBuffer: 20 * 1024 * 1024
        };

        if (!options.suppressOutput) {
            this.logCommand(executable, commandArgs, cwd);
        }

        return await new Promise<string>((resolve, reject) => {
            const child = execFile(executable, commandArgs, execOptions, (error, stdout, stderr) => {
                if (error) {
                    const exitCode = typeof (error as any).code === 'number' ? (error as any).code : null;
                    const message = error.code === 'ENOENT'
                        ? `Unable to run hledger executable at "${executable}". Ensure the path is correct.`
                        : `hledger command failed with exit code ${exitCode ?? 'unknown'}.`;
                    const cliError = new HledgerCliError(message, executable, commandArgs, stderr ?? '', exitCode);
                    reject(cliError);
                    return;
                }
                resolve(stdout);
            });

            if (options.input) {
                child.stdin?.write(options.input);
                child.stdin?.end();
            }

            if (cancellationToken) {
                cancellationToken.onCancellationRequested(() => {
                    child.kill();
                    reject(new vscode.CancellationError());
                });
            }
        });
    }

    async runJson<T>(args: string[], options: HledgerRunOptions = {}): Promise<T> {
        const stdout = await this.run(args, options);
        try {
            return JSON.parse(stdout) as T;
        } catch (error) {
            throw new Error(`Failed to parse hledger JSON output: ${(error as Error).message}`);
        }
    }

    private getTimeout(config: vscode.WorkspaceConfiguration): number {
        const value = config.get<number>('cli.timeout', 10000);
        if (typeof value !== 'number' || Number.isNaN(value) || value <= 0) {
            return 10000;
        }
        return value;
    }

    private getDefaultFileArgs(config: vscode.WorkspaceConfiguration, folder?: vscode.WorkspaceFolder): string[] {
        const journal = config.get<string>('cli.defaultJournal', '').trim();
        if (!journal) {
            return [];
        }
        const resolved = this.resolvePath(journal, folder);
        return ['-f', resolved];
    }

    private resolvePath(target: string, folder?: vscode.WorkspaceFolder): string {
        if (path.isAbsolute(target)) {
            return target;
        }
        const base = folder?.uri.fsPath ?? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!base) {
            return target;
        }
        return path.join(base, target);
    }

    private resolveCwd(folder?: vscode.WorkspaceFolder): string | undefined {
        if (folder) {
            return folder.uri.fsPath;
        }
        return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    }

    private logCommand(command: string, args: readonly string[], cwd?: string): void {
        const timestamp = new Date().toISOString();
        this.output.appendLine(`[${timestamp}] hledger> ${command} ${args.join(' ')}`);
        if (cwd) {
            this.output.appendLine(`  cwd: ${cwd}`);
        }
    }

    dispose(): void {
        this.output.dispose();
    }
}
