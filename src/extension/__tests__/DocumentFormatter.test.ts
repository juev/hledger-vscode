// DocumentFormatter.test.ts - Unit tests for document formatting functionality

import { DocumentFormatter, createDocumentFormatter, FormattedTransaction } from '../DocumentFormatter';

describe('DocumentFormatter', () => {
    let formatter: DocumentFormatter;

    beforeEach(() => {
        formatter = new DocumentFormatter();
    });

    describe('Tab preservation', () => {
        it('should preserve tabs in content', () => {
            const content = `2025-01-15 * Test transaction
\tAssets:Bank\t\t100 USD
\tExpenses:Food\t\t-50 USD`;

            const result = formatter.formatContent(content);
            expect(result.success).toBe(true);

            if (result.success) {
                const formatted = result.data;
                // Should preserve tabs
                expect(formatted).toContain('\tAssets:Bank');
                expect(formatted).toContain('\tExpenses:Food');
                // Should align amounts properly
                expect(formatted).toContain('100 USD');
                expect(formatted).toContain('-50 USD');
            }
        });

        it('should handle mixed tabs and spaces', () => {
            const content = `2025-01-15 * Test transaction
  \tAssets:Bank    100 USD
\t  Expenses:Food  -50 USD`;

            const result = formatter.formatContent(content);
            expect(result.success).toBe(true);

            if (result.success) {
                const formatted = result.data;
                // Should format properly (may change original indentation)
                expect(formatted).toContain('Assets:Bank');
                expect(formatted).toContain('Expenses:Food');
                // Should align amounts
                expect(formatted).toContain('100 USD');
                expect(formatted).toContain('-50 USD');
            }
        });
    });

    describe('Posting indentation', () => {
        it('should apply correct 4-space indentation to postings', () => {
            const content = `2025-01-15 * Test transaction
  Assets:Bank        100 USD
   Expenses:Food     -50 USD`;

            const result = formatter.formatContent(content);
            expect(result.success).toBe(true);

            if (result.success) {
                const formatted = result.data;
                const lines = formatted.split('\n');
                expect(lines[1]).toMatch(/^    Assets:Bank/); // Exactly 4 spaces
                expect(lines[2]).toMatch(/^    Expenses:Food/); // Exactly 4 spaces
            }
        });

        it('should handle over-indented postings', () => {
            const content = `2025-01-15 * Test transaction
      Assets:Bank        100 USD
        Expenses:Food     -50 USD`;

            const result = formatter.formatContent(content);
            expect(result.success).toBe(true);

            if (result.success) {
                const formatted = result.data;
                const lines = formatted.split('\n');
                expect(lines[1]).toMatch(/^    Assets:Bank/); // Reduced to 4 spaces
                expect(lines[2]).toMatch(/^    Expenses:Food/); // Reduced to 4 spaces
            }
        });

        it('should preserve start-of-line comments', () => {
            const content = `2025-01-15 * Test transaction
    Assets:Bank        100 USD
    ; This is a comment
    Expenses:Food     -50 USD`;

            const result = formatter.formatContent(content);
            expect(result.success).toBe(true);

            if (result.success) {
                const formatted = result.data;
                const lines = formatted.split('\n');
                expect(lines[2]).toMatch(/^    ; This is a comment/); // Preserved as-is
            }
        });
    });

    describe('Inline comment alignment', () => {
        it('should align inline comments within transactions', () => {
            const content = `2025-01-15 * Test transaction
    Assets:Bank        100 USD  ; Bank account
    Expenses:Food     -50 USD   ; Grocery shopping`;

            const result = formatter.formatContent(content);
            expect(result.success).toBe(true);

            if (result.success) {
                const formatted = result.data;
                const lines = formatted.split('\n');
                expect(lines.length).toBeGreaterThanOrEqual(3);

                // Comments should be aligned
                const commentPos1 = lines[1]!.indexOf(';');
                const commentPos2 = lines[2]!.indexOf(';');
                expect(commentPos1).toBe(commentPos2);
                expect(commentPos1).toBeGreaterThan(0);
            }
        });

        it('should handle transactions without inline comments', () => {
            const content = `2025-01-15 * Test transaction
    Assets:Bank        100 USD
    Expenses:Food     -50 USD`;

            const result = formatter.formatContent(content);
            expect(result.success).toBe(true);

            if (result.success) {
                const formatted = result.data;
                expect(formatted).not.toContain(';');
            }
        });
    });

    describe('Amount alignment integration', () => {
        it('should integrate with DocumentFormatter for amount formatting', () => {
            const content = `2025-01-15 * Test transaction
    Assets:Bank  100 USD
    Expenses:Food     -50 USD`;

            const result = formatter.formatContent(content);
            expect(result.success).toBe(true);

            if (result.success) {
                const formatted = result.data;
                const lines = formatted.split('\n');
                expect(lines.length).toBeGreaterThanOrEqual(3);

                // Amounts should be aligned by their numeric values (ignore signs)
                const amountPos1 = lines[1]!.indexOf('100');
                const amountPos2 = lines[2]!.indexOf('50'); // Look for '50' not '-50'
                expect(amountPos1).toBe(amountPos2);
            }
        });

        it('should handle transactions with different account name lengths', () => {
            const content = `2025-01-15 * Test transaction
    Assets:Bank:Checking        100 USD
    Expenses                    -50 USD
    Assets:Savings:Emergency   200 USD`;

            const result = formatter.formatContent(content);
            expect(result.success).toBe(true);

            if (result.success) {
                const formatted = result.data;
                const lines = formatted.split('\n');

                // All amounts should be aligned to the same column
                const amountPositions = lines
                    .slice(1) // Skip header
                    .map(line => {
                        const match = line.match(/\d+/);
                        return match && match.index !== undefined ? match.index : -1;
                    })
                    .filter(pos => pos >= 0);

                // All amount positions should be the same
                if (amountPositions.length > 0) {
                    const firstPos = amountPositions[0];
                    expect(amountPositions.every(pos => pos === firstPos)).toBe(true);
                }
            }
        });
    });

    describe('Multiple transactions', () => {
        it('should format multiple transactions consistently', () => {
            const content = `2025-01-15 * Test transaction 1
    Assets:Bank        100 USD
    Expenses:Food     -50 USD

2025-01-16 * Test transaction 2
    Assets:Bank        200 USD
    Expenses:Gas     -30 USD`;

            const result = formatter.formatContent(content);
            expect(result.success).toBe(true);

            if (result.success) {
                const formatted = result.data;
                const lines = formatted.split('\n');

                // All postings should have 4-space indentation
                expect(lines[1]).toMatch(/^    Assets:Bank/);
                expect(lines[2]).toMatch(/^    Expenses:Food/);
                expect(lines[5]).toMatch(/^    Assets:Bank/);
                expect(lines[6]).toMatch(/^    Expenses:Gas/);

                // Empty lines should be preserved
                expect(lines[3]).toBe('');
            }
        });

        it('should handle directives between transactions', () => {
            const content = `2025-01-15 * Test transaction 1
    Assets:Bank        100 USD
    Expenses:Food     -50 USD

account Expenses:Gas

2025-01-16 * Test transaction 2
    Assets:Bank        200 USD
    Expenses:Gas     -30 USD`;

            const result = formatter.formatContent(content);
            expect(result.success).toBe(true);

            if (result.success) {
                const formatted = result.data;
                const lines = formatted.split('\n');

                // Directives should not be indented
                expect(lines[4]).toMatch(/^account Expenses:Gas/);
            }
        });
    });

    describe('Balance assertions', () => {
        it('should not modify alignment for lines with balance assertions', () => {
            const content = `2025-01-15 * Test transaction
    Assets:Bank  1000 RUB = 5000 RUB
    Expenses:Food  -500 RUB`;

            const result = formatter.formatContent(content);
            expect(result.success).toBe(true);

            if (result.success) {
                const lines = result.data.split('\n');
                // Line with = should preserve original spacing between account and amount
                expect(lines[1]).toContain('Assets:Bank  1000 RUB = 5000 RUB');
            }
        });

        it('should not modify various balance assertion operators', () => {
            const content = `2025-01-15 * Test
    Assets:Bank  100 USD = 500 USD
    Assets:Cash  50 USD == 100 USD
    Assets:Gold  10 oz =* 20 oz`;

            const result = formatter.formatContent(content);
            expect(result.success).toBe(true);

            if (result.success) {
                const lines = result.data.split('\n');
                expect(lines[1]).toContain('Assets:Bank  100 USD = 500 USD');
                expect(lines[2]).toContain('Assets:Cash  50 USD == 100 USD');
                expect(lines[3]).toContain('Assets:Gold  10 oz =* 20 oz');
            }
        });

        it('should format account names containing equals sign', () => {
            // Note: The account with = has poor alignment that needs fixing
            const content = `2025-01-15 * Test transaction
    Expenses:Meeting=Food     100 USD
    Assets:Cash               -100 USD`;

            const result = formatter.formatContent(content);
            expect(result.success).toBe(true);

            if (result.success) {
                const lines = result.data.split('\n');
                // Account name with = should still be formatted (aligned properly)
                // Both accounts should have same amount alignment column
                expect(lines[1]).toMatch(/^\s+Expenses:Meeting=Food\s+100 USD$/);
                expect(lines[2]).toMatch(/^\s+Assets:Cash\s+-100 USD$/);

                // Verify both amounts start at same column (proper alignment)
                const amount1Pos = lines[1]?.indexOf('100 USD') ?? -1;
                const amount2Pos = lines[2]?.indexOf('-100 USD') ?? -1;
                expect(amount1Pos).toBeGreaterThan(0);
                expect(amount2Pos).toBeGreaterThan(0);
                // The "-" is part of amount, so positions should align at the digit
                expect(amount1Pos).toBe(amount2Pos + 1); // -100 has extra char
            }
        });

        it('should format account names with multiple equals signs', () => {
            const content = `2025-01-15 * Test
    Expenses:Key=Value=Data  50 EUR
    Assets:Bank  -50 EUR`;

            const result = formatter.formatContent(content);
            expect(result.success).toBe(true);

            if (result.success) {
                const lines = result.data.split('\n');
                expect(lines[1]).toMatch(/^\s+Expenses:Key=Value=Data\s+50 EUR$/);
            }
        });
    });

    describe('Edge cases', () => {
        it('should handle empty content', () => {
            const result = formatter.formatContent('');
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toBe('');
            }
        });

        it('should handle content with only comments', () => {
            const content = `; This is a comment
; Another comment`;

            const result = formatter.formatContent(content);
            expect(result.success).toBe(true);

            if (result.success) {
                const formatted = result.data;
                expect(formatted).toContain('; This is a comment');
                expect(formatted).toContain('; Another comment');
            }
        });

        it('should handle malformed transactions gracefully', () => {
            const content = `2025-01-15 * Test transaction
    Assets:Bank        100 USD
    ; Missing second posting

2025-01-16 * Another transaction
    Expenses:Food     -50 USD`;

            const result = formatter.formatContent(content);
            expect(result.success).toBe(true); // Should not crash
        });
    });

    describe('Custom formatting options', () => {
        it('should preserve tabs in content', () => {
            const customFormatter = new DocumentFormatter();
            const content = `2025-01-15 * Test transaction
	Assets:Bank	100 USD`;

            const result = customFormatter.formatContent(content);
            expect(result.success).toBe(true);

            if (result.success) {
                const formatted = result.data;
                // Should preserve tabs since we don't convert them anymore
                expect(formatted).toContain('\tAssets:Bank');
            }
        });

        it('should use custom posting indentation', () => {
            const customFormatter = new DocumentFormatter({ postingIndent: 2 });
            const content = `2025-01-15 * Test transaction
    Assets:Bank        100 USD`;

            const result = customFormatter.formatContent(content);
            expect(result.success).toBe(true);

            if (result.success) {
                const formatted = result.data;
                const lines = formatted.split('\n');
                expect(lines[1]).toMatch(/^  Assets:Bank/); // 2 spaces, not 4
            }
        });
    });
});

describe('createDocumentFormatter', () => {
    it('should create formatter with default options', () => {
        const formatter = createDocumentFormatter();
        expect(formatter).toBeInstanceOf(DocumentFormatter);
    });

    it('should create formatter with custom options', () => {
        const formatter = createDocumentFormatter({ postingIndent: 6 });
        expect(formatter).toBeInstanceOf(DocumentFormatter);
    });
});