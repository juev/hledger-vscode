// TransactionTemplateCompleter.test.ts - Tests for transaction template completion
import * as vscode from 'vscode';
import { TransactionTemplateCompleter } from '../TransactionTemplateCompleter';
import { HLedgerConfig } from '../../HLedgerConfig';
import { CompletionContext, PayeeName, AccountName, CommodityCode, UsageCount, TransactionTemplate, TemplateKey } from '../../types';

// Mock vscode module
jest.mock('vscode', () => ({
    CompletionItem: class {
        constructor(public label: string, public kind?: number) {}
        insertText?: unknown;
        detail?: string;
        documentation?: unknown;
        sortText?: string;
        filterText?: string;
    },
    CompletionItemKind: {
        Snippet: 15,
        Text: 1,
    },
    SnippetString: class {
        constructor(public value: string) {}
    },
    MarkdownString: class {
        private content = '';
        appendMarkdown(value: string) {
            this.content += value;
            return this;
        }
        appendCodeblock(value: string, language?: string) {
            this.content += `\`\`\`${language || ''}\n${value}\n\`\`\``;
            return this;
        }
        toString() {
            return this.content;
        }
    }
}), { virtual: true });

describe('TransactionTemplateCompleter', () => {
    let completer: TransactionTemplateCompleter;
    let mockConfig: jest.Mocked<HLedgerConfig>;

    // Helper to create mock templates
    function createTemplate(
        payee: string,
        postings: { account: string; amount: string | null; commodity: string | null }[],
        usageCount: number = 1,
        lastUsedDate: string | null = '2024-12-24'
    ): TransactionTemplate {
        return {
            payee: payee as PayeeName,
            postings: postings.map(p => ({
                account: p.account as AccountName,
                amount: p.amount,
                commodity: p.commodity as CommodityCode | null
            })),
            usageCount: usageCount as UsageCount,
            lastUsedDate
        };
    }

    beforeEach(() => {
        mockConfig = {
            getPayeesWithTemplates: jest.fn().mockReturnValue([]),
            getTemplatesForPayee: jest.fn().mockReturnValue([]),
            getRecentTemplateUsage: jest.fn().mockReturnValue(0),
            getRecentTemplateFrequency: jest.fn().mockReturnValue(0),
        } as unknown as jest.Mocked<HLedgerConfig>;
        completer = new TransactionTemplateCompleter(mockConfig);
    });

    describe('complete()', () => {
        it('should return empty array when no templates exist', () => {
            const context: CompletionContext = {
                type: 'transaction_template',
                query: 'Coffee'
            };

            const result = completer.complete(context);

            expect(result).toEqual([]);
        });

        it('should match payees by prefix', () => {
            mockConfig.getPayeesWithTemplates.mockReturnValue([
                'Coffee Shop' as PayeeName,
                'Grocery Store' as PayeeName
            ]);
            mockConfig.getTemplatesForPayee.mockImplementation((payee: PayeeName) => {
                if (payee === 'Coffee Shop') {
                    return [createTemplate('Coffee Shop', [
                        { account: 'Expenses:Food:Coffee', amount: '5.00USD', commodity: 'USD' },
                        { account: 'Assets:Cash', amount: null, commodity: null }
                    ], 5)];
                }
                return [];
            });

            const context: CompletionContext = {
                type: 'transaction_template',
                query: 'Coff'
            };

            const result = completer.complete(context);

            expect(result.length).toBe(1);
            expect(result[0]!.label).toBe('Coffee Shop');
        });

        it('should create snippet with tabstops for amounts', () => {
            mockConfig.getPayeesWithTemplates.mockReturnValue(['Coffee Shop' as PayeeName]);
            mockConfig.getTemplatesForPayee.mockReturnValue([
                createTemplate('Coffee Shop', [
                    { account: 'Expenses:Food:Coffee', amount: '5.00USD', commodity: 'USD' },
                    { account: 'Assets:Cash', amount: null, commodity: null }
                ], 5)
            ]);

            const context: CompletionContext = {
                type: 'transaction_template',
                query: 'Coffee'
            };

            const result = completer.complete(context);

            expect(result.length).toBe(1);
            const snippet = result[0]!.insertText as vscode.SnippetString;
            expect(snippet.value).toContain('Coffee Shop');
            expect(snippet.value).toContain('Expenses:Food:Coffee');
            expect(snippet.value).toContain('Assets:Cash');
        });

        it('should sort by usage count (highest first)', () => {
            mockConfig.getPayeesWithTemplates.mockReturnValue([
                'Store A' as PayeeName,
                'Store B' as PayeeName
            ]);
            mockConfig.getTemplatesForPayee.mockImplementation((payee: PayeeName) => {
                if (payee === 'Store A') {
                    return [createTemplate('Store A', [
                        { account: 'Expenses:Shopping', amount: '10.00', commodity: null },
                        { account: 'Assets:Cash', amount: null, commodity: null }
                    ], 2)];
                }
                if (payee === 'Store B') {
                    return [createTemplate('Store B', [
                        { account: 'Expenses:Shopping', amount: '20.00', commodity: null },
                        { account: 'Assets:Bank', amount: null, commodity: null }
                    ], 10)];
                }
                return [];
            });

            const context: CompletionContext = {
                type: 'transaction_template',
                query: 'Store'
            };

            const result = completer.complete(context);

            expect(result.length).toBe(2);
            // Store B has higher usage count, should come first
            expect(result[0]!.label).toBe('Store B');
            expect(result[1]!.label).toBe('Store A');
        });

        it('should use identical filterText for gopls hack', () => {
            mockConfig.getPayeesWithTemplates.mockReturnValue([
                'Store A' as PayeeName,
                'Store B' as PayeeName
            ]);
            mockConfig.getTemplatesForPayee.mockReturnValue([
                createTemplate('Store A', [
                    { account: 'Expenses:Shopping', amount: '10.00', commodity: null },
                    { account: 'Assets:Cash', amount: null, commodity: null }
                ], 1)
            ]);

            const context: CompletionContext = {
                type: 'transaction_template',
                query: 'Store'
            };

            const result = completer.complete(context);

            // All items should have the same filterText
            const filterTexts = result.map(item => item.filterText);
            expect(new Set(filterTexts).size).toBe(1);
            expect(filterTexts[0]).toBe('Store');
        });

        it('should handle multiple templates per payee', () => {
            mockConfig.getPayeesWithTemplates.mockReturnValue(['Grocery Store' as PayeeName]);
            mockConfig.getTemplatesForPayee.mockReturnValue([
                createTemplate('Grocery Store', [
                    { account: 'Expenses:Food', amount: '50.00', commodity: null },
                    { account: 'Assets:Cash', amount: null, commodity: null }
                ], 10),
                createTemplate('Grocery Store', [
                    { account: 'Expenses:Food', amount: '30.00', commodity: null },
                    { account: 'Assets:Bank:Checking', amount: null, commodity: null }
                ], 5)
            ]);

            const context: CompletionContext = {
                type: 'transaction_template',
                query: 'Grocery'
            };

            const result = completer.complete(context);

            // Should return multiple completion items for the same payee
            expect(result.length).toBe(2);
        });

        it('should handle Unicode payee names', () => {
            mockConfig.getPayeesWithTemplates.mockReturnValue(['Кафе' as PayeeName]);
            mockConfig.getTemplatesForPayee.mockReturnValue([
                createTemplate('Кафе', [
                    { account: 'Расходы:Еда', amount: '500', commodity: 'RUB' },
                    { account: 'Активы:Наличные', amount: null, commodity: null }
                ], 3)
            ]);

            const context: CompletionContext = {
                type: 'transaction_template',
                query: 'Каф'
            };

            const result = completer.complete(context);

            expect(result.length).toBe(1);
            expect(result[0]!.label).toBe('Кафе');
        });

        it('should handle empty query (show all templates)', () => {
            mockConfig.getPayeesWithTemplates.mockReturnValue([
                'Store A' as PayeeName,
                'Store B' as PayeeName
            ]);
            mockConfig.getTemplatesForPayee.mockImplementation((payee: PayeeName) => {
                return [createTemplate(payee, [
                    { account: 'Expenses:Shopping', amount: '10.00', commodity: null },
                    { account: 'Assets:Cash', amount: null, commodity: null }
                ], 1)];
            });

            const context: CompletionContext = {
                type: 'transaction_template',
                query: ''
            };

            const result = completer.complete(context);

            expect(result.length).toBe(2);
        });

        it('should limit results to 50 templates', () => {
            const payees = Array.from({ length: 60 }, (_, i) => `Store${i}` as PayeeName);
            mockConfig.getPayeesWithTemplates.mockReturnValue(payees);
            mockConfig.getTemplatesForPayee.mockImplementation((payee: PayeeName) => {
                return [createTemplate(payee, [
                    { account: 'Expenses:Shopping', amount: '10.00', commodity: null },
                    { account: 'Assets:Cash', amount: null, commodity: null }
                ], 1)];
            });

            const context: CompletionContext = {
                type: 'transaction_template',
                query: 'Store'
            };

            const result = completer.complete(context);

            expect(result.length).toBeLessThanOrEqual(50);
        });
    });

    describe('snippet format', () => {
        it('should format snippet with proper indentation', () => {
            mockConfig.getPayeesWithTemplates.mockReturnValue(['Test Payee' as PayeeName]);
            mockConfig.getTemplatesForPayee.mockReturnValue([
                createTemplate('Test Payee', [
                    { account: 'Expenses:Test', amount: '100.00', commodity: null },
                    { account: 'Assets:Cash', amount: null, commodity: null }
                ], 1)
            ]);

            const context: CompletionContext = {
                type: 'transaction_template',
                query: 'Test'
            };

            const result = completer.complete(context);

            expect(result.length).toBe(1);
            const snippet = result[0]!.insertText as vscode.SnippetString;
            // Should have proper 4-space indentation for postings
            expect(snippet.value).toContain('\n    Expenses:Test');
            expect(snippet.value).toContain('\n    Assets:Cash');
        });

        it('should include amount as tabstop placeholder', () => {
            mockConfig.getPayeesWithTemplates.mockReturnValue(['Test Payee' as PayeeName]);
            mockConfig.getTemplatesForPayee.mockReturnValue([
                createTemplate('Test Payee', [
                    { account: 'Expenses:Test', amount: '100.00USD', commodity: 'USD' },
                    { account: 'Assets:Cash', amount: null, commodity: null }
                ], 1)
            ]);

            const context: CompletionContext = {
                type: 'transaction_template',
                query: 'Test'
            };

            const result = completer.complete(context);

            const snippet = result[0]!.insertText as vscode.SnippetString;
            // Amount should be in a tabstop placeholder
            expect(snippet.value).toMatch(/\$\{\d+:100\.00USD\}/);
        });
    });
});
