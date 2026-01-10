// AmountFormatterService.ts - Formats amounts according to commodity directives
import { HLedgerConfig } from '../HLedgerConfig';
import { NumberFormatService, CommodityFormat } from './NumberFormatService';
import { CommodityCode } from '../types';

/**
 * Service for formatting amounts according to commodity format directives.
 * Supports both explicit commodity formatting and default commodity formatting.
 */
export class AmountFormatterService {
    private commodityRegexCache = new Map<CommodityCode, { prefix: RegExp; suffix: RegExp }>();

    constructor(
        private readonly config: HLedgerConfig,
        private readonly numberFormatService: NumberFormatService
    ) {}

    /**
     * Gets the current alignment column from config.
     * @returns The alignment column position
     */
    getAlignmentColumn(): number {
        return this.config.getAmountAlignmentColumn?.() ?? 40;
    }

    /**
     * Formats all amounts in a posting line according to commodity format.
     * Handles: main amount, cost notation (@, @@), balance assertions (=, ==, =*, ==*)
     * Preserves inline comments.
     *
     * @param line The posting line to format
     * @param alignmentColumn Optional column position for amount alignment (default: 2 spaces after account)
     * @returns Formatted line or null if formatting not applicable
     */
    formatPostingLine(line: string, alignmentColumn?: number): string | null {
        // Check if this is a posting line (starts with whitespace)
        if (!line || !line.match(/^\s+\S/)) {
            return null;
        }

        // Extract indentation
        const indentMatch = line.match(/^(\s+)/);
        const indent = indentMatch?.[1] ?? '    ';

        const trimmedLine = line.trim();

        // Step 1: Extract inline comment (must be preceded by 2+ spaces or at start after amount)
        // Using negated character class [^;] to prevent ReDoS
        let comment = '';
        let lineWithoutComment = trimmedLine;
        const commentMatch = trimmedLine.match(/^([^;]+)(\s{2,};.*)$/);
        if (commentMatch) {
            lineWithoutComment = commentMatch[1]?.trim() ?? trimmedLine;
            comment = commentMatch[2] ?? '';
        }

        // Step 2: Extract balance assertion (=, ==, =*, ==*)
        // Using negated character class [^=] to prevent ReDoS
        let balanceAssertion = '';
        let balanceAssertionAmount = '';
        let lineWithoutAssertion = lineWithoutComment;
        const assertionMatch = lineWithoutComment.match(/^([^=]+)\s+(==?\*?)\s+(.+)$/);
        if (assertionMatch) {
            lineWithoutAssertion = assertionMatch[1]?.trim() ?? lineWithoutComment;
            balanceAssertion = assertionMatch[2] ?? '';
            balanceAssertionAmount = assertionMatch[3]?.trim() ?? '';
        }

        // Step 3: Extract cost notation (@, @@)
        // Using negated character class [^@] to prevent ReDoS
        let costNotation = '';
        let costAmount = '';
        let lineWithoutCost = lineWithoutAssertion;
        const costMatch = lineWithoutAssertion.match(/^([^@]+)\s+(@@?)\s+(.+)$/);
        if (costMatch) {
            lineWithoutCost = costMatch[1]?.trim() ?? lineWithoutAssertion;
            costNotation = costMatch[2] ?? '';
            costAmount = costMatch[3]?.trim() ?? '';
        }

        // Step 4: Split account from main amount using 2+ spaces or tab
        const splitMatch = lineWithoutCost.match(/^(.+?)(?:\s{2,}|\t)(.*)$/);

        let accountPart = '';
        let mainAmount = '';

        if (splitMatch) {
            accountPart = splitMatch[1]?.trim() ?? '';
            mainAmount = splitMatch[2]?.trim() ?? '';
        } else {
            // No amount part - might be balance assertion without posting amount (e.g., "Assets:Bank  = 5000 RUB")
            accountPart = lineWithoutCost;
        }

        // Get commodity formats
        const commodityFormats = this.config.getCommodityFormats();
        if (!commodityFormats) {
            return null;
        }

        // Format main amount (if present)
        let formattedMainAmount = mainAmount;
        if (mainAmount) {
            const formatted = this.formatSingleAmount(mainAmount, commodityFormats);
            if (formatted !== null) {
                formattedMainAmount = formatted;
            }
        }

        // Format cost amount (if present)
        let formattedCostAmount = costAmount;
        if (costAmount) {
            const formatted = this.formatSingleAmount(costAmount, commodityFormats);
            if (formatted !== null) {
                formattedCostAmount = formatted;
            }
        }

        // Format balance assertion amount (if present)
        let formattedAssertionAmount = balanceAssertionAmount;
        if (balanceAssertionAmount) {
            const formatted = this.formatSingleAmount(balanceAssertionAmount, commodityFormats);
            if (formatted !== null) {
                formattedAssertionAmount = formatted;
            }
        }

        // Check if we have any amounts that could be formatted
        const hasAmountToFormat = mainAmount || costAmount || balanceAssertionAmount;

        // Return null if there's nothing to format
        if (!hasAmountToFormat) {
            return null;
        }

        // Check if any formatting actually changed something
        const anyFormatChanged =
            (mainAmount && formattedMainAmount !== mainAmount) ||
            (costAmount && formattedCostAmount !== costAmount) ||
            (balanceAssertionAmount && formattedAssertionAmount !== balanceAssertionAmount);

        // Return null if nothing changed (no applicable format found)
        if (!anyFormatChanged) {
            return null;
        }

        // Calculate spacing for alignment
        const accountLength = indent.length + accountPart.length;
        let spacing = '  '; // Default: 2 spaces

        if (alignmentColumn !== undefined && alignmentColumn > 0) {
            const spacingNeeded = Math.max(2, alignmentColumn - accountLength);
            spacing = ' '.repeat(spacingNeeded);
        }

        // Reconstruct the line
        let result = `${indent}${accountPart}`;

        if (formattedMainAmount) {
            result += `${spacing}${formattedMainAmount}`;
        }

        if (costNotation && formattedCostAmount) {
            if (!formattedMainAmount) {
                // Cost without main amount (unusual but handle it)
                result += spacing;
            }
            result += ` ${costNotation} ${formattedCostAmount}`;
        }

        if (balanceAssertion && formattedAssertionAmount) {
            if (!formattedMainAmount && !costNotation) {
                // Balance assertion without main amount (e.g., "Assets:Bank  = 5000 RUB")
                // Use spacing (2 spaces by default) before assertion
                result += `${spacing}${balanceAssertion} ${formattedAssertionAmount}`;
            } else {
                result += ` ${balanceAssertion} ${formattedAssertionAmount}`;
            }
        }

        if (comment) {
            result += comment;
        }

        return result;
    }

