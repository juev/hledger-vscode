// utils.ts - Utility functions for the hledger extension

/**
 * Escapes special regex characters in a string to make it safe for use in a regular expression.
 * 
 * @param str The string to escape
 * @returns The escaped string
 * 
 * @example
 * ```typescript
 * const escaped = escapeRegex('1.234,56');
 * console.log(escaped); // '1\\.234,56'
 * ```
 */
export function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}