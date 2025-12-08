import { TransactionGenerator } from '../TransactionGenerator';
import { ParsedTabularData, ColumnMapping, ParsedRow, DEFAULT_IMPORT_OPTIONS } from '../types';

describe('TransactionGenerator', () => {
    let generator: TransactionGenerator;

    beforeEach(() => {
        generator = new TransactionGenerator();
    });

    const createData = (
        headers: string[],
        rows: string[][],
        mappings: ColumnMapping[]
    ): ParsedTabularData => ({
        headers,
        rows: rows.map((cells, index) => ({
            cells,
            lineNumber: index + 2,
        })),
        delimiter: ',',
        columnMappings: mappings,
    });

    const createMappings = (types: Array<{ type: string; index: number }>): ColumnMapping[] =>
        types.map(({ type, index }) => ({
            type: type as ColumnMapping['type'],
            index,
            headerName: `Column${index}`,
            confidence: 1.0,
        }));

    describe('basic transaction generation', () => {
        it('should generate transaction from valid row', () => {
            const data = createData(
                ['Date', 'Description', 'Amount'],
                [['2024-01-15', 'Grocery Store', '-50.00']],
                createMappings([
                    { type: 'date', index: 0 },
                    { type: 'description', index: 1 },
                    { type: 'amount', index: 2 },
                ])
            );

            const result = generator.generate(data);

            expect(result.errors).toHaveLength(0);
            expect(result.transactions).toHaveLength(1);
            expect(result.transactions[0].date).toBe('2024-01-15');
            expect(result.transactions[0].description).toBe('Grocery Store');
            expect(result.transactions[0].amount).toBe(-50);
        });

        it('should generate multiple transactions', () => {
            const data = createData(
                ['Date', 'Description', 'Amount'],
                [
                    ['2024-01-15', 'Grocery Store', '-50.00'],
                    ['2024-01-16', 'Gas Station', '-30.00'],
                    ['2024-01-17', 'Salary', '3000.00'],
                ],
                createMappings([
                    { type: 'date', index: 0 },
                    { type: 'description', index: 1 },
                    { type: 'amount', index: 2 },
                ])
            );

            const result = generator.generate(data);

            expect(result.transactions).toHaveLength(3);
            expect(result.statistics.processedRows).toBe(3);
        });
    });

    describe('column detection validation', () => {
        it('should fail if date column is missing', () => {
            const data = createData(
                ['Description', 'Amount'],
                [['Grocery Store', '-50.00']],
                createMappings([
                    { type: 'description', index: 0 },
                    { type: 'amount', index: 1 },
                ])
            );

            const result = generator.generate(data);

            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].fatal).toBe(true);
            expect(result.errors[0].message).toContain('date');
        });

        it('should fail if amount column is missing', () => {
            const data = createData(
                ['Date', 'Description'],
                [['2024-01-15', 'Grocery Store']],
                createMappings([
                    { type: 'date', index: 0 },
                    { type: 'description', index: 1 },
                ])
            );

            const result = generator.generate(data);

            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].fatal).toBe(true);
        });
    });

    describe('debit/credit columns', () => {
        it('should handle separate debit and credit columns', () => {
            const data = createData(
                ['Date', 'Description', 'Debit', 'Credit'],
                [
                    ['2024-01-15', 'Expense', '50.00', ''],
                    ['2024-01-16', 'Income', '', '100.00'],
                ],
                createMappings([
                    { type: 'date', index: 0 },
                    { type: 'description', index: 1 },
                    { type: 'debit', index: 2 },
                    { type: 'credit', index: 3 },
                ])
            );

            const result = generator.generate(data);

            expect(result.transactions).toHaveLength(2);
            expect(result.transactions[0].amount).toBe(-50); // Debit is negative
            expect(result.transactions[1].amount).toBe(100); // Credit is positive
        });
    });

    describe('amount parsing', () => {
        it('should handle US format (1,234.56)', () => {
            const data = createData(
                ['Date', 'Description', 'Amount'],
                [['2024-01-15', 'Purchase', '-1,234.56']],
                createMappings([
                    { type: 'date', index: 0 },
                    { type: 'description', index: 1 },
                    { type: 'amount', index: 2 },
                ])
            );

            const result = generator.generate(data);

            expect(result.transactions[0].amount).toBeCloseTo(-1234.56);
        });

        it('should handle EU format (1.234,56)', () => {
            const data = createData(
                ['Date', 'Description', 'Amount'],
                [['2024-01-15', 'Purchase', '-1.234,56']],
                createMappings([
                    { type: 'date', index: 0 },
                    { type: 'description', index: 1 },
                    { type: 'amount', index: 2 },
                ])
            );

            const result = generator.generate(data);

            expect(result.transactions[0].amount).toBeCloseTo(-1234.56);
        });

        it('should handle currency symbols', () => {
            const data = createData(
                ['Date', 'Description', 'Amount'],
                [['2024-01-15', 'Purchase', '$50.00']],
                createMappings([
                    { type: 'date', index: 0 },
                    { type: 'description', index: 1 },
                    { type: 'amount', index: 2 },
                ])
            );

            const result = generator.generate(data);

            expect(result.transactions[0].amount).toBe(50);
        });

        it('should handle accounting notation (parentheses for negative)', () => {
            const data = createData(
                ['Date', 'Description', 'Amount'],
                [['2024-01-15', 'Purchase', '(50.00)']],
                createMappings([
                    { type: 'date', index: 0 },
                    { type: 'description', index: 1 },
                    { type: 'amount', index: 2 },
                ])
            );

            const result = generator.generate(data);

            expect(result.transactions[0].amount).toBe(-50);
        });
    });

    describe('invert amounts option', () => {
        it('should invert amounts when configured', () => {
            const invertingGenerator = new TransactionGenerator({
                invertAmounts: true,
            });

            const data = createData(
                ['Date', 'Description', 'Amount'],
                [['2024-01-15', 'Purchase', '50.00']],
                createMappings([
                    { type: 'date', index: 0 },
                    { type: 'description', index: 1 },
                    { type: 'amount', index: 2 },
                ])
            );

            const result = invertingGenerator.generate(data);

            expect(result.transactions[0].amount).toBe(-50);
        });
    });

    describe('category and account resolution', () => {
        it('should resolve account from category', () => {
            const data = createData(
                ['Date', 'Description', 'Amount', 'Category'],
                [['2024-01-15', 'Shop', '-50.00', 'Groceries']],
                createMappings([
                    { type: 'date', index: 0 },
                    { type: 'description', index: 1 },
                    { type: 'amount', index: 2 },
                    { type: 'category', index: 3 },
                ])
            );

            const result = generator.generate(data);

            expect(result.transactions[0].sourceAccount.source).toBe('category');
            expect(result.transactions[0].sourceAccount.account).toBe('expenses:food:groceries');
        });

        it('should resolve account from merchant pattern', () => {
            const data = createData(
                ['Date', 'Description', 'Amount'],
                [['2024-01-15', 'AMAZON.COM*123ABC', '-50.00']],
                createMappings([
                    { type: 'date', index: 0 },
                    { type: 'description', index: 1 },
                    { type: 'amount', index: 2 },
                ])
            );

            const result = generator.generate(data);

            expect(result.transactions[0].sourceAccount.source).toBe('pattern');
            expect(result.transactions[0].sourceAccount.account).toBe('expenses:shopping:amazon');
        });

        it('should resolve account from amount sign', () => {
            const data = createData(
                ['Date', 'Description', 'Amount'],
                [
                    ['2024-01-15', 'Random Merchant', '-50.00'],
                    ['2024-01-16', 'Unknown Income', '100.00'],
                ],
                createMappings([
                    { type: 'date', index: 0 },
                    { type: 'description', index: 1 },
                    { type: 'amount', index: 2 },
                ])
            );

            const result = generator.generate(data);

            expect(result.transactions[0].sourceAccount.source).toBe('sign');
            expect(result.transactions[0].sourceAccount.account).toBe('expenses:unknown');
            expect(result.transactions[1].sourceAccount.source).toBe('sign');
            expect(result.transactions[1].sourceAccount.account).toBe('income:unknown');
        });
    });

    describe('currency handling', () => {
        it('should include currency from column', () => {
            const data = createData(
                ['Date', 'Description', 'Amount', 'Currency'],
                [['2024-01-15', 'Purchase', '-50.00', 'EUR']],
                createMappings([
                    { type: 'date', index: 0 },
                    { type: 'description', index: 1 },
                    { type: 'amount', index: 2 },
                    { type: 'currency', index: 3 },
                ])
            );

            const result = generator.generate(data);

            expect(result.transactions[0].currency).toBe('EUR');
            expect(result.transactions[0].amountFormatted).toContain('EUR');
        });
    });

    describe('optional fields', () => {
        it('should include memo from memo column', () => {
            const data = createData(
                ['Date', 'Description', 'Amount', 'Memo'],
                [['2024-01-15', 'Purchase', '-50.00', 'Weekly groceries']],
                createMappings([
                    { type: 'date', index: 0 },
                    { type: 'description', index: 1 },
                    { type: 'amount', index: 2 },
                    { type: 'memo', index: 3 },
                ])
            );

            const result = generator.generate(data);

            expect(result.transactions[0].memo).toBe('Weekly groceries');
        });

        it('should include reference from reference column', () => {
            const data = createData(
                ['Date', 'Description', 'Amount', 'Reference'],
                [['2024-01-15', 'Purchase', '-50.00', 'REF123']],
                createMappings([
                    { type: 'date', index: 0 },
                    { type: 'description', index: 1 },
                    { type: 'amount', index: 2 },
                    { type: 'reference', index: 3 },
                ])
            );

            const result = generator.generate(data);

            expect(result.transactions[0].reference).toBe('REF123');
        });
    });

    describe('error handling', () => {
        it('should handle invalid date gracefully', () => {
            const data = createData(
                ['Date', 'Description', 'Amount'],
                [
                    ['not-a-date', 'Purchase', '-50.00'],
                    ['2024-01-15', 'Valid Purchase', '-30.00'],
                ],
                createMappings([
                    { type: 'date', index: 0 },
                    { type: 'description', index: 1 },
                    { type: 'amount', index: 2 },
                ])
            );

            const result = generator.generate(data);

            expect(result.transactions).toHaveLength(1);
            expect(result.warnings).toHaveLength(1);
            expect(result.statistics.skippedRows).toBe(1);
        });

        it('should handle invalid amount gracefully', () => {
            const data = createData(
                ['Date', 'Description', 'Amount'],
                [
                    ['2024-01-15', 'Purchase', 'not-a-number'],
                    ['2024-01-16', 'Valid Purchase', '-30.00'],
                ],
                createMappings([
                    { type: 'date', index: 0 },
                    { type: 'description', index: 1 },
                    { type: 'amount', index: 2 },
                ])
            );

            const result = generator.generate(data);

            expect(result.transactions).toHaveLength(1);
            expect(result.warnings.length).toBeGreaterThan(0);
        });

        it('should warn about empty description', () => {
            const data = createData(
                ['Date', 'Description', 'Amount'],
                [['2024-01-15', '', '-50.00']],
                createMappings([
                    { type: 'date', index: 0 },
                    { type: 'description', index: 1 },
                    { type: 'amount', index: 2 },
                ])
            );

            const result = generator.generate(data);

            expect(result.transactions).toHaveLength(1);
            expect(result.warnings.some(w => w.message.includes('description'))).toBe(true);
        });
    });

    describe('statistics', () => {
        it('should track detection sources', () => {
            const data = createData(
                ['Date', 'Description', 'Amount', 'Category'],
                [
                    ['2024-01-15', 'AMAZON', '-50.00', ''], // pattern
                    ['2024-01-16', 'Shop', '-30.00', 'Groceries'], // category
                    ['2024-01-17', 'Random', '-20.00', ''], // sign
                ],
                createMappings([
                    { type: 'date', index: 0 },
                    { type: 'description', index: 1 },
                    { type: 'amount', index: 2 },
                    { type: 'category', index: 3 },
                ])
            );

            const result = generator.generate(data);

            expect(result.statistics.detectionSources.pattern).toBeGreaterThan(0);
            expect(result.statistics.detectionSources.category).toBeGreaterThan(0);
            expect(result.statistics.detectionSources.sign).toBeGreaterThan(0);
        });

        it('should count auto-detected vs TODO accounts', () => {
            const data = createData(
                ['Date', 'Description', 'Amount'],
                [
                    ['2024-01-15', 'AMAZON', '-50.00'], // auto-detected
                    ['2024-01-16', 'Random', '-30.00'], // sign heuristic (needs review)
                ],
                createMappings([
                    { type: 'date', index: 0 },
                    { type: 'description', index: 1 },
                    { type: 'amount', index: 2 },
                ])
            );

            const result = generator.generate(data);

            expect(result.statistics.autoDetectedAccounts).toBeGreaterThan(0);
            expect(result.statistics.todoAccounts).toBeGreaterThan(0);
        });
    });

    describe('formatting', () => {
        it('should format transaction as hledger entry', () => {
            const data = createData(
                ['Date', 'Description', 'Amount'],
                [['2024-01-15', 'Grocery Store', '-50.00']],
                createMappings([
                    { type: 'date', index: 0 },
                    { type: 'description', index: 1 },
                    { type: 'amount', index: 2 },
                ])
            );

            const result = generator.generate(data);
            const formatted = generator.formatTransaction(result.transactions[0]);

            expect(formatted).toContain('2024-01-15');
            expect(formatted).toContain('Grocery Store');
            expect(formatted).toContain('50.00');
            expect(formatted).toContain(DEFAULT_IMPORT_OPTIONS.defaultBalancingAccount);
        });

        it('should format transaction with reference', () => {
            const data = createData(
                ['Date', 'Description', 'Amount', 'Reference'],
                [['2024-01-15', 'Purchase', '-50.00', 'REF123']],
                createMappings([
                    { type: 'date', index: 0 },
                    { type: 'description', index: 1 },
                    { type: 'amount', index: 2 },
                    { type: 'reference', index: 3 },
                ])
            );

            const result = generator.generate(data);
            const formatted = generator.formatTransaction(result.transactions[0]);

            expect(formatted).toContain('(REF123)');
        });

        it('should format transaction with memo', () => {
            const data = createData(
                ['Date', 'Description', 'Amount', 'Memo'],
                [['2024-01-15', 'Purchase', '-50.00', 'Weekly groceries']],
                createMappings([
                    { type: 'date', index: 0 },
                    { type: 'description', index: 1 },
                    { type: 'amount', index: 2 },
                    { type: 'memo', index: 3 },
                ])
            );

            const result = generator.generate(data);
            const formatted = generator.formatTransaction(result.transactions[0]);

            expect(formatted).toContain('; Weekly groceries');
        });

        it('should include annotation comment for matched accounts', () => {
            const data = createData(
                ['Date', 'Description', 'Amount'],
                [['2024-01-15', 'AMAZON.COM', '-50.00']],
                createMappings([
                    { type: 'date', index: 0 },
                    { type: 'description', index: 1 },
                    { type: 'amount', index: 2 },
                ])
            );

            const result = generator.generate(data);
            const formatted = generator.formatTransaction(result.transactions[0], true);

            expect(formatted).toContain('matched:');
        });

        it('should exclude annotations when disabled', () => {
            const data = createData(
                ['Date', 'Description', 'Amount'],
                [['2024-01-15', 'AMAZON.COM', '-50.00']],
                createMappings([
                    { type: 'date', index: 0 },
                    { type: 'description', index: 1 },
                    { type: 'amount', index: 2 },
                ])
            );

            const result = generator.generate(data);
            const formatted = generator.formatTransaction(result.transactions[0], false);

            expect(formatted).not.toContain('matched:');
        });
    });

    describe('formatAll', () => {
        it('should format all transactions with header', () => {
            const data = createData(
                ['Date', 'Description', 'Amount'],
                [
                    ['2024-01-15', 'Purchase 1', '-50.00'],
                    ['2024-01-16', 'Purchase 2', '-30.00'],
                ],
                createMappings([
                    { type: 'date', index: 0 },
                    { type: 'description', index: 1 },
                    { type: 'amount', index: 2 },
                ])
            );

            const result = generator.generate(data);
            const output = generator.formatAll(result, 'test.csv');

            expect(output).toContain('; Imported from test.csv');
            expect(output).toContain('; Rows: 2 processed');
            expect(output).toContain('2024-01-15');
            expect(output).toContain('2024-01-16');
        });

        it('should include statistics in header', () => {
            const data = createData(
                ['Date', 'Description', 'Amount'],
                [['2024-01-15', 'AMAZON', '-50.00']],
                createMappings([
                    { type: 'date', index: 0 },
                    { type: 'description', index: 1 },
                    { type: 'amount', index: 2 },
                ])
            );

            const result = generator.generate(data);
            const output = generator.formatAll(result);

            expect(output).toContain('; Accounts:');
            expect(output).toContain('auto-detected');
        });

        it('should include warnings in output', () => {
            const data = createData(
                ['Date', 'Description', 'Amount'],
                [
                    ['2024-01-15', '', '-50.00'], // Empty description
                ],
                createMappings([
                    { type: 'date', index: 0 },
                    { type: 'description', index: 1 },
                    { type: 'amount', index: 2 },
                ])
            );

            const result = generator.generate(data);
            const output = generator.formatAll(result);

            expect(output).toContain('; Warnings:');
        });
    });

    describe('payee fallback', () => {
        it('should use payee column when description is missing', () => {
            const data = createData(
                ['Date', 'Payee', 'Amount'],
                [['2024-01-15', 'Store Name', '-50.00']],
                createMappings([
                    { type: 'date', index: 0 },
                    { type: 'payee', index: 1 },
                    { type: 'amount', index: 2 },
                ])
            );

            const result = generator.generate(data);

            expect(result.transactions[0].description).toBe('Store Name');
        });
    });

    describe('custom configuration', () => {
        it('should use custom default accounts', () => {
            const customGenerator = new TransactionGenerator({
                defaultDebitAccount: 'expenses:misc',
                defaultCreditAccount: 'income:misc',
                defaultBalancingAccount: 'assets:bank',
            });

            const data = createData(
                ['Date', 'Description', 'Amount'],
                [['2024-01-15', 'Unknown Purchase', '-50.00']],
                createMappings([
                    { type: 'date', index: 0 },
                    { type: 'description', index: 1 },
                    { type: 'amount', index: 2 },
                ])
            );

            const result = customGenerator.generate(data);

            expect(result.transactions[0].sourceAccount.account).toBe('expenses:misc');
            expect(result.transactions[0].targetAccount).toBe('assets:bank');
        });
    });
});
