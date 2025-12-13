/**
 * Parser for tabular data (CSV/TSV) with auto-delimiter detection
 * Handles RFC 4180 compliant CSV with quoted values
 */

import {
    Delimiter,
    ParsedTabularData,
    ParsedRow,
    TabularDataParserOptions,
    DEFAULT_PARSER_OPTIONS,
    ColumnMapping,
} from './types';

/** Result type for parsing operations */
type ParseResult<T> =
    | { success: true; value: T }
    | { success: false; error: string };

function success<T>(value: T): ParseResult<T> {
    return { success: true, value };
}

function failure<T>(error: string): ParseResult<T> {
    return { success: false, error };
}

/**
 * Parser for tabular data with auto-delimiter detection
 */
export class TabularDataParser {
    private readonly options: TabularDataParserOptions;

    constructor(options?: Partial<TabularDataParserOptions>) {
        this.options = { ...DEFAULT_PARSER_OPTIONS, ...options };
    }

    /**
     * Parse tabular data from string content
     * Auto-detects delimiter if not specified
     */
    parse(
        content: string,
        delimiter?: Delimiter,
        columnMappings?: readonly ColumnMapping[]
    ): ParseResult<ParsedTabularData> {
        if (!content.trim()) {
            return failure('Empty content');
        }

        // Normalize line endings
        const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const lines = normalizedContent.split('\n');

        // Track original line numbers before filtering
        // Each entry is { line: string, originalLineNumber: number }
        const linesWithNumbers = lines.map((line, index) => ({
            line,
            originalLineNumber: index + 1,
        }));

        // Filter empty lines if configured, preserving original line numbers
        const nonEmptyLinesWithNumbers = this.options.skipEmptyRows
            ? linesWithNumbers.filter((entry) => entry.line.trim().length > 0)
            : linesWithNumbers;

        if (nonEmptyLinesWithNumbers.length === 0) {
            return failure('No data lines found');
        }

        // Extract just the lines for delimiter detection
        const nonEmptyLines = nonEmptyLinesWithNumbers.map((entry) => entry.line);

        // Detect delimiter if not specified
        const detectedDelimiter = delimiter ?? this.detectDelimiter(nonEmptyLines);
        if (!detectedDelimiter) {
            return failure('Could not detect delimiter');
        }

        // Parse all lines, tracking original line numbers
        const parsedLinesWithNumbers: Array<{ cells: string[]; originalLineNumber: number }> = [];
        for (const entry of nonEmptyLinesWithNumbers) {
            const result = this.parseLine(entry.line, detectedDelimiter);
            if (result.success === false) {
                return failure(`Error parsing line ${entry.originalLineNumber}: ${result.error}`);
            }
            parsedLinesWithNumbers.push({
                cells: result.value,
                originalLineNumber: entry.originalLineNumber,
            });
        }

        // Extract headers and rows
        let headers: string[] = [];
        let dataRows: ParsedRow[] = [];

        if (this.options.hasHeader && parsedLinesWithNumbers.length > 0) {
            const firstEntry = parsedLinesWithNumbers[0];
            if (firstEntry === undefined) {
                return failure('No header line found');
            }
            headers = this.options.trimCells
                ? firstEntry.cells.map((h) => h.trim())
                : firstEntry.cells;

            dataRows = parsedLinesWithNumbers.slice(1).map((entry) => ({
                cells: this.options.trimCells ? entry.cells.map((c) => c.trim()) : entry.cells,
                lineNumber: entry.originalLineNumber,
            }));
        } else {
            // Generate column headers
            const maxColumns = Math.max(...parsedLinesWithNumbers.map((e) => e.cells.length));
            headers = Array.from({ length: maxColumns }, (_, i) => `Column${i + 1}`);

            dataRows = parsedLinesWithNumbers.map((entry) => ({
                cells: this.options.trimCells ? entry.cells.map((c) => c.trim()) : entry.cells,
                lineNumber: entry.originalLineNumber,
            }));
        }

        return success({
            headers,
            rows: dataRows,
            delimiter: detectedDelimiter,
            columnMappings: columnMappings ?? [],
        });
    }

