// HLedgerFormattingProvider.ts - Standard VS Code formatting provider for hledger files
// Uses VS Code's DocumentFormattingEditProvider API for seamless integration

import * as vscode from 'vscode';
import { DocumentFormatter } from './DocumentFormatter';
import { isFailure } from './types';

/**
 * VS Code Document Formatting Provider for hledger files.
 * Integrates with VS Code's standard formatting infrastructure.
 */
export class HLedgerFormattingProvider implements vscode.DocumentFormattingEditProvider {
    private documentFormatter: DocumentFormatter;

    constructor() {
        this.documentFormatter = new DocumentFormatter();
    }

    /**
     * Provides document formatting edits for hledger files.
     * Called by VS Code when user triggers Format Document or format on save.
     *
     * @param document The document to format
     * @param options Formatting options (insert spaces, tab size, etc.)
     * @param token Cancellation token
     * @returns Promise resolving to array of TextEdit objects
     */
    async provideDocumentFormattingEdits(
        document: vscode.TextDocument,
        options: vscode.FormattingOptions,
        token: vscode.CancellationToken
    ): Promise<vscode.TextEdit[]> {
        // Check if operation is cancelled
        if (token.isCancellationRequested) {
            return [];
        }

        // Formatting is controlled by VS Code's global editor.formatOnSave setting

        try {
            // Get document content
            const content = document.getText();

            // Format using existing DocumentFormatter
            const formatResult = this.documentFormatter.formatContent(content);

            if (isFailure(formatResult)) {
                console.error('HLedger formatting failed:', formatResult.error);
                return [];
            }

            const formattedContent = formatResult.data;

            // If content hasn't changed, return empty edits
            if (formattedContent === content) {
                return [];
            }

            // Create a single edit that replaces the entire document
            const fullRange = new vscode.Range(
                document.positionAt(0),
                document.positionAt(content.length)
            );

            return [vscode.TextEdit.replace(fullRange, formattedContent)];

        } catch (error) {
            console.error('Error during hledger document formatting:', error);
            return [];
        }
    }
}

/**
 * VS Code Document Range Formatting Provider for hledger files.
 * Allows formatting selected portions of hledger files.
 */
export class HLedgerRangeFormattingProvider implements vscode.DocumentRangeFormattingEditProvider {
    private documentFormatter: DocumentFormatter;

    constructor() {
        this.documentFormatter = new DocumentFormatter();
    }

    /**
     * Provides range formatting edits for hledger files.
     * Called by VS Code when user triggers Format Selection.
     *
     * @param document The document to format
     * @param range The range to format
     * @param options Formatting options
     * @param token Cancellation token
     * @returns Promise resolving to array of TextEdit objects
     */
    async provideDocumentRangeFormattingEdits(
        document: vscode.TextDocument,
        range: vscode.Range,
        options: vscode.FormattingOptions,
        token: vscode.CancellationToken
    ): Promise<vscode.TextEdit[]> {
        // Check if operation is cancelled
        if (token.isCancellationRequested) {
            return [];
        }

        try {
            // For range formatting, we still format the entire document
            // because hledger formatting requires context of the whole transaction
            // This ensures consistency and proper alignment
            return await this.provideDocumentFormattingEdits(document, options, token);

        } catch (error) {
            console.error('Error during hledger range formatting:', error);
            return [];
        }
    }

    /**
     * Delegates to the main document formatting logic.
     */
    private async provideDocumentFormattingEdits(
        document: vscode.TextDocument,
        options: vscode.FormattingOptions,
        token: vscode.CancellationToken
    ): Promise<vscode.TextEdit[]> {
        const content = document.getText();
        const formatResult = this.documentFormatter.formatContent(content);

        if (isFailure(formatResult)) {
            console.error('HLedger formatting failed:', formatResult.error);
            return [];
        }

        const formattedContent = formatResult.data;

        if (formattedContent === content) {
            return [];
        }

        const fullRange = new vscode.Range(
            document.positionAt(0),
            document.positionAt(content.length)
        );

        return [vscode.TextEdit.replace(fullRange, formattedContent)];
    }
}

/**
 * Register formatting providers for hledger files.
 * Call this function during extension activation.
 */
export function registerFormattingProviders(context: vscode.ExtensionContext): void {
    // Register document formatting provider
    const documentFormatter = new HLedgerFormattingProvider();
    const documentRegistration = vscode.languages.registerDocumentFormattingEditProvider(
        'hledger',
        documentFormatter
    );
    context.subscriptions.push(documentRegistration);

    // Register range formatting provider
    const rangeFormatter = new HLedgerRangeFormattingProvider();
    const rangeRegistration = vscode.languages.registerDocumentRangeFormattingEditProvider(
        'hledger',
        rangeFormatter
    );
    context.subscriptions.push(rangeRegistration);

    console.log('HLedger formatting providers registered');
}