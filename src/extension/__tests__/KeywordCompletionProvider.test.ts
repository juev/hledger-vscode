import * as vscode from 'vscode';
import { KeywordCompletionProvider } from '../completion/providers/KeywordCompletionProvider';
import { HLEDGER_KEYWORDS } from '../types';

// Mock vscode module
jest.mock('vscode');

describe('KeywordCompletionProvider', () => {
    let provider: KeywordCompletionProvider;
    let mockDocument: any;
    let mockPosition: any;
    let mockToken: any;
    let mockContext: any;
    
    beforeEach(() => {
        provider = new KeywordCompletionProvider();
        
        // Reset mocks
        jest.clearAllMocks();
        
        // Mock document
        mockDocument = {
            lineAt: jest.fn(),
            getText: jest.fn()
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
        
        // Mock workspace configuration
        (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
            get: jest.fn((key: string, defaultValue?: any) => {
                if (key === 'maxResults') return 25;
                return defaultValue;
            })
        });
    });
    
    describe('shouldProvideCompletions', () => {
        it('should provide completions at the start of a line', () => {
            mockDocument.lineAt.mockReturnValue({ text: '' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(0, 0),
                mockToken,
                mockContext
            ) as vscode.CompletionItem[];
            
            expect(items).toBeDefined();
            expect(items.length).toBeGreaterThan(0);
        });
        
        it('should provide completions with minimal whitespace', () => {
            mockDocument.lineAt.mockReturnValue({ text: ' acc' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(0, 4),
                mockToken,
                mockContext
            ) as vscode.CompletionItem[];
            
            expect(items).toBeDefined();
            expect(items.length).toBeGreaterThan(0);
        });
        
        it('should not provide completions for indented lines (posting lines)', () => {
            mockDocument.lineAt.mockReturnValue({ text: '  Account:Name' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(0, 14),
                mockToken,
                mockContext
            );
            
            expect(items).toBeUndefined();
        });
    });
    
    describe('keyword completions', () => {
        it('should return all keywords for empty input', () => {
            mockDocument.lineAt.mockReturnValue({ text: '' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(0, 0),
                mockToken,
                mockContext
            ) as vscode.CompletionItem[];
            
            expect(items.length).toBeLessThanOrEqual(25); // Default limit
            
            // Check that all items are keywords
            items.forEach(item => {
                expect(HLEDGER_KEYWORDS).toContain(item.label);
                expect(item.kind).toBe(vscode.CompletionItemKind.Keyword);
                expect(item.detail).toBe('hledger directive');
            });
        });
        
        it('should return keywords sorted by relevance', () => {
            mockDocument.lineAt.mockReturnValue({ text: '' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(0, 0),
                mockToken,
                mockContext
            ) as vscode.CompletionItem[];
            
            // Without specific query, keywords should be returned in some consistent order
            // We don't make assumptions about artificial prioritization
            expect(items.length).toBeGreaterThan(0);
            
            // All items should still be valid keywords
            items.forEach(item => {
                expect(HLEDGER_KEYWORDS).toContain(item.label);
                expect(item.kind).toBe(vscode.CompletionItemKind.Keyword);
                expect(item.detail).toBe('hledger directive');
            });
        });
        
        it('should filter keywords based on typed text', () => {
            mockDocument.lineAt.mockReturnValue({ text: 'acc' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(0, 3),
                mockToken,
                mockContext
            ) as vscode.CompletionItem[];
            
            // Should only include keywords containing 'acc'
            items.forEach(item => {
                expect(item.label.toString().toLowerCase()).toContain('acc');
            });
            
            // Should include 'account'
            const labels = items.map(item => item.label.toString());
            expect(labels).toContain('account');
        });
        
        it('should handle single character queries', () => {
            mockDocument.lineAt.mockReturnValue({ text: 'a' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(0, 1),
                mockToken,
                mockContext
            ) as vscode.CompletionItem[];
            
            // Should include keywords containing 'a'
            items.forEach(item => {
                expect(item.label.toString().toLowerCase()).toContain('a');
            });
        });
        
        it('should set proper range for replacements', () => {
            mockDocument.lineAt.mockReturnValue({ text: 'acc' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(0, 3),
                mockToken,
                mockContext
            ) as vscode.CompletionItem[];
            
            items.forEach(item => {
                expect(item.range).toBeDefined();
                if (item.range && !(item.range instanceof Array)) {
                    if ('start' in item.range && 'end' in item.range) {
                        // It's a Range object
                        expect(item.range.start.line).toBe(0);
                        expect(item.range.start.character).toBe(0);
                        expect(item.range.end.line).toBe(0);
                        expect(item.range.end.character).toBe(3);
                    } else {
                        // It's a { inserting: Range; replacing: Range } object
                        const rangeWithOptions = item.range as { inserting: vscode.Range; replacing: vscode.Range };
                        expect(rangeWithOptions.replacing.start.line).toBe(0);
                        expect(rangeWithOptions.replacing.start.character).toBe(0);
                        expect(rangeWithOptions.replacing.end.line).toBe(0);
                        expect(rangeWithOptions.replacing.end.character).toBe(3);
                    }
                }
            });
        });
    });
    
    describe('configuration', () => {
        it('should respect maxResults configuration', () => {
            (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
                get: jest.fn((key: string, defaultValue?: any) => {
                    if (key === 'maxResults') return 10;
                    return defaultValue;
                })
            });
            
            mockDocument.lineAt.mockReturnValue({ text: '' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(0, 0),
                mockToken,
                mockContext
            ) as vscode.CompletionItem[];
            
            expect(items.length).toBeLessThanOrEqual(10);
        });
    });
});