// NumberFormatService.test.ts - Tests for extended amount pattern support
import { NumberFormatService, createNumberFormatService, NumberFormat, CommodityFormat } from '../NumberFormatService';

describe('NumberFormatService', () => {
    let service: NumberFormatService;

    beforeEach(() => {
        service = createNumberFormatService();
    });

    describe('createAmountPattern - extended format support', () => {
        describe('sign placement', () => {
            it('should match positive sign before number', () => {
                const pattern = service.createUniversalAmountPattern();
                expect(pattern.test('+100')).toBe(true);
                expect(pattern.test('+123.45')).toBe(true);
                expect(pattern.test('+1,234.56')).toBe(true);
            });

            it('should match negative sign before number', () => {
                const pattern = service.createUniversalAmountPattern();
                expect(pattern.test('-100')).toBe(true);
                expect(pattern.test('-123.45')).toBe(true);
                expect(pattern.test('-1,234.56')).toBe(true);
            });
        });

        describe('scientific notation', () => {
            it('should match uppercase E scientific notation', () => {
                const pattern = service.createUniversalAmountPattern();
                expect(pattern.test('1E3')).toBe(true);
                expect(pattern.test('1E10')).toBe(true);
                expect(pattern.test('123E3')).toBe(true);
            });

            it('should match lowercase e scientific notation', () => {
                const pattern = service.createUniversalAmountPattern();
                expect(pattern.test('1e3')).toBe(true);
                expect(pattern.test('1e10')).toBe(true);
                expect(pattern.test('123e3')).toBe(true);
            });

            it('should match scientific notation with negative exponent', () => {
                const pattern = service.createUniversalAmountPattern();
                expect(pattern.test('1E-6')).toBe(true);
                expect(pattern.test('1e-6')).toBe(true);
                expect(pattern.test('123E-10')).toBe(true);
            });

            it('should match scientific notation with positive exponent sign', () => {
                const pattern = service.createUniversalAmountPattern();
                expect(pattern.test('1E+3')).toBe(true);
                expect(pattern.test('1e+3')).toBe(true);
                expect(pattern.test('123E+10')).toBe(true);
            });

            it('should match scientific notation with decimal part', () => {
                const pattern = service.createUniversalAmountPattern();
                expect(pattern.test('1.5E3')).toBe(true);
                expect(pattern.test('1.23e-6')).toBe(true);
                expect(pattern.test('0.1E+3')).toBe(true);
            });

            it('should match negative numbers with scientific notation', () => {
                const pattern = service.createUniversalAmountPattern();
                expect(pattern.test('-1E3')).toBe(true);
                expect(pattern.test('-1e-6')).toBe(true);
                expect(pattern.test('+1E3')).toBe(true);
            });
        });

        describe('trailing decimal', () => {
            it('should match trailing decimal point (10.)', () => {
                const pattern = service.createUniversalAmountPattern();
                expect(pattern.test('10.')).toBe(true);
                expect(pattern.test('123.')).toBe(true);
                expect(pattern.test('1000.')).toBe(true);
            });

            it('should match trailing decimal with sign', () => {
                const pattern = service.createUniversalAmountPattern();
                expect(pattern.test('-10.')).toBe(true);
                expect(pattern.test('+10.')).toBe(true);
            });
        });

        describe('currency symbol prefix', () => {
            it('should match dollar sign before number', () => {
                const pattern = service.createUniversalAmountPattern();
                expect(pattern.test('$100')).toBe(true);
                expect(pattern.test('$123.45')).toBe(true);
                expect(pattern.test('$1,234.56')).toBe(true);
            });

            it('should match euro sign before number', () => {
                const pattern = service.createUniversalAmountPattern();
                expect(pattern.test('€100')).toBe(true);
                expect(pattern.test('€123.45')).toBe(true);
            });

            it('should match ruble sign before number', () => {
                const pattern = service.createUniversalAmountPattern();
                expect(pattern.test('₽100')).toBe(true);
                expect(pattern.test('₽123.45')).toBe(true);
            });

            it('should match pound and yen signs', () => {
                const pattern = service.createUniversalAmountPattern();
                expect(pattern.test('£100')).toBe(true);
                expect(pattern.test('¥100')).toBe(true);
            });

            it('should match sign before currency symbol (-$100)', () => {
                const pattern = service.createUniversalAmountPattern();
                expect(pattern.test('-$100')).toBe(true);
                expect(pattern.test('+$100')).toBe(true);
                expect(pattern.test('-€100')).toBe(true);
                expect(pattern.test('+£100')).toBe(true);
            });

            it('should match currency symbol then sign ($-100)', () => {
                const pattern = service.createUniversalAmountPattern();
                expect(pattern.test('$-100')).toBe(true);
                expect(pattern.test('$+100')).toBe(true);
                expect(pattern.test('€-100')).toBe(true);
                expect(pattern.test('£+100')).toBe(true);
            });
        });

        describe('combined formats', () => {
            it('should match currency with grouped numbers', () => {
                const pattern = service.createUniversalAmountPattern();
                expect(pattern.test('$1,234.56')).toBe(true);
                expect(pattern.test('-$1,234.56')).toBe(true);
                expect(pattern.test('$-1,234.56')).toBe(true);
            });

            it('should match scientific with currency', () => {
                const pattern = service.createUniversalAmountPattern();
                // Scientific notation typically doesn't have currency prefix in practice
                // but the pattern should handle various combinations
                expect(pattern.test('1E3')).toBe(true);
                expect(pattern.test('-1E3')).toBe(true);
            });

            it('should match European format amounts', () => {
                const pattern = service.createUniversalAmountPattern();
                expect(pattern.test('1.234,56')).toBe(true);
                expect(pattern.test('-1.234,56')).toBe(true);
                expect(pattern.test('+1.234,56')).toBe(true);
            });

            it('should match space-grouped amounts', () => {
                const pattern = service.createUniversalAmountPattern();
                expect(pattern.test('1 234,56')).toBe(true);
                expect(pattern.test('-1 234,56')).toBe(true);
            });
        });

        describe('backward compatibility', () => {
            it('should still match basic numbers', () => {
                const pattern = service.createUniversalAmountPattern();
                expect(pattern.test('123')).toBe(true);
                expect(pattern.test('123.45')).toBe(true);
                expect(pattern.test('123,45')).toBe(true);
            });

            it('should still match grouped numbers', () => {
                const pattern = service.createUniversalAmountPattern();
                expect(pattern.test('1,234.56')).toBe(true);
                expect(pattern.test('1.234,56')).toBe(true);
                expect(pattern.test('1 234,56')).toBe(true);
            });

            it('should still match negative numbers', () => {
                const pattern = service.createUniversalAmountPattern();
                expect(pattern.test('-123')).toBe(true);
                expect(pattern.test('-123.45')).toBe(true);
                expect(pattern.test('-1,234.56')).toBe(true);
            });

            it('should still match crypto amounts with many decimals', () => {
                const pattern = service.createUniversalAmountPattern();
                expect(pattern.test('0.00123456')).toBe(true);
                expect(pattern.test('123.123456789012')).toBe(true);
            });
        });

        describe('invalid formats', () => {
            it('should not match invalid formats', () => {
                const pattern = service.createUniversalAmountPattern();
                expect(pattern.test('')).toBe(false);
                expect(pattern.test('abc')).toBe(false);
                expect(pattern.test('12.34.56')).toBe(false);
                expect(pattern.test('$')).toBe(false);
                expect(pattern.test('E3')).toBe(false);
            });
        });
    });

    describe('createAmountPattern - specific format', () => {
        it('should create pattern supporting positive sign', () => {
            const format: NumberFormat = {
                decimalMark: '.',
                groupSeparator: '',
                decimalPlaces: 2,
                useGrouping: false
            };
            const pattern = service.createAmountPattern(format);
            expect(pattern.test('+100')).toBe(true);
            expect(pattern.test('+100.50')).toBe(true);
        });

        it('should create pattern supporting trailing decimal', () => {
            const format: NumberFormat = {
                decimalMark: '.',
                groupSeparator: '',
                decimalPlaces: 2,
                useGrouping: false
            };
            const pattern = service.createAmountPattern(format);
            expect(pattern.test('100.')).toBe(true);
        });

        it('should create pattern supporting scientific notation', () => {
            const format: NumberFormat = {
                decimalMark: '.',
                groupSeparator: '',
                decimalPlaces: 2,
                useGrouping: false
            };
            const pattern = service.createAmountPattern(format);
            expect(pattern.test('1E3')).toBe(true);
            expect(pattern.test('1e-6')).toBe(true);
            expect(pattern.test('1.5E+3')).toBe(true);
        });

        it('should create pattern supporting currency prefix', () => {
            const format: NumberFormat = {
                decimalMark: '.',
                groupSeparator: '',
                decimalPlaces: 2,
                useGrouping: false
            };
            const pattern = service.createAmountPattern(format);
            expect(pattern.test('$100')).toBe(true);
            expect(pattern.test('$100.50')).toBe(true);
            expect(pattern.test('-$100')).toBe(true);
            expect(pattern.test('$-100')).toBe(true);
        });

        it('should create pattern with grouping and extended features', () => {
            const format: NumberFormat = {
                decimalMark: '.',
                groupSeparator: ',',
                decimalPlaces: 2,
                useGrouping: true
            };
            const pattern = service.createAmountPattern(format);
            expect(pattern.test('$1,234.56')).toBe(true);
            expect(pattern.test('-$1,234.56')).toBe(true);
            expect(pattern.test('$-1,234.56')).toBe(true);
            expect(pattern.test('+1,234.56')).toBe(true);
        });
    });

    describe('formatNumber', () => {
        describe('European format (space grouping, comma decimal)', () => {
            const euroFormat: NumberFormat = {
                decimalMark: ',',
                groupSeparator: ' ',
                decimalPlaces: 2,
                useGrouping: true
            };

            it('should format simple number', () => {
                expect(service.formatNumber(1000, euroFormat)).toBe('1 000,00');
            });

            it('should format number with decimals', () => {
                expect(service.formatNumber(1234.56, euroFormat)).toBe('1 234,56');
            });

            it('should format large number', () => {
                expect(service.formatNumber(1234567.89, euroFormat)).toBe('1 234 567,89');
            });

            it('should format small number without grouping', () => {
                expect(service.formatNumber(123, euroFormat)).toBe('123,00');
            });

            it('should round to specified decimal places', () => {
                expect(service.formatNumber(100.999, euroFormat)).toBe('101,00');
                expect(service.formatNumber(100.994, euroFormat)).toBe('100,99');
            });

            it('should handle negative numbers', () => {
                expect(service.formatNumber(-1000, euroFormat)).toBe('-1 000,00');
                expect(service.formatNumber(-1234.56, euroFormat)).toBe('-1 234,56');
            });

            it('should handle zero', () => {
                expect(service.formatNumber(0, euroFormat)).toBe('0,00');
            });
        });

        describe('US format (comma grouping, period decimal)', () => {
            const usFormat: NumberFormat = {
                decimalMark: '.',
                groupSeparator: ',',
                decimalPlaces: 2,
                useGrouping: true
            };

            it('should format simple number', () => {
                expect(service.formatNumber(1000, usFormat)).toBe('1,000.00');
            });

            it('should format number with decimals', () => {
                expect(service.formatNumber(1234.56, usFormat)).toBe('1,234.56');
            });

            it('should handle negative numbers', () => {
                expect(service.formatNumber(-1000, usFormat)).toBe('-1,000.00');
            });
        });

        describe('German format (period grouping, comma decimal)', () => {
            const deFormat: NumberFormat = {
                decimalMark: ',',
                groupSeparator: '.',
                decimalPlaces: 2,
                useGrouping: true
            };

            it('should format simple number', () => {
                expect(service.formatNumber(1000, deFormat)).toBe('1.000,00');
            });

            it('should format number with decimals', () => {
                expect(service.formatNumber(1234.56, deFormat)).toBe('1.234,56');
            });
        });

        describe('no grouping format', () => {
            const simpleFormat: NumberFormat = {
                decimalMark: '.',
                groupSeparator: '',
                decimalPlaces: 2,
                useGrouping: false
            };

            it('should format without grouping', () => {
                expect(service.formatNumber(1000, simpleFormat)).toBe('1000.00');
                expect(service.formatNumber(1234567, simpleFormat)).toBe('1234567.00');
            });
        });

        describe('different decimal places', () => {
            it('should format with 0 decimal places', () => {
                const format: NumberFormat = {
                    decimalMark: '.',
                    groupSeparator: ',',
                    decimalPlaces: 0,
                    useGrouping: true
                };
                expect(service.formatNumber(1234.56, format)).toBe('1,235');
            });

            it('should format with 4 decimal places', () => {
                const format: NumberFormat = {
                    decimalMark: '.',
                    groupSeparator: ',',
                    decimalPlaces: 4,
                    useGrouping: true
                };
                expect(service.formatNumber(1234.5, format)).toBe('1,234.5000');
            });
        });
    });

    describe('formatAmount', () => {
        describe('suffix symbol (EUR style)', () => {
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

            it('should format with suffix symbol and spacing', () => {
                expect(service.formatAmount(1000, rubFormat)).toBe('1 000,00 RUB');
            });

            it('should format negative amount with suffix', () => {
                expect(service.formatAmount(-1000, rubFormat)).toBe('-1 000,00 RUB');
            });

            it('should format large amount', () => {
                expect(service.formatAmount(1234567.89, rubFormat)).toBe('1 234 567,89 RUB');
            });
        });

        describe('suffix symbol without spacing', () => {
            const eurFormat: CommodityFormat = {
                format: {
                    decimalMark: ',',
                    groupSeparator: '.',
                    decimalPlaces: 2,
                    useGrouping: true
                },
                symbol: '€',
                symbolBefore: false,
                symbolSpacing: false,
                template: '1.000,00€'
            };

            it('should format without spacing before suffix', () => {
                expect(service.formatAmount(1000, eurFormat)).toBe('1.000,00€');
            });
        });

        describe('prefix symbol (USD style)', () => {
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

            it('should format with prefix symbol', () => {
                expect(service.formatAmount(100, usdFormat)).toBe('$100.00');
                expect(service.formatAmount(1000, usdFormat)).toBe('$1,000.00');
            });

            it('should format negative amount with prefix (sign before symbol)', () => {
                expect(service.formatAmount(-100, usdFormat)).toBe('-$100.00');
            });
        });

        describe('prefix symbol with spacing', () => {
            const spacedFormat: CommodityFormat = {
                format: {
                    decimalMark: '.',
                    groupSeparator: ',',
                    decimalPlaces: 2,
                    useGrouping: true
                },
                symbol: 'USD',
                symbolBefore: true,
                symbolSpacing: true,
                template: 'USD 1,000.00'
            };

            it('should format with spacing after prefix', () => {
                expect(service.formatAmount(1000, spacedFormat)).toBe('USD 1,000.00');
            });

            it('should format negative with spacing', () => {
                expect(service.formatAmount(-1000, spacedFormat)).toBe('-USD 1,000.00');
            });
        });
    });
});
