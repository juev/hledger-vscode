/**
 * HLedgerImportCommands - Command handlers for CSV/TSV import
 */

import * as vscode from 'vscode';
import * as path from 'path';
import {
  TabularDataParser,
  ColumnDetector,
  TransactionGenerator,
  ImportOptions,
  PayeeAccountHistory,
  DEFAULT_IMPORT_OPTIONS,
  isJournalError,
} from './import';
import { HLedgerConfig } from './HLedgerConfig';

/**
 * Import commands for converting tabular data to hledger format
 */
export class HLedgerImportCommands implements vscode.Disposable {
  private readonly parser: TabularDataParser;
  private readonly columnDetector: ColumnDetector;
  private readonly config: HLedgerConfig | null;

  constructor(config?: HLedgerConfig) {
    this.parser = new TabularDataParser();
    this.columnDetector = new ColumnDetector();
    this.config = config ?? null;
  }

  dispose(): void {
    // No resources to dispose
  }

  /**
   * Import selected text as tabular data
   */
  async importFromSelection(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor found.');
      return;
    }

    const selection = editor.selection;
    if (selection.isEmpty) {
      vscode.window.showErrorMessage('No text selected. Please select tabular data to import.');
      return;
    }

    const selectedText = editor.document.getText(selection);
    if (!selectedText.trim()) {
      vscode.window.showErrorMessage('Selection is empty.');
      return;
    }

