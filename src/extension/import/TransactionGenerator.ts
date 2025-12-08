/**
 * Transaction generator for converting parsed tabular data to hledger format
 */

import {
    ParsedTabularData,
    ParsedRow,
    ColumnMapping,
    ColumnType,
    ImportedTransaction,
    ImportResult,
    ImportOptions,
    ImportStatistics,
    ImportWarning,
    ImportError,
    AccountResolution,
    AccountResolutionSource,
    DEFAULT_IMPORT_OPTIONS,
} from './types';
import { DateParser } from './DateParser';
import { AccountResolver } from './AccountResolver';
import { ColumnDetector } from './ColumnDetector';

/**
 * Generator for hledger transactions from tabular data
 */
export class TransactionGenerator {
    private readonly dateParser: DateParser;
    private readonly accountResolver: AccountResolver;
    private readonly options: ImportOptions;

    constructor(options?: Partial<ImportOptions>) {
        this.options = { ...DEFAULT_IMPORT_OPTIONS, ...options };
        this.dateParser = new DateParser(this.options.dateFormat);
        this.accountResolver = new AccountResolver(this.options);
    }

    /**
     * Generate hledger transactions from parsed tabular data
     */
    generate(data: ParsedTabularData): ImportResult {
        const transactions: ImportedTransaction[] = [];
        const warnings: ImportWarning[] = [];
        const errors: ImportError[] = [];

        // Validate required columns
        const validation = ColumnDetector.hasRequiredColumns(data.columnMappings);
        if (!validation.valid) {
            errors.push({
                lineNumber: 0,
                message: `Missing required columns: ${validation.missing.join(', ')}`,
                fatal: true,
            });
            return this.createResult(transactions, warnings, errors, data.rows.length);
        }

        // Process each row
        for (const row of data.rows) {
            const result = this.processRow(row, data.columnMappings);

            if (result.success === true) {
                transactions.push(result.transaction);
                if (result.warnings) {
                    warnings.push(...result.warnings);
                }
            } else {
                const error = result.error;
                if (error.fatal) {
                    errors.push(error);
                } else {
                    const warning: ImportWarning = {
                        lineNumber: error.lineNumber,
                        message: error.message,
                    };
                    if (error.field !== undefined) {
                        (warning as { field: string }).field = error.field;
                    }
                    warnings.push(warning);
                }
            }
        }

        return this.createResult(transactions, warnings, errors, data.rows.length);
    }

    /**
     * Process a single row into a transaction
     */
    private processRow(
        row: ParsedRow,
        mappings: readonly ColumnMapping[]
    ): {
        success: true;
        transaction: ImportedTransaction;
        warnings?: ImportWarning[];
    } | {
        success: false;
        error: ImportError;
    } {
        const warnings: ImportWarning[] = [];

        // Extract date
        const dateMapping = ColumnDetector.findMapping(mappings, 'date');
        if (!dateMapping) {
            return {
                success: false,
                error: {
                    lineNumber: row.lineNumber,
                    message: 'No date column found',
                    fatal: false,
                },
            };
        }

        const dateStr = this.getCellValue(row, dateMapping.index);
        if (!dateStr) {
            return {
                success: false,
                error: {
                    lineNumber: row.lineNumber,
                    message: 'Empty date value',
                    field: 'date',
                    fatal: false,
                },
            };
        }

        const dateResult = this.dateParser.parse(dateStr);
        if (!dateResult.success) {
            return {
                success: false,
                error: {
                    lineNumber: row.lineNumber,
                    message: `Invalid date: ${dateStr}`,
                    field: 'date',
                    fatal: false,
                },
            };
        }

        // Extract description
        const description = this.extractDescription(row, mappings);
        if (!description) {
            warnings.push({
                lineNumber: row.lineNumber,
                message: 'Empty description, using placeholder',
                field: 'description',
            });
        }

        // Extract amount
        const amountResult = this.extractAmount(row, mappings);
        if (amountResult.success === false) {
            return {
                success: false,
                error: {
                    lineNumber: row.lineNumber,
                    message: amountResult.error,
                    field: 'amount',
                    fatal: false,
                },
            };
        }

        // Extract category (optional)
        const category = this.extractCategory(row, mappings);

        // Extract currency (optional)
        const currency = this.extractCurrency(row, mappings);

        // Resolve account
        const accountResolution = this.accountResolver.resolve(
            description || 'Unknown',
            category,
            amountResult.amount
        );

        // Extract memo and reference (optional)
        const memo = this.extractFieldValue(row, mappings, 'memo');
        const reference = this.extractFieldValue(row, mappings, 'reference');

        // Create transaction - only include optional properties when they have values
        const transaction: ImportedTransaction = {
            date: dateResult.value,
            description: description || 'Unknown transaction',
            amount: amountResult.amount,
            amountFormatted: this.formatAmount(amountResult.amount, currency),
            sourceAccount: accountResolution,
            targetAccount: this.options.defaultBalancingAccount,
            lineNumber: row.lineNumber,
            ...(currency !== undefined && { currency }),
            ...(memo !== undefined && { memo }),
            ...(reference !== undefined && { reference }),
        };

        // Return result - only include warnings when array has items
        if (warnings.length > 0) {
            return {
                success: true,
                transaction,
                warnings,
            };
        }
        return {
            success: true,
            transaction,
        };
    }

