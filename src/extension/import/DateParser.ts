/**
 * Date parser with multi-format support and auto-detection
 * Outputs dates in YYYY-MM-DD format for hledger
 */

import { DateFormat } from './types';

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

/** Parsed date components */
interface DateComponents {
    year: number;
    month: number;
    day: number;
}

/**
 * Date parser with support for multiple formats
 */
export class DateParser {
    private readonly preferredFormat: DateFormat;

    constructor(preferredFormat: DateFormat = 'auto') {
        this.preferredFormat = preferredFormat;
    }

    /**
     * Parse date string to YYYY-MM-DD format
     * Auto-detects format if preferredFormat is 'auto'
     */
    parse(dateString: string): ParseResult<string> {
        const trimmed = dateString.trim();
        if (!trimmed) {
            return failure('Empty date string');
        }

        if (this.preferredFormat !== 'auto') {
            return this.parseWithFormat(trimmed, this.preferredFormat);
        }

        // Try each format in order of specificity
        const formats: DateFormat[] = [
            'YYYY-MM-DD',
            'YYYY/MM/DD',
            'DD.MM.YYYY',
            'DD/MM/YYYY',
            'DD-MM-YYYY',
            'MM/DD/YYYY',
        ];

        for (const format of formats) {
            const result = this.parseWithFormat(trimmed, format);
            if (result.success) {
                // Validate the result makes sense
                const validation = this.validateDateString(result.value);
                if (validation.success) {
                    return result;
                }
            }
        }

        return failure(`Could not parse date: ${trimmed}`);
    }

    /**
     * Detect date format from a sample of date strings
     */
    detectFormat(samples: readonly string[]): DateFormat {
        const validSamples = samples.filter((s) => s.trim().length > 0);
        if (validSamples.length === 0) {
            return 'auto';
        }

        const formats: DateFormat[] = [
            'YYYY-MM-DD',
            'YYYY/MM/DD',
            'DD.MM.YYYY',
            'DD/MM/YYYY',
            'DD-MM-YYYY',
            'MM/DD/YYYY',
        ];

        const scores: Map<DateFormat, number> = new Map();
        for (const format of formats) {
            scores.set(format, 0);
        }

        for (const sample of validSamples) {
            for (const format of formats) {
                const result = this.parseWithFormat(sample, format);
                if (result.success) {
                    const validation = this.validateDateString(result.value);
                    if (validation.success) {
                        scores.set(format, scores.get(format)! + 1);
                    }
                }
            }
        }

        // Find format with highest score
        let bestFormat: DateFormat = 'auto';
        let bestScore = 0;

        for (const [format, score] of scores) {
            if (score > bestScore) {
                bestScore = score;
                bestFormat = format;
            }
        }

        // If no format matched at least half the samples, return 'auto'
        if (bestScore < validSamples.length / 2) {
            return 'auto';
        }

        return bestFormat;
    }

    /**
     * Parse date with a specific format
     */
    private parseWithFormat(dateString: string, format: DateFormat): ParseResult<string> {
        const components = this.extractComponents(dateString, format);
        if (components.success === false) {
            return failure(components.error);
        }

        return this.normalizeDate(components.value);
    }

