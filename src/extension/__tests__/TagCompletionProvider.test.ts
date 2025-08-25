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
                { tag: 'Event', count: 4 },
                { tag: 'location', count: 3 },
                { tag: 'vendor', count: 2 },
                { tag: 'Status', count: 2 }
            ]),
            getTagValuesByLastUsed: jest.fn().mockImplementation((tagName: string) => {
                if (tagName === 'Event') {
                    return [
                        { value: '2025-02-freiburg', count: 2 },
                        { value: '2025-03-berlin', count: 1 }
                    ];
                } else if (tagName === 'Subscription') {
                    return [
                        { value: 'monthly', count: 3 },
                        { value: 'yearly', count: 1 }
                    ];
                } else if (tagName === 'Status') {
                    return [
                        { value: 'confirmed', count: 2 },
                        { value: 'pending', count: 1 }
                    ];
                }
                return [];
            })
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
        
        it('should provide completions for tags in middle of comments', () => {
            mockDocument.lineAt.mockReturnValue({ text: '  Expenses:Food  50.00 USD ; some comment Event' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(0, 47),
                mockToken,
                mockContext
            ) as vscode.CompletionItem[];
            
            expect(items).toBeDefined();
            expect(items.length).toBeGreaterThan(0);
            expect(items[0].label).toBe('Event');
        });
        
        it('should provide tag value completions for tags in middle of comments', () => {
            mockDocument.lineAt.mockReturnValue({ text: '  Expenses:Food  50.00 USD ; some comment Event: ' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(0, 49),
                mockToken,
                mockContext
            ) as vscode.CompletionItem[];
            
            expect(items).toBeDefined();
            expect(items.length).toBe(2);
            expect(items[0].label).toBe('2025-02-freiburg');
            expect(items[1].label).toBe('2025-03-berlin');
        });
        
        it('should handle multiple tags in same comment', () => {
            mockDocument.lineAt.mockReturnValue({ text: '  Expenses:Food ; Status: confirmed Event: ' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(0, 42),
                mockToken,
                mockContext
            ) as vscode.CompletionItem[];
            
            expect(items).toBeDefined();
            expect(items.length).toBe(2);
            expect(items[0].label).toBe('2025-02-freiburg');
            expect(items[1].label).toBe('2025-03-berlin');
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
            expect(items[2].label).toBe('Event');    // 4 uses
            expect(items[3].label).toBe('location'); // 3 uses
            expect(items[4].label).toBe('vendor');   // 2 uses
            expect(items[5].label).toBe('Status');   // 2 uses
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
            expect(categoryItem?.insertText).toBe('category: ');
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
    
    describe('tag value completions', () => {
        it('should provide tag values when completing after colon', () => {
            mockDocument.lineAt.mockReturnValue({ text: '  Expenses:Travel ; Event: ' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(0, 26),
                mockToken,
                mockContext
            ) as vscode.CompletionItem[];
            
            expect(items).toBeDefined();
            expect(items.length).toBe(2);
            expect(items[0].label).toBe('2025-02-freiburg'); // Most used
            expect(items[1].label).toBe('2025-03-berlin');
        });
        
        it('should filter tag values based on typed text', () => {
            mockDocument.lineAt.mockReturnValue({ text: '  Expenses:Travel ; Event: freiburg' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(0, 31),
                mockToken,
                mockContext
            ) as vscode.CompletionItem[];
            
            expect(items).toBeDefined();
            if (items) {
                expect(items.length).toBeGreaterThan(0);
                const labels = items.map(item => item.label.toString());
                expect(labels).toContain('2025-02-freiburg');
                expect(labels).not.toContain('2025-03-berlin');
            }
        });
        
        it('should provide subscription tag values', () => {
            mockDocument.lineAt.mockReturnValue({ text: '  Expenses:Software ; Subscription: ' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(0, 35),
                mockToken,
                mockContext
            ) as vscode.CompletionItem[];
            
            expect(items).toBeDefined();
            expect(items.length).toBe(2);
            expect(items[0].label).toBe('monthly'); // Most used (count: 3)
            expect(items[1].label).toBe('yearly');  // Less used (count: 1)
        });
        
        it('should set correct item kind for tag values', () => {
            mockDocument.lineAt.mockReturnValue({ text: '  Expenses:Travel ; Event: ' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(0, 26),
                mockToken,
                mockContext
            ) as vscode.CompletionItem[];
            
            expect(items).toBeDefined();
            expect(items.length).toBeGreaterThan(0);
            items.forEach(item => {
                expect(item.kind).toBe(vscode.CompletionItemKind.Value);
            });
        });
        
        it('should include usage count in tag value detail', () => {
            mockDocument.lineAt.mockReturnValue({ text: '  Expenses:Travel ; Event: ' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(0, 26),
                mockToken,
                mockContext
            ) as vscode.CompletionItem[];
            
            const freiburgItem = items.find(item => item.label === '2025-02-freiburg');
            expect(freiburgItem?.detail).toBe('Event value (used 2 times)');
            
            const berlinItem = items.find(item => item.label === '2025-03-berlin');
            expect(berlinItem?.detail).toBe('Event value (used 1 times)');
        });
        
        it('should handle no tag values for unknown tag', () => {
            mockDocument.lineAt.mockReturnValue({ text: '  Expenses:Travel ; UnknownTag: ' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(0, 31),
                mockToken,
                mockContext
            );
            
            expect(items).toBeUndefined();
        });
        
        it('should not insert colon for tag values', () => {
            mockDocument.lineAt.mockReturnValue({ text: '  Expenses:Travel ; Event: ' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(0, 26),
                mockToken,
                mockContext
            ) as vscode.CompletionItem[];
            
            expect(items).toBeDefined();
            items.forEach(item => {
                expect(item.insertText).toBe(item.label);
                expect(item.insertText).not.toContain(':');
            });
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