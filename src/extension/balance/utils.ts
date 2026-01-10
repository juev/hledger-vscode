/**
 * Shared utilities for balance assertion detection.
 * Consolidates patterns used across DocumentFormatter, AmountFormatterService, and AmountParser.
 */

/**
 * Pattern to detect balance assertions in posting lines.
 * Matches: =, ==, =*, ==*, :=
 * Requires whitespace before and after the assertion operator.
 * This prevents matching equals signs in account names (e.g., "Expenses:Meeting=Food").
 */
export const BALANCE_ASSERTION_PATTERN = /\s+(:?={1,2}\*?)\s+/;

/**
 * Checks if a line contains a balance assertion.
 * Returns false for comment-only lines and lines without proper assertion syntax.
 *
 * @param line - The line to check
 * @returns true if the line contains a balance assertion
 */
export function hasBalanceAssertion(line: string): boolean {
    const trimmed = line.trimStart();

    if (trimmed.startsWith(';')) {
        return false;
    }

    if (/^(commodity|account|alias|include|P)\s/.test(trimmed)) {
        return false;
    }

    if (/^\d{4}[-/]/.test(trimmed)) {
        return false;
    }

    return BALANCE_ASSERTION_PATTERN.test(line);
}