    /**
     * Gets cached regex patterns for a commodity.
     * Creates and caches them if not already cached.
     */
    private getCommodityRegex(commodity: CommodityCode): { prefix: RegExp; suffix: RegExp } {
        let cached = this.commodityRegexCache.get(commodity);
        if (!cached) {
            const escaped = this.escapeRegex(commodity);
            cached = {
                suffix: new RegExp(`${escaped}$`),
                prefix: new RegExp(`^${escaped}`)
            };
            this.commodityRegexCache.set(commodity, cached);
        }
        return cached;
    }

    /**
     * Formats a single amount string (with or without commodity).
     * @returns Formatted amount or null if no format applicable
     */
    private formatSingleAmount(amountStr: string, commodityFormats: ReadonlyMap<CommodityCode, CommodityFormat>): string | null {
        let format: CommodityFormat | undefined;
        let hasCommodity = false;
        let actualCommodity: CommodityCode | undefined;

        // Try to find commodity in amount string (using cached regexes)
        for (const [commodity] of commodityFormats) {
            const regex = this.getCommodityRegex(commodity);
            // Check suffix: "100 RUB" or "100RUB"
            if (regex.suffix.test(amountStr)) {
                actualCommodity = commodity;
                break;
            }
            // Check prefix: "$100" or "$ 100"
            if (regex.prefix.test(amountStr)) {
                actualCommodity = commodity;
                break;
            }
        }

        if (actualCommodity) {
            format = commodityFormats.get(actualCommodity);
            hasCommodity = true;
        } else {
            // No commodity - try default
            const defaultCommodity = this.config.getDefaultCommodity();
            if (defaultCommodity) {
                format = commodityFormats.get(defaultCommodity);
            }
        }

        if (!format) {
            return null;
        }

        const numericValue = this.parseNumericValue(amountStr, actualCommodity);
        if (numericValue === null) {
            return null;
        }

        if (hasCommodity) {
            return this.numberFormatService.formatAmount(numericValue, format);
        } else {
            return this.numberFormatService.formatNumber(numericValue, format.format);
        }
    }

    /**
     * Formats all amounts in document content.
     *
     * @param content The full document content
     * @returns Formatted content
     */
    formatDocumentContent(content: string): string {
        const alignmentColumn = this.getAlignmentColumn();
        const lines = content.split('\n');
        const formattedLines = lines.map(line => {
            const formatted = this.formatPostingLine(line, alignmentColumn);
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
