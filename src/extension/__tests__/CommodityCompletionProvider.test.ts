import * as vscode from 'vscode';
import { CommodityCompletionProvider } from '../completion/providers/CommodityCompletionProvider';

// Mock the main module
jest.mock('../main', () => ({
    getConfig: jest.fn()
}));

import { getConfig } from '../main';

describe('CommodityCompletionProvider', () => {
    let provider: CommodityCompletionProvider;
    let mockDocument: any;
    let mockPosition: any;
    let mockToken: any;
    let mockContext: any;
    let mockConfig: any;
    
    beforeEach(() => {
        provider = new CommodityCompletionProvider();
        
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
            getCommoditiesByUsage: jest.fn().mockReturnValue([
                { commodity: 'USD', count: 15 },
                { commodity: 'EUR', count: 10 },
                { commodity: 'BTC', count: 5 },
                { commodity: 'RUB', count: 3 }
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
        it('should provide completions after positive amounts', () => {
            mockDocument.lineAt.mockReturnValue({ text: '  Assets:Bank  100.00 ' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(0, 22),
                mockToken,
                mockContext
            ) as vscode.CompletionItem[];
            
            expect(items).toBeDefined();
            expect(items.length).toBeGreaterThan(0);
        });
        
        it('should provide completions after negative amounts', () => {
            mockDocument.lineAt.mockReturnValue({ text: '  Expenses:Food  -50.25 ' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(0, 24),
                mockToken,
                mockContext
            ) as vscode.CompletionItem[];
            
            expect(items).toBeDefined();
            expect(items.length).toBeGreaterThan(0);
        });
        
        it('should provide completions with partial commodity typed', () => {
            mockDocument.lineAt.mockReturnValue({ text: '  Assets:Bank  100 U' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(0, 20),
                mockToken,
                mockContext
            ) as vscode.CompletionItem[];
            
            expect(items).toBeDefined();
            expect(items.length).toBeGreaterThan(0);
            // Should match USD
            expect(items[0].label).toBe('USD');
        });
        
        it('should not provide completions without amount', () => {
            mockDocument.lineAt.mockReturnValue({ text: '  Assets:Bank  ' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(0, 15),
                mockToken,
                mockContext
            );
            
            expect(items).toBeUndefined();
        });
        
        it('should handle amounts with comma as decimal separator', () => {
            mockDocument.lineAt.mockReturnValue({ text: '  Assets:Bank  100,50 ' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(0, 22),
                mockToken,
                mockContext
            ) as vscode.CompletionItem[];
            
            expect(items).toBeDefined();
            expect(items.length).toBeGreaterThan(0);
        });
    });
    
    describe('commodity completions', () => {
        it('should return commodities sorted by usage for empty input', () => {
            mockDocument.lineAt.mockReturnValue({ text: '  Assets:Bank  100 ' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(0, 19),
                mockToken,
                mockContext
            ) as vscode.CompletionItem[];
            
            // Should be sorted by usage count
            expect(items[0].label).toBe('USD'); // 15 uses
            expect(items[1].label).toBe('EUR'); // 10 uses
            expect(items[2].label).toBe('BTC'); // 5 uses
            expect(items[3].label).toBe('RUB'); // 3 uses
        });
        
        it('should include detail about usage', () => {
            mockDocument.lineAt.mockReturnValue({ text: '  Assets:Bank  100 ' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(0, 19),
                mockToken,
                mockContext
            ) as vscode.CompletionItem[];
            
            const usdItem = items.find(item => item.label === 'USD');
            expect(usdItem?.detail).toBe('Configured commodity (used 15 times)');
        });
        
        it('should filter commodities based on typed text', () => {
            mockDocument.lineAt.mockReturnValue({ text: '  Assets:Bank  100 E' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(0, 20),
                mockToken,
                mockContext
            ) as vscode.CompletionItem[];
            
            // Should only include commodities containing 'E'
            const labels = items.map(item => item.label.toString());
            expect(labels).toContain('EUR');
            expect(labels).not.toContain('USD');
        });
        
        it('should handle case-insensitive matching', () => {
            mockDocument.lineAt.mockReturnValue({ text: '  Assets:Bank  100 bt' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(0, 21),
                mockToken,
                mockContext
            ) as vscode.CompletionItem[];
            
            // Should match BTC
            const labels = items.map(item => item.label.toString());
            expect(labels).toContain('BTC');
        });
        
        it('should include default commodities', () => {
            // Mock config without GBP
            mockConfig.getCommoditiesByUsage.mockReturnValue([
                { commodity: 'USD', count: 10 }
            ]);
            
            mockDocument.lineAt.mockReturnValue({ text: '  Assets:Bank  100 ' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(0, 19),
                mockToken,
                mockContext
            ) as vscode.CompletionItem[];
            
            // Should include default commodities
            const labels = items.map(item => item.label.toString());
            expect(labels).toContain('EUR'); // Default commodity
            expect(labels).toContain('GBP'); // Default commodity
            
            // Default commodities should have appropriate detail
            const eurItem = items.find(item => item.label === 'EUR');
            expect(eurItem?.detail).toBe('Default commodity');
        });
        
        it('should set proper range for replacements', () => {
            mockDocument.lineAt.mockReturnValue({ text: '  Assets:Bank  100 US' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(0, 21),
                mockToken,
                mockContext
            ) as vscode.CompletionItem[];
            
            items.forEach(item => {
                expect(item.range).toBeDefined();
                if (item.range && !(item.range instanceof Array)) {
                    if ('start' in item.range && 'end' in item.range) {
                        // It's a Range object
                        expect(item.range.start.line).toBe(0);
                        expect(item.range.start.character).toBe(19); // Start of 'US'
                        expect(item.range.end.line).toBe(0);
                        expect(item.range.end.character).toBe(21);
                    } else {
                        // It's a { inserting: Range; replacing: Range } object
                        const rangeWithOptions = item.range as { inserting: vscode.Range; replacing: vscode.Range };
                        expect(rangeWithOptions.replacing.start.line).toBe(0);
                        expect(rangeWithOptions.replacing.start.character).toBe(19);
                        expect(rangeWithOptions.replacing.end.line).toBe(0);
                        expect(rangeWithOptions.replacing.end.character).toBe(21);
                    }
                }
            });
        });
    });
    
    describe('configuration', () => {
        it('should respect maxResults configuration', () => {
            // Create many commodities
            const manyCommodities = Array.from({ length: 50 }, (_, i) => ({
                commodity: `COM${i}`,
                count: 50 - i
            }));
            mockConfig.getCommoditiesByUsage.mockReturnValue(manyCommodities);
            
            (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
                get: jest.fn((key: string, defaultValue?: any) => {
                    if (key === 'maxResults') return 10;
                    return defaultValue;
                })
            });
            
            mockDocument.lineAt.mockReturnValue({ text: '  Assets:Bank  100 ' });
            
            const items = provider.provideCompletionItems(
                mockDocument,
                mockPosition(0, 19),
                mockToken,
                mockContext
            ) as vscode.CompletionItem[];
            
            expect(items.length).toBeLessThanOrEqual(10);
        });
    });
});