    /**
     * Extract description from row using description or payee columns
     */
    private extractDescription(
        row: ParsedRow,
        mappings: readonly ColumnMapping[]
    ): string | undefined {
        // Try description column first
        const descMapping = ColumnDetector.findMapping(mappings, 'description');
        if (descMapping) {
            const desc = this.getCellValue(row, descMapping.index);
            if (desc) return desc;
        }

        // Fall back to payee column
        const payeeMapping = ColumnDetector.findMapping(mappings, 'payee');
        if (payeeMapping) {
            const payee = this.getCellValue(row, payeeMapping.index);
            if (payee) return payee;
        }

        return undefined;
    }

    /**
     * Extract amount from row (handles single amount or debit/credit columns)
     */
    private extractAmount(
        row: ParsedRow,
        mappings: readonly ColumnMapping[]
    ): { success: true; amount: number } | { success: false; error: string } {
        // Try single amount column
        const amountMapping = ColumnDetector.findMapping(mappings, 'amount');
        if (amountMapping) {
            const amountStr = this.getCellValue(row, amountMapping.index);
            if (amountStr) {
                const parsed = this.parseAmountString(amountStr);
                if (parsed !== null) {
                    const amount = this.options.invertAmounts ? -parsed : parsed;
                    return { success: true, amount };
                }
                return { success: false, error: `Invalid amount: ${amountStr}` };
            }
        }

        // Try debit/credit columns
        const debitMapping = ColumnDetector.findMapping(mappings, 'debit');
        const creditMapping = ColumnDetector.findMapping(mappings, 'credit');

        if (debitMapping || creditMapping) {
            let amount = 0;

            if (debitMapping) {
                const debitStr = this.getCellValue(row, debitMapping.index);
                if (debitStr) {
                    const parsed = this.parseAmountString(debitStr);
                    if (parsed !== null) {
                        amount -= Math.abs(parsed); // Debits are negative
                    }
                }
            }

            if (creditMapping) {
                const creditStr = this.getCellValue(row, creditMapping.index);
                if (creditStr) {
                    const parsed = this.parseAmountString(creditStr);
                    if (parsed !== null) {
                        amount += Math.abs(parsed); // Credits are positive
                    }
                }
            }

            if (amount !== 0) {
                const finalAmount = this.options.invertAmounts ? -amount : amount;
                return { success: true, amount: finalAmount };
            }
        }

        return { success: false, error: 'No valid amount found' };
    }

