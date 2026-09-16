// HLedgerCliCommands.test.ts - Tests for CLI command handlers

import type { Mock } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { HLedgerCliCommands } from '../HLedgerCliCommands';
import { HLedgerCliService } from '../services/HLedgerCliService';
import * as vscode from 'vscode';

/** getuid is absent on Windows, where the optional call yields undefined. */
const isRoot = process.getuid?.() === 0;

// Constructing HLedgerCliService starts path resolution, which shells out to
// `which hledger` and then `<path> --version`. No assertion here depends on
// that -- every test stubs the service methods it uses -- but leaving it real
// made these unit tests spawn processes and behave differently depending on
// whether hledger happens to be installed. Stub both calls as "not found".
vi.mock('child_process', () => ({
    exec: vi.fn((...args: unknown[]) => {
        const callback = args[args.length - 1];
        if (typeof callback === 'function') {
            (callback as (e: Error) => void)(new Error('not found'));
        }
        return {};
    }),
    execFile: vi.fn((...args: unknown[]) => {
        const callback = args[args.length - 1];
        if (typeof callback === 'function') {
            (callback as (e: Error) => void)(new Error('not found'));
        }
        return {};
    }),
}));

describe('HLedgerCliCommands - Progress Indicators', () => {
    let tempDir: string;
    let validJournalPath: string;
    let mockService: HLedgerCliService;
    let commands: HLedgerCliCommands;
    let mockEditor: any;
    let mockDocument: any;

    beforeEach(async () => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hledger-test-'));
        validJournalPath = path.join(tempDir, 'test.journal');
        fs.writeFileSync(validJournalPath, '2025-01-01 Test\n  Assets:Bank  $100\n');

        mockService = new HLedgerCliService();
        // Await the fire-and-forget init the constructor starts, so it cannot
        // still be resolving when the test ends and skew coverage.
        await mockService.getHledgerPath();
        commands = new HLedgerCliCommands(mockService);

        mockDocument = {
            uri: { fsPath: validJournalPath },
            languageId: 'hledger'
        };

        mockEditor = {
            document: mockDocument,
            selection: { active: { line: 0, character: 0 } },
            edit: vi.fn().mockResolvedValue(true)
        };

        vscode.window.activeTextEditor = mockEditor;
        vscode.window.showInformationMessage = vi.fn();
        vscode.window.showErrorMessage = vi.fn();
    });

    afterEach(() => {
        commands.dispose();
        mockService.dispose();
        fs.rmSync(tempDir, { recursive: true, force: true });
        delete process.env.LEDGER_FILE;
    });

    it('should show cancellable progress notification during balance sheet command execution', async () => {
        const withProgressSpy = vi.spyOn(vscode.window, 'withProgress');

        vi.spyOn(mockService, 'isHledgerAvailable').mockResolvedValue(true);
        vi.spyOn(mockService, 'runBalanceSheet').mockResolvedValue('Balance Sheet Report');
        vi.spyOn(mockService, 'formatAsComment').mockReturnValue('; Balance Sheet Report');

        await commands.insertBalanceSheet();

        expect(withProgressSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                location: vscode.ProgressLocation.Notification,
                title: 'Running hledger balancesheet...',
                cancellable: true
            }),
            expect.any(Function)
        );
    });

    it('should show cancellable progress notification during stats command execution', async () => {
        const withProgressSpy = vi.spyOn(vscode.window, 'withProgress');

        vi.spyOn(mockService, 'isHledgerAvailable').mockResolvedValue(true);
        vi.spyOn(mockService, 'runStats').mockResolvedValue('Stats Report');
        vi.spyOn(mockService, 'formatAsComment').mockReturnValue('; Stats Report');

        await commands.insertStats();

        expect(withProgressSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                location: vscode.ProgressLocation.Notification,
                title: 'Running hledger stats...',
                cancellable: true
            }),
            expect.any(Function)
        );
    });

    it('should show cancellable progress notification during incomestatement command execution', async () => {
        const withProgressSpy = vi.spyOn(vscode.window, 'withProgress');

        vi.spyOn(mockService, 'isHledgerAvailable').mockResolvedValue(true);
        vi.spyOn(mockService, 'runIncomestatement').mockResolvedValue('Income Statement Report');
        vi.spyOn(mockService, 'formatAsComment').mockReturnValue('; Income Statement Report');

        await commands.insertIncomestatement();

        expect(withProgressSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                location: vscode.ProgressLocation.Notification,
                title: 'Running hledger incomestatement...',
                cancellable: true
            }),
            expect.any(Function)
        );
    });

    it('should still show error messages when CLI fails inside progress', async () => {

        vi.spyOn(mockService, 'isHledgerAvailable').mockResolvedValue(true);
        vi.spyOn(mockService, 'runBalanceSheet').mockRejectedValue(new Error('CLI execution failed'));

        await commands.insertBalanceSheet();

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            expect.stringContaining('Failed to run hledger balancesheet')
        );
    });

    it('should show info message when command is cancelled', async () => {

        vi.spyOn(mockService, 'isHledgerAvailable').mockResolvedValue(true);
        vi.spyOn(mockService, 'runBalanceSheet').mockImplementation(async () => {
            throw new Error('hledger bs was cancelled.');
        });

        // Simulate cancellation by making withProgress trigger the abort
        (vscode.window.withProgress as unknown as Mock).mockImplementationOnce(async (options: any, task: any) => {
            const listeners: Array<() => void> = [];
            const token = {
                isCancellationRequested: false,
                onCancellationRequested: vi.fn((listener: () => void) => {
                    listeners.push(listener);
                    return { dispose: vi.fn() };
                }),
            };
            const progressPromise = task({ report: vi.fn() }, token);
            // Trigger cancellation after the task starts
            listeners.forEach(l => l());
            return progressPromise;
        });

        await commands.insertBalanceSheet();

        expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
            expect.stringContaining('was cancelled')
        );
    });
});

