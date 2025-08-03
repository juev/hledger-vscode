import * as vscode from 'vscode';
import { AccountCompletionProvider } from '../completion/providers/AccountCompletionProvider';

// Mock the main module
jest.mock('../main', () => ({
    getConfig: jest.fn()
}));

import { getConfig } from '../main';

describe('AccountCompletionProvider', () => {
    let provider: AccountCompletionProvider;
    let mockDocument: any;
    let mockPosition: any;
    let mockToken: any;
    let mockContext: any;
    let mockConfig: any;
    
    beforeEach(() => {
        provider = new AccountCompletionProvider();
        
        // Reset mocks
        jest.clearAllMocks();
        
        // Mock document
        mockDocument = {
            lineAt: jest.fn(),
            getText: jest.fn(),
            uri: { fsPath: '/test/test.journal' }
        };
        
        // Mock position
        mockPosition = jest.fn((line: number, character: number) => ({
            line,
            character
        }));
        
        // Mock cancellation token
        mockToken = {
            isCancellationRequested: false,
            onCancellationRequested: jest.fn()
        };
        
        // Mock completion context
        mockContext = {
            triggerKind: vscode.CompletionTriggerKind.Invoke,
            triggerCharacter: undefined
        };
        
        // Mock config
        mockConfig = {
            getAccountsByUsage: jest.fn().mockReturnValue([
                { account: 'Assets:Bank:Checking', count: 10 },
                { account: 'Expenses:Food', count: 8 },
                { account: 'Income:Salary', count: 5 },
                { account: 'Assets:Cash', count: 3 }
            ]),
            getDefinedAccounts: jest.fn().mockReturnValue([
                'Assets:Bank:Checking',
                'Expenses:Food'
            ])
        };
        
        (getConfig as jest.Mock).mockReturnValue(mockConfig);
        
        // Mock workspace configuration
        (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
            get: jest.fn((key: string, defaultValue?: any) => {
                if (key === 'maxResults') return 25;
                if (key === 'maxAccountResults') return 30;
                return defaultValue;
            })
        });
    });
    
    describe('shouldProvideCompletions', () => {
        it('should provide completions for posting lines (2+ spaces)', () => {
            mockDocument.lineAt.mockReturnValue({ text: '  ' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(0, 2),
                mockToken,
                mockContext
            ) as vscode.CompletionItem[];
            
            expect(items).toBeDefined();
            expect(items.length).toBeGreaterThan(0);
        });
        
        it('should provide completions with partial account name', () => {
            mockDocument.lineAt.mockReturnValue({ text: '  Ass' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(0, 5),
                mockToken,
                mockContext
            ) as vscode.CompletionItem[];
            
            expect(items).toBeDefined();
            expect(items.length).toBeGreaterThan(0);
            // Should match Assets accounts
            expect(items[0].label).toContain('Assets');
        });
        
        it('should not provide completions for non-posting lines', () => {
            mockDocument.lineAt.mockReturnValue({ text: 'account Assets:Bank' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(0, 19),
                mockToken,
                mockContext
            );
            
            expect(items).toBeUndefined();
        });
        
        it('should not provide completions for lines with amounts', () => {
            mockDocument.lineAt.mockReturnValue({ text: '  Assets:Bank  100.00' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(0, 21),
                mockToken,
                mockContext
            );
            
            expect(items).toBeUndefined();
        });
    });
    
    describe('account completions', () => {
        it('should return accounts sorted by usage for empty input', () => {
            mockDocument.lineAt.mockReturnValue({ text: '  ' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(0, 2),
                mockToken,
                mockContext
            ) as vscode.CompletionItem[];
            
            // Should be sorted by usage count
            expect(items[0].label).toBe('Assets:Bank:Checking'); // 10 uses
            expect(items[1].label).toBe('Expenses:Food'); // 8 uses
            expect(items[2].label).toBe('Income:Salary'); // 5 uses
        });
        
        it('should distinguish defined vs used accounts', () => {
            mockDocument.lineAt.mockReturnValue({ text: '  ' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(0, 2),
                mockToken,
                mockContext
            ) as vscode.CompletionItem[];
            
            // Find specific accounts
            const definedAccount = items.find(item => item.label === 'Assets:Bank:Checking');
            const usedAccount = items.find(item => item.label === 'Income:Salary');
            
            expect(definedAccount?.kind).toBe(vscode.CompletionItemKind.Class);
            expect(definedAccount?.detail).toContain('Defined account');
            
            expect(usedAccount?.kind).toBe(vscode.CompletionItemKind.Reference);
            expect(usedAccount?.detail).toContain('Used account');
        });
        
        it('should filter accounts based on typed text', () => {
            mockDocument.lineAt.mockReturnValue({ text: '  Exp' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(0, 5),
                mockToken,
                mockContext
            ) as vscode.CompletionItem[];
            
            // Should only include accounts matching 'Exp'
            items.forEach(item => {
                expect(item.label.toString().toLowerCase()).toContain('exp');
            });
            
            // Should include 'Expenses:Food'
            const labels = items.map(item => item.label.toString());
            expect(labels).toContain('Expenses:Food');
        });
        
        it('should handle hierarchical account matching', () => {
            mockDocument.lineAt.mockReturnValue({ text: '  Assets:B' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(0, 10),
                mockToken,
                mockContext
            ) as vscode.CompletionItem[];
            
            // Should match Assets:Bank:Checking
            const labels = items.map(item => item.label.toString());
            expect(labels).toContain('Assets:Bank:Checking');
        });
        
        it('should set proper range for replacements', () => {
            mockDocument.lineAt.mockReturnValue({ text: '  Ass' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(0, 5),
                mockToken,
                mockContext
            ) as vscode.CompletionItem[];
            
            items.forEach(item => {
                expect(item.range).toBeDefined();
                if (item.range && !(item.range instanceof Array)) {
                    if ('start' in item.range && 'end' in item.range) {
                        // It's a Range object
                        expect(item.range.start.line).toBe(0);
                        expect(item.range.start.character).toBe(2); // After spaces
                        expect(item.range.end.line).toBe(0);
                        expect(item.range.end.character).toBe(5);
                    } else {
                        // It's a { inserting: Range; replacing: Range } object
                        const rangeWithOptions = item.range as { inserting: vscode.Range; replacing: vscode.Range };
                        expect(rangeWithOptions.replacing.start.line).toBe(0);
                        expect(rangeWithOptions.replacing.start.character).toBe(2);
                        expect(rangeWithOptions.replacing.end.line).toBe(0);
                        expect(rangeWithOptions.replacing.end.character).toBe(5);
                    }
                }
            });
        });
        
        it('should include default account prefixes', () => {
            // Mock empty usage data
            mockConfig.getAccountsByUsage.mockReturnValue([]);
            
            mockDocument.lineAt.mockReturnValue({ text: '  ' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(0, 2),
                mockToken,
                mockContext
            ) as vscode.CompletionItem[];
            
            // Should include default prefixes
            const labels = items.map(item => item.label.toString());
            expect(labels).toContain('Assets');
            expect(labels).toContain('Liabilities');
            expect(labels).toContain('Equity');
            expect(labels).toContain('Income');
            expect(labels).toContain('Expenses');
            
            // Default prefixes should be marked as folders
            const assetsItem = items.find(item => item.label === 'Assets');
            expect(assetsItem?.kind).toBe(vscode.CompletionItemKind.Folder);
            expect(assetsItem?.detail).toBe('Default account prefix');
        });
    });
    
    describe('configuration', () => {
        it('should respect maxAccountResults configuration', () => {
            // Create many accounts
            const manyAccounts = Array.from({ length: 50 }, (_, i) => ({
                account: `Account${i}`,
                count: 50 - i
            }));
            mockConfig.getAccountsByUsage.mockReturnValue(manyAccounts);
            
            (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
                get: jest.fn((key: string, defaultValue?: any) => {
                    if (key === 'maxAccountResults') return 10;
                    return defaultValue;
                })
            });
            
            mockDocument.lineAt.mockReturnValue({ text: '  ' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(0, 2),
                mockToken,
                mockContext
            ) as vscode.CompletionItem[];
            
            expect(items.length).toBeLessThanOrEqual(10);
        });
    });
});