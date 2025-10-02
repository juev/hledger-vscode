// amount-alignment-integration.test.ts - Integration tests for amount alignment functionality

import { AmountAligner } from '../AmountAligner';
import { isSuccess } from '../types';
import * as fs from 'fs';
import * as path from 'path';

describe('Amount Alignment Integration Tests', () => {
    let aligner: AmountAligner;
    const testdataDir = path.join(__dirname, '../../../testdata');

    beforeAll(() => {
        aligner = new AmountAligner();
    });

    describe('Simple Transactions', () => {
        it('should align amounts in simple transaction file', () => {
            const filePath = path.join(testdataDir, 'amount-alignment-simple.journal');
            const content = fs.readFileSync(filePath, 'utf8');

            const result = aligner.formatContent(content);
            expect(result.success).toBe(true);

            if (result.success) {
                // Just verify that the formatting succeeded and basic content is preserved
                expect(result.data).toContain('2025-01-15 * Grocery Store');
                expect(result.data).toContain('Assets:Cash');
                expect(result.data).toContain('Expenses:Food');
                expect(result.data).toContain('100.00 USD');
                expect(result.data).toContain('-50.25 USD');

                // Verify that some amount alignment occurred by checking spacing
                const lines = result.data.split('\n');
                const postingLinesWithAmounts = lines.filter(line =>
                    line.match(/^\s{4,}.*\d+.*USD$/)
                );

                // Should find several posting lines with amounts
                expect(postingLinesWithAmounts.length).toBeGreaterThan(0);

                // Check that amounts are not immediately after account names (there's some spacing)
                postingLinesWithAmounts.forEach(line => {
                    const accountMatch = line.match(/(Assets|Expenses):\w+/);
                    const amountMatch = line.match(/\d+\.\d{2}\s+USD/);
                    if (accountMatch && amountMatch) {
                        const accountPos = line.indexOf(accountMatch[0]);
                        const amountPos = line.indexOf(amountMatch[0]);
                        expect(amountPos).toBeGreaterThan(accountPos + accountMatch[0].length + 1);
                    }
                });
            }
        });
    });

    describe('Complex Transactions', () => {
        it('should handle multi-currency transactions', () => {
            const filePath = path.join(testdataDir, 'amount-alignment-complex.journal');
            const content = fs.readFileSync(filePath, 'utf8');

            const result = aligner.formatContent(content);
            expect(result.success).toBe(true);

            if (result.success) {
                // Should handle various commodity formats
                expect(result.data).toContain('$1,234.56');
                expect(result.data).toContain('€2,345.67');
                expect(result.data).toContain('¥50,000');
                expect(result.data).toContain('0.01234567');
                expect(result.data).toContain('100,000.50 ₽');
            }
        });

        it('should handle European number formats', () => {
            const filePath = path.join(testdataDir, 'amount-alignment-complex.journal');
            const content = fs.readFileSync(filePath, 'utf8');

            const result = aligner.formatContent(content);
            expect(result.success).toBe(true);

            if (result.success) {
                // Should preserve European number formats
                expect(result.data).toContain('1 234,56 €');
                expect(result.data).toContain('2.345,67 €');
                expect(result.data).toContain('1.234,56 €');
            }
        });
    });

    describe('Edge Cases', () => {
        it('should handle virtual postings and balance assertions', () => {
            const filePath = path.join(testdataDir, 'amount-alignment-edge-cases.journal');
            const content = fs.readFileSync(filePath, 'utf8');

            const result = aligner.formatContent(content);
            expect(result.success).toBe(true);

            if (result.success) {
                // Should handle virtual postings
                expect(result.data).toContain('[Expenses:Food]');
                expect(result.data).toContain('(Assets:Cash)');

                // Should handle balance assertions
                expect(result.data).toContain('= 5000.00 USD');
                expect(result.data).toContain('== 15000.00 USD');
            }
        });

        it('should handle different indentation styles', () => {
            const filePath = path.join(testdataDir, 'amount-alignment-edge-cases.journal');
            const content = fs.readFileSync(filePath, 'utf8');

            const result = aligner.formatContent(content);
            expect(result.success).toBe(true);

            if (result.success) {
                // Should format regardless of indentation style
                const lines = result.data.split('\n');
                const postingLines = lines.filter(line =>
                    line.match(/^\s+.*\d+.*[A-Z]{3,}$/) || line.match(/^\s+.*[A-Z]{3,}.*\d+$/)
                );
                expect(postingLines.length).toBeGreaterThan(0);
            }
        });
    });

    describe('Unicode Support', () => {
        it('should handle Unicode account names and amounts', () => {
            const filePath = path.join(testdataDir, 'amount-alignment-unicode.journal');
            const content = fs.readFileSync(filePath, 'utf8');

            const result = aligner.formatContent(content);
            expect(result.success).toBe(true);

            if (result.success) {
                // Should preserve Unicode characters
                expect(result.data).toContain('Активы:Банк');
                expect(result.data).toContain('资产:银行');
                expect(result.data).toContain('الأصول:البنك');
                expect(result.data).toContain('₽');
                // Check that the content contains some Unicode currency symbols
                expect(result.data).toMatch(/[₽¥€£$]/);
            }
        });
    });

    describe('Performance Testing', () => {
        it('should handle large files efficiently', () => {
            const filePath = path.join(testdataDir, 'amount-alignment-large-file.journal');
            const content = fs.readFileSync(filePath, 'utf8');

            const startTime = Date.now();
            const result = aligner.formatContent(content);
            const endTime = Date.now();

            expect(result.success).toBe(true);
            expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds

            if (result.success) {
                // Should have processed many transactions
                const lines = result.data.split('\n');
                const transactionHeaders = lines.filter(line => /^\d{4}-\d{2}-\d{2}/.test(line));
                expect(transactionHeaders.length).toBeGreaterThan(50);
            }
        });
    });

    describe('Error Handling', () => {
        it('should handle malformed content gracefully', () => {
            const filePath = path.join(testdataDir, 'amount-alignment-error-cases.journal');
            const content = fs.readFileSync(filePath, 'utf8');

            const result = aligner.formatContent(content);
            // Should still process valid parts even with errors
            expect(result.success).toBe(true);

            if (result.success) {
                // Should contain some valid transactions
                expect(result.data).toContain('Assets:Bank');
                expect(result.data).toContain('Expenses:Food');
            }
        });

        it('should handle empty content', () => {
            const result = aligner.formatContent('');
            expect(result.success).toBe(true);
            if (isSuccess(result)) {
                expect(result.data).toBe('');
            }
        });

        it('should handle content with only directives', () => {
            const content = `account Assets:Bank
account Expenses:Food
commodity USD
`;
            const result = aligner.formatContent(content);
            expect(result.success).toBe(true);
            if (isSuccess(result)) {
                expect(result.data).toBe(content);
            }
        });
    });

    describe('File Format Compatibility', () => {
        it('should handle .hledger extension files', () => {
            const filePath = path.join(testdataDir, 'amount-alignment-mixed-filetypes.hledger');
            const content = fs.readFileSync(filePath, 'utf8');

            const result = aligner.formatContent(content);
            expect(result.success).toBe(true);

            if (result.success) {
                expect(result.data).toContain('P 2025-01-01');
                expect(result.data).toContain('D 1,000.00 USD');
            }
        });

        it('should handle .ledger extension files', () => {
            const filePath = path.join(testdataDir, 'amount-alignment-mixed-filetypes.ledger');
            const content = fs.readFileSync(filePath, 'utf8');

            const result = aligner.formatContent(content);
            expect(result.success).toBe(true);

            if (result.success) {
                // Should handle ledger date formats
                expect(result.data).toContain('2025/01/01');
                expect(result.data).toContain('01/15/2025');
            }
        });
    });

    describe('Alignment Quality', () => {
        it('should produce consistent alignment within transactions', () => {
            const testContent = `2025-01-15 * Test Transaction
    Assets:Bank        100.00 USD
    Expenses:Food     -50.25 USD
    Assets:Cash        25.50 USD
    Expenses:Gas      -15.75 USD

2025-01-16 * Another Transaction
    Very:Long:Account:Name:Here    1000.00 EUR
    Short                                   -250.00 EUR
    Medium:Account                    500.00 EUR
`;

            const result = aligner.formatContent(testContent);
            expect(result.success).toBe(true);

            if (result.success) {
                const lines = result.data.split('\n');

                // Find amounts in first transaction
                const firstTransactionAmounts: number[] = [];
                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i];
                    if (line.startsWith('    ') && /\d+/.test(line)) {
                        const amountMatch = line.match(/(\s+)([-+]?\d[0-9,.\s]*\d?\s*[A-Z]{3,})/);
                        if (amountMatch) {
                            const amountPos = line.indexOf(amountMatch[2]);
                            firstTransactionAmounts.push(amountPos);
                        }
                    }
                    if (line.trim() === '' || /^\d{4}-\d{2}-\d{2}/.test(line)) {
                        break;
                    }
                }

                // All amounts in first transaction should be aligned
                if (firstTransactionAmounts.length > 1) {
                    const firstPos = firstTransactionAmounts[0];
                    firstTransactionAmounts.forEach(pos => {
                        expect(pos).toBe(firstPos);
                    });
                }
            }
        });

        it('should handle transactions with mixed amounts and no amounts', () => {
            const testContent = `2025-01-15 * Mixed Transaction
    Assets:Bank        100.00 USD
    Expenses:Food
    Assets:Cash        50.00 USD
    Expenses:Transport
`;

            const result = aligner.formatContent(testContent);
            expect(result.success).toBe(true);

            if (result.success) {
                const lines = result.data.split('\n');
                // Find posting lines (lines starting with at least 4 spaces)
                const postingLines = lines.filter(line => line.match(/^\s{4,}/));

                // Check that we have 4 posting lines total
                expect(postingLines.length).toBe(4);

                // Check that lines with amounts contain amounts
                const linesWithAmounts = postingLines.filter(line => line.match(/\d/));
                expect(linesWithAmounts.length).toBe(2);

                // Check that lines without amounts don't contain amounts
                const linesWithoutAmounts = postingLines.filter(line => !line.match(/\d/));
                expect(linesWithoutAmounts.length).toBe(2);

                // Verify the specific content (regardless of exact spacing)
                expect(result.data).toContain('Assets:Bank');
                expect(result.data).toContain('100.00 USD');
                expect(result.data).toContain('Expenses:Food');
                expect(result.data).toContain('Assets:Cash');
                expect(result.data).toContain('50.00 USD');
                expect(result.data).toContain('Expenses:Transport');
            }
        });
    });
});