    /**
     * Auto-detect delimiter from content
     * Analyzes first 10 lines to determine most likely delimiter
     */
    detectDelimiter(lines: string[]): Delimiter | null {
        const delimiters: Delimiter[] = [',', '\t', ';', '|'];
        const sampleLines = lines.slice(0, Math.min(10, lines.length));

        // Count occurrences of each delimiter per line
        const counts: Map<Delimiter, number[]> = new Map();
        for (const d of delimiters) {
            counts.set(d, []);
        }

        for (const line of sampleLines) {
            for (const delimiter of delimiters) {
                // Count occurrences outside of quoted strings
                const count = this.countDelimiterOccurrences(line, delimiter);
                const delimiterCounts = counts.get(delimiter);
                if (delimiterCounts) {
                    delimiterCounts.push(count);
                }
            }
        }

        // Find delimiter with most consistent non-zero count
        let bestDelimiter: Delimiter | null = null;
        let bestScore = -1;

        for (const [delimiter, lineCounts] of counts) {
            // Check if all lines have the same count (consistency)
            const nonZeroCounts = lineCounts.filter((c) => c > 0);
            if (nonZeroCounts.length === 0) continue;

            // Calculate consistency score
            const uniqueCounts = new Set(nonZeroCounts);
            const consistency = nonZeroCounts.length / sampleLines.length;
            const uniformity = 1 / uniqueCounts.size;
            const avgCount = nonZeroCounts.reduce((a, b) => a + b, 0) / nonZeroCounts.length;

            // Score: prefer consistent, uniform counts with reasonable number of delimiters
            const score = consistency * uniformity * Math.min(avgCount, 10);

            if (score > bestScore) {
                bestScore = score;
                bestDelimiter = delimiter;
            }
        }

        return bestDelimiter;
    }

    /**
     * Count delimiter occurrences outside of quoted strings.
     *
     * Uses single-pass state machine for quote tracking to correctly handle
     * delimiters that appear inside quoted fields (RFC 4180 compliant).
     *
     * @param line - The line to analyze
     * @param delimiter - The delimiter character to count
     * @returns Number of unquoted delimiter occurrences
     *
     * @complexity O(n) where n is line length - single pass through string
     * @memory O(1) - no allocations, only primitive state variables
     */
    private countDelimiterOccurrences(line: string, delimiter: Delimiter): number {
        let count = 0;
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
                // Check for escaped quote
                if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
                    i++; // Skip escaped quote
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === delimiter && !inQuotes) {
                count++;
            }
        }

        return count;
    }

    /**
     * Parse a single line respecting quoted values (RFC 4180)
     */
    private parseLine(line: string, delimiter: Delimiter): ParseResult<string[]> {
        const cells: string[] = [];
        let currentCell = '';
        let inQuotes = false;
        let i = 0;

        while (i < line.length) {
            const char = line[i];

            if (inQuotes) {
                if (char === '"') {
                    // Check for escaped quote
                    if (i + 1 < line.length && line[i + 1] === '"') {
                        currentCell += '"';
                        i += 2;
                    } else {
                        // End of quoted section
                        inQuotes = false;
                        i++;
                    }
                } else {
                    currentCell += char;
                    i++;
                }
            } else {
                if (char === '"') {
                    // Start of quoted section
                    inQuotes = true;
                    i++;
                } else if (char === delimiter) {
                    // End of cell
                    cells.push(currentCell);
                    currentCell = '';
                    i++;
                } else {
                    currentCell += char;
                    i++;
                }
            }
        }

        // Handle unclosed quotes
        if (inQuotes) {
            return failure('Unclosed quote');
        }

        // Add last cell
        cells.push(currentCell);

        return success(cells);
    }

    /**
     * Validate that all rows have consistent column count
     */
    validateColumnConsistency(data: ParsedTabularData): string[] {
        const warnings: string[] = [];
        const expectedColumns = data.headers.length;

        for (const row of data.rows) {
            if (row.cells.length !== expectedColumns) {
                warnings.push(
                    `Line ${row.lineNumber}: Expected ${expectedColumns} columns, got ${row.cells.length}`
                );
            }
        }

        return warnings;
    }

    /**
     * Get a cell value by column index, with optional default
     */
    static getCellValue(row: ParsedRow, index: number, defaultValue = ''): string {
        return index >= 0 && index < row.cells.length ? (row.cells[index] ?? defaultValue) : defaultValue;
    }
}
