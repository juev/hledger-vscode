// strict-positioning-alignment.test.ts - Test for amount alignment in strict-positioning.journal
// This test reproduces the issue where only the first transaction gets formatted

import { DocumentFormatter } from '../DocumentFormatter';
import * as fs from 'fs';
import * as path from 'path';

describe('DocumentFormatter - Strict Positioning File Tests', () => {
    let formatter: DocumentFormatter;
    let testContent: string;

    beforeAll(() => {
        formatter = new DocumentFormatter();

        // Load the actual strict-positioning.journal file
        const testFilePath = path.join(__dirname, '../../../testdata/strict-positioning.journal');
        testContent = fs.readFileSync(testFilePath, 'utf8');
    });

    describe('formatContent with strict-positioning.journal', () => {
        it('should format ALL transactions in the file, not just the first one', () => {
            const result = formatter.formatContent(testContent);

            expect(result.success).toBe(true);
            if (!result.success) return;

            const formattedContent = result.data;
            const lines = formattedContent.split('\n');

            // Find all posting lines with amounts
            const postingLinesWithAmounts: Array<{
                lineNumber: number;
                accountName: string;
                amountPart: string;
                amountPosition: number;
            }> = [];

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i]!;
                const trimmedLine = line.trim();

                // Check if this is a posting line with an amount (2+ spaces or tabs)
                if ((line.startsWith('  ') || line.startsWith('\t')) &&
                    trimmedLine.match(/\S.*?\s{2,}\S+/)) {

                    const match = trimmedLine.match(/(\S.*?)(?:\s{2,}|\t)(.*)/);
                    if (match && match[2] && match[2].trim().length > 0) {
                        const accountName = match[1]!.trim();
                        let amountPart = match[2]!.trim();

                        // Check if this actually contains an amount (has numbers)
                        // Filter out lines that are just comments
                        if (!amountPart.startsWith(';') && /[\p{N}]/u.test(amountPart)) {
                            // Find the position of the amount in the original line
                            const amountStartPos = line.indexOf(amountPart);

                            postingLinesWithAmounts.push({
                                lineNumber: i + 1,
                                accountName,
                                amountPart,
                                amountPosition: amountStartPos
                            });
                        }
                    }
                }
            }

            // Assert that we found posting lines with amounts
            expect(postingLinesWithAmounts.length).toBeGreaterThan(0);

            // Get all unique amount positions
            const amountPositions = [...new Set(postingLinesWithAmounts.map(p => p.amountPosition))];

            // For proper alignment, we should have fewer unique positions than posting lines
            // (many amounts should be aligned at the same position)
            if (postingLinesWithAmounts.length > 1) {
                expect(amountPositions.length).toBeLessThan(postingLinesWithAmounts.length);

                // Filter out trading syntax (@@) from alignment calculation as it has different structure
                const regularAmounts = postingLinesWithAmounts.filter(p => !p.amountPart.includes('@@'));
                const regularPositions = [...new Set(regularAmounts.map(p => p.amountPosition))];

                if (regularPositions.length > 1) {
                    // Check that regular amounts are reasonably aligned (within a small range)
                    const maxPos = Math.max(...regularPositions);
                    const minPos = Math.min(...regularPositions);
                    const alignmentRange = maxPos - minPos;

                    // The alignment should be consistent (range should be small)
                    expect(alignmentRange).toBeLessThanOrEqual(5); // Allow some tolerance for different account lengths
                }
            }
        });

        it('should preserve transaction structure while formatting amounts', () => {
            const result = formatter.formatContent(testContent);

            expect(result.success).toBe(true);
            if (!result.success) return;

            const formattedContent = result.data;

            // Count transaction headers (lines starting with dates)
            const originalTransactions = testContent.split('\n').filter(line =>
                line.trim().match(/^(\d{4}[-\/\.]\d{1,2}[-\/\.]\d{1,2}|\d{1,2}[-\/\.]\d{1,2})/)
            ).length;

            const formattedTransactions = formattedContent.split('\n').filter(line =>
                line.trim().match(/^(\d{4}[-\/\.]\d{1,2}[-\/\.]\d{1,2}|\d{1,2}[-\/\.]\d{1,2})/)
            ).length;

            // Should preserve the same number of transactions
            expect(formattedTransactions).toBe(originalTransactions);
            expect(formattedTransactions).toBeGreaterThan(1); // Should have multiple transactions
        });

        it('should handle performance test transaction correctly', () => {
            const result = formatter.formatContent(testContent);

            expect(result.success).toBe(true);
            if (!result.success) return;

            const formattedContent = result.data;
            const lines = formattedContent.split('\n');

            // Find the performance test transaction (around line 100 in original)
            let performanceTestStart = -1;
            for (let i = 0; i < lines.length; i++) {
                if (lines[i]!.includes('Performance test transaction')) {
                    performanceTestStart = i;
                    break;
                }
            }

            expect(performanceTestStart).toBeGreaterThan(-1);

            // Check that the next several lines are properly formatted postings
            let postingLinesFound = 0;
            for (let i = performanceTestStart + 1; i < Math.min(performanceTestStart + 15, lines.length); i++) {
                const line = lines[i]!;
                if ((line.startsWith('  ') || line.startsWith('\t')) && line.trim().match(/\S.*?\s{2,}\S+/)) {
                    postingLinesFound++;
                }
            }

            // Should find several posting lines in the performance test
            expect(postingLinesFound).toBeGreaterThan(5);

            // Extract amount positions for performance test postings
            const performanceAmountPositions: number[] = [];
            for (let i = performanceTestStart + 1; i < Math.min(performanceTestStart + 15, lines.length); i++) {
                const line = lines[i]!;
                const trimmedLine = line.trim();
                const match = trimmedLine.match(/(\S.*?)(?:\s{2,}|\t)(.*)/);
                if (match && match[2] && match[2].trim().length > 0) {
                    const amountPart = match[2]!.trim();
                    const amountStartPos = line.indexOf(amountPart);
                    performanceAmountPositions.push(amountStartPos);
                }
            }

            console.log(`Performance test amount positions: ${performanceAmountPositions.join(', ')}`);

            // All amounts in the same transaction should be aligned consistently
            // Allow for 2 positions to handle signs (positive vs negative amounts)
            const uniquePositions = [...new Set(performanceAmountPositions)];
            expect(uniquePositions.length).toBeLessThanOrEqual(2);
        });
    });
});