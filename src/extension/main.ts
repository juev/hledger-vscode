// main.ts - Simplified entry point for hledger extension
// Refactored architecture with ~190 lines (FASE G)

import * as vscode from 'vscode';
import * as path from 'path';
import { HLedgerParser, ParsedHLedgerData } from './HLedgerParser';
import { HLedgerConfig } from './HLedgerConfig';
import { SimpleProjectCache } from './SimpleProjectCache';
import { StrictCompletionProvider } from './StrictCompletionProvider';
import { HLedgerEnterCommand } from './HLedgerEnterCommand';
import { SimpleFuzzyMatcher } from './SimpleFuzzyMatcher';
import { createCacheKey, isFailure } from './types';
import { AmountAligner } from './AmountAligner';

// Global instances for simplified architecture
let globalConfig: HLedgerConfig;
let amountAligner: AmountAligner;

// Track recently formatted documents to prevent infinite loops
const recentlyFormattedDocuments = new Set<string>();
const FORMAT_COOLDOWN_MS = 1000; // 1 second cooldown

/**
 * Handles document save events and applies automatic formatting if enabled.
 *
 * @param document The document that was saved
 * @returns Promise that resolves when formatting is complete
 */
export async function handleDocumentSave(document: vscode.TextDocument): Promise<void> {
    try {
        // Check if this is a hledger file
        if (document.languageId !== 'hledger') {
            return;
        }

        // Check if this document was recently formatted to prevent infinite loops
        const documentKey = `${document.uri.toString()}_${document.version}`;
        if (recentlyFormattedDocuments.has(documentKey)) {
            return;
        }

        // Get configuration
        const config = vscode.workspace.getConfiguration('hledger');
        const isAmountAlignmentEnabled = config.get<boolean>('amountAlignment.enabled', false);
        const isFormatOnSaveEnabled = config.get<boolean>('amountAlignment.formatOnSave', false);

        // Only format if both amount alignment and format on save are enabled
        if (!isAmountAlignmentEnabled || !isFormatOnSaveEnabled) {
            return;
        }

        // Initialize amount aligner if not already done
        if (!amountAligner) {
            amountAligner = new AmountAligner();
        }

        // Get the document content
        const content = document.getText();

        // Format the content using AmountAligner
        const formatResult = amountAligner.formatContent(content);

        if (!formatResult.success || isFailure(formatResult)) {
            console.error('HLedger auto-format failed:', isFailure(formatResult) ? formatResult.error : 'Unknown error');
            return;
        }

        const formattedContent = formatResult.data;

        // Check if content actually changed
        if (formattedContent === content) {
            return;
        }

        // Apply the formatting using a text edit
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document === document) {
            const fullRange = new vscode.Range(
                document.positionAt(0),
                document.positionAt(content.length)
            );

            // Mark this document as recently formatted before applying edits
            recentlyFormattedDocuments.add(documentKey);

            // Schedule removal from the tracking set after cooldown
            setTimeout(() => {
                recentlyFormattedDocuments.delete(documentKey);
            }, FORMAT_COOLDOWN_MS);

            // Apply the edit
            const editSuccess = await editor.edit(editBuilder => {
                editBuilder.replace(fullRange, formattedContent);
            });

            if (editSuccess) {
                // Show a subtle notification that formatting was applied
                vscode.window.setStatusBarMessage('hledger: Amounts aligned on save', 3000);

                // Log the formatting for debugging
                console.log(`Auto-formatted hledger document on save: ${document.fileName}`);
            } else {
                // Remove from tracking set if edit failed
                recentlyFormattedDocuments.delete(documentKey);
                console.warn(`Failed to apply auto-format to document: ${document.fileName}`);
            }
        }

    } catch (error) {
        // Log the error but don't block the save operation
        console.error('Error during hledger auto-format on save:', error);

        // Show error notification only if it's a significant error
        if (error instanceof Error && error.message.includes('failed to parse')) {
            vscode.window.showErrorMessage(`hledger auto-format failed: ${error.message}`);
        }
    }
}

