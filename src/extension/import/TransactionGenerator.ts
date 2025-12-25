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
  PayeeAccountHistory,
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

  constructor(options?: Partial<ImportOptions>, payeeHistory?: PayeeAccountHistory) {
    this.options = { ...DEFAULT_IMPORT_OPTIONS, ...options };
    this.dateParser = new DateParser(this.options.dateFormat);
    this.accountResolver = new AccountResolver(this.options, payeeHistory);
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
          warnings.push({
            lineNumber: error.lineNumber,
            message: error.message,
            ...(error.field !== undefined && { field: error.field }),
          });
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
  ):
    | {
        success: true;
        transaction: ImportedTransaction;
        warnings?: ImportWarning[];
      }
    | {
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
  private extractCategory(row: ParsedRow, mappings: readonly ColumnMapping[]): string | undefined {
    const categoryMapping = ColumnDetector.findMapping(mappings, 'category');
    if (categoryMapping) {
      return this.getCellValue(row, categoryMapping.index) || undefined;
    }
    return undefined;
  }

  /**
   * Extract currency from row
   */
  private extractCurrency(row: ParsedRow, mappings: readonly ColumnMapping[]): string | undefined {
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
    if (index < 0 || index >= row.cells.length) {
      return '';
    }
    return row.cells[index]?.trim() ?? '';
  }

  /**
   * Parse amount string to a numeric value, handling multiple international number formats.
   *
   * Supports the following input formats:
   * - **US format**: `1,234.56` or `-1,234.56` (comma as thousand separator, period as decimal)
   * - **EU format**: `1.234,56` or `-1.234,56` (period as thousand separator, comma as decimal)
   * - **Accounting notation**: `(1,234.56)` represents a negative amount
   * - **Sign placement**: `+1234`, `-1234`, `$1234`, `€1234`, `₽1234`
   * - **Currency symbols**: `$1234`, `€1234`, `£1234`, `¥1234`, `₽1234`, `₴1234`, `₸1234`, `₹1234` (ignored during parsing)
   * - **Integer amounts**: `1234` (no decimal separator)
   *
   * Parsing rules:
   * 1. Strips all leading/trailing whitespace
   * 2. Removes all currency symbols (dollar, euro, pound, yen, etc.)
   * 3. Detects negative amounts via parentheses notation (e.g., `(100)` → -100)
   * 4. Determines decimal separator by checking which appears last (. or ,):
   *    - If period appears last → US format (remove commas)
   *    - If comma appears last → EU format (remove periods, convert comma to period)
   *    - If only comma present → heuristic check (≤2 digits after comma means decimal, else thousand separator)
   *    - If only period present → treated as decimal separator
   * 5. Applies explicit signs (`+`/`-`) and accounting notation signs
   *
   * @param {string} amountStr - The amount string to parse (e.g., `$1,234.56`, `1.234,56`, `(100)`)
   * @returns {number | null} The parsed numeric value, or null if parsing fails. Returns null for:
   *   - Strings longer than 100 characters (DoS protection)
   *   - Malformed amounts that cannot be parsed as valid numbers
   *   - Empty strings or strings containing only non-numeric characters
   *
   * @example
   * parseAmountString('1,234.56')      // → 1234.56
   * parseAmountString('-1,234.56')     // → -1234.56
   * parseAmountString('1.234,56')      // → 1234.56 (EU format)
   * parseAmountString('(1,234.56)')    // → -1234.56 (accounting notation)
   * parseAmountString('$1,234.56')     // → 1234.56 (currency removed)
   * parseAmountString('1234')          // → 1234 (integer)
   *
   * @complexity O(n) where n is string length - single pass for cleaning and normalization
   * @memory O(1) - no allocations beyond result string
   * @security No nested loops or backtracking, safe from algorithmic complexity attacks.
   *           DoS protection: rejects strings > 100 characters.
   */
  private parseAmountString(amountStr: string): number | null {
    // DoS protection: reject strings over 100 characters
    if (amountStr.length > 100) {
      return null;
    }

    const cleaned = this.stripCurrencySymbols(amountStr);
    const { value: withoutParens, isNegative } = this.parseAccountingNotation(cleaned);

    // Extract explicit sign from the value
    const hasSign = withoutParens.startsWith('-') || withoutParens.startsWith('+');
    const sign = withoutParens.startsWith('-') ? -1 : 1;
    const unsigned = hasSign ? withoutParens.slice(1) : withoutParens;

    const normalized = this.normalizeDecimalSeparator(unsigned);
    const numericValue = parseFloat(normalized);

    if (isNaN(numericValue)) {
      return null;
    }

    return (isNegative ? -1 : 1) * sign * numericValue;
  }

  /**
   * Remove currency symbols and whitespace from amount string.
   * Supports common currency symbols: $, €, £, ¥, ₽, ₴, ₸, ₹
   */
  private stripCurrencySymbols(str: string): string {
    return str.replace(/[$€£¥₽₴₸₹\s]/g, '').trim();
  }

  /**
   * Parse accounting notation where parentheses indicate negative values.
   * Example: "(100)" represents -100
   */
  private parseAccountingNotation(str: string): { value: string; isNegative: boolean } {
    const isNegative = str.startsWith('(') && str.endsWith(')');
    const value = isNegative ? str.slice(1, -1) : str;
    return { value, isNegative };
  }

  /**
   * Normalize decimal separator to period for parseFloat compatibility.
   * Handles US format (1,234.56), EU format (1.234,56), and ambiguous cases.
   *
   * When both separators are present, the position determines format:
   * - Period after comma = US format (1,234.56)
   * - Comma after period = EU format (1.234,56)
   *
   * When only comma is present, decimalSeparatorHint controls interpretation:
   * - 'auto': <=2 digits after comma = decimal, >2 digits = thousand separator
   * - 'comma': Always treat as decimal separator
   * - 'period': Always treat as thousand separator
   */
  private normalizeDecimalSeparator(str: string): string {
    const lastDot = str.lastIndexOf('.');
    const lastComma = str.lastIndexOf(',');

    const hasDot = lastDot !== -1;
    const hasComma = lastComma !== -1;

    let normalized: string;

    if (hasDot && hasComma) {
      // Both separators present - position determines format
      if (lastDot > lastComma) {
        // Period is decimal separator (US format: 1,234.56)
        normalized = str.replace(/,/g, '');
      } else {
        // Comma is decimal separator (EU format: 1.234,56)
        normalized = str.replace(/\./g, '').replace(',', '.');
      }
    } else if (hasComma && !hasDot) {
      // Only comma present - use hint or heuristic
      const hint = this.options.decimalSeparatorHint ?? 'auto';

      if (hint === 'comma') {
        // Treat comma as decimal separator (European format)
        normalized = str.replace(',', '.');
      } else if (hint === 'period') {
        // Treat comma as thousand separator (US format)
        normalized = str.replace(/,/g, '');
      } else {
        // 'auto': Use heuristic based on digit count after comma
        const afterComma = str.slice(lastComma + 1);
        if (afterComma.length <= 2) {
          // Two or fewer digits after comma suggests decimal separator
          normalized = str.replace(',', '.');
        } else {
          // More than two digits suggests thousand separator
          normalized = str.replace(/,/g, '');
        }
      }
    } else if (hasDot && !hasComma) {
      // Only period present - treat as decimal separator
      normalized = str;
    } else {
      // No separators (integer)
      normalized = str;
    }

    // Remove any remaining whitespace (group separators)
    return normalized.replace(/\s/g, '');
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
