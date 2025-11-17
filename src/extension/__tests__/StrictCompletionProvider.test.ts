// StrictCompletionProvider.test.ts - Integration tests for strict completion provider
import * as vscode from 'vscode';
import { StrictCompletionProvider } from '../StrictCompletionProvider';
import { HLedgerConfig } from '../HLedgerConfig';
import { HLedgerParser } from '../HLedgerParser';
import { SimpleProjectCache } from '../SimpleProjectCache';

// Import MockTextDocument from the mock
const { MockTextDocument } = vscode as any;

describe('StrictCompletionProvider Integration', () => {
    let provider: StrictCompletionProvider;
    let config: HLedgerConfig;

    beforeEach(() => {
        const parser = new HLedgerParser();
        const cache = new SimpleProjectCache();
        config = new HLedgerConfig(parser, cache);
        provider = new StrictCompletionProvider(config);
    });

    const mockCompletionContext: vscode.CompletionContext = {
        triggerKind: vscode.CompletionTriggerKind.Invoke,
        triggerCharacter: undefined
    };

    const mockCancellationToken: vscode.CancellationToken = {
        isCancellationRequested: false,
        onCancellationRequested: () => new vscode.Disposable(() => {})
    };

    describe('Date completions', () => {
        it('should provide date completions at line beginning', () => {
            const document = new MockTextDocument(['2024']);
            const position = new vscode.Position(0, 4);

            const completions = provider.provideCompletionItems(
                document, 
                position, 
                mockCancellationToken, 
                mockCompletionContext
            );

            expect(completions).toBeDefined();
            expect(Array.isArray(completions)).toBe(true);
            expect(completions.length).toBeGreaterThan(0);
            
            // Should contain date-related completions
            const hasDateCompletions = completions.some(item => 
                item.kind === vscode.CompletionItemKind.Constant
            );
            expect(hasDateCompletions).toBe(true);
        });

        it('should provide date completions for zero at line start', () => {
            const document = new MockTextDocument(['0']);
            const position = new vscode.Position(0, 1);

            const completions = provider.provideCompletionItems(
                document, 
                position, 
                mockCancellationToken, 
                mockCompletionContext
            );

            expect(completions).toBeDefined();
            expect(completions.length).toBeGreaterThan(0);
        });

        it('should not provide date completions in middle of line', () => {
            const document = new MockTextDocument(['  2024']);
            const position = new vscode.Position(0, 6);

            const completions = provider.provideCompletionItems(
                document, 
                position, 
                mockCancellationToken, 
                mockCompletionContext
            );

            expect(completions.length).toBe(0);
        });
    });

    describe('Account completions', () => {
        it('should provide account completions on indented lines', () => {
            const document = new MockTextDocument(['  Assets']);
            const position = new vscode.Position(0, 8);

            const completions = provider.provideCompletionItems(
                document, 
                position, 
                mockCancellationToken, 
                mockCompletionContext
            );

            expect(completions).toBeDefined();
            expect(Array.isArray(completions)).toBe(true);
            // Note: Actual account completions depend on parsed data
        });

        it('should not provide account completions on non-indented lines', () => {
            const document = new MockTextDocument(['Assets']);
            const position = new vscode.Position(0, 6);

            const completions = provider.provideCompletionItems(
                document, 
                position, 
                mockCancellationToken, 
                mockCompletionContext
            );

            expect(completions.length).toBe(0);
        });
    });

    describe('Commodity completions', () => {
        it('should provide commodity completions after amount + single space', () => {
            const document = new MockTextDocument(['  Assets:Cash  100.00 U']);
            const position = new vscode.Position(0, 23);

            const completions = provider.provideCompletionItems(
                document, 
                position, 
                mockCancellationToken, 
                mockCompletionContext
            );

            expect(completions).toBeDefined();
            expect(Array.isArray(completions)).toBe(true);
        });

        it('should not provide commodity completions after amount + two spaces', () => {
            const document = new MockTextDocument(['  Assets:Cash  100.00  ']);
            const position = new vscode.Position(0, 24);

            const completions = provider.provideCompletionItems(
                document, 
                position, 
                mockCancellationToken, 
                mockCompletionContext
            );

            expect(completions.length).toBe(0);
        });
    });

    describe('Forbidden zones', () => {
        it('should suppress all completions after amount + two spaces', () => {
            const document = new MockTextDocument(['  Assets:Cash  100.00  ']);
            const position = new vscode.Position(0, 24);

            const completions = provider.provideCompletionItems(
                document, 
                position, 
                mockCancellationToken, 
                mockCompletionContext
            );

            expect(completions.length).toBe(0);
        });

        it('should suppress completions in middle of words', () => {
            const document = new MockTextDocument(['  Assets:Cash']);
            const position = new vscode.Position(0, 8); // Middle of "Assets:Cash"

            const completions = provider.provideCompletionItems(
                document, 
                position, 
                mockCancellationToken, 
                mockCompletionContext
            );

            expect(completions.length).toBe(0);
        });
    });

    describe('Edge cases', () => {
        it('should handle empty lines gracefully', () => {
            const document = new MockTextDocument(['']);
            const position = new vscode.Position(0, 0);

            const completions = provider.provideCompletionItems(
                document, 
                position, 
                mockCancellationToken, 
                mockCompletionContext
            );

            expect(completions).toBeDefined();
            expect(Array.isArray(completions)).toBe(true);
        });

        it('should handle positions beyond line length', () => {
            const document = new MockTextDocument(['2024']);
            const position = new vscode.Position(0, 10);

            const completions = provider.provideCompletionItems(
                document, 
                position, 
                mockCancellationToken, 
                mockCompletionContext
            );

            expect(completions).toBeDefined();
            expect(Array.isArray(completions)).toBe(true);
        });

        it('should handle multiline documents', () => {
            const document = new MockTextDocument([
                '2024-01-15 Test transaction',
                '  Assets:Cash  100.00 USD',
                '  Expenses:Food'
            ]);

            // Test date completion on first line
            let position = new vscode.Position(0, 4);
            let completions = provider.provideCompletionItems(
                document, position, mockCancellationToken, mockCompletionContext
            );
            expect(completions.length).toBeGreaterThan(0);

            // Test account completion on third line
            position = new vscode.Position(2, 15);
            completions = provider.provideCompletionItems(
                document, position, mockCancellationToken, mockCompletionContext
            );
            expect(completions).toBeDefined();
        });
    });

    describe('Performance', () => {
        it('should provide completions quickly', () => {
            const document = new MockTextDocument(['2024-01-15 Test']);
            const position = new vscode.Position(0, 4);

            const startTime = Date.now();

            // Run completion 100 times
            for (let i = 0; i < 100; i++) {
                provider.provideCompletionItems(
                    document, 
                    position, 
                    mockCancellationToken, 
                    mockCompletionContext
                );
            }

            const endTime = Date.now();
            const duration = endTime - startTime;

            // Should complete 100 requests in under 200ms
            expect(duration).toBeLessThan(200);
        });
    });

    describe('Strict rules enforcement', () => {
        it('should enforce exactly one completion type per position', () => {
            const testCases = [
                { document: ['2024'], position: new vscode.Position(0, 4), expectedType: 'date' },
                { document: ['  Assets'], position: new vscode.Position(0, 8), expectedType: 'account' },
                { document: ['  Assets:Cash  100.00 U'], position: new vscode.Position(0, 23), expectedType: 'commodity' }
            ];

            testCases.forEach(({ document: lines, position, expectedType }) => {
                const document = new MockTextDocument(lines);
                const completions = provider.provideCompletionItems(
                    document, position, mockCancellationToken, mockCompletionContext
                );

                // Should have completions for the expected type
                expect(completions).toBeDefined();
                
                // All completions should be of the same kind (single type per position rule)
                if (completions.length > 0) {
                    const firstKind = completions[0]!.kind;
                    const allSameKind = completions.every(item => item.kind === firstKind);
                    expect(allSameKind).toBe(true);
                }
            });
        });

        it('should respect minimum trigger requirements', () => {
            // Test that contextual triggers work
            const contextualTriggers = [':', '@', ';'];
            
            contextualTriggers.forEach(trigger => {
                // These should not cause errors when used appropriately
                const document = new MockTextDocument([`  Assets${trigger}`]);
                const position = new vscode.Position(0, 8 + trigger.length);
                
                const completions = provider.provideCompletionItems(
                    document, position, mockCancellationToken, {
                        ...mockCompletionContext,
                        triggerCharacter: trigger
                    }
                );
                
                expect(completions).toBeDefined();
            });
        });
    });
});