/**
 * Document formatting provider for hledger files using AmountAligner.
 * Provides automatic alignment of amounts in transaction postings.
 */
class HLedgerDocumentFormattingEditProvider implements vscode.DocumentFormattingEditProvider {
    /**
     * Provides document formatting edits for hledger files.
     *
     * @param document The document to format
     * @param options Formatting options
     * @param token Cancellation token
     * @returns Promise resolving to formatting edits or null if formatting is disabled
     */
    async provideDocumentFormattingEdits(
        document: vscode.TextDocument,
        options: vscode.FormattingOptions,
        token: vscode.CancellationToken
    ): Promise<vscode.TextEdit[] | null> {
        try {
            // Check if amount alignment is enabled in configuration
            const config = vscode.workspace.getConfiguration('hledger');
            const isAlignmentEnabled = config.get<boolean>('amountAlignment.enabled', false);

            if (!isAlignmentEnabled) {
                return null;
            }

            // Check if the document is a hledger file
            if (document.languageId !== 'hledger') {
                return null;
            }

            // Check for cancellation
            if (token.isCancellationRequested) {
                return null;
            }

            // Initialize amount aligner if not already done
            if (!amountAligner) {
                amountAligner = new AmountAligner();
            }

            // Get the document content
            const content = document.getText();

            // Format the content using AmountAligner
            const formatResult = amountAligner.formatContent(content);

            if (!formatResult.success || isFailure(formatResult)) {
                console.error('HLedger formatting failed:', isFailure(formatResult) ? formatResult.error : 'Unknown error');
                return null;
            }

            const formattedContent = formatResult.data;

            // If content hasn't changed, return null
            if (formattedContent === content) {
                return null;
            }

            // Create a single text edit for the entire document
            const fullRange = new vscode.Range(
                document.positionAt(0),
                document.positionAt(content.length)
            );

            const textEdit = vscode.TextEdit.replace(fullRange, formattedContent);

            return [textEdit];

        } catch (error) {
            console.error('Error during hledger document formatting:', error);
            return null;
        }
    }
}

