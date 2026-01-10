// AmountFormatterService.test.ts - Tests for amount formatting based on commodity directives
import { AmountFormatterService } from '../AmountFormatterService';
import { NumberFormatService, CommodityFormat } from '../NumberFormatService';
import { HLedgerConfig } from '../../HLedgerConfig';
import { CommodityCode, createCommodityCode } from '../../types';

describe('AmountFormatterService', () => {
    let service: AmountFormatterService;
    let mockConfig: jest.Mocked<HLedgerConfig>;
    let numberFormatService: NumberFormatService;

    const rubFormat: CommodityFormat = {
        format: {
            decimalMark: ',',
            groupSeparator: ' ',
            decimalPlaces: 2,
            useGrouping: true
        },
        symbol: 'RUB',
        symbolBefore: false,
        symbolSpacing: true,
        template: '1 000,00 RUB'
    };

    const usdFormat: CommodityFormat = {
        format: {
            decimalMark: '.',
            groupSeparator: ',',
            decimalPlaces: 2,
            useGrouping: true
        },
        symbol: '$',
        symbolBefore: true,
        symbolSpacing: false,
        template: '$1,000.00'
    };

    beforeEach(() => {
        numberFormatService = new NumberFormatService();

        mockConfig = {
            getCommodityFormats: jest.fn(),
            getDefaultCommodity: jest.fn(),
        } as unknown as jest.Mocked<HLedgerConfig>;

        service = new AmountFormatterService(mockConfig, numberFormatService);
    });

    describe('formatPostingLine', () => {
        describe('posting with commodity', () => {
            it('should format amount when commodity format is defined', () => {
                const formats = new Map<CommodityCode, CommodityFormat>();
                formats.set(createCommodityCode('RUB'), rubFormat);
                mockConfig.getCommodityFormats.mockReturnValue(formats);
                mockConfig.getDefaultCommodity.mockReturnValue(null);

                const result = service.formatPostingLine('    Assets:Bank  1000 RUB');

                expect(result).toBe('    Assets:Bank  1 000,00 RUB');
            });

            it('should format negative amount with commodity', () => {
                const formats = new Map<CommodityCode, CommodityFormat>();
                formats.set(createCommodityCode('RUB'), rubFormat);
                mockConfig.getCommodityFormats.mockReturnValue(formats);
                mockConfig.getDefaultCommodity.mockReturnValue(null);

                const result = service.formatPostingLine('    Assets:Bank  -1000 RUB');

                expect(result).toBe('    Assets:Bank  -1 000,00 RUB');
            });

            it('should format with prefix symbol ($)', () => {
                const formats = new Map<CommodityCode, CommodityFormat>();
                formats.set(createCommodityCode('$'), usdFormat);
                mockConfig.getCommodityFormats.mockReturnValue(formats);
                mockConfig.getDefaultCommodity.mockReturnValue(null);

                const result = service.formatPostingLine('    Assets:Bank  $100');

                expect(result).toBe('    Assets:Bank  $100.00');
            });

            it('should return null when commodity format is not defined', () => {
                mockConfig.getCommodityFormats.mockReturnValue(new Map());
                mockConfig.getDefaultCommodity.mockReturnValue(null);

                const result = service.formatPostingLine('    Assets:Bank  1000 EUR');

                expect(result).toBeNull();
            });
        });

        describe('posting without commodity (use defaultCommodity)', () => {
            it('should format number only using default commodity format', () => {
                const formats = new Map<CommodityCode, CommodityFormat>();
                formats.set(createCommodityCode('RUB'), rubFormat);
                mockConfig.getCommodityFormats.mockReturnValue(formats);
                mockConfig.getDefaultCommodity.mockReturnValue(createCommodityCode('RUB'));

                const result = service.formatPostingLine('    Assets:Bank  1000');

                // Should format number but NOT add symbol
                expect(result).toBe('    Assets:Bank  1 000,00');
            });

            it('should format negative number without commodity', () => {
                const formats = new Map<CommodityCode, CommodityFormat>();
                formats.set(createCommodityCode('RUB'), rubFormat);
                mockConfig.getCommodityFormats.mockReturnValue(formats);
                mockConfig.getDefaultCommodity.mockReturnValue(createCommodityCode('RUB'));

                const result = service.formatPostingLine('    Assets:Bank  -1000');

                expect(result).toBe('    Assets:Bank  -1 000,00');
            });

            it('should return null when no default commodity is set', () => {
                mockConfig.getCommodityFormats.mockReturnValue(new Map());
                mockConfig.getDefaultCommodity.mockReturnValue(null);

                const result = service.formatPostingLine('    Assets:Bank  1000');

                expect(result).toBeNull();
            });

            it('should return null when default commodity has no format', () => {
                mockConfig.getCommodityFormats.mockReturnValue(new Map());
                mockConfig.getDefaultCommodity.mockReturnValue(createCommodityCode('EUR'));

                const result = service.formatPostingLine('    Assets:Bank  1000');

                expect(result).toBeNull();
            });
        });

        describe('non-posting lines', () => {
            it('should return null for transaction line', () => {
                mockConfig.getCommodityFormats.mockReturnValue(new Map());

                const result = service.formatPostingLine('2024-01-01 Supermarket');

                expect(result).toBeNull();
            });

            it('should return null for empty line', () => {
                mockConfig.getCommodityFormats.mockReturnValue(new Map());

                const result = service.formatPostingLine('');

                expect(result).toBeNull();
            });

            it('should return null for posting without amount', () => {
                mockConfig.getCommodityFormats.mockReturnValue(new Map());

                const result = service.formatPostingLine('    Assets:Bank');

                expect(result).toBeNull();
            });
        });

        describe('edge cases', () => {
            it('should preserve indentation', () => {
                const formats = new Map<CommodityCode, CommodityFormat>();
                formats.set(createCommodityCode('RUB'), rubFormat);
                mockConfig.getCommodityFormats.mockReturnValue(formats);
                mockConfig.getDefaultCommodity.mockReturnValue(null);

                const result = service.formatPostingLine('        Assets:Bank  1000 RUB');

                expect(result?.startsWith('        ')).toBe(true);
            });

            it('should handle already formatted amounts', () => {
                const formats = new Map<CommodityCode, CommodityFormat>();
                formats.set(createCommodityCode('RUB'), rubFormat);
                mockConfig.getCommodityFormats.mockReturnValue(formats);
                mockConfig.getDefaultCommodity.mockReturnValue(null);

                const result = service.formatPostingLine('    Assets:Bank  1 000,00 RUB');

                // Returns null when amount is already correctly formatted (no changes needed)
                expect(result).toBeNull();
            });

            it('should handle decimal amounts', () => {
                const formats = new Map<CommodityCode, CommodityFormat>();
                formats.set(createCommodityCode('RUB'), rubFormat);
                mockConfig.getCommodityFormats.mockReturnValue(formats);
                mockConfig.getDefaultCommodity.mockReturnValue(null);

                const result = service.formatPostingLine('    Assets:Bank  1234.56 RUB');

                expect(result).toBe('    Assets:Bank  1 234,56 RUB');
            });
        });

        describe('alignment column', () => {
            beforeEach(() => {
                const formats = new Map<CommodityCode, CommodityFormat>();
                formats.set(createCommodityCode('RUB'), rubFormat);
                mockConfig.getCommodityFormats.mockReturnValue(formats);
                mockConfig.getDefaultCommodity.mockReturnValue(createCommodityCode('RUB'));
            });

            it('should align amount to specified column', () => {
                // Account "Assets:Bank" = 11 chars + 4 indent = 15 chars
                // Column 40 means amount starts at position 40
                // Spacing = 40 - 15 = 25 spaces
                const result = service.formatPostingLine('    Assets:Bank  1000 RUB', 40);

                // Count characters before amount
                const amountStart = result?.indexOf('1 000,00');
                expect(amountStart).toBe(40);
            });

            it('should use minimum 2 spaces when account is longer than alignment column', () => {
                // Long account name that exceeds column 40
                const result = service.formatPostingLine('    Расходы:Супермаркет:Продукты:Молочные  1000 RUB', 40);

                // Should have at least 2 spaces before amount
                expect(result).toMatch(/Молочные {2,}\d/);
            });

            it('should align short account names correctly', () => {
                // Short account "A:B" = 3 chars + 4 indent = 7 chars
                // Column 40 means 33 spaces
                const result = service.formatPostingLine('    A:B  1000 RUB', 40);

                const amountStart = result?.indexOf('1 000,00');
                expect(amountStart).toBe(40);
            });

            it('should use default alignment when column not specified', () => {
                // Without column argument, should use 2 spaces (current behavior)
                const result = service.formatPostingLine('    Assets:Bank  1000 RUB');

                // Should have exactly 2 spaces after account (current default)
                expect(result).toBe('    Assets:Bank  1 000,00 RUB');
            });

            it('should align amounts without commodity symbol', () => {
                const result = service.formatPostingLine('    Assets:Bank  1000', 40);

                // Amount without symbol should also be aligned
                const amountStart = result?.indexOf('1 000,00');
                expect(amountStart).toBe(40);
            });

            it('should handle negative amounts with alignment', () => {
                const result = service.formatPostingLine('    Assets:Bank  -1000 RUB', 40);

                // Negative sign should be at alignment column
                const signStart = result?.indexOf('-1 000,00');
                expect(signStart).toBe(40);
            });
        });
    });

    describe('hledger syntax - format ALL amounts', () => {
        beforeEach(() => {
            const formats = new Map<CommodityCode, CommodityFormat>();
            formats.set(createCommodityCode('RUB'), rubFormat);
            formats.set(createCommodityCode('USD'), {
                format: {
                    decimalMark: ',',
                    groupSeparator: ' ',
                    decimalPlaces: 2,
                    useGrouping: true
                },
                symbol: 'USD',
                symbolBefore: false,
                symbolSpacing: true,
                template: '1 000,00 USD'
            });
            formats.set(createCommodityCode('AAPL'), {
                format: {
                    decimalMark: '.',
                    groupSeparator: '',
                    decimalPlaces: 0,
                    useGrouping: false
                },
                symbol: 'AAPL',
                symbolBefore: false,
                symbolSpacing: true,
                template: '10 AAPL'
            });
            mockConfig.getCommodityFormats.mockReturnValue(formats);
            mockConfig.getDefaultCommodity.mockReturnValue(createCommodityCode('RUB'));
        });

        describe('balance assertions', () => {
            it('should format both posting amount and balance assertion', () => {
                const result = service.formatPostingLine('    Assets:Bank  1000 RUB = 5000 RUB');
                expect(result).toBe('    Assets:Bank  1 000,00 RUB = 5 000,00 RUB');
            });

            it('should format balance assertion without posting amount', () => {
                const result = service.formatPostingLine('    Assets:Bank  = 5000 RUB');
                expect(result).toBe('    Assets:Bank  = 5 000,00 RUB');
            });

            it('should handle == (total assertion)', () => {
                const result = service.formatPostingLine('    Assets:Bank  1000 RUB == 5000 RUB');
                expect(result).toBe('    Assets:Bank  1 000,00 RUB == 5 000,00 RUB');
            });

            it('should handle =* (inclusive assertion)', () => {
                const result = service.formatPostingLine('    Assets:Bank  1000 RUB =* 5000 RUB');
                expect(result).toBe('    Assets:Bank  1 000,00 RUB =* 5 000,00 RUB');
            });

            it('should handle ==* (total inclusive assertion)', () => {
                const result = service.formatPostingLine('    Assets:Bank  1000 RUB ==* 5000 RUB');
                expect(result).toBe('    Assets:Bank  1 000,00 RUB ==* 5 000,00 RUB');
            });
        });

        describe('cost notation', () => {
            it('should format both quantity and price per unit @', () => {
                const result = service.formatPostingLine('    Assets:USD  100 USD @ 95.50 RUB');
                expect(result).toBe('    Assets:USD  100,00 USD @ 95,50 RUB');
            });

            it('should format both quantity and total cost @@', () => {
                const result = service.formatPostingLine('    Assets:USD  100 USD @@ 9550 RUB');
                expect(result).toBe('    Assets:USD  100,00 USD @@ 9 550,00 RUB');
            });

            it('should format stock purchase with @ price', () => {
                const result = service.formatPostingLine('    Assets:Stocks  10 AAPL @ 150 USD');
                expect(result).toBe('    Assets:Stocks  10 AAPL @ 150,00 USD');
            });

            it('should format stock purchase with @@ total', () => {
                const result = service.formatPostingLine('    Assets:Stocks  10 AAPL @@ 1500 USD');
                expect(result).toBe('    Assets:Stocks  10 AAPL @@ 1 500,00 USD');
            });
        });

        describe('virtual postings', () => {
            it('should format balanced virtual posting []', () => {
                const result = service.formatPostingLine('    [Budget:Food]  -1000 RUB');
                expect(result).toBe('    [Budget:Food]  -1 000,00 RUB');
            });

            it('should format unbalanced virtual posting ()', () => {
                const result = service.formatPostingLine('    (Tracking)  1000 RUB');
                expect(result).toBe('    (Tracking)  1 000,00 RUB');
            });

            it('should format virtual posting with balance assertion', () => {
                const result = service.formatPostingLine('    [Budget:Food]  -1000 RUB = -5000 RUB');
                expect(result).toBe('    [Budget:Food]  -1 000,00 RUB = -5 000,00 RUB');
            });
        });

        describe('inline comments', () => {
            it('should preserve inline comment after amount', () => {
                const result = service.formatPostingLine('    Expenses:Food  1000 RUB  ; groceries');
                expect(result).toBe('    Expenses:Food  1 000,00 RUB  ; groceries');
            });

            it('should preserve comment with balance assertion', () => {
                const result = service.formatPostingLine('    Assets:Bank  1000 RUB = 5000 RUB  ; check balance');
                expect(result).toBe('    Assets:Bank  1 000,00 RUB = 5 000,00 RUB  ; check balance');
            });

            it('should preserve comment with cost notation', () => {
                const result = service.formatPostingLine('    Assets:USD  100 USD @ 95.50 RUB  ; exchange rate');
                expect(result).toBe('    Assets:USD  100,00 USD @ 95,50 RUB  ; exchange rate');
            });
        });

        describe('default commodity (D directive)', () => {
            it('should format amount without explicit commodity using D directive', () => {
                const result = service.formatPostingLine('    Expenses:Food  1000');
                expect(result).toBe('    Expenses:Food  1 000,00');
            });

            it('should format amount without commodity in cost notation', () => {
                const result = service.formatPostingLine('    Assets:USD  100 @ 95.50');
                expect(result).toBe('    Assets:USD  100,00 @ 95,50');
            });

            it('should format amount without commodity in balance assertion', () => {
                const result = service.formatPostingLine('    Assets:Cash  1000 = 5000');
                expect(result).toBe('    Assets:Cash  1 000,00 = 5 000,00');
            });

            it('should format balance assertion without posting amount using D directive', () => {
                const result = service.formatPostingLine('    Assets:Cash  = 5000');
                expect(result).toBe('    Assets:Cash  = 5 000,00');
            });
        });

        describe('combined syntax', () => {
            it('should format all amounts in combined syntax', () => {
                const result = service.formatPostingLine('    Assets:USD  100 USD @ 95.50 RUB = 500 USD  ; purchase');
                expect(result).toBe('    Assets:USD  100,00 USD @ 95,50 RUB = 500,00 USD  ; purchase');
            });

            it('should handle complex posting with cost and assertion', () => {
                const result = service.formatPostingLine('    Assets:Stocks  10 AAPL @@ 1500 USD = 20 AAPL');
                expect(result).toBe('    Assets:Stocks  10 AAPL @@ 1 500,00 USD = 20 AAPL');
            });
        });
    });

    describe('formatDocumentContent', () => {
        it('should format all postings in document', () => {
            const formats = new Map<CommodityCode, CommodityFormat>();
            formats.set(createCommodityCode('RUB'), rubFormat);
            mockConfig.getCommodityFormats.mockReturnValue(formats);
            mockConfig.getDefaultCommodity.mockReturnValue(createCommodityCode('RUB'));

            const content = `2024-01-01 Supermarket
    Expenses:Food  1000 RUB
    Assets:Cash  -1000

2024-01-02 Salary
    Assets:Bank  50000
    Income:Salary`;

            const result = service.formatDocumentContent(content);

            // Check formatted amounts with flexible whitespace (alignment may vary)
            expect(result).toMatch(/Expenses:Food\s+1 000,00 RUB/);
            expect(result).toMatch(/Assets:Cash\s+-1 000,00/);
            expect(result).toMatch(/Assets:Bank\s+50 000,00/);
            // Income:Salary has no amount, should be unchanged
            expect(result).toContain('    Income:Salary');
        });

        it('should not modify lines without commodity format', () => {
            mockConfig.getCommodityFormats.mockReturnValue(new Map());
            mockConfig.getDefaultCommodity.mockReturnValue(null);

            const content = `2024-01-01 Test
    Assets:Bank  1000 EUR`;

            const result = service.formatDocumentContent(content);

            expect(result).toBe(content);
        });

        it('should pass alignment column to formatPostingLine', () => {
            const formats = new Map<CommodityCode, CommodityFormat>();
            formats.set(createCommodityCode('RUB'), rubFormat);
            mockConfig.getCommodityFormats.mockReturnValue(formats);
            mockConfig.getDefaultCommodity.mockReturnValue(createCommodityCode('RUB'));
            (mockConfig as unknown as { getAmountAlignmentColumn: () => number }).getAmountAlignmentColumn = jest.fn().mockReturnValue(40);

            const content = `2024-01-01 Test
    Assets:Bank  1000 RUB`;

            const result = service.formatDocumentContent(content);

            // Amount should be aligned to column 40
            const lines = result.split('\n');
            const postingLine = lines[1];
            const amountStart = postingLine?.indexOf('1 000,00');
            expect(amountStart).toBe(40);
        });
    });

    describe('European format with dot as thousands separator', () => {
        const europeanRubFormat: CommodityFormat = {
            format: {
                decimalMark: ',',
                groupSeparator: '.',
                decimalPlaces: 2,
                useGrouping: true
            },
            symbol: 'RUB',
            symbolBefore: false,
            symbolSpacing: true,
            template: '1.000,00 RUB'
        };

        beforeEach(() => {
            const formats = new Map<CommodityCode, CommodityFormat>();
            formats.set(createCommodityCode('RUB'), europeanRubFormat);
            mockConfig.getCommodityFormats.mockReturnValue(formats);
            mockConfig.getDefaultCommodity.mockReturnValue(createCommodityCode('RUB'));
        });

        it('should parse 1.614 RUB as 1614 (dot is thousands separator)', () => {
            // Bug: 1.614 was incorrectly parsed as 1.614 (decimal) and formatted as 1,61
            const result = service.formatPostingLine('    Assets:Bank  1.614 RUB');
            expect(result).toBe('    Assets:Bank  1.614,00 RUB');
        });

        it('should parse 1.700 RUB as 1700', () => {
            const result = service.formatPostingLine('    Assets:Bank  1.700 RUB');
            expect(result).toBe('    Assets:Bank  1.700,00 RUB');
        });

        it('should return null for already formatted 1.614,50 RUB', () => {
            // Already correctly formatted - returns null (no change needed)
            const result = service.formatPostingLine('    Assets:Bank  1.614,50 RUB');
            expect(result).toBeNull();
        });

        it('should parse plain number using default commodity format', () => {
            const result = service.formatPostingLine('    Assets:Bank  1.614');
            expect(result).toBe('    Assets:Bank  1.614,00');
        });
    });

    describe('format mismatch handling', () => {
        it('should return null when amount uses space separator but format expects dot', () => {
            const dotFormat: CommodityFormat = {
                format: {
                    decimalMark: ',',
                    groupSeparator: '.',
                    decimalPlaces: 2,
                    useGrouping: true
                },
                symbol: 'RUB',
                symbolBefore: false,
                symbolSpacing: true,
                template: '1.000,00 RUB'
            };

            const formats = new Map<CommodityCode, CommodityFormat>();
            formats.set(createCommodityCode('RUB'), dotFormat);
            mockConfig.getCommodityFormats.mockReturnValue(formats);
            mockConfig.getDefaultCommodity.mockReturnValue(null);

            const result = service.formatPostingLine('    Assets:Bank  -561 200,00 RUB');

            expect(result).toBeNull();
        });

        it('should return null when amount uses dot separator but format expects space', () => {
            const formats = new Map<CommodityCode, CommodityFormat>();
            formats.set(createCommodityCode('RUB'), rubFormat);
            mockConfig.getCommodityFormats.mockReturnValue(formats);
            mockConfig.getDefaultCommodity.mockReturnValue(null);

            const result = service.formatPostingLine('    Assets:Bank  1.234,56 RUB');

            expect(result).toBeNull();
        });

        it('should return null for large amount with space separator when format expects dot', () => {
            const dotFormat: CommodityFormat = {
                format: {
                    decimalMark: ',',
                    groupSeparator: '.',
                    decimalPlaces: 2,
                    useGrouping: true
                },
                symbol: 'RUB',
                symbolBefore: false,
                symbolSpacing: true,
                template: '1.000,00 RUB'
            };

            const formats = new Map<CommodityCode, CommodityFormat>();
            formats.set(createCommodityCode('RUB'), dotFormat);
            mockConfig.getCommodityFormats.mockReturnValue(formats);
            mockConfig.getDefaultCommodity.mockReturnValue(null);

            const result = service.formatPostingLine('    Assets:Bank  -6 856 852,35 RUB');

            expect(result).toBeNull();
        });
    });

    describe('ReDoS protection', () => {
        beforeEach(() => {
            const formats = new Map<CommodityCode, CommodityFormat>();
            formats.set(createCommodityCode('RUB'), rubFormat);
            mockConfig.getCommodityFormats.mockReturnValue(formats);
            mockConfig.getDefaultCommodity.mockReturnValue(createCommodityCode('RUB'));
        });

        it('should handle long account names efficiently', () => {
            const longAccount = 'a'.repeat(1000);
            const line = `    ${longAccount}  100 RUB`;
            const start = performance.now();
            service.formatPostingLine(line);
            const elapsed = performance.now() - start;
            expect(elapsed).toBeLessThan(100); // Should complete in <100ms
        });

        it('should handle long lines without delimiters efficiently', () => {
            const longContent = 'x'.repeat(500);
            const line = `    Account  100 RUB ${longContent}`;
            const start = performance.now();
            service.formatPostingLine(line);
            const elapsed = performance.now() - start;
            expect(elapsed).toBeLessThan(100);
        });

        it('should handle lines with many potential assertion markers', () => {
            // Line with many = characters that could trigger backtracking
            const manyEquals = '='.repeat(100);
            const line = `    Account${manyEquals}  100 RUB`;
            const start = performance.now();
            service.formatPostingLine(line);
            const elapsed = performance.now() - start;
            expect(elapsed).toBeLessThan(100);
        });

        it('should handle lines with many @ characters', () => {
            // Line with many @ characters that could trigger backtracking
            const manyAts = '@'.repeat(100);
            const line = `    Account${manyAts}  100 RUB`;
            const start = performance.now();
            service.formatPostingLine(line);
            const elapsed = performance.now() - start;
            expect(elapsed).toBeLessThan(100);
        });

        it('should handle lines with many semicolons', () => {
            // Line with many ; characters that could trigger backtracking
            const manySemis = ';'.repeat(100);
            const line = `    Account  100 RUB ${manySemis}`;
            const start = performance.now();
            service.formatPostingLine(line);
            const elapsed = performance.now() - start;
            expect(elapsed).toBeLessThan(100);
        });
    });
});
