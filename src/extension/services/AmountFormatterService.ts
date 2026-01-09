// AmountFormatterService.ts - Formats amounts according to commodity directives
import { HLedgerConfig } from '../HLedgerConfig';
import { NumberFormatService, CommodityFormat } from './NumberFormatService';
import { CommodityCode } from '../types';

/**
 * Service for formatting amounts according to commodity format directives.
 * Supports both explicit commodity formatting and default commodity formatting.
 */
export class AmountFormatterService {
    constructor(
        private readonly config: HLedgerConfig,
        private readonly numberFormatService: NumberFormatService
    ) {}

    /**
     * Formats the amount in a posting line according to commodity format.
     * Returns null if the line is not a posting, has no amount, or no format is defined.
     *
     * @param line The posting line to format
     * @returns Formatted line or null if formatting not applicable
     */
    formatPostingLine(line: string): string | null {
        // Check if this is a posting line (starts with whitespace)
        if (!line || !line.match(/^\s+\S/)) {
            return null;
        }

        // Extract indentation
        const indentMatch = line.match(/^(\s+)/);
        const indent = indentMatch?.[1] ?? '    ';

        // Parse posting line manually (lexer has limitations with prefix symbols and space grouping)
        const trimmedLine = line.trim();

        // Split account from amount using 2+ spaces or tab
        const splitMatch = trimmedLine.match(/^(.+?)(?:\s{2,}|\t)(.+)$/);
        if (!splitMatch) {
            // No amount part found
            return null;
        }

        const accountPart = splitMatch[1]?.trim() ?? '';
        const amountPart = splitMatch[2]?.trim() ?? '';

        if (!amountPart) {
            return null;
        }

        // Determine the format to use
        const commodityFormats = this.config.getCommodityFormats();
        if (!commodityFormats) {
            return null;
        }

        let format: CommodityFormat | undefined;
        let hasCommodityInLine = false;
        let actualCommodity: CommodityCode | undefined;

        // Try to find commodity in amount part - check all known commodities
        for (const [commodity] of commodityFormats) {
            const escaped = this.escapeRegex(commodity);
            // Check suffix: "100 RUB" or "100RUB"
            if (new RegExp(`${escaped}$`).test(amountPart)) {
                actualCommodity = commodity;
                break;
            }
            // Check prefix: "$100" or "$ 100"
            if (new RegExp(`^${escaped}`).test(amountPart)) {
                actualCommodity = commodity;
                break;
            }
        }

        if (actualCommodity) {
            // Posting has explicit commodity - use its format
            format = commodityFormats.get(actualCommodity);
            hasCommodityInLine = true;
        } else {
            // No commodity in posting - try default commodity
            const defaultCommodity = this.config.getDefaultCommodity();
            if (defaultCommodity) {
                format = commodityFormats.get(defaultCommodity);
            }
        }

        // No format found - don't modify
        if (!format) {
            return null;
        }

        // Parse the numeric value from the amount string
        const numericValue = this.parseNumericValue(amountPart, actualCommodity);
        if (numericValue === null) {
            return null;
        }

        // Format the amount
        let formattedAmount: string;
        if (hasCommodityInLine) {
            // Has commodity - format with symbol
            formattedAmount = this.numberFormatService.formatAmount(numericValue, format);
        } else {
            // No commodity - format number only (don't add symbol)
            formattedAmount = this.numberFormatService.formatNumber(numericValue, format.format);
        }

        // Reconstruct the line
        return `${indent}${accountPart}  ${formattedAmount}`;
    }

    /**
     * Formats all amounts in document content.
     *
     * @param content The full document content
     * @returns Formatted content
     */
    formatDocumentContent(content: string): string {
        const lines = content.split('\n');
        const formattedLines = lines.map(line => {
            const formatted = this.formatPostingLine(line);
            return formatted ?? line;
        });
        return formattedLines.join('\n');
    }

    /**
     * Extracts the numeric value from an amount string.
     * Handles various formats: "1000", "-1000", "1,000.00", "1 000,00", etc.
     */
    private parseNumericValue(amountStr: string, commodity: CommodityCode | undefined): number | null {
        let cleanAmount = amountStr.trim();

        if (commodity) {
            // Remove commodity from amount string (both prefix and suffix)
            const escaped = this.escapeRegex(commodity);
            // Remove from end (suffix): "100 RUB" → "100"
            cleanAmount = cleanAmount.replace(new RegExp(`\\s*${escaped}$`), '').trim();
            // Remove from start (prefix): "$100" → "100"
            cleanAmount = cleanAmount.replace(new RegExp(`^${escaped}\\s*`), '').trim();
        }

        // Handle sign
        const isNegative = cleanAmount.startsWith('-');
        if (isNegative) {
            cleanAmount = cleanAmount.substring(1).trim();
        } else if (cleanAmount.startsWith('+')) {
            cleanAmount = cleanAmount.substring(1).trim();
        }

        // Normalize number: remove grouping separators and standardize decimal
        // First, try to detect the decimal separator
        // If there's a comma followed by exactly 1-4 digits at the end, it's likely a decimal comma
        // If there's a period followed by exactly 1-4 digits at the end, it's likely a decimal period

        let normalizedAmount = cleanAmount;

        // European format: 1.234,56 or 1 234,56
        if (/,\d{1,4}$/.test(cleanAmount)) {
            // Comma is decimal separator - remove spaces and periods
            normalizedAmount = cleanAmount
                .replace(/[\s.]/g, '')  // Remove spaces and periods (group separators)
                .replace(',', '.');     // Replace decimal comma with period
        }
        // US format: 1,234.56
        else if (/\.\d{1,4}$/.test(cleanAmount)) {
            // Period is decimal separator - remove commas and spaces
            normalizedAmount = cleanAmount.replace(/[,\s]/g, '');
        }
        // No decimal - just remove grouping
        else {
            normalizedAmount = cleanAmount.replace(/[,.\s]/g, '');
        }

        const value = parseFloat(normalizedAmount);

        if (isNaN(value)) {
            return null;
        }

        return isNegative ? -value : value;
    }

    private escapeRegex(str: string): string {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}