// Main activation function
export function activate(context: vscode.ExtensionContext): void {
    try {
        // Initialize global config with simple architecture
        const parser = new HLedgerParser();
        const cache = new SimpleProjectCache();
        globalConfig = new HLedgerConfig(parser, cache);
        
        // Register strict completion provider with necessary triggers
        // VS Code requires explicit triggers - 24x7 IntelliSense doesn't work automatically
        const strictProvider = new StrictCompletionProvider(globalConfig);
        context.subscriptions.push(
            vscode.languages.registerCompletionItemProvider(
                'hledger',
                strictProvider,
                // Triggers for different completion contexts:
                '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',  // Date completion at line start
                ' ',  // After date for accounts, after amount for currencies
                ':',  // Account hierarchy
                '@',  // Commodities
                ';'   // Comments (future use)
            )
        );

        // Register document formatting provider for amount alignment
        const formattingProvider = new HLedgerDocumentFormattingEditProvider();
        context.subscriptions.push(
            vscode.languages.registerDocumentFormattingEditProvider(
                'hledger',
                formattingProvider
            )
        );

        // Register document save event handler for automatic formatting
        const saveHandler = vscode.workspace.onDidSaveTextDocument(async (document) => {
            await handleDocumentSave(document);
        });
        context.subscriptions.push(saveHandler);
        
        // Register Enter key handler for smart indentation
        const enterCommand = new HLedgerEnterCommand();
        context.subscriptions.push(enterCommand);


        // Register manual completion commands
        context.subscriptions.push(
            vscode.commands.registerCommand('hledger.triggerDateCompletion', () => {
                vscode.commands.executeCommand('editor.action.triggerSuggest');
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('hledger.triggerAccountCompletion', () => {
                vscode.commands.executeCommand('editor.action.triggerSuggest');
            })
        );

        // Register manual formatting command
        context.subscriptions.push(
            vscode.commands.registerCommand('hledger.formatDocument', async () => {
                const editor = vscode.window.activeTextEditor;
                if (!editor) {
                    vscode.window.showWarningMessage('No active editor found');
                    return;
                }

                if (editor.document.languageId !== 'hledger') {
                    vscode.window.showWarningMessage('This command is only available for hledger files');
                    return;
                }

                // Check configuration settings
                const config = vscode.workspace.getConfiguration('hledger');
                const isAlignmentEnabled = config.get<boolean>('amountAlignment.enabled', false);
                const isFormatOnSaveEnabled = config.get<boolean>('amountAlignment.formatOnSave', false);

                if (!isAlignmentEnabled) {
                    const enableAction = await vscode.window.showWarningMessage(
                        'Amount alignment is disabled. Enable it to format amounts?',
                        'Enable', 'Cancel'
                    );

                    if (enableAction === 'Enable') {
                        await config.update('amountAlignment.enabled', true, vscode.ConfigurationTarget.WorkspaceFolder);

                        // Also suggest enabling format on save
                        const enableFormatOnSave = await vscode.window.showInformationMessage(
                            'Amount alignment enabled. Would you like to also enable automatic formatting on save?',
                            'Enable Format on Save', 'Not Now'
                        );

                        if (enableFormatOnSave === 'Enable Format on Save') {
                            await config.update('amountAlignment.formatOnSave', true, vscode.ConfigurationTarget.WorkspaceFolder);
                            vscode.window.showInformationMessage('Amount alignment and format on save enabled for this workspace');
                        } else {
                            vscode.window.showInformationMessage('Amount alignment enabled for this workspace');
                        }
                    } else {
                        return;
                    }
                } else if (!isFormatOnSaveEnabled) {
                    // Suggest enabling format on save if not already enabled
                    const enableFormatOnSave = await vscode.window.showInformationMessage(
                        'Would you like to enable automatic formatting on save?',
                        'Enable Format on Save', 'Not Now'
                    );

                    if (enableFormatOnSave === 'Enable Format on Save') {
                        await config.update('amountAlignment.formatOnSave', true, vscode.ConfigurationTarget.WorkspaceFolder);
                        vscode.window.showInformationMessage('Format on save enabled for this workspace');
                    }
                }

                try {
                    // Show progress indicator
                    await vscode.window.withProgress({
                        location: vscode.ProgressLocation.Notification,
                        title: 'Aligning amounts',
                        cancellable: false
                    }, async (progress) => {
                        progress.report({ increment: 0, message: 'Formatting document...' });

                        // Execute the format command
                        await vscode.commands.executeCommand('editor.action.format');

                        progress.report({ increment: 100, message: 'Complete!' });

                        // Brief delay to show completion
                        await new Promise(resolve => setTimeout(resolve, 500));
                    });

                    // Show success message
                    vscode.window.showInformationMessage('Document formatted successfully');

                } catch (error) {
                    console.error('Error formatting hledger document:', error);
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    vscode.window.showErrorMessage(`Failed to format document: ${errorMessage}`);
                }
            })
        );

        // Register toggle format on save command
        context.subscriptions.push(
            vscode.commands.registerCommand('hledger.toggleFormatOnSave', async () => {
                const config = vscode.workspace.getConfiguration('hledger');
                const isFormatOnSaveEnabled = config.get<boolean>('amountAlignment.formatOnSave', false);
                const isAmountAlignmentEnabled = config.get<boolean>('amountAlignment.enabled', false);

                if (!isAmountAlignmentEnabled) {
                    const enableAlignmentAction = await vscode.window.showWarningMessage(
                        'Amount alignment must be enabled before using format on save. Enable amount alignment?',
                        'Enable', 'Cancel'
                    );

                    if (enableAlignmentAction === 'Enable') {
                        await config.update('amountAlignment.enabled', true, vscode.ConfigurationTarget.WorkspaceFolder);
                        await config.update('amountAlignment.formatOnSave', true, vscode.ConfigurationTarget.WorkspaceFolder);
                        vscode.window.showInformationMessage('Amount alignment and format on save enabled');
                    }
                } else {
                    // Toggle the format on save setting
                    const newValue = !isFormatOnSaveEnabled;
                    await config.update('amountAlignment.formatOnSave', newValue, vscode.ConfigurationTarget.WorkspaceFolder);

                    const status = newValue ? 'enabled' : 'disabled';
                    vscode.window.showInformationMessage(`Format on save ${status}`);
                }
            })
        );

        // Extension activation complete
        
    } catch (error) {
        console.error('HLedger extension activation failed:', error);
    }
}

export function deactivate(): void {
    try {
        if (globalConfig) {
            globalConfig.clearCache();
        }
        // Extension deactivation complete
    } catch (error) {
        console.error('HLedger extension deactivation error:', error);
    }
}

// Helper function to get config for a document (for backward compatibility)
export function getConfig(document: vscode.TextDocument): HLedgerConfig {
    if (!globalConfig) {
        const parser = new HLedgerParser();
        const cache = new SimpleProjectCache();
        globalConfig = new HLedgerConfig(parser, cache);
    }
    
    globalConfig.getConfigForDocument(document);
    return globalConfig;
}

// Legacy exports for backward compatibility
export { HLedgerConfig } from './HLedgerConfig';
export { HLedgerParser } from './HLedgerParser';

/**
 * Legacy WorkspaceCache wrapper for backward compatibility.
 * Provides type-safe wrapper around SimpleProjectCache with branded types.
 * @deprecated Use SimpleProjectCache directly for new code.
 */
export class WorkspaceCache {
    private cache = new SimpleProjectCache();
    
    get(key: string) {
        return this.cache.get(createCacheKey(key));
    }
    
    set(key: string, value: ParsedHLedgerData) {
        return this.cache.set(createCacheKey(key), value);
    }
    
    clear() {
        return this.cache.clear();
    }

    isValid(workspacePath: string): boolean {
        return this.cache.has(createCacheKey(workspacePath));
    }

    update(workspacePath: string): void {
        const cacheKey = createCacheKey(workspacePath);
        if (!this.cache.has(cacheKey)) {
            const parser = new HLedgerParser();
            const data = parser.parseWorkspace(workspacePath);
            this.cache.set(cacheKey, data);
        }
    }

    getConfig() {
        return null; // Legacy method
    }

    invalidate(): void {
        this.cache.clear();
    }

    dispose(): void {
        this.cache.clear();
    }

    static resetInstance(): void {
        // No-op for backward compatibility
    }
}

/**
 * Legacy ProjectCache wrapper for backward compatibility.
 * Provides type-safe wrapper around SimpleProjectCache with project-specific methods.
 * @deprecated Use SimpleProjectCache directly for new code.
 */
export class ProjectCache {
    private cache = new SimpleProjectCache();
    
    get(key: string) {
        return this.cache.get(createCacheKey(key));
    }
    
    set(key: string, value: ParsedHLedgerData) {
        return this.cache.set(createCacheKey(key), value);
    }
    
    clear() {
        return this.cache.clear();
    }

    getConfig(projectPath: string) {
        return this.cache.get(createCacheKey(projectPath));
    }

    initializeProject(projectPath: string) {
        return this.cache.getOrCreateProjectConfig(projectPath);
    }

    hasProject(projectPath: string): boolean {
        return this.cache.has(createCacheKey(projectPath));
    }

    findProjectForFile(filePath: string): string | null {
        // Simple implementation - use directory of file
        return path.dirname(filePath);
    }

    dispose(): void {
        this.cache.clear();
    }

    static resetInstance(): void {
        // No-op for backward compatibility
    }

    static get(): ProjectCache {
        return new ProjectCache();
    }

    static getInstance(): ProjectCache {
        return new ProjectCache();
    }
}

/**
 * Legacy fuzzy match function for backward compatibility.
 * @deprecated Use SimpleFuzzyMatcher directly for new code.
 * @param query - Search query string
 * @param items - Array of strings to search
 * @param maxResults - Maximum number of results to return
 * @returns Array of fuzzy match results with item and score
 */
export function fuzzyMatch(query: string, items: string[], maxResults = 100): { item: string; score: number }[] {
    const matcher = new SimpleFuzzyMatcher();
    return matcher.match(query, items, { maxResults });
}