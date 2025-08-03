import * as vscode from 'vscode';
import { PayeeCompletionProvider } from '../completion/providers/PayeeCompletionProvider';

// Mock the main module
jest.mock('../main', () => ({
    getConfig: jest.fn()
}));

import { getConfig } from '../main';

describe('PayeeCompletionProvider', () => {
    let provider: PayeeCompletionProvider;
    let mockDocument: any;
    let mockPosition: any;
    let mockToken: any;
    let mockContext: any;
    let mockConfig: any;
    
    beforeEach(() => {
        provider = new PayeeCompletionProvider();
        
        // Reset mocks
        jest.clearAllMocks();
        
        // Mock document with sample journal content
        const journalContent = `
2025-01-01 Opening balances
  Assets:Bank  1000.00 USD
  Equity:Opening

2025-01-15 Grocery Store
  Expenses:Food  50.00 USD
  Assets:Bank

2025-01-20 Coffee Shop
  Expenses:Dining  5.00 USD
  Assets:Bank
  
2025-01-25 Grocery Store
  Expenses:Food  75.00 USD
  Assets:Bank
`;
        
        mockDocument = {
            lineAt: jest.fn((lineNumber: number) => {
                const lines = journalContent.split('\n');
                return { text: lines[lineNumber] || '' };
            }),
            getText: jest.fn().mockReturnValue(journalContent),
            lineCount: journalContent.split('\n').length,
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
            getPayeesByUsage: jest.fn().mockReturnValue([
                { payee: 'Grocery Store', count: 5 },
                { payee: 'Coffee Shop', count: 3 },
                { payee: 'Restaurant', count: 2 },
                { payee: 'Gas Station', count: 1 }
            ])
        };
        
        (getConfig as jest.Mock).mockReturnValue(mockConfig);
        
        // Mock workspace configuration
        (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
            get: jest.fn((key: string, defaultValue?: any) => {
                if (key === 'maxResults') return 25;
                return defaultValue;
            })
        });
    });
    
    describe('shouldProvideCompletions', () => {
        it('should provide completions after date', () => {
            mockDocument.lineAt.mockReturnValue({ text: '2025-01-01 ' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(0, 11),
                mockToken,
                mockContext
            ) as vscode.CompletionItem[];
            
            expect(items).toBeDefined();
            expect(items.length).toBeGreaterThan(0);
        });
        
        it('should provide completions after date and status', () => {
            mockDocument.lineAt.mockReturnValue({ text: '2025-01-01 * ' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(0, 13),
                mockToken,
                mockContext
            ) as vscode.CompletionItem[];
            
            expect(items).toBeDefined();
            expect(items.length).toBeGreaterThan(0);
        });
        
        it('should provide completions after date, status and code', () => {
            mockDocument.lineAt.mockReturnValue({ text: '2025-01-01 * (123) ' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(0, 19),
                mockToken,
                mockContext
            ) as vscode.CompletionItem[];
            
            expect(items).toBeDefined();
            expect(items.length).toBeGreaterThan(0);
        });
        
        it('should provide completions with partial payee typed', () => {
            mockDocument.lineAt.mockReturnValue({ text: '2025-01-01 Groc' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(0, 15),
                mockToken,
                mockContext
            ) as vscode.CompletionItem[];
            
            expect(items).toBeDefined();
            expect(items.length).toBeGreaterThan(0);
            // Should match Grocery Store
            expect(items[0].label).toBe('Grocery Store');
        });
        
        it('should not provide completions without date', () => {
            mockDocument.lineAt.mockReturnValue({ text: '  Assets:Bank  100.00 USD' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(0, 25),
                mockToken,
                mockContext
            );
            
            expect(items).toBeUndefined();
        });
        
        it('should support various date formats', () => {
            // Test different date formats
            const dateFormats = [
                '2025-01-01 ',
                '2025/01/01 ',
                '2025.01.01 ',
                '01-01 ',
                '01/01 ',
                '01.01 '
            ];
            
            dateFormats.forEach(format => {
                mockDocument.lineAt.mockReturnValue({ text: format });
                
                const items = provider.provideCompletionItems(
                    mockDocument,
                    mockPosition(0, format.length),
                    mockToken,
                    mockContext
                ) as vscode.CompletionItem[];
                
                expect(items).toBeDefined();
                expect(items.length).toBeGreaterThan(0);
            });
        });
    });
    
    describe('payee completions', () => {
        it('should return payees sorted by usage for empty input', () => {
            mockDocument.lineAt.mockReturnValue({ text: '2025-01-01 ' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(0, 11),
                mockToken,
                mockContext
            ) as vscode.CompletionItem[];
            
            // Should be sorted by usage count
            expect(items[0].label).toBe('Grocery Store'); // 5 uses
            expect(items[1].label).toBe('Coffee Shop');   // 3 uses
            expect(items[2].label).toBe('Restaurant');    // 2 uses
            expect(items[3].label).toBe('Gas Station');   // 1 use
        });
        
        it('should include usage count in detail', () => {
            mockDocument.lineAt.mockReturnValue({ text: '2025-01-01 ' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(0, 11),
                mockToken,
                mockContext
            ) as vscode.CompletionItem[];
            
            const groceryItem = items.find(item => item.label === 'Grocery Store');
            expect(groceryItem?.detail).toBe('Payee/Store (used 5 times)');
        });
        
        it('should filter payees based on typed text', () => {
            mockDocument.lineAt.mockReturnValue({ text: '2025-01-01 Cof' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(0, 14),
                mockToken,
                mockContext
            ) as vscode.CompletionItem[];
            
            // Should match Coffee Shop
            const labels = items.map(item => item.label.toString());
            expect(labels).toContain('Coffee Shop');
            expect(labels).not.toContain('Gas Station');
        });
        
        it('should handle case-insensitive matching', () => {
            mockDocument.lineAt.mockReturnValue({ text: '2025-01-01 groc' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(0, 15),
                mockToken,
                mockContext
            ) as vscode.CompletionItem[];
            
            // Should match Grocery Store
            expect(items[0].label).toBe('Grocery Store');
        });
        
        it('should set proper range for replacements', () => {
            mockDocument.lineAt.mockReturnValue({ text: '2025-01-01 Groc' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(0, 15),
                mockToken,
                mockContext
            ) as vscode.CompletionItem[];
            
            items.forEach(item => {
                expect(item.range).toBeDefined();
                if (item.range && !(item.range instanceof Array)) {
                    if ('start' in item.range && 'end' in item.range) {
                        // It's a Range object
                        expect(item.range.start.line).toBe(0);
                        expect(item.range.start.character).toBe(11); // Start of 'Groc'
                        expect(item.range.end.line).toBe(0);
                        expect(item.range.end.character).toBe(15);
                    } else {
                        // It's a { inserting: Range; replacing: Range } object
                        const rangeWithOptions = item.range as { inserting: vscode.Range; replacing: vscode.Range };
                        expect(rangeWithOptions.replacing.start.line).toBe(0);
                        expect(rangeWithOptions.replacing.start.character).toBe(11);
                        expect(rangeWithOptions.replacing.end.line).toBe(0);
                        expect(rangeWithOptions.replacing.end.character).toBe(15);
                    }
                }
            });
        });
        
        it('should handle no payees in config', () => {
            mockConfig.getPayeesByUsage.mockReturnValue([]);
            
            mockDocument.lineAt.mockReturnValue({ text: '2025-01-01 ' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(0, 11),
                mockToken,
                mockContext
            );
            
            expect(items).toBeUndefined();
        });
    });
    
    describe('configuration', () => {
        it('should respect maxResults configuration', () => {
            // Create many payees
            const manyPayees = Array.from({ length: 50 }, (_, i) => ({
                payee: `Store ${i}`,
                count: 50 - i
            }));
            mockConfig.getPayeesByUsage.mockReturnValue(manyPayees);
            
            (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
                get: jest.fn((key: string, defaultValue?: any) => {
                    if (key === 'maxResults') return 10;
                    return defaultValue;
                })
            });
            
            mockDocument.lineAt.mockReturnValue({ text: '2025-01-01 ' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(0, 11),
                mockToken,
                mockContext
            ) as vscode.CompletionItem[];
            
            expect(items.length).toBeLessThanOrEqual(10);
        });
    });
});