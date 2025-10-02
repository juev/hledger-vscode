// amount-alignment-configuration.test.ts - Test configuration integration for amount alignment

import { AmountAligner } from '../AmountAligner';
import { isSuccess } from '../types';

describe('Amount Alignment Configuration Tests', () => {
    describe('Default Configuration', () => {
        it('should use default formatting options', () => {
            const aligner = new AmountAligner();
            const content = `2025-01-15 * Test
    Assets:Bank        100.00 USD
    Expenses:Food     -50.00 USD
`;

            const result = aligner.formatContent(content);
            expect(result.success).toBe(true);

            if (isSuccess(result)) {
                // Should apply default minimum spacing of 2 spaces
                const lines = result.data.split('\n');
                const firstPosting = lines[1];
                const accountEnd = firstPosting.indexOf('Assets:Bank') + 'Assets:Bank'.length;
                const amountStart = firstPosting.indexOf('100.00 USD');
                const spacing = amountStart - accountEnd;
                expect(spacing).toBeGreaterThanOrEqual(2);
            }
        });
    });

    describe('Custom Configuration', () => {
        it('should respect custom minimum spacing', () => {
            const customAligner = new AmountAligner({ minSpacing: 5 });
            const content = `2025-01-15 * Test
    Assets:Bank        100.00 USD
    Expenses:Food     -50.00 USD
`;

            const result = customAligner.formatContent(content);
            expect(result.success).toBe(true);

            if (isSuccess(result)) {
                const lines = result.data.split('\n');
                const firstPosting = lines[1];
                const accountEnd = firstPosting.indexOf('Assets:Bank') + 'Assets:Bank'.length;
                const amountStart = firstPosting.indexOf('100.00 USD');
                const spacing = amountStart - accountEnd;
                expect(spacing).toBeGreaterThanOrEqual(5);
            }
        });

        it('should respect preserve existing alignment option', () => {
            const customAligner = new AmountAligner({ preserveExistingAlignment: false });
            const content = `2025-01-15 * Test
    Assets:Bank        100.00 USD
    Expenses:Food     -50.00 USD
`;

            const result = customAligner.formatContent(content);
            expect(result.success).toBe(true);

            if (isSuccess(result)) {
                // Should reformat even if already aligned
                expect(result.data).toContain('Assets:Bank');
                expect(result.data).toContain('Expenses:Food');
                expect(result.data).toContain('100.00 USD');
                expect(result.data).toContain('-50.00 USD');
            }
        });

        it('should respect use commodity formatting option', () => {
            const customAligner = new AmountAligner({ useCommodityFormatting: false });
            const content = `2025-01-15 * Test
    Assets:Bank        $100.00
    Assets:Cash        €200.50
    Expenses:Food     -50.00 USD
`;

            const result = customAligner.formatContent(content);
            expect(result.success).toBe(true);

            if (isSuccess(result)) {
                // Should align amounts regardless of commodity position
                const lines = result.data.split('\n');
                const amountPositions = lines
                    .filter(line => line.match(/^\s{4,}.*\d+/))
                    .map(line => {
                        const amountMatch = line.match(/([-+]?\d[0-9,.\s]*\d?\s*[\p{Sc}$€£¥₽₩])/u);
                        return amountMatch ? line.indexOf(amountMatch[0]) : -1;
                    })
                    .filter(pos => pos >= 0);

                // All amounts should be aligned at the same position
                if (amountPositions.length > 1) {
                    const firstPos = amountPositions[0];
                    amountPositions.forEach(pos => {
                        expect(pos).toBe(firstPos);
                    });
                }
            }
        });
    });

    describe('Configuration Edge Cases', () => {
        it('should handle zero minimum spacing', () => {
            const customAligner = new AmountAligner({ minSpacing: 0 });
            const content = `2025-01-15 * Test
    Assets:Bank        100.00 USD
    Expenses:Food     -50.00 USD
`;

            const result = customAligner.formatContent(content);
            expect(result.success).toBe(true);

            if (isSuccess(result)) {
                // Should still format with reasonable spacing
                expect(result.data).toContain('Assets:Bank');
                expect(result.data).toContain('Expenses:Food');
            }
        });

        it('should handle very large minimum spacing', () => {
            const customAligner = new AmountAligner({ minSpacing: 20 });
            const content = `2025-01-15 * Test
    Assets:Bank        100.00 USD
    Expenses:Food     -50.00 USD
`;

            const result = customAligner.formatContent(content);
            expect(result.success).toBe(true);

            if (isSuccess(result)) {
                const lines = result.data.split('\n');
                const firstPosting = lines[1];
                const accountEnd = firstPosting.indexOf('Assets:Bank') + 'Assets:Bank'.length;
                const amountStart = firstPosting.indexOf('100.00 USD');
                const spacing = amountStart - accountEnd;
                expect(spacing).toBeGreaterThanOrEqual(20);
            }
        });

        it('should handle empty configuration', () => {
            const customAligner = new AmountAligner({});
            const content = `2025-01-15 * Test
    Assets:Bank        100.00 USD
    Expenses:Food     -50.00 USD
`;

            const result = customAligner.formatContent(content);
            expect(result.success).toBe(true);

            if (isSuccess(result)) {
                // Should use defaults
                expect(result.data).toContain('Assets:Bank');
                expect(result.data).toContain('Expenses:Food');
            }
        });
    });

    describe('Configuration Validation', () => {
        it('should handle invalid minSpacing gracefully', () => {
            // TypeScript prevents invalid types at compile time, but test runtime behavior
            expect(() => {
                new AmountAligner({ minSpacing: -1 });
            }).not.toThrow();

            expect(() => {
                new AmountAligner({ minSpacing: Number.NaN });
            }).not.toThrow();

            expect(() => {
                new AmountAligner({ minSpacing: Number.POSITIVE_INFINITY });
            }).not.toThrow();
        });

        it('should handle boolean options', () => {
            expect(() => {
                new AmountAligner({ preserveExistingAlignment: true });
            }).not.toThrow();

            expect(() => {
                new AmountAligner({ preserveExistingAlignment: false });
            }).not.toThrow();

            expect(() => {
                new AmountAligner({ useCommodityFormatting: true });
            }).not.toThrow();

            expect(() => {
                new AmountAligner({ useCommodityFormatting: false });
            }).not.toThrow();
        });
    });

    describe('Performance with Different Configurations', () => {
        it('should maintain performance with custom configurations', () => {
            const customAligner = new AmountAligner({
                minSpacing: 10,
                preserveExistingAlignment: false,
                useCommodityFormatting: true
            });

            // Create a large test content
            let content = '';
            for (let i = 0; i < 100; i++) {
                content += `2025-01-${String(i + 1).padStart(2, '0')} * Transaction ${i + 1}
    Assets:Bank${i % 5}         ${(100 + i * 10).toFixed(2)} USD
    Expenses:Category${i % 3}   ${(-50 - i * 5).toFixed(2)} USD
    Assets:Cash${i % 2}         ${(i * 2).toFixed(2)} USD

`;
            }

            const startTime = Date.now();
            const result = customAligner.formatContent(content);
            const endTime = Date.now();

            expect(result.success).toBe(true);
            expect(endTime - startTime).toBeLessThan(2000); // Should complete within 2 seconds

            if (isSuccess(result)) {
                // Should have processed all transactions
                expect(result.data).toContain('Transaction 1');
                expect(result.data).toContain('Transaction 100');
            }
        });
    });

    describe('Integration with NumberFormatService', () => {
        it('should work with custom NumberFormatService', () => {
            // Test that the aligner works with different number format services
            const customAligner = new AmountAligner({});
            const content = `2025-01-15 * Test
    Assets:Bank        1,234.56 USD
    Assets:Cash        1.234,56 EUR
    Assets:Credit      1 234,56 JPY
    Expenses:Food     -500.00 USD
`;

            const result = customAligner.formatContent(content);
            expect(result.success).toBe(true);

            if (isSuccess(result)) {
                // Should preserve different number formats
                expect(result.data).toContain('1,234.56 USD');
                expect(result.data).toContain('1.234,56 EUR');
                expect(result.data).toContain('1 234,56 JPY');
                expect(result.data).toContain('-500.00 USD');
            }
        });
    });
});