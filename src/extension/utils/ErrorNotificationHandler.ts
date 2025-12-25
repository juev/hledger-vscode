// ErrorNotificationHandler.ts - Centralized error notification handling for VS Code
// Provides user-friendly notifications for file processing errors and warnings

import * as vscode from 'vscode';
import type { FileProcessingError, FileProcessingWarning } from '../processor/HLedgerFileProcessor';

/**
 * Notification severity levels
 */
export enum NotificationSeverity {
  Error = 'error',
  Warning = 'warning',
  Info = 'info',
}

/**
 * Options for error notification display
 */
export interface NotificationOptions {
  /** Show detailed error information in output channel */
  showDetails?: boolean;
  /** Group multiple errors into a single notification */
  groupErrors?: boolean;
  /** Maximum number of errors to show in notification */
  maxErrorsToShow?: number;
}

/**
 * Handler for displaying file processing errors and warnings to users
 */
export class ErrorNotificationHandler {
  private readonly outputChannel: vscode.OutputChannel;
  private static readonly MAX_ERRORS_IN_NOTIFICATION = 3;
  private static readonly CHANNEL_NAME = 'HLedger';

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel(ErrorNotificationHandler.CHANNEL_NAME);
  }

  /**
   * Handle file processing errors with user notification
   */
  public handleFileProcessingErrors(
    errors: FileProcessingError[],
    options: NotificationOptions = {}
  ): void {
    if (errors.length === 0) {
      return;
    }

    const {
      showDetails = true,
      groupErrors = true,
      maxErrorsToShow = ErrorNotificationHandler.MAX_ERRORS_IN_NOTIFICATION,
    } = options;

    // Log all errors to output channel
    if (showDetails) {
      this.logErrorsToOutput(errors);
    }

    // Show user notification
    if (groupErrors && errors.length > maxErrorsToShow) {
      this.showGroupedErrorNotification(errors, maxErrorsToShow);
    } else {
      this.showIndividualErrorNotifications(errors.slice(0, maxErrorsToShow));
    }
  }

  /**
   * Handle file processing warnings with user notification
   */
  public handleFileProcessingWarnings(
    warnings: FileProcessingWarning[],
    options: NotificationOptions = {}
  ): void {
    if (warnings.length === 0) {
      return;
    }

    const { showDetails = true } = options;

    // Log warnings to output channel
    if (showDetails) {
      this.logWarningsToOutput(warnings);
    }

    // Only show warning notification for critical warnings
    // Most warnings are informational and don't need user notification
    const criticalWarnings = warnings.filter((w) => this.isCriticalWarning(w));

    if (criticalWarnings.length > 0) {
      this.showWarningNotification(criticalWarnings);
    }
  }

  /**
   * Log errors to output channel with context
   */
  private logErrorsToOutput(errors: FileProcessingError[]): void {
    this.outputChannel.appendLine('=== HLedger File Processing Errors ===');
    this.outputChannel.appendLine(`Timestamp: ${new Date().toISOString()}`);
    this.outputChannel.appendLine(`Error count: ${errors.length}`);
    this.outputChannel.appendLine('');

    errors.forEach((error, index) => {
      this.outputChannel.appendLine(`Error ${index + 1}:`);
      this.outputChannel.appendLine(`  File: ${error.file}`);
      if (error.line !== undefined) {
        this.outputChannel.appendLine(`  Line: ${error.line}`);
      }
      this.outputChannel.appendLine(`  Message: ${error.error}`);
      this.outputChannel.appendLine('');
    });

    this.outputChannel.appendLine('=== End of Error Report ===');
    this.outputChannel.appendLine('');
  }

  /**
   * Log warnings to output channel with context
   */
  private logWarningsToOutput(warnings: FileProcessingWarning[]): void {
    this.outputChannel.appendLine('=== HLedger File Processing Warnings ===');
    this.outputChannel.appendLine(`Timestamp: ${new Date().toISOString()}`);
    this.outputChannel.appendLine(`Warning count: ${warnings.length}`);
    this.outputChannel.appendLine('');

    warnings.forEach((warning, index) => {
      this.outputChannel.appendLine(`Warning ${index + 1}:`);
      this.outputChannel.appendLine(`  File: ${warning.file}`);
      this.outputChannel.appendLine(`  Message: ${warning.message}`);
      this.outputChannel.appendLine('');
    });

    this.outputChannel.appendLine('=== End of Warning Report ===');
    this.outputChannel.appendLine('');
  }

  /**
   * Show grouped error notification (multiple errors)
   */
  private showGroupedErrorNotification(errors: FileProcessingError[], maxToShow: number): void {
    const remainingCount = errors.length - maxToShow;
    const errorList = errors
      .slice(0, maxToShow)
      .map((e) => `• ${this.formatErrorForNotification(e)}`)
      .join('\n');

    const message = `HLedger: ${errors.length} file processing error${errors.length > 1 ? 's' : ''} occurred:\n\n${errorList}${
      remainingCount > 0
        ? `\n\n...and ${remainingCount} more error${remainingCount > 1 ? 's' : ''}`
        : ''
    }`;

    vscode.window.showErrorMessage(message, 'Show Details', 'Dismiss').then((selection) => {
      if (selection === 'Show Details') {
        this.outputChannel.show();
      }
    });
  }

  /**
   * Show individual error notifications (few errors)
   */
  private showIndividualErrorNotifications(errors: FileProcessingError[]): void {
    errors.forEach((error) => {
      const message = `HLedger: ${this.formatErrorForNotification(error)}`;

      vscode.window.showErrorMessage(message, 'Show Details', 'Dismiss').then((selection) => {
        if (selection === 'Show Details') {
          this.outputChannel.show();
        }
      });
    });
  }

  /**
   * Show warning notification for critical warnings
   */
  private showWarningNotification(warnings: FileProcessingWarning[]): void {
    if (warnings.length === 1) {
      const warning = warnings[0];
      if (warning) {
        const message = `HLedger: ${this.formatWarningForNotification(warning)}`;

        vscode.window.showWarningMessage(message, 'Show Details', 'Dismiss').then((selection) => {
          if (selection === 'Show Details') {
            this.outputChannel.show();
          }
        });
      }
    } else {
      const message = `HLedger: ${warnings.length} warnings occurred. Check the output channel for details.`;

      vscode.window.showWarningMessage(message, 'Show Details', 'Dismiss').then((selection) => {
        if (selection === 'Show Details') {
          this.outputChannel.show();
        }
      });
    }
  }

  /**
   * Format error for notification display
   */
  private formatErrorForNotification(error: FileProcessingError): string {
    const fileName = this.getFileName(error.file);
    const lineInfo = error.line !== undefined ? ` (line ${error.line})` : '';
    return `${fileName}${lineInfo}: ${error.error}`;
  }

  /**
   * Format warning for notification display
   */
  private formatWarningForNotification(warning: FileProcessingWarning): string {
    const fileName = this.getFileName(warning.file);
    return `${fileName}: ${warning.message}`;
  }

  /**
   * Extract file name from full path for cleaner display
   */
  private getFileName(filePath: string): string {
    const parts = filePath.split(/[/\\]/);
    return parts[parts.length - 1] || filePath;
  }

  /**
   * Determine if a warning is critical and requires user notification
   */
  private isCriticalWarning(warning: FileProcessingWarning): boolean {
    const criticalPatterns = [/not found/i, /failed to/i, /cannot/i, /unable to/i, /missing/i];

    return criticalPatterns.some((pattern) => pattern.test(warning.message));
  }

  /**
   * Show output channel (for manual debugging)
   */
  public showOutputChannel(): void {
    this.outputChannel.show();
  }

  /**
   * Clear output channel
   */
  public clearOutput(): void {
    this.outputChannel.clear();
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    this.outputChannel.dispose();
  }
}
