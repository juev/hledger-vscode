import { TabularDataParser } from '../TabularDataParser';
import { Delimiter } from '../types';

describe('TabularDataParser', () => {
    let parser: TabularDataParser;

    beforeEach(() => {
        parser = new TabularDataParser();
    });

    describe('delimiter detection', () => {
        it('should detect comma delimiter', () => {
            const content = `Date,Description,Amount
2024-01-15,Grocery Store,50.00
2024-01-16,Gas Station,30.00`;

            const result = parser.parse(content);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.value.delimiter).toBe(',');
            }
        });

        it('should detect tab delimiter', () => {
            const content = `Date\tDescription\tAmount
2024-01-15\tGrocery Store\t50.00
2024-01-16\tGas Station\t30.00`;

            const result = parser.parse(content);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.value.delimiter).toBe('\t');
            }
        });

        it('should detect semicolon delimiter', () => {
            const content = `Date;Description;Amount
2024-01-15;Grocery Store;50.00
2024-01-16;Gas Station;30.00`;

            const result = parser.parse(content);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.value.delimiter).toBe(';');
            }
        });

        it('should detect pipe delimiter', () => {
            const content = `Date|Description|Amount
2024-01-15|Grocery Store|50.00
2024-01-16|Gas Station|30.00`;

            const result = parser.parse(content);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.value.delimiter).toBe('|');
            }
        });
    });

    describe('parsing', () => {
        it('should parse headers and rows', () => {
            const content = `Date,Description,Amount
2024-01-15,Grocery Store,50.00
2024-01-16,Gas Station,30.00`;

            const result = parser.parse(content);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.value.headers).toEqual(['Date', 'Description', 'Amount']);
                expect(result.value.rows).toHaveLength(2);
                expect(result.value.rows[0].cells).toEqual(['2024-01-15', 'Grocery Store', '50.00']);
                expect(result.value.rows[0].lineNumber).toBe(2);
            }
        });

        it('should handle quoted values with commas', () => {
            const content = `Date,Description,Amount
2024-01-15,"Coffee, Bakery",5.50
2024-01-16,Gas Station,30.00`;

            const result = parser.parse(content);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.value.rows[0].cells[1]).toBe('Coffee, Bakery');
            }
        });

        it('should handle escaped quotes', () => {
            const content = `Date,Description,Amount
2024-01-15,"John ""The Boss"" Smith",100.00`;

            const result = parser.parse(content);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.value.rows[0].cells[1]).toBe('John "The Boss" Smith');
            }
        });

        it('should handle empty cells', () => {
            const content = `Date,Description,Amount,Note
2024-01-15,Grocery Store,50.00,
2024-01-16,,30.00,Gas`;

            const result = parser.parse(content);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.value.rows[0].cells).toEqual(['2024-01-15', 'Grocery Store', '50.00', '']);
                expect(result.value.rows[1].cells).toEqual(['2024-01-16', '', '30.00', 'Gas']);
            }
        });

        it('should skip empty rows when configured', () => {
            const content = `Date,Description,Amount
2024-01-15,Grocery Store,50.00

2024-01-16,Gas Station,30.00`;

            const result = parser.parse(content);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.value.rows).toHaveLength(2);
            }
        });

        it('should trim cell values when configured', () => {
            const content = `Date,Description,Amount
  2024-01-15  ,  Grocery Store  ,  50.00  `;

            const result = parser.parse(content);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.value.rows[0].cells).toEqual(['2024-01-15', 'Grocery Store', '50.00']);
            }
        });

        it('should handle Windows line endings', () => {
            const content = "Date,Description,Amount\r\n2024-01-15,Grocery Store,50.00\r\n2024-01-16,Gas Station,30.00";

            const result = parser.parse(content);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.value.rows).toHaveLength(2);
            }
        });
    });

    describe('error handling', () => {
        it('should return error for empty content', () => {
            const result = parser.parse('');
            expect(result.success).toBe(false);
            if (result.success === false) {
                const errorMessage = result.error;
                expect(errorMessage).toContain('Empty');
            }
        });

        it('should return error for whitespace-only content', () => {
            const result = parser.parse('   \n\n   ');
            expect(result.success).toBe(false);
        });

        it('should return error for unclosed quotes', () => {
            const content = `Date,Description,Amount
2024-01-15,"Unclosed quote,50.00`;

            const result = parser.parse(content);
            expect(result.success).toBe(false);
        });
    });

    describe('explicit delimiter', () => {
        it('should use explicit delimiter when provided', () => {
            const content = `Date,Description;Amount
2024-01-15,Grocery Store;50.00`;

            const result = parser.parse(content, ';' as Delimiter);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.value.delimiter).toBe(';');
                expect(result.value.headers).toEqual(['Date,Description', 'Amount']);
            }
        });
    });

    describe('Unicode support', () => {
        it('should handle Cyrillic text', () => {
            const content = `Дата,Описание,Сумма
2024-01-15,Продукты,1500.00
2024-01-16,Бензин,2000.00`;

            const result = parser.parse(content);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.value.headers).toEqual(['Дата', 'Описание', 'Сумма']);
                expect(result.value.rows[0].cells[1]).toBe('Продукты');
            }
        });
    });

    describe('column consistency validation', () => {
        it('should warn about inconsistent column counts', () => {
            const content = `Date,Description,Amount
2024-01-15,Grocery Store,50.00
2024-01-16,Gas Station`;

            const result = parser.parse(content);
            expect(result.success).toBe(true);
            if (result.success) {
                const warnings = parser.validateColumnConsistency(result.value);
                expect(warnings.length).toBeGreaterThan(0);
            }
        });
    });
});
