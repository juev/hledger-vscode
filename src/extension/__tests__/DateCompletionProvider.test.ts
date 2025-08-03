import * as vscode from 'vscode';
import { DateCompletionProvider } from '../completion/providers/DateCompletionProvider';

describe('DateCompletionProvider', () => {
    let provider: DateCompletionProvider;
    let mockDocument: any;
    let mockPosition: any;
    let mockToken: any;
    let mockContext: any;
    
    beforeEach(() => {
        provider = new DateCompletionProvider();
        
        // Reset mocks
        jest.clearAllMocks();
        
        // Mock document with sample journal content
        const journalContent = `
2025-01-01 Opening balances
  Assets:Bank  1000.00 USD
  Equity:Opening

2025-01-15 Grocery shopping  
  Expenses:Food  50.00 USD
  Assets:Bank

2025-01-20 Salary
  Assets:Bank  3000.00 USD
  Income:Salary
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
        
        // Mock workspace configuration
        (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
            get: jest.fn((key: string, defaultValue?: any) => {
                if (key === 'maxResults') return 25;
                return defaultValue;
            })
        });
    });
    
    describe('shouldProvideCompletions', () => {
        it('should provide completions on empty lines', () => {
            mockDocument.lineAt.mockReturnValueOnce({ text: '' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(12, 0),
                mockToken,
                mockContext
            ) as vscode.CompletionItem[];
            
            expect(items).toBeDefined();
            expect(items.length).toBeGreaterThan(0);
        });
        
        it('should provide completions for partial dates', () => {
            mockDocument.lineAt.mockReturnValueOnce({ text: '2025' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(12, 4),
                mockToken,
                mockContext
            ) as vscode.CompletionItem[];
            
            expect(items).toBeDefined();
            expect(items.length).toBeGreaterThan(0);
            // Should only include dates starting with 2025
            items.forEach(item => {
                expect(item.label.toString()).toMatch(/^2025/);
            });
        });
        
        it('should not provide completions on non-date lines', () => {
            mockDocument.lineAt.mockReturnValueOnce({ text: '  Assets:Bank  100.00 USD' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(12, 25),
                mockToken,
                mockContext
            );
            
            expect(items).toBeUndefined();
        });
    });
    
    describe('date completions', () => {
        it('should prioritize last transaction date', () => {
            mockDocument.lineAt.mockReturnValueOnce({ text: '' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(12, 0),
                mockToken,
                mockContext
            ) as vscode.CompletionItem[];
            
            // First item should be the last transaction date (2025-01-20)
            expect(items[0].label).toBe('2025-01-20');
            expect(items[0].detail).toBe('Last transaction date');
            expect(items[0].preselect).toBe(true);
        });
        
        it("should include today's date", () => {
            mockDocument.lineAt.mockReturnValueOnce({ text: '' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(12, 0),
                mockToken,
                mockContext
            ) as vscode.CompletionItem[];
            
            const today = new Date().toISOString().split('T')[0];
            const todayItem = items.find(item => item.label === today);
            
            expect(todayItem).toBeDefined();
            expect(todayItem?.detail).toBe("Today's date");
        });
        
        it("should include yesterday's date", () => {
            mockDocument.lineAt.mockReturnValueOnce({ text: '' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(12, 0),
                mockToken,
                mockContext
            ) as vscode.CompletionItem[];
            
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];
            
            const yesterdayItem = items.find(item => item.label === yesterdayStr);
            
            expect(yesterdayItem).toBeDefined();
            expect(yesterdayItem?.detail).toBe("Yesterday's date");
        });
        
        it('should include previous dates from document', () => {
            mockDocument.lineAt.mockReturnValueOnce({ text: '' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(12, 0),
                mockToken,
                mockContext
            ) as vscode.CompletionItem[];
            
            // Should include all previous dates
            const labels = items.map(item => item.label.toString());
            expect(labels).toContain('2025-01-01');
            expect(labels).toContain('2025-01-15');
            expect(labels).toContain('2025-01-20');
        });
        
        it('should include space after date insertion', () => {
            mockDocument.lineAt.mockReturnValueOnce({ text: '' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(12, 0),
                mockToken,
                mockContext
            ) as vscode.CompletionItem[];
            
            items.forEach(item => {
                expect(item.insertText).toMatch(/ $/); // Should end with space
            });
        });
        
        it('should filter dates based on typed text', () => {
            mockDocument.lineAt.mockReturnValueOnce({ text: '2025-01-1' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(12, 9),
                mockToken,
                mockContext
            ) as vscode.CompletionItem[];
            
            // FuzzyMatcher will include dates containing the pattern, not just starting with it
            // So 2025-01-20 might be included because it contains "2025-01-1"
            const labels = items.map(item => item.label.toString());
            expect(labels).toContain('2025-01-15');
            // 2025-01-01 should also be included if it exists
            const matchingDates = labels.filter(label => label.includes('2025-01-1'));
            expect(matchingDates.length).toBeGreaterThan(0);
        });
        
        it('should set proper range for replacements', () => {
            // For this test, we want a line that starts with a partial date
            mockDocument.lineAt.mockReturnValue({ text: '2025' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(12, 4),
                mockToken,
                mockContext
            ) as vscode.CompletionItem[];
            
            // Should have at least one item
            expect(items.length).toBeGreaterThan(0);
            
            // Check at least one item has a range set
            const itemsWithRange = items.filter(item => item.range !== undefined);
            expect(itemsWithRange.length).toBeGreaterThan(0);
            
            // Check the first item with a range
            const firstItemWithRange = itemsWithRange[0];
            if (firstItemWithRange.range && !(firstItemWithRange.range instanceof Array)) {
                if ('start' in firstItemWithRange.range && 'end' in firstItemWithRange.range) {
                    // It's a Range object
                    expect(firstItemWithRange.range.start.line).toBe(12);
                    expect(firstItemWithRange.range.start.character).toBe(0);
                    expect(firstItemWithRange.range.end.line).toBe(12);
                    expect(firstItemWithRange.range.end.character).toBe(4);
                } else {
                    // It's a { inserting: Range; replacing: Range } object
                    const rangeWithOptions = firstItemWithRange.range as { inserting: vscode.Range; replacing: vscode.Range };
                    expect(rangeWithOptions.replacing.start.line).toBe(12);
                    expect(rangeWithOptions.replacing.start.character).toBe(0);
                    expect(rangeWithOptions.replacing.end.line).toBe(12);
                    expect(rangeWithOptions.replacing.end.character).toBe(4);
                }
            }
        });
    });
    
    describe('configuration', () => {
        it('should respect maxResults configuration', () => {
            // Create a document with many dates
            let manyDatesContent = '';
            for (let i = 1; i <= 50; i++) {
                manyDatesContent += `2025-01-${i.toString().padStart(2, '0')} Transaction ${i}\n`;
                manyDatesContent += `  Assets:Bank  100.00 USD\n  Expenses:Other\n\n`;
            }
            
            mockDocument.lineAt = jest.fn((lineNumber: number) => {
                const lines = manyDatesContent.split('\n');
                return { text: lines[lineNumber] || '' };
            });
            mockDocument.lineCount = manyDatesContent.split('\n').length;
            
            (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
                get: jest.fn((key: string, defaultValue?: any) => {
                    if (key === 'maxResults') return 10;
                    return defaultValue;
                })
            });
            
            mockDocument.lineAt.mockReturnValueOnce({ text: '' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(200, 0),
                mockToken,
                mockContext
            ) as vscode.CompletionItem[];
            
            expect(items.length).toBeLessThanOrEqual(10);
        });
    });
});