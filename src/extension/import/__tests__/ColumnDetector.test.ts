import { ColumnDetector } from '../ColumnDetector';
import { ParsedRow } from '../types';

describe('ColumnDetector', () => {
    let detector: ColumnDetector;

    beforeEach(() => {
        detector = new ColumnDetector();
    });

    describe('header matching', () => {
        it('should detect date column', () => {
            const headers = ['Date', 'Description', 'Amount'];
            const mappings = detector.detectColumns(headers, []);

            const dateMapping = mappings.find(m => m.type === 'date');
            expect(dateMapping).toBeDefined();
            expect(dateMapping?.index).toBe(0);
            expect(dateMapping?.confidence).toBeGreaterThan(0.8);
        });

        it('should detect description column', () => {
            const headers = ['Date', 'Description', 'Amount'];
            const mappings = detector.detectColumns(headers, []);

            const descMapping = mappings.find(m => m.type === 'description');
            expect(descMapping).toBeDefined();
            expect(descMapping?.index).toBe(1);
        });

        it('should detect amount column', () => {
            const headers = ['Date', 'Description', 'Amount'];
            const mappings = detector.detectColumns(headers, []);

            const amountMapping = mappings.find(m => m.type === 'amount');
            expect(amountMapping).toBeDefined();
            expect(amountMapping?.index).toBe(2);
        });

        it('should detect category column', () => {
            const headers = ['Date', 'Description', 'Amount', 'Category'];
            const mappings = detector.detectColumns(headers, []);

            const categoryMapping = mappings.find(m => m.type === 'category');
            expect(categoryMapping).toBeDefined();
            expect(categoryMapping?.index).toBe(3);
        });

        it('should detect debit and credit columns', () => {
            const headers = ['Date', 'Description', 'Debit', 'Credit'];
            const mappings = detector.detectColumns(headers, []);

            const debitMapping = mappings.find(m => m.type === 'debit');
            const creditMapping = mappings.find(m => m.type === 'credit');

            expect(debitMapping).toBeDefined();
            expect(debitMapping?.index).toBe(2);
            expect(creditMapping).toBeDefined();
            expect(creditMapping?.index).toBe(3);
        });

        it('should detect payee column', () => {
            const headers = ['Date', 'Payee', 'Amount'];
            const mappings = detector.detectColumns(headers, []);

            const payeeMapping = mappings.find(m => m.type === 'payee');
            expect(payeeMapping).toBeDefined();
            expect(payeeMapping?.index).toBe(1);
        });

        it('should detect reference column', () => {
            const headers = ['Date', 'Reference', 'Description', 'Amount'];
            const mappings = detector.detectColumns(headers, []);

            const refMapping = mappings.find(m => m.type === 'reference');
            expect(refMapping).toBeDefined();
            expect(refMapping?.index).toBe(1);
        });

        it('should detect currency column', () => {
            const headers = ['Date', 'Description', 'Amount', 'Currency'];
            const mappings = detector.detectColumns(headers, []);

            const currMapping = mappings.find(m => m.type === 'currency');
            expect(currMapping).toBeDefined();
            expect(currMapping?.index).toBe(3);
        });
    });

    describe('Russian headers', () => {
        it('should detect Russian date column', () => {
            const headers = ['Дата', 'Описание', 'Сумма'];
            const mappings = detector.detectColumns(headers, []);

            const dateMapping = mappings.find(m => m.type === 'date');
            expect(dateMapping).toBeDefined();
            expect(dateMapping?.index).toBe(0);
        });

        it('should detect Russian amount column', () => {
            const headers = ['Дата', 'Описание', 'Сумма'];
            const mappings = detector.detectColumns(headers, []);

            const amountMapping = mappings.find(m => m.type === 'amount');
            expect(amountMapping).toBeDefined();
            expect(amountMapping?.index).toBe(2);
        });

        it('should detect Russian category column', () => {
            const headers = ['Дата', 'Описание', 'Сумма', 'Категория'];
            const mappings = detector.detectColumns(headers, []);

            const categoryMapping = mappings.find(m => m.type === 'category');
            expect(categoryMapping).toBeDefined();
            expect(categoryMapping?.index).toBe(3);
        });
    });

    describe('content-based detection', () => {
        const createRows = (data: string[][]): ParsedRow[] => {
            return data.map((cells, index) => ({
                cells,
                lineNumber: index + 2,
            }));
        };

        it('should detect date column by content', () => {
            const headers = ['Col1', 'Col2', 'Col3'];
            const rows = createRows([
                ['2024-01-15', 'Description', '50.00'],
                ['2024-01-16', 'Another', '30.00'],
            ]);

            const mappings = detector.detectColumns(headers, rows);
            const dateMapping = mappings.find(m => m.type === 'date');
            expect(dateMapping).toBeDefined();
            expect(dateMapping?.index).toBe(0);
        });

        it('should detect amount column by content', () => {
            const headers = ['Col1', 'Col2', 'Col3'];
            const rows = createRows([
                ['2024-01-15', 'Description', '1,234.56'],
                ['2024-01-16', 'Another', '30.00'],
            ]);

            const mappings = detector.detectColumns(headers, rows);
            const amountMapping = mappings.find(m => m.type === 'amount');
            expect(amountMapping).toBeDefined();
            expect(amountMapping?.index).toBe(2);
        });

        it('should detect currency column by content', () => {
            const headers = ['Date', 'Description', 'Amount', 'Curr'];
            const rows = createRows([
                ['2024-01-15', 'Description', '50.00', 'USD'],
                ['2024-01-16', 'Another', '30.00', 'EUR'],
            ]);

            const mappings = detector.detectColumns(headers, rows);
            const currMapping = mappings.find(m => m.type === 'currency');
            expect(currMapping).toBeDefined();
            expect(currMapping?.index).toBe(3);
        });
    });

    describe('findMapping helper', () => {
        it('should find mapping by type', () => {
            const headers = ['Date', 'Description', 'Amount'];
            const mappings = detector.detectColumns(headers, []);

            const dateMapping = ColumnDetector.findMapping(mappings, 'date');
            expect(dateMapping).toBeDefined();
            expect(dateMapping?.type).toBe('date');
        });

        it('should return undefined for missing type', () => {
            const headers = ['Date', 'Description', 'Amount'];
            const mappings = detector.detectColumns(headers, []);

            const categoryMapping = ColumnDetector.findMapping(mappings, 'category');
            expect(categoryMapping).toBeUndefined();
        });
    });

    describe('hasRequiredColumns validation', () => {
        it('should pass with date and amount', () => {
            const headers = ['Date', 'Description', 'Amount'];
            const mappings = detector.detectColumns(headers, []);

            const result = ColumnDetector.hasRequiredColumns(mappings);
            expect(result.valid).toBe(true);
            expect(result.missing).toHaveLength(0);
        });

        it('should pass with date and debit/credit', () => {
            const headers = ['Date', 'Description', 'Debit', 'Credit'];
            const mappings = detector.detectColumns(headers, []);

            const result = ColumnDetector.hasRequiredColumns(mappings);
            expect(result.valid).toBe(true);
        });

        it('should fail without date', () => {
            const headers = ['Col1', 'Col2', 'Amount'];
            const mappings = detector.detectColumns(headers, []);

            // Override to mark first column as unknown
            const modifiedMappings = mappings.map(m =>
                m.index === 0 ? { ...m, type: 'unknown' as const } : m
            );

            const result = ColumnDetector.hasRequiredColumns(modifiedMappings);
            expect(result.valid).toBe(false);
            expect(result.missing).toContain('date');
        });
    });

    describe('conflict resolution', () => {
        it('should handle duplicate type detection by confidence', () => {
            const headers = ['Date', 'Transaction Date', 'Amount'];
            const mappings = detector.detectColumns(headers, []);

            // Should only have one date mapping
            const dateMappings = mappings.filter(m => m.type === 'date');
            expect(dateMappings).toHaveLength(1);
        });
    });
});
