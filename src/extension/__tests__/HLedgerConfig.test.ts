import { HLedgerConfig } from '../main';
import { HLedgerParser, ParsedHLedgerData } from '../HLedgerParser';
import { SimpleProjectCache } from '../SimpleProjectCache';
import { createAccountName, createUsageCount } from '../types';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { MockTextDocument } from '../../__mocks__/vscode';

jest.mock('fs');

describe('HLedgerConfig', () => {
    let config: HLedgerConfig;
    
    beforeEach(() => {
        config = new HLedgerConfig();
        jest.clearAllMocks();
    });
    
    describe('parseContent', () => {
        it('should parse account directives', () => {
            const content = `
account Assets:Bank
account Expenses:Food
account Активы:Наличные
`;
            
            config.parseContent(content);
            
            expect(config.getAccounts()).toEqual(expect.arrayContaining([
                'Assets:Bank',
                'Expenses:Food',
                'Активы:Наличные'
            ]));
            expect(config.getDefinedAccounts()).toEqual(expect.arrayContaining([
                'Assets:Bank',
                'Expenses:Food',
                'Активы:Наличные'
            ]));
        });
        
        
        it('should parse commodity directives', () => {
            const content = `
commodity RUB
commodity 1,000.00 USD
commodity EUR
`;
            
            config.parseContent(content);
            
            // Updated to expect just the commodity symbols, not the full format templates
            expect(config.getCommodities()).toEqual(expect.arrayContaining([
                'RUB', 'USD', 'EUR'
            ]));
        });
        
        it('should parse default commodity', () => {
            const content = `D 1000.00 RUB`;
            
            config.parseContent(content);
            
            // Updated to expect just the commodity symbol, not the full format template
            expect(config.defaultCommodity).toBe('RUB');
        });
        
        it('should extract dates from transactions', () => {
            const content = `
2025-01-15 Test transaction
    Assets:Cash    100
    Expenses:Food  -100
    
01-16 Short date
    Assets:Cash    50
    Expenses:Food  -50
`;
            
            config.parseContent(content);
            
            expect(config.getLastDate()).toBe('01-16');
        });
        
        it('should extract accounts from transactions', () => {
            const content = `
2025-01-15 Test
    Assets:Cash         100.50 RUB
    Expenses:Food       -50.25 RUB
    Активы:Наличные     25
`;
            
            config.parseContent(content);
            
            expect(config.getUsedAccounts()).toEqual(expect.arrayContaining([
                'Assets:Cash',
                'Expenses:Food',
                'Активы:Наличные'
            ]));
        });
        
        it('should handle include directives', () => {
            const content = `include other.journal`;
            const mockFileContent = `account Assets:Included`;
            
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.readFileSync as jest.Mock).mockReturnValue(mockFileContent);
            
            config.parseContent(content, '/test/path');
            
            expect(fs.readFileSync).toHaveBeenCalledWith(
                path.resolve('/test/path', 'other.journal'),
                'utf8'
            );
            expect(config.getAccounts()).toContain('Assets:Included');
        });
        
        it('should handle comments', () => {
            const content = `
; This is a comment
# This is also a comment
account Assets:Bank ; inline comment
`;
            
            config.parseContent(content);
            
            expect(config.getAccounts()).toContain('Assets:Bank');
            expect(config.getAccounts()).toHaveLength(1);
        });
    });
    
    describe('getUndefinedAccounts', () => {
        it('should return accounts used but not defined', () => {
            const content = `
account Assets:Bank

2025-01-15 Test
    Assets:Bank      100
    Assets:Cash      -50
    Expenses:Food    -50
`;

            config.parseContent(content);

            expect(config.getUndefinedAccounts()).toEqual(expect.arrayContaining([
                'Assets:Cash',
                'Expenses:Food'
            ]));
            expect(config.getUndefinedAccounts()).not.toContain('Assets:Bank');
        });

        it('should consider sub-accounts valid if parent account is defined', () => {
            const content = `
account Assets
account Expenses

2025-01-15 Test
    Assets:Bank:Cash     100
    Assets:Wallet        -50
    Expenses:Food:Lunch  -50
`;

            config.parseContent(content);

            // All accounts should be valid because parent accounts are defined
            expect(config.getUndefinedAccounts()).toHaveLength(0);
        });

        it('should return undefined accounts when no parent is defined', () => {
            const content = `
account Assets:Bank

2025-01-15 Test
    Assets:Bank:Cash     100
    Liabilities:Card     -100
`;

            config.parseContent(content);

            // Assets:Bank:Cash is valid (parent Assets:Bank is defined)
            // Liabilities:Card is undefined (no parent defined)
            expect(config.getUndefinedAccounts()).toEqual(['Liabilities:Card']);
            expect(config.getUndefinedAccounts()).not.toContain('Assets:Bank:Cash');
        });
    });
    
    describe('parseFile', () => {
        it('should handle non-existent files gracefully', () => {
            (fs.existsSync as jest.Mock).mockReturnValue(false);
            
            expect(() => config.parseFile('/non/existent/file.journal')).not.toThrow();
            expect(config.getAccounts()).toHaveLength(0);
        });
        
        it('should handle file read errors gracefully', () => {
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.readFileSync as jest.Mock).mockImplementation(() => {
                throw new Error('Permission denied');
            });
            
            // HLedgerParser now silently handles errors in test environment
            // Just ensure no exception is thrown
            expect(() => {
                config.parseFile('/error/file.journal');
            }).not.toThrow();
            
            // Verify that no data was parsed due to error
            expect(config.getAccounts()).toEqual([]);
        });
    });

    describe('getConfigForDocument - cache pollution prevention', () => {
        it('should clone data before merging when currentLine is provided', () => {
            // This test verifies that when getConfigForDocument is called with currentLine,
            // the workspace data is cloned before mergeCurrentData mutates it.
            //
            // The bug: this.data and this.cache share the same object reference.
            // When mergeCurrentData() mutates this.data, it also pollutes the cache.
            //
            // Testing strategy:
            // 1. Set up internal state to simulate cached workspace data
            // 2. Call getConfigForDocument with a document containing new data
            // 3. Verify the original workspace data Set was NOT mutated

            // Create workspace data with mutable Sets that we can verify
            const originalAccountsSet = new Set(['Assets:Bank', 'Expenses:Food']);
            const originalUsedAccountsSet = new Set<string>();

            const workspaceData: ParsedHLedgerData = {
                accounts: originalAccountsSet,
                definedAccounts: new Set(['Assets:Bank', 'Expenses:Food']),
                usedAccounts: originalUsedAccountsSet,
                payees: new Set(),
                tags: new Set(),
                commodities: new Set(),
                aliases: new Map(),
                accountUsage: new Map(),
                payeeUsage: new Map(),
                tagUsage: new Map(),
                commodityUsage: new Map(),
                tagValues: new Map(),
                tagValueUsage: new Map(),
                payeeAccounts: new Map(),
                payeeAccountPairUsage: new Map(),
                commodityFormats: new Map(),
                decimalMark: null,
                defaultCommodity: null,
                transactionTemplates: new Map(),
                lastDate: null
            };

            // Inject the shared cache that holds workspace data
            const sharedCache = new SimpleProjectCache();
            sharedCache.set('/test/project', workspaceData);

            // Create config with the shared cache
            const parser = new HLedgerParser();
            const configWithSharedCache = new HLedgerConfig(parser, sharedCache);

            // Set internal state to simulate a prior workspace parse
            const internalConfig = configWithSharedCache as unknown as {
                data: ParsedHLedgerData;
                lastWorkspacePath: string;
            };
            internalConfig.data = workspaceData;
            internalConfig.lastWorkspacePath = '/test/project';

            // Verify initial state
            expect(originalAccountsSet.size).toBe(2);
            expect(originalAccountsSet.has('Assets:NewAccount')).toBe(false);
            expect(originalUsedAccountsSet.size).toBe(0);

            // Create a document with new account data
            // Note: The posting account needs proper indentation (spaces/tab) and amount separation
            const documentContent = `2025-01-15 Test transaction
    Assets:NewAccount    100
    Expenses:Food       -100
`;
            const fileUri = {
                scheme: 'file',
                authority: '',
                path: '/test/project/test.journal',
                query: '',
                fragment: '',
                fsPath: '/test/project/test.journal',
                with: jest.fn(),
                toString: () => 'file:///test/project/test.journal',
                toJSON: () => ({ $mid: 1, fsPath: '/test/project/test.journal', path: '/test/project/test.journal', scheme: 'file' })
            };

            const document = new MockTextDocument(documentContent.split('\n'), {
                uri: fileUri as vscode.Uri,
                fileName: '/test/project/test.journal',
                languageId: 'hledger'
            });

            const workspaceFolder = {
                uri: {
                    scheme: 'file',
                    fsPath: '/test/project',
                    path: '/test/project',
                    authority: '',
                    query: '',
                    fragment: '',
                    with: jest.fn(),
                    toString: () => 'file:///test/project',
                    toJSON: () => ({})
                },
                name: 'project',
                index: 0
            };
            (vscode.workspace.getWorkspaceFolder as jest.Mock).mockReturnValue(workspaceFolder);
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.readdirSync as jest.Mock).mockReturnValue([]);

            // Call with currentLine=2 (the Expenses:Food posting line, so Assets:NewAccount is included)
            // This triggers mergeCurrentData which mutates this.data
            configWithSharedCache.getConfigForDocument(document, 2);

            // After merge, the config should see the new account from the document
            const accountsAfterMerge = configWithSharedCache.getAccounts();
            expect(accountsAfterMerge).toContain('Assets:NewAccount');
            expect(accountsAfterMerge).toContain('Expenses:Food');

            // CRITICAL ASSERTION: The original workspace data Set should NOT be mutated
            // This is the cache pollution bug we're testing for.
            //
            // With the bug: originalAccountsSet.has('Assets:NewAccount') === true (POLLUTION!)
            // With the fix: originalAccountsSet.has('Assets:NewAccount') === false (CLEAN!)
            expect(originalAccountsSet.has('Assets:NewAccount')).toBe(false);
            expect(originalAccountsSet.size).toBe(2);

            // Also verify usedAccounts wasn't polluted
            expect(originalUsedAccountsSet.has('Assets:NewAccount')).toBe(false);
        });

        it('should not persist incomplete data across multiple getConfigForDocument calls', () => {
            // This test verifies the persistence aspect of cache pollution:
            // If cache is polluted on first call, it should NOT persist to subsequent calls.
            //
            // Scenario:
            // 1. User types "prod" on line 5
            // 2. getConfigForDocument(doc, 5) is called -> "prod" should NOT appear in accounts
            // 3. User moves cursor to line 10 (different content)
            // 4. getConfigForDocument(doc, 10) is called -> "prod" should STILL NOT be in accounts
            //
            // This tests that incomplete account names don't pollute the cache permanently.

            // Set up workspace cache with known accounts
            const workspaceData: ParsedHLedgerData = {
                accounts: new Set(['Assets:Bank', 'Expenses:Food']),
                definedAccounts: new Set(['Assets:Bank', 'Expenses:Food']),
                usedAccounts: new Set<string>(),
                payees: new Set(),
                tags: new Set(),
                commodities: new Set(),
                aliases: new Map(),
                accountUsage: new Map([
                    [createAccountName('Assets:Bank'), createUsageCount(50)],
                    [createAccountName('Expenses:Food'), createUsageCount(100)]
                ]),
                payeeUsage: new Map(),
                tagUsage: new Map(),
                commodityUsage: new Map(),
                tagValues: new Map(),
                tagValueUsage: new Map(),
                payeeAccounts: new Map(),
                payeeAccountPairUsage: new Map(),
                commodityFormats: new Map(),
                decimalMark: null,
                defaultCommodity: null,
                transactionTemplates: new Map(),
                lastDate: null
            };

            const sharedCache = new SimpleProjectCache();
            sharedCache.set('/test/project', workspaceData);

            const parser = new HLedgerParser();
            const configWithSharedCache = new HLedgerConfig(parser, sharedCache);

            // Create document with partial account name "prod" on line 5
            const documentContent = `2025-01-15 Grocery shopping
    Assets:Bank          -100
    Expenses:Food         100

prod
2025-01-16 Another transaction
    Assets:Bank          -50
    Expenses:Food         50
`;
            const fileUri = {
                scheme: 'file',
                authority: '',
                path: '/test/project/test.journal',
                query: '',
                fragment: '',
                fsPath: '/test/project/test.journal',
                with: jest.fn(),
                toString: () => 'file:///test/project/test.journal',
                toJSON: () => ({ $mid: 1, fsPath: '/test/project/test.journal', path: '/test/project/test.journal', scheme: 'file' })
            };

            const document = new MockTextDocument(documentContent.split('\n'), {
                uri: fileUri as vscode.Uri,
                fileName: '/test/project/test.journal',
                languageId: 'hledger'
            });

            const workspaceFolder = {
                uri: {
                    scheme: 'file',
                    fsPath: '/test/project',
                    path: '/test/project',
                    authority: '',
                    query: '',
                    fragment: '',
                    with: jest.fn(),
                    toString: () => 'file:///test/project',
                    toJSON: () => ({})
                },
                name: 'project',
                index: 0
            };
            (vscode.workspace.getWorkspaceFolder as jest.Mock).mockReturnValue(workspaceFolder);
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.readdirSync as jest.Mock).mockReturnValue([]);

            // First call: user on line 5 (the "prod" line - zero-indexed line 4)
            configWithSharedCache.getConfigForDocument(document, 4);
            const accountsAfterFirstCall = configWithSharedCache.getAccounts();

            // "prod" should NOT be in accounts (it's incomplete)
            expect(accountsAfterFirstCall).not.toContain('prod');
            expect(accountsAfterFirstCall).toContain('Assets:Bank');
            expect(accountsAfterFirstCall).toContain('Expenses:Food');

            // Second call: user on line 10 (zero-indexed line 9)
            configWithSharedCache.getConfigForDocument(document, 9);
            const accountsAfterSecondCall = configWithSharedCache.getAccounts();

            // "prod" should STILL NOT be in accounts (cache wasn't polluted)
            expect(accountsAfterSecondCall).not.toContain('prod');
            expect(accountsAfterSecondCall).toContain('Assets:Bank');
            expect(accountsAfterSecondCall).toContain('Expenses:Food');

            // Verify cache wasn't polluted
            const cachedData = sharedCache.get('/test/project');
            expect(cachedData).toBeDefined();
            expect(cachedData?.accounts.has('prod')).toBe(false);
        });
    });

    describe('getConfigForDocument - virtual document handling', () => {
        beforeEach(() => {
            // Reset mocks for workspace scanning tests
            (fs.existsSync as jest.Mock).mockReturnValue(false);
            (fs.readdirSync as jest.Mock).mockReturnValue([]);
        });

        it('should not scan workspace for untitled documents', () => {
            const content = `
account Assets:TestAccount
2025-01-15 Test
    Assets:TestAccount  100
`;
            // Create untitled document (scheme !== 'file')
            const untitledUri = {
                scheme: 'untitled',
                authority: '',
                path: 'Untitled-1',
                query: '',
                fragment: '',
                fsPath: 'Untitled-1',
                with: jest.fn(),
                toString: () => 'untitled:Untitled-1',
                toJSON: () => ({ $mid: 1, fsPath: 'Untitled-1', path: 'Untitled-1', scheme: 'untitled' })
            };

            const document = new MockTextDocument(content.split('\n'), {
                uri: untitledUri as vscode.Uri,
                fileName: 'Untitled-1',
                languageId: 'hledger',
                isUntitled: true
            });

            // Mock workspace to return undefined (no workspace folder)
            (vscode.workspace.getWorkspaceFolder as jest.Mock).mockReturnValue(undefined);

            // Should not throw and should not call readdirSync (no workspace scanning)
            config.getConfigForDocument(document);

            // readdirSync should NOT be called because untitled docs skip workspace scanning
            expect(fs.readdirSync).not.toHaveBeenCalled();

            // But document content should still be parsed
            expect(config.getAccounts()).toContain('Assets:TestAccount');
        });

        it('should not scan workspace for custom scheme documents', () => {
            const content = `account Assets:CustomScheme`;

            const customUri = {
                scheme: 'vscode-notebook',
                authority: '',
                path: '/notebook/cell',
                query: '',
                fragment: '',
                fsPath: '/notebook/cell',
                with: jest.fn(),
                toString: () => 'vscode-notebook:/notebook/cell',
                toJSON: () => ({ $mid: 1, fsPath: '/notebook/cell', path: '/notebook/cell', scheme: 'vscode-notebook' })
            };

            const document = new MockTextDocument(content.split('\n'), {
                uri: customUri as vscode.Uri,
                fileName: '/notebook/cell',
                languageId: 'hledger'
            });

            (vscode.workspace.getWorkspaceFolder as jest.Mock).mockReturnValue(undefined);

            config.getConfigForDocument(document);

            expect(fs.readdirSync).not.toHaveBeenCalled();
            expect(config.getAccounts()).toContain('Assets:CustomScheme');
        });

        it('should not scan root directory even for file scheme', () => {
            const content = `account Assets:RootFile`;

            const rootUri = {
                scheme: 'file',
                authority: '',
                path: '/file.journal',
                query: '',
                fragment: '',
                fsPath: '/file.journal',
                with: jest.fn(),
                toString: () => 'file:///file.journal',
                toJSON: () => ({ $mid: 1, fsPath: '/file.journal', path: '/file.journal', scheme: 'file' })
            };

            const document = new MockTextDocument(content.split('\n'), {
                uri: rootUri as vscode.Uri,
                fileName: '/file.journal',
                languageId: 'hledger'
            });

            // No workspace folder, path.dirname('/file.journal') = '/'
            (vscode.workspace.getWorkspaceFolder as jest.Mock).mockReturnValue(undefined);

            config.getConfigForDocument(document);

            // Should NOT scan root directory
            expect(fs.readdirSync).not.toHaveBeenCalled();
            expect(config.getAccounts()).toContain('Assets:RootFile');
        });

        it('should scan workspace for normal file documents', () => {
            const content = `account Assets:NormalFile`;

            const fileUri = {
                scheme: 'file',
                authority: '',
                path: '/home/user/project/test.journal',
                query: '',
                fragment: '',
                fsPath: '/home/user/project/test.journal',
                with: jest.fn(),
                toString: () => 'file:///home/user/project/test.journal',
                toJSON: () => ({ $mid: 1, fsPath: '/home/user/project/test.journal', path: '/home/user/project/test.journal', scheme: 'file' })
            };

            const document = new MockTextDocument(content.split('\n'), {
                uri: fileUri as vscode.Uri,
                fileName: '/home/user/project/test.journal',
                languageId: 'hledger'
            });

            // Mock workspace folder
            const workspaceFolder = {
                uri: {
                    scheme: 'file',
                    fsPath: '/home/user/project',
                    path: '/home/user/project',
                    authority: '',
                    query: '',
                    fragment: '',
                    with: jest.fn(),
                    toString: () => 'file:///home/user/project',
                    toJSON: () => ({})
                },
                name: 'project',
                index: 0
            };
            (vscode.workspace.getWorkspaceFolder as jest.Mock).mockReturnValue(workspaceFolder);
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.readdirSync as jest.Mock).mockReturnValue([]);

            config.getConfigForDocument(document);

            // Should scan workspace for normal file documents
            expect(fs.existsSync).toHaveBeenCalled();
            expect(config.getAccounts()).toContain('Assets:NormalFile');
        });
    });
});