    await this.processImport(selectedText, 'selection');
  }

  /**
   * Import entire file as tabular data
   */
  async importFromFile(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor found.');
      return;
    }

    const document = editor.document;
    const content = document.getText();

    if (!content.trim()) {
      vscode.window.showErrorMessage('File is empty.');
      return;
    }

    // Get source name from file
    const sourceName = path.basename(document.fileName);

    await this.processImport(content, sourceName);
  }

  /**
   * Process import with progress indicator
   */
  private async processImport(content: string, sourceName: string): Promise<void> {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Importing tabular data...',
        cancellable: false,
      },
      async (progress) => {
        try {
          progress.report({ message: 'Parsing data...' });

          // Parse tabular data
          const parseResult = this.parser.parse(content);
          if (parseResult.success === false) {
            vscode.window.showErrorMessage(`Failed to parse data: ${parseResult.error}`);
            return;
          }

          const parsedData = parseResult.value;

          progress.report({ message: 'Detecting columns...' });

          // Detect column types
          const columnMappings = this.columnDetector.detectColumns(
            parsedData.headers,
            parsedData.rows
          );

          // Check for required columns
          const validation = ColumnDetector.hasRequiredColumns(columnMappings);
          if (!validation.valid) {
            const missing = validation.missing.join(', ');
            vscode.window.showErrorMessage(
              `Missing required columns: ${missing}. ` +
                `Detected columns: ${columnMappings.map((m) => `${m.headerName}(${m.type})`).join(', ')}`
            );
            return;
          }

          // Update parsed data with column mappings
          const dataWithMappings = {
            ...parsedData,
            columnMappings,
          };

          progress.report({ message: 'Generating transactions...' });

          // Get import options from configuration
          const options = this.getImportOptions();

          // Get payee-account history from journal (if available and enabled)
          let payeeHistory: PayeeAccountHistory | undefined;
          if (options.useJournalHistory !== false && this.config) {
            try {
              const historyData = this.config.getPayeeAccountHistory();
              if (historyData) {
                payeeHistory = historyData;
              }
            } catch (error) {
              // Use type-safe error checking with custom error types
              const isExpectedFailure = isJournalError(error);

              if (!isExpectedFailure) {
                // Log unexpected errors for debugging
                console.error('Failed to load payee account history from journal.', error);

                // Only show warning for unexpected failures
                await vscode.window.showWarningMessage(
                  'Could not load journal account history. Account resolution will use patterns and category mapping instead.',
                  'OK'
                );
              }
              // For expected failures (JournalNotFoundError, JournalAccessError), continue silently
            }
          }

          // Generate transactions
          const generator = new TransactionGenerator(options, payeeHistory);
          const result = generator.generate(dataWithMappings);

          // Check for fatal errors
          const fatalErrors = result.errors.filter((e) => e.fatal);
          if (fatalErrors.length > 0) {
            vscode.window.showErrorMessage(
              `Import failed: ${fatalErrors.map((e) => e.message).join('; ')}`
            );
            return;
          }

          // Check if any transactions were generated
          if (result.transactions.length === 0) {
            vscode.window.showWarningMessage(
              'No transactions could be generated from the data. ' +
                `Errors: ${result.errors.map((e) => e.message).join('; ')}`
            );
            return;
          }

          progress.report({ message: 'Creating document...' });

          // Format transactions
          const journalContent = generator.formatAll(result, sourceName);

          // Open in new untitled document
          await this.openInNewDocument(journalContent);

          // Show summary
          this.showImportSummary(result);
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          vscode.window.showErrorMessage(`Import failed: ${message}`);
        }
      }
    );
  }

  /**
   * Get import options from VS Code configuration
   */
  private getImportOptions(): ImportOptions {
    const config = vscode.workspace.getConfiguration('hledger.import');

    const dateFormat = config.get<ImportOptions['dateFormat']>(
      'dateFormat',
      DEFAULT_IMPORT_OPTIONS.dateFormat
    );

    const options: ImportOptions = {
      defaultDebitAccount: config.get(
        'defaultDebitAccount',
        DEFAULT_IMPORT_OPTIONS.defaultDebitAccount
      ),
      defaultCreditAccount: config.get(
        'defaultCreditAccount',
        DEFAULT_IMPORT_OPTIONS.defaultCreditAccount
      ),
      defaultBalancingAccount: config.get(
        'defaultBalancingAccount',
        DEFAULT_IMPORT_OPTIONS.defaultBalancingAccount
      ),
      invertAmounts: config.get('invertAmounts', DEFAULT_IMPORT_OPTIONS.invertAmounts),
      useJournalHistory: config.get('useJournalHistory', DEFAULT_IMPORT_OPTIONS.useJournalHistory),
      merchantPatterns: config.get('merchantPatterns', DEFAULT_IMPORT_OPTIONS.merchantPatterns),
      categoryMapping: config.get('categoryMapping', DEFAULT_IMPORT_OPTIONS.categoryMapping),
    };

    // Only include dateFormat if it has a value
    if (dateFormat !== undefined) {
      return { ...options, dateFormat };
    }
    return options;
  }

  /**
   * Open content in new untitled document with hledger language
   */
  private async openInNewDocument(content: string): Promise<void> {
    const document = await vscode.workspace.openTextDocument({
      language: 'hledger',
      content,
    });

    await vscode.window.showTextDocument(document);
  }

  /**
   * Show import summary notification
   */
  private showImportSummary(result: {
    transactions: readonly unknown[];
    warnings: readonly unknown[];
    statistics: {
      processedRows: number;
      skippedRows: number;
      autoDetectedAccounts: number;
      todoAccounts: number;
    };
  }): void {
    const { statistics, warnings } = result;

    let message = `Imported ${statistics.processedRows} transactions`;

    if (statistics.skippedRows > 0) {
      message += `, ${statistics.skippedRows} rows skipped`;
    }

    if (statistics.autoDetectedAccounts > 0) {
      message += `. ${statistics.autoDetectedAccounts} accounts auto-detected`;
    }

    if (statistics.todoAccounts > 0) {
      message += `, ${statistics.todoAccounts} need review`;
    }

    if (warnings.length > 0) {
      vscode.window.showWarningMessage(`${message}. ${warnings.length} warnings.`);
    } else {
      vscode.window.showInformationMessage(message + '.');
    }
  }
}