    /**
     * Extract category from row
     */
    private extractCategory(
        row: ParsedRow,
        mappings: readonly ColumnMapping[]
    ): string | undefined {
        const categoryMapping = ColumnDetector.findMapping(mappings, 'category');
        if (categoryMapping) {
            return this.getCellValue(row, categoryMapping.index) || undefined;
        }
        return undefined;
    }

    /**
     * Extract currency from row
     */
    private extractCurrency(
        row: ParsedRow,
        mappings: readonly ColumnMapping[]
    ): string | undefined {
        const currencyMapping = ColumnDetector.findMapping(mappings, 'currency');
        if (currencyMapping) {
            return this.getCellValue(row, currencyMapping.index) || undefined;
        }
        return undefined;
    }

    /**
     * Extract a field value by column type
     */
    private extractFieldValue(
        row: ParsedRow,
        mappings: readonly ColumnMapping[],
        type: ColumnType
    ): string | undefined {
        const mapping = ColumnDetector.findMapping(mappings, type);
        if (mapping) {
            return this.getCellValue(row, mapping.index) || undefined;
        }
        return undefined;
    }

    /**
     * Get cell value from row
     */
    private getCellValue(row: ParsedRow, index: number): string {
        const value = index >= 0 && index < row.cells.length ? row.cells[index] : undefined;
        return value !== undefined ? value.trim() : '';
    }

    /**
     * Parse amount string to number
     */
    private parseAmountString(amountStr: string): number | null {
        // Remove currency symbols and whitespace
        let cleaned = amountStr.replace(/[$€£¥₽₴₸₹\s]/g, '').trim();

        // Handle parentheses as negative (accounting notation)
        const isNegative = cleaned.startsWith('(') && cleaned.endsWith(')');
        if (isNegative) {
            cleaned = cleaned.slice(1, -1);
        }

        // Handle leading minus or plus
        const hasSign = cleaned.startsWith('-') || cleaned.startsWith('+');
        const sign = cleaned.startsWith('-') ? -1 : 1;
        if (hasSign) {
            cleaned = cleaned.slice(1);
        }

        // Determine decimal separator
        // If both . and , are present, the last one is the decimal separator
        const lastDot = cleaned.lastIndexOf('.');
        const lastComma = cleaned.lastIndexOf(',');

        let normalized: string;

        if (lastDot > lastComma) {
            // Period is decimal separator (US format: 1,234.56)
            normalized = cleaned.replace(/,/g, '');
        } else if (lastComma > lastDot) {
            // Comma is decimal separator (EU format: 1.234,56)
            normalized = cleaned.replace(/\./g, '').replace(',', '.');
        } else if (lastComma === -1 && lastDot === -1) {
            // No decimal separator (integer)
            normalized = cleaned;
        } else if (lastComma !== -1) {
            // Only comma, check if it's decimal or thousand separator
            const afterComma = cleaned.slice(lastComma + 1);
            if (afterComma.length <= 2) {
                // Likely decimal separator
                normalized = cleaned.replace(',', '.');
            } else {
                // Likely thousand separator
                normalized = cleaned.replace(/,/g, '');
            }
        } else {
            // Only dot
            normalized = cleaned;
        }

        // Remove remaining group separators (spaces)
        normalized = normalized.replace(/\s/g, '');

        const value = parseFloat(normalized);
        if (isNaN(value)) {
            return null;
        }

        return (isNegative ? -1 : 1) * sign * value;
    }

    /**
     * Format amount with currency
     */
    private formatAmount(amount: number, currency?: string): string {
        const absAmount = Math.abs(amount);
        const sign = amount < 0 ? '-' : '';

        // Format with 2 decimal places
        const formatted = absAmount.toFixed(2);

        if (currency) {
            // Check if currency is a symbol or code
            const isSymbol = /^[^\w\s]$/.test(currency) || /^[$€£¥₽₴₸₹]$/.test(currency);
            if (isSymbol) {
                return `${sign}${currency}${formatted}`;
            } else {
                return `${sign}${formatted} ${currency}`;
            }
        }

        return `${sign}${formatted}`;
    }