    /**
     * Extract date components based on format
     */
    private extractComponents(
        dateString: string,
        format: DateFormat
    ): ParseResult<DateComponents> {
        // Define regex patterns for each format
        const patterns: Record<DateFormat, RegExp> = {
            auto: /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/, // Default to ISO
            'YYYY-MM-DD': /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
            'YYYY/MM/DD': /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/,
            'DD/MM/YYYY': /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
            'MM/DD/YYYY': /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
            'DD.MM.YYYY': /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/,
            'DD-MM-YYYY': /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
        };

        const pattern = patterns[format];
        const match = dateString.match(pattern);

        if (!match) {
            return failure(`Date ${dateString} does not match format ${format}`);
        }

        let year: number, month: number, day: number;

        const part1 = match[1] ?? '';
        const part2 = match[2] ?? '';
        const part3 = match[3] ?? '';

        switch (format) {
            case 'YYYY-MM-DD':
            case 'YYYY/MM/DD':
            case 'auto':
                year = parseInt(part1, 10);
                month = parseInt(part2, 10);
                day = parseInt(part3, 10);
                break;

            case 'DD/MM/YYYY':
            case 'DD.MM.YYYY':
            case 'DD-MM-YYYY':
                day = parseInt(part1, 10);
                month = parseInt(part2, 10);
                year = parseInt(part3, 10);
                break;

            case 'MM/DD/YYYY':
                month = parseInt(part1, 10);
                day = parseInt(part2, 10);
                year = parseInt(part3, 10);
                break;

            default:
                return failure(`Unknown format: ${format}`);
        }

        return success({ year, month, day });
    }

    /**
     * Normalize date components to YYYY-MM-DD string
     */
    private normalizeDate(components: DateComponents): ParseResult<string> {
        const { year, month, day } = components;

        // Handle 2-digit years
        let fullYear = year;
        if (year < 100) {
            // Assume years 00-30 are 2000s, 31-99 are 1900s
            fullYear = year <= 30 ? 2000 + year : 1900 + year;
        }

        // Validate ranges
        if (month < 1 || month > 12) {
            return failure(`Invalid month: ${month}`);
        }

        if (day < 1 || day > 31) {
            return failure(`Invalid day: ${day}`);
        }

        // Check days in month
        const daysInMonth = this.getDaysInMonth(fullYear, month);
        if (day > daysInMonth) {
            return failure(`Day ${day} is invalid for month ${month}`);
        }

        // Format as YYYY-MM-DD
        const formattedMonth = month.toString().padStart(2, '0');
        const formattedDay = day.toString().padStart(2, '0');

        return success(`${fullYear}-${formattedMonth}-${formattedDay}`);
    }

    /**
     * Get the number of days in a month
     */
    private getDaysInMonth(year: number, month: number): number {
        const daysPerMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

        if (month === 2 && this.isLeapYear(year)) {
            return 29;
        }

        return daysPerMonth[month - 1] ?? 31;
    }

    /**
     * Check if a year is a leap year
     */
    private isLeapYear(year: number): boolean {
        return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    }

    /**
     * Validate a YYYY-MM-DD date string
     */
    private validateDateString(dateStr: string): ParseResult<boolean> {
        const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!match) {
            return failure('Invalid format');
        }

        const year = parseInt(match[1] ?? '', 10);
        const month = parseInt(match[2] ?? '', 10);
        const day = parseInt(match[3] ?? '', 10);

        // Sanity check year
        if (year < 1900 || year > 2100) {
            return failure(`Year ${year} is out of reasonable range`);
        }

        if (month < 1 || month > 12) {
            return failure(`Invalid month: ${month}`);
        }

        const daysInMonth = this.getDaysInMonth(year, month);
        if (day < 1 || day > daysInMonth) {
            return failure(`Invalid day: ${day}`);
        }

        return success(true);
    }

    /**
     * Try to disambiguate between DD/MM/YYYY and MM/DD/YYYY
     * Returns the more likely interpretation based on values
     */
    static disambiguateSlashFormat(samples: readonly string[]): 'DD/MM/YYYY' | 'MM/DD/YYYY' {
        let ddmmCount = 0;
        let mmddCount = 0;

        for (const sample of samples) {
            const match = sample.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
            if (!match) continue;

            const first = parseInt(match[1] ?? '', 10);
            const second = parseInt(match[2] ?? '', 10);

            // If first > 12, must be DD/MM
            if (first > 12) {
                ddmmCount++;
            }
            // If second > 12, must be MM/DD
            else if (second > 12) {
                mmddCount++;
            }
        }

        // Default to DD/MM/YYYY (more common globally) if no decisive evidence
        return mmddCount > ddmmCount ? 'MM/DD/YYYY' : 'DD/MM/YYYY';
    }
}
