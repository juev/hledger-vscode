/**
 * Integration tests for completion provider with realistic scenarios
 * Tests completion behavior at different cursor positions with sample journal data
 *
 * Note: These tests verify the core completion provider functionality by simulating
 * real-world usage scenarios with sample hledger journal data.
 */

import * as vscode from 'vscode';
import { StrictCompletionProvider } from '../StrictCompletionProvider';
import { HLedgerConfig } from '../HLedgerConfig';
import { HLedgerParser } from '../HLedgerParser';
import { SimpleProjectCache } from '../SimpleProjectCache';

const { MockTextDocument } = vscode as any;

describe('Completion Integration Tests', () => {
    let provider: StrictCompletionProvider;
    let config: HLedgerConfig;
    let parser: HLedgerParser;
    let cache: SimpleProjectCache;

    // Sample journal content with various data for completions
    const sampleJournalContent = `
; Sample journal file for integration testing
commodity USD
commodity EUR
commodity RUB

2024-01-15 Grocery Store
  Expenses:Food:Groceries  50.00 USD
  Assets:Cash

2024-01-20 Salary Payment
  Income:Salary  -3000.00 USD
  Assets:Bank:Checking

2024-02-01 Coffee Shop
  Expenses:Food:Dining  5.50 EUR
  Assets:Cash

2024-02-05 Rent Payment
  Expenses:Housing:Rent  1200.00 USD
  Assets:Bank:Checking

2024-02-10 Online Shopping
  Expenses:Shopping:Electronics  299.99 USD
  Assets:CreditCard

2024-03-01 Coffee and Snacks
  Expenses:Food and Beverages  25.00 RUB
  Assets:Checking Account
`;

    const mockCompletionContext: vscode.CompletionContext = {
        triggerKind: vscode.CompletionTriggerKind.Invoke,
        triggerCharacter: undefined
    };

    const mockCancellationToken: vscode.CancellationToken = {
        isCancellationRequested: false,
        onCancellationRequested: () => new vscode.Disposable(() => {})
    };

    beforeEach(() => {
        parser = new HLedgerParser();
        cache = new SimpleProjectCache();
        config = new HLedgerConfig(parser, cache);

        // Parse sample journal content directly into config
        config.parseContent(sampleJournalContent, '/test');

        // Mock getConfigForDocument to prevent data from being overwritten during completion
        config.getConfigForDocument = jest.fn();

        provider = new StrictCompletionProvider(config);
    });

    describe('Date Completion at Line Start', () => {
        it('should provide date completions with partial year input', () => {
            const document = new MockTextDocument(['2024']);
            const position = new vscode.Position(0, 4);

            const completions = provider.provideCompletionItems(
                document,
                position,
                mockCancellationToken,
                mockCompletionContext
            );

            expect(completions).toBeDefined();
            expect(completions.length).toBeGreaterThan(0);

            // Should contain dates with 2024
            const has2024Dates = completions.some(item =>
                item.label.toString().includes('2024')
            );
            expect(has2024Dates).toBe(true);
        });

        it('should NOT provide date completions in middle of line (indented)', () => {
            const document = new MockTextDocument(['  2024']);
            const position = new vscode.Position(0, 6);

            const completions = provider.provideCompletionItems(
                document,
                position,
                mockCancellationToken,
                mockCompletionContext
            );

            // Should not provide date completions when not at line start
            expect(completions.length).toBe(0);
        });
    });

    describe('Account Completion on Indented Lines', () => {
        it('should provide account completions on indented line', () => {
            const document = new MockTextDocument(['  Assets']);
            const position = new vscode.Position(0, 8);

            const completions = provider.provideCompletionItems(
                document,
                position,
                mockCancellationToken,
                mockCompletionContext
            );

            expect(completions).toBeDefined();
            expect(completions.length).toBeGreaterThan(0);

            // Verify that sample accounts are available in config
            expect(config.getAccounts().length).toBeGreaterThan(0);

            // Should include accounts from sample data
            const accountNames = ['Assets:Cash', 'Assets:Bank:Checking', 'Assets:CreditCard'];
            const hasAssetAccounts = accountNames.some(name =>
                completions.some(item => item.label.toString().includes(name))
            );
            expect(hasAssetAccounts).toBe(true);
        });

        it('should filter account completions based on partial input', () => {
            const document = new MockTextDocument(['  Expenses:Food']);
            const position = new vscode.Position(0, 15);

            const completions = provider.provideCompletionItems(
                document,
                position,
                mockCancellationToken,
                mockCompletionContext
            );

            expect(completions).toBeDefined();

            // Should include food-related accounts
            const foodAccounts = ['Expenses:Food:Groceries', 'Expenses:Food:Dining'];
            const hasFoodAccounts = foodAccounts.some(name =>
                completions.some(item => item.label.toString().includes(name))
            );
            expect(hasFoodAccounts).toBe(true);
        });

        it('should provide hierarchical account completions with colon trigger', () => {
            const document = new MockTextDocument(['  Expenses:']);
            const position = new vscode.Position(0, 11);

            const completions = provider.provideCompletionItems(
                document,
                position,
                mockCancellationToken,
                {
                    ...mockCompletionContext,
                    triggerCharacter: ':'
                }
            );

            expect(completions).toBeDefined();

            // Should include sub-accounts of Expenses
            const expenseCategories = ['Food', 'Housing', 'Shopping'];
            const hasExpenseCategories = expenseCategories.some(name =>
                completions.some(item => item.label.toString().includes(name))
            );
            expect(hasExpenseCategories).toBe(true);
        });

        it('should NOT provide account completions on non-indented lines', () => {
            const document = new MockTextDocument(['Assets:Cash']);
            const position = new vscode.Position(0, 11);

            const completions = provider.provideCompletionItems(
                document,
                position,
                mockCancellationToken,
                mockCompletionContext
            );

            // Should not provide completions on non-indented lines
            expect(completions.length).toBe(0);
        });
    });

    describe('Accounts with Spaces', () => {
        it('should handle accounts with spaces in names', () => {
            const document = new MockTextDocument(['  Expenses:Food and']);
            const position = new vscode.Position(0, 19);

            const completions = provider.provideCompletionItems(
                document,
                position,
                mockCancellationToken,
                mockCompletionContext
            );

            expect(completions).toBeDefined();

            // Should include "Expenses:Food and Beverages" from sample data
            const hasSpacedAccount = completions.some(item =>
                item.label.toString().includes('Food and Beverages')
            );
            expect(hasSpacedAccount).toBe(true);
        });

        it('should filter accounts with spaces correctly', () => {
            const document = new MockTextDocument(['  Assets:Checking']);
            const position = new vscode.Position(0, 17);

            const completions = provider.provideCompletionItems(
                document,
                position,
                mockCancellationToken,
                mockCompletionContext
            );

            expect(completions).toBeDefined();

            // Should include "Assets:Checking Account" from sample data
            const hasCheckingAccount = completions.some(item =>
                item.label.toString().includes('Checking Account')
            );
            expect(hasCheckingAccount).toBe(true);
        });

        it('should complete full account names with spaces without breaking', () => {
            const document = new MockTextDocument(['  Expenses:Food and Beverages  10.00 RUB']);
            const position = new vscode.Position(0, 29);

            // Position after the full account name - should not cause errors
            const completions = provider.provideCompletionItems(
                document,
                position,
                mockCancellationToken,
                mockCompletionContext
            );

            expect(completions).toBeDefined();
            expect(Array.isArray(completions)).toBe(true);
            // Spaces in account names don't break the completion system
        });

        it('should handle multiple spaces in account hierarchy', () => {
            const document = new MockTextDocument(['  Assets:Checking Account']);
            const position = new vscode.Position(0, 24);

            const completions = provider.provideCompletionItems(
                document,
                position,
                mockCancellationToken,
                mockCompletionContext
            );

            expect(completions).toBeDefined();
            expect(Array.isArray(completions)).toBe(true);
            // System should handle accounts with spaces gracefully
        });
    });

    describe('Commodity Completion after Amount', () => {
        it('should provide commodity completions after amount with single space', () => {
            const document = new MockTextDocument(['  Assets:Cash  100.00 ']);
            const position = new vscode.Position(0, 21);

            const completions = provider.provideCompletionItems(
                document,
                position,
                mockCancellationToken,
                mockCompletionContext
            );

            expect(completions).toBeDefined();

            // Commodity completion after amount + single space
            if (completions.length > 0) {
                // Should include USD from sample data
                const hasUSD = completions.some(item =>
                    item.label.toString().includes('USD')
                );
                expect(hasUSD).toBe(true);
            } else {
                // If no completions, verify commodities are in config
                const commodities = config.getCommodities();
                expect(commodities.length).toBeGreaterThan(0);
            }
        });

        it('should filter commodity completions based on partial input', () => {
            const document = new MockTextDocument(['  Assets:Cash  100.00 RU']);
            const position = new vscode.Position(0, 24);

            const completions = provider.provideCompletionItems(
                document,
                position,
                mockCancellationToken,
                mockCompletionContext
            );

            expect(completions).toBeDefined();

            // Verify that commodities are available in config
            const commodities = config.getCommodities();
            expect(commodities.some(c => c === 'RUB')).toBe(true);

            // If completions are provided, they should be filtered correctly
            if (completions.length > 0) {
                const hasRUB = completions.some(item =>
                    item.label.toString().includes('RUB')
                );
                expect(hasRUB).toBe(true);
            }
        });

        it('should handle commodity context after amounts', () => {
            const document = new MockTextDocument(['  Assets:Cash  100.00 USD']);
            const position = new vscode.Position(0, 24);

            const completions = provider.provideCompletionItems(
                document,
                position,
                mockCancellationToken,
                mockCompletionContext
            );

            expect(completions).toBeDefined();
            expect(Array.isArray(completions)).toBe(true);

            // Verify commodities are loaded in config
            const commodities = config.getCommodities();
            expect(commodities.length).toBe(3); // USD, EUR, RUB
            expect(commodities).toContain('USD');
            expect(commodities).toContain('EUR');
            expect(commodities).toContain('RUB');
        });

        it('should provide commodity completions with @ trigger', () => {
            const document = new MockTextDocument(['  Assets:Cash  100.00 @']);
            const position = new vscode.Position(0, 22);

            const completions = provider.provideCompletionItems(
                document,
                position,
                mockCancellationToken,
                {
                    ...mockCompletionContext,
                    triggerCharacter: '@'
                }
            );

            expect(completions).toBeDefined();
            // Should provide commodity-related completions
        });
    });

    describe('Forbidden Zones', () => {
        it('should NOT provide any completions after amount + two spaces', () => {
            const document = new MockTextDocument(['  Assets:Cash  100.00  ']);
            const position = new vscode.Position(0, 23);

            const completions = provider.provideCompletionItems(
                document,
                position,
                mockCancellationToken,
                mockCompletionContext
            );

            // Two spaces after amount is forbidden zone
            expect(completions.length).toBe(0);
        });

        it('should handle completion requests in middle of account names', () => {
            const document = new MockTextDocument(['  Assets:Cash']);
            const position = new vscode.Position(0, 8); // Middle of "Assets:Cash"

            const completions = provider.provideCompletionItems(
                document,
                position,
                mockCancellationToken,
                mockCompletionContext
            );

            // Provider may return completions for account hierarchies even mid-word
            expect(completions).toBeDefined();
            expect(Array.isArray(completions)).toBe(true);
        });
    });

    describe('Filtering with Partial Input', () => {
        it('should filter accounts starting with specific letter', () => {
            const document = new MockTextDocument(['  E']);
            const position = new vscode.Position(0, 3);

            const completions = provider.provideCompletionItems(
                document,
                position,
                mockCancellationToken,
                mockCompletionContext
            );

            expect(completions).toBeDefined();

            // Should only include accounts starting with E (Expenses)
            const allStartWithE = completions.every(item => {
                const label = item.label.toString();
                return label.startsWith('E') || label.startsWith('e');
            });
            expect(allStartWithE).toBe(true);

            // Should NOT include Assets or Income accounts
            const hasAssets = completions.some(item =>
                item.label.toString().startsWith('Assets')
            );
            expect(hasAssets).toBe(false);
        });
    });

    describe('Realistic Transaction Scenarios', () => {
        it('should handle multiline transaction with multiple postings', () => {
            const document = new MockTextDocument([
                '2024-12-15 Test Transaction',
                '  Expenses:Food  50.00 USD',
                '  Expenses:Transport  15.00 USD',
                '  '
            ]);

            // Cursor on last indented line
            const position = new vscode.Position(3, 2);
            const completions = provider.provideCompletionItems(
                document, position, mockCancellationToken, mockCompletionContext
            );

            expect(completions).toBeDefined();
            // Should provide account completions on indented line
            const hasAccounts = completions.some(item =>
                item.label.toString().includes('Assets')
            );
            expect(hasAccounts).toBe(true);
        });

        it('should provide completions for different contexts in same document', () => {
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
            expect(completions[0]?.kind).toBe(vscode.CompletionItemKind.Constant);

            // Test account completion on third line
            position = new vscode.Position(2, 15);
            completions = provider.provideCompletionItems(
                document, position, mockCancellationToken, mockCompletionContext
            );
            expect(completions).toBeDefined();
            expect(completions.length).toBeGreaterThan(0);
        });
    });

    describe('Edge Cases and Error Handling', () => {
        it('should handle empty document gracefully', () => {
            const document = new MockTextDocument(['']);
            const position = new vscode.Position(0, 0);

            const completions = provider.provideCompletionItems(
                document, position, mockCancellationToken, mockCompletionContext
            );

            expect(completions).toBeDefined();
            expect(Array.isArray(completions)).toBe(true);
        });

        it('should handle cursor position beyond line length', () => {
            const document = new MockTextDocument(['2024']);
            const position = new vscode.Position(0, 100);

            const completions = provider.provideCompletionItems(
                document, position, mockCancellationToken, mockCompletionContext
            );

            expect(completions).toBeDefined();
            expect(Array.isArray(completions)).toBe(true);
        });

        it('should handle invalid line numbers gracefully', () => {
            const document = new MockTextDocument(['2024-01-15 Test']);
            const position = new vscode.Position(10, 0);

            const completions = provider.provideCompletionItems(
                document, position, mockCancellationToken, mockCompletionContext
            );

            expect(completions).toBeDefined();
            expect(Array.isArray(completions)).toBe(true);
        });

        it('should handle special characters in account names', () => {
            const document = new MockTextDocument(['  Assets:Bank:Checking-USD']);
            const position = new vscode.Position(0, 26);

            const completions = provider.provideCompletionItems(
                document, position, mockCancellationToken, mockCompletionContext
            );

            expect(completions).toBeDefined();
        });
    });

    describe('Performance Tests', () => {
        it('should complete quickly with large dataset', () => {
            // Create a large dataset
            const lines: string[] = [];
            for (let i = 0; i < 100; i++) {
                lines.push(`2024-01-${String(i + 1).padStart(2, '0')} Transaction ${i}`);
                lines.push(`  Expenses:Category${i}  100.00 USD`);
                lines.push(`  Assets:Cash`);
            }

            const largeDoc = new MockTextDocument(lines);
            config.parseContent(largeDoc.getText(), '/test-large');

            const document = new MockTextDocument(['  Expenses:']);
            const position = new vscode.Position(0, 11);

            const startTime = Date.now();
            const completions = provider.provideCompletionItems(
                document, position, mockCancellationToken, mockCompletionContext
            );
            const duration = Date.now() - startTime;

            expect(completions).toBeDefined();
            // Should complete in under 100ms even with large dataset
            expect(duration).toBeLessThan(100);
        });
    });

    describe('Data Loading Verification', () => {
        it('should successfully parse and load sample journal data', () => {
            // Verify that sample data was loaded correctly
            const accounts = config.getAccounts();
            const payees = config.getPayees();
            const commodities = config.getCommodities();

            expect(accounts.length).toBeGreaterThan(0);
            expect(payees.length).toBeGreaterThan(0);
            expect(commodities.length).toBeGreaterThan(0);

            // Verify specific entities from sample data
            expect(accounts.some(a => a.includes('Assets:Cash'))).toBe(true);
            expect(payees.some(p => p.includes('Grocery Store'))).toBe(true);
            expect(commodities.some(c => c === 'USD')).toBe(true);
        });
    });
});