    /**
     * Create import result with statistics
     */
    private createResult(
        transactions: ImportedTransaction[],
        warnings: ImportWarning[],
        errors: ImportError[],
        totalRows: number
    ): ImportResult {
        const detectionSources: Record<AccountResolutionSource, number> = {
            category: 0,
            history: 0,
            pattern: 0,
            sign: 0,
            default: 0,
        };

        let autoDetectedAccounts = 0;
        let todoAccounts = 0;

        for (const tx of transactions) {
            detectionSources[tx.sourceAccount.source]++;

            if (AccountResolver.needsReview(tx.sourceAccount)) {
                todoAccounts++;
            } else {
                autoDetectedAccounts++;
            }
        }

        const statistics: ImportStatistics = {
            totalRows,
            processedRows: transactions.length,
            skippedRows: totalRows - transactions.length,
            autoDetectedAccounts,
            todoAccounts,
            detectionSources,
        };

        return {
            transactions,
            warnings,
            errors,
            statistics,
        };
    }

    /**
     * Format a single transaction as hledger journal entry
     */
    formatTransaction(tx: ImportedTransaction, includeAnnotations = true): string {
        const lines: string[] = [];

        // Transaction header: date description
        let header = `${tx.date} ${tx.description}`;
        if (tx.reference) {
            header = `${tx.date} (${tx.reference}) ${tx.description}`;
        }
        lines.push(header);

        // Add memo as comment if present
        if (tx.memo) {
            lines.push(`    ; ${tx.memo}`);
        }

        // Calculate padding for alignment
        const accountPart = `    ${tx.sourceAccount.account}`;
        const padding = Math.max(4, 52 - accountPart.length - tx.amountFormatted.length);
        const amountPadding = ' '.repeat(padding);

        if (includeAnnotations && tx.sourceAccount.source !== 'default') {
            // Account with annotation comment
            lines.push(
                `    ${tx.sourceAccount.account}${amountPadding}${tx.amountFormatted}  ; matched: ${AccountResolver.describeSource(tx.sourceAccount.source)}`
            );
        } else {
            lines.push(`    ${tx.sourceAccount.account}${amountPadding}${tx.amountFormatted}`);
        }

        // Second posting (balancing account, amount inferred)
        lines.push(`    ${tx.targetAccount}`);

        return lines.join('\n');
    }

    /**
     * Format all transactions as hledger journal content
     */
    formatAll(result: ImportResult, sourceName?: string): string {
        const lines: string[] = [];
        const timestamp = new Date().toISOString().split('T')[0];

        // Header comment
        lines.push(`; Imported from ${sourceName || 'CSV'} on ${timestamp}`);
        lines.push(
            `; Rows: ${result.statistics.processedRows} processed, ${result.statistics.skippedRows} skipped`
        );
        lines.push(
            `; Accounts: ${result.statistics.autoDetectedAccounts} auto-detected, ${result.statistics.todoAccounts} need review (TODO)`
        );

        // Detection source breakdown
        const sources = result.statistics.detectionSources;
        const sourceBreakdown = Object.entries(sources)
            .filter(([, count]) => count > 0)
            .map(([source, count]) => `${source}: ${count}`)
            .join(', ');
        if (sourceBreakdown) {
            lines.push(`; Detection sources: ${sourceBreakdown}`);
        }

        lines.push('');

        // Add warnings as comments
        if (result.warnings.length > 0) {
            lines.push('; Warnings:');
            for (const warning of result.warnings.slice(0, 10)) {
                lines.push(`; - Line ${warning.lineNumber}: ${warning.message}`);
            }
            if (result.warnings.length > 10) {
                lines.push(`; - ... and ${result.warnings.length - 10} more warnings`);
            }
            lines.push('');
        }

        // Format transactions
        for (const tx of result.transactions) {
            lines.push(this.formatTransaction(tx));
            lines.push('');
        }

        return lines.join('\n');
    }
}