describe('HLedgerCliCommands - Command Injection Prevention', () => {
    let tempDir: string;
    let validJournalPath: string;

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hledger-test-'));
        validJournalPath = path.join(tempDir, 'test.journal');
        fs.writeFileSync(validJournalPath, '2025-01-01 Test\n  Assets:Bank  $100\n');
    });

    afterEach(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
        delete process.env.LEDGER_FILE;
    });

    describe('sanitizeJournalPath', () => {
        let commands: HLedgerCliCommands;
        let mockService: HLedgerCliService;

        beforeEach(async () => {
            mockService = new HLedgerCliService();
            // Await the fire-and-forget init the constructor starts, so it cannot
            // still be resolving when the test ends and skew coverage.
            await mockService.getHledgerPath();
            commands = new HLedgerCliCommands(mockService);
        });

        afterEach(() => {
            commands.dispose();
            mockService.dispose();
        });

        // Shell metacharacters are not special here: the service calls
        // child_process.execFile with an argv array, so no shell ever parses
        // the path. Rejecting them only refused legitimate names such as
        // "/Users/me/Taxes (2024)/main.journal".
        const metacharacterPaths = [
            '; rm -rf /',
            ' && curl evil.com',
            ' | cat /etc/passwd',
            '`whoami`',
            '$(whoami)',
            '()',
            '[test]',
            '{test}',
            '^test',
            '"test"',
            '<test',
            '>test',
        ];

        it.each(metacharacterPaths)('should accept a path containing %s', (suffix) => {
            const exoticPath = `${validJournalPath}${suffix}`;

            expect(() => {
                (commands as any).sanitizeJournalPath(exoticPath);
            }).not.toThrow(/cannot appear/);
        });

        it('should reject a path with a NUL byte', () => {
            expect(() => {
                (commands as any).sanitizeJournalPath(`${validJournalPath}\u0000x`);
            }).toThrow(/cannot appear/);
        });

        it('should reject a path with a line break', () => {
            const forgedPath = `${validJournalPath}\n; injected`;

            expect(() => {
                (commands as any).sanitizeJournalPath(forgedPath);
            }).toThrow(/cannot appear/);
        });

        it('should allow paths with backslash (Windows compatibility)', () => {
            // Backslash is an ordinary character here; the path is rejected only
            // because it does not exist, not as a shell metacharacter.
            const windowsStylePath = `${validJournalPath}\\test`;

            expect(() => {
                (commands as any).sanitizeJournalPath(windowsStylePath);
            }).toThrow(/does not exist/);
        });

        it('should accept an existing path with parentheses', () => {
            const parenthesised = path.join(tempDir, 'taxes (2024).journal');
            fs.writeFileSync(parenthesised, 'test');

            expect((commands as any).sanitizeJournalPath(parenthesised)).toBe(parenthesised);
        });

        it('should reject non-existent paths', () => {
            const nonExistentPath = path.join(tempDir, 'nonexistent.journal');

            expect(() => {
                (commands as any).sanitizeJournalPath(nonExistentPath);
            }).toThrow(/does not exist or is not accessible/);
        });

        // Root bypasses file permission checks, so chmod 000 does not make a
        // file unreadable and there is nothing for sanitizeJournalPath to
        // reject. CI runs as a normal user, but container images default to
        // root -- without this the suite fails there and looks like a real
        // regression in path validation.
        it.skipIf(isRoot)('should reject unreadable paths', () => {
            const unreadablePath = path.join(tempDir, 'unreadable.journal');
            fs.writeFileSync(unreadablePath, 'test');
            fs.chmodSync(unreadablePath, 0o000);

            try {
                expect(() => {
                    (commands as any).sanitizeJournalPath(unreadablePath);
                }).toThrow(/does not exist or is not accessible/);
            } finally {
                fs.chmodSync(unreadablePath, 0o644);
            }
        });

        it('should accept valid paths', () => {
            const result = (commands as any).sanitizeJournalPath(validJournalPath);
            expect(result).toBe(validJournalPath);
        });

        it('should accept paths with spaces', () => {
            const pathWithSpaces = path.join(tempDir, 'test file.journal');
            fs.writeFileSync(pathWithSpaces, 'test');

            const result = (commands as any).sanitizeJournalPath(pathWithSpaces);
            expect(result).toBe(pathWithSpaces);
        });

        it('should accept paths with hyphens', () => {
            const pathWithHyphens = path.join(tempDir, 'test-file.journal');
            fs.writeFileSync(pathWithHyphens, 'test');

            const result = (commands as any).sanitizeJournalPath(pathWithHyphens);
            expect(result).toBe(pathWithHyphens);
        });
    });

    describe('getJournalFilePath with sanitization', () => {
        let commands: HLedgerCliCommands;
        let mockService: HLedgerCliService;
        let mockDocument: any;

        beforeEach(async () => {
            mockService = new HLedgerCliService();
            // Await the fire-and-forget init the constructor starts, so it cannot
            // still be resolving when the test ends and skew coverage.
            await mockService.getHledgerPath();
            commands = new HLedgerCliCommands(mockService);
            mockDocument = {
                uri: { fsPath: validJournalPath },
                languageId: 'hledger'
            };
        });

        afterEach(() => {
            commands.dispose();
            mockService.dispose();
        });

        it('should sanitize environment variable path', () => {
            process.env.LEDGER_FILE = `${validJournalPath}; rm -rf /`;

            expect(() => {
                (commands as any).getJournalFilePath(mockDocument);
            }).toThrow(/does not exist or is not accessible/);
        });

        it('should use valid environment variable path', () => {
            process.env.LEDGER_FILE = validJournalPath;

            const result = (commands as any).getJournalFilePath(mockDocument);
            expect(result).toBe(validJournalPath);
        });

        it('should use document path if environment variable is invalid', () => {
            process.env.LEDGER_FILE = `${validJournalPath}; rm -rf /`;

            expect(() => {
                (commands as any).getJournalFilePath(mockDocument);
            }).toThrow(/does not exist or is not accessible/);
        });

        it('should bypass sanitization for trusted document path', () => {
            delete process.env.LEDGER_FILE;

            const result = (commands as any).getJournalFilePath(mockDocument);
            expect(result).toBe(validJournalPath);
        });
    });
});
