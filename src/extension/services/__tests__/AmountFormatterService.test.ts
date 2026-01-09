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

                expect(result).toBe('    Assets:Bank  1 000,00 RUB');
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

            expect(result).toContain('    Expenses:Food  1 000,00 RUB');
            expect(result).toContain('    Assets:Cash  -1 000,00');
            expect(result).toContain('    Assets:Bank  50 000,00');
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
    });
});
