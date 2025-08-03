import * as vscode from 'vscode';
import { TagCompletionProvider } from '../completion/providers/TagCompletionProvider';

// Mock the main module
jest.mock('../main', () => ({
    getConfig: jest.fn()
}));

import { getConfig } from '../main';

describe('TagCompletionProvider', () => {
    let provider: TagCompletionProvider;
    let mockDocument: any;
    let mockPosition: any;
    let mockToken: any;
    let mockContext: any;
    let mockConfig: any;
    
    beforeEach(() => {
        provider = new TagCompletionProvider();
        
        // Reset mocks
        jest.clearAllMocks();
        
        // Mock document with sample journal content
        const journalContent = `
2025-01-01 Opening balances
  Assets:Bank  1000.00 USD
  Equity:Opening

2025-01-15 Grocery shopping ; category:food project:home
  Expenses:Food  50.00 USD
  Assets:Bank

2025-01-20 Coffee ; category:dining location:downtown
  Expenses:Dining  5.00 USD
  Assets:Bank
  
2025-01-25 Gas station ; category:transport
  Expenses:Auto  40.00 USD
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
            getTagsByUsage: jest.fn().mockReturnValue([
                { tag: 'category', count: 8 },
                { tag: 'project', count: 5 },
                { tag: 'location', count: 3 },
                { tag: 'vendor', count: 2 }
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
        it('should provide completions after semicolon', () => {
            mockDocument.lineAt.mockReturnValue({ text: '  Expenses:Food  50.00 USD ; ' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(0, 30),
                mockToken,
                mockContext
            ) as vscode.CompletionItem[];
            
            expect(items).toBeDefined();
            expect(items.length).toBeGreaterThan(0);
        });
        
        it('should provide completions after semicolon and tag prefix', () => {
            mockDocument.lineAt.mockReturnValue({ text: '  Expenses:Food  50.00 USD ; cat' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(0, 33),
                mockToken,
                mockContext
            ) as vscode.CompletionItem[];
            
            expect(items).toBeDefined();
            expect(items.length).toBeGreaterThan(0);
            // Should match category
            expect(items[0].label).toBe('category');
        });
        
        it('should provide completions with hash format', () => {
            mockDocument.lineAt.mockReturnValue({ text: '  Expenses:Food  50.00 USD ; #ca' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(0, 33),
                mockToken,
                mockContext
            ) as vscode.CompletionItem[];
            
            expect(items).toBeDefined();
            expect(items.length).toBeGreaterThan(0);
            // Should match category
            expect(items[0].label).toBe('category');
        });
        
        it('should not provide completions without semicolon', () => {
            mockDocument.lineAt.mockReturnValue({ text: '  Expenses:Food  50.00 USD' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(0, 26),
                mockToken,
                mockContext
            );
            
            expect(items).toBeUndefined();
        });
        
        it('should provide completions for tags with Cyrillic characters', () => {
            mockConfig.getTagsByUsage.mockReturnValue([
                { tag: 'категория', count: 5 },
                { tag: 'проект', count: 3 }
            ]);
            
            mockDocument.lineAt.mockReturnValue({ text: '  Expenses:Food  50.00 USD ; кат' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(0, 33),
                mockToken,
                mockContext
            ) as vscode.CompletionItem[];
            
            expect(items).toBeDefined();
            expect(items.length).toBeGreaterThan(0);
            expect(items[0].label).toBe('категория');
        });
    });
    
    describe('tag completions', () => {
        it('should return tags sorted by usage for empty input', () => {
            mockDocument.lineAt.mockReturnValue({ text: '  Expenses:Food  50.00 USD ; ' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(0, 30),
                mockToken,
                mockContext
            ) as vscode.CompletionItem[];
            
            // Should be sorted by usage count
            expect(items[0].label).toBe('category'); // 8 uses
            expect(items[1].label).toBe('project');  // 5 uses
            expect(items[2].label).toBe('location'); // 3 uses
            expect(items[3].label).toBe('vendor');   // 2 uses
        });
        
        it('should include usage count in detail', () => {
            mockDocument.lineAt.mockReturnValue({ text: '  Expenses:Food  50.00 USD ; ' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(0, 30),
                mockToken,
                mockContext
            ) as vscode.CompletionItem[];
            
            const categoryItem = items.find(item => item.label === 'category');
            expect(categoryItem?.detail).toBe('Tag/Category (used 8 times)');
        });
        
        it('should filter tags based on typed text', () => {
            mockDocument.lineAt.mockReturnValue({ text: '  Expenses:Food  50.00 USD ; pro' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(0, 33),
                mockToken,
                mockContext
            ) as vscode.CompletionItem[];
            
            // Should match project
            const labels = items.map(item => item.label.toString());
            expect(labels).toContain('project');
            expect(labels).not.toContain('vendor');
        });
        
        it('should handle case-insensitive matching', () => {
            mockDocument.lineAt.mockReturnValue({ text: '  Expenses:Food  50.00 USD ; CAT' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(0, 33),
                mockToken,
                mockContext
            ) as vscode.CompletionItem[];
            
            // Should match category
            expect(items[0].label).toBe('category');
        });
        
        it('should append colon to insert text', () => {
            mockDocument.lineAt.mockReturnValue({ text: '  Expenses:Food  50.00 USD ; cat' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(0, 33),
                mockToken,
                mockContext
            ) as vscode.CompletionItem[];
            
            const categoryItem = items.find(item => item.label === 'category');
            expect(categoryItem?.insertText).toBe('category:');
        });
        
        it('should set proper range for replacements', () => {
            mockDocument.lineAt.mockReturnValue({ text: '  Expenses:Food  50.00 USD ; cat' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(0, 33),
                mockToken,
                mockContext
            ) as vscode.CompletionItem[];
            
            items.forEach(item => {
                expect(item.range).toBeDefined();
                if (item.range && !(item.range instanceof Array)) {
                    if ('start' in item.range && 'end' in item.range) {
                        // It's a Range object
                        expect(item.range.start.line).toBe(0);
                        expect(item.range.start.character).toBe(30); // Start of 'cat'
                        expect(item.range.end.line).toBe(0);
                        expect(item.range.end.character).toBe(33);
                    } else {
                        // It's a { inserting: Range; replacing: Range } object
                        const rangeWithOptions = item.range as { inserting: vscode.Range; replacing: vscode.Range };
                        expect(rangeWithOptions.replacing.start.line).toBe(0);
                        expect(rangeWithOptions.replacing.start.character).toBe(30);
                        expect(rangeWithOptions.replacing.end.line).toBe(0);
                        expect(rangeWithOptions.replacing.end.character).toBe(33);
                    }
                }
            });
        });
        
        it('should handle no tags in config', () => {
            mockConfig.getTagsByUsage.mockReturnValue([]);
            
            mockDocument.lineAt.mockReturnValue({ text: '  Expenses:Food  50.00 USD ; ' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(0, 30),
                mockToken,
                mockContext
            );
            
            expect(items).toBeUndefined();
        });
    });
    
    describe('configuration', () => {
        it('should respect maxResults configuration', () => {
            // Create many tags
            const manyTags = Array.from({ length: 50 }, (_, i) => ({
                tag: `tag${i}`,
                count: 50 - i
            }));
            mockConfig.getTagsByUsage.mockReturnValue(manyTags);
            
            (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
                get: jest.fn((key: string, defaultValue?: any) => {
                    if (key === 'maxResults') return 10;
                    return defaultValue;
                })
            });
            
            mockDocument.lineAt.mockReturnValue({ text: '  Expenses:Food  50.00 USD ; ' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(0, 30),
                mockToken,
                mockContext
            ) as vscode.CompletionItem[];
            
            expect(items.length).toBeLessThanOrEqual(10);
        });
    });
});