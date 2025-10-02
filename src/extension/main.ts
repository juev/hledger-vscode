// main.ts - Simplified entry point for hledger extension
// Refactored architecture with ~190 lines (FASE G)

import * as vscode from 'vscode';
import * as path from 'path';
import { HLedgerParser, ParsedHLedgerData } from './HLedgerParser';
import { HLedgerConfig } from './HLedgerConfig';
import { SimpleProjectCache } from './SimpleProjectCache';
import { StrictCompletionProvider } from './StrictCompletionProvider';
import { HLedgerEnterCommand } from './HLedgerEnterCommand';
import { HLedgerTabCommand } from './HLedgerTabCommand';
import { SimpleFuzzyMatcher } from './SimpleFuzzyMatcher';
import { createCacheKey, isFailure } from './types';
import { DocumentFormatter } from './DocumentFormatter';

// Global instances for simplified architecture
let globalConfig: HLedgerConfig;
let documentFormatter: DocumentFormatter;

// Track recently formatted documents to prevent infinite loops
const recentlyFormattedDocuments = new Set<string>();
const FORMAT_COOLDOWN_MS = 1000; // 1 second cooldown

/**
 * Handles document save events and applies automatic formatting if enabled.
 * Includes proper posting indentation, amount alignment, and comment alignment.
 *
 * @param document The document that was saved
 * @returns Promise that resolves when formatting is complete
 */
export async function handleDocumentSave(document: vscode.TextDocument): Promise<void> {
    try {
        console.log(`handleDocumentSave called for: ${document.fileName}, languageId: ${document.languageId}`);

        // Check if this is a hledger file
        if (document.languageId !== 'hledger') {
            console.log('Not a hledger file, skipping');
            return;
        }

        // Check if this document was recently formatted to prevent infinite loops
        const documentKey = `${document.uri.toString()}_${document.version}`;
        if (recentlyFormattedDocuments.has(documentKey)) {
            return;
        }

        // Get configuration
        const config = vscode.workspace.getConfiguration('hledger');
        const isFormatOnSaveEnabled = config.get<boolean>('formatOnSave', false);
        console.log(`Format on save enabled: ${isFormatOnSaveEnabled}`);

        // Only format if format on save is enabled
        if (!isFormatOnSaveEnabled) {
            console.log('Format on save is disabled, skipping');
            return;
        }

        // Initialize document formatter if not already done
        if (!documentFormatter) {
            documentFormatter = new DocumentFormatter();
        }

        // Get the document content
        const content = document.getText();

        // Format the content using DocumentFormatter
        console.log('Formatting document content...');
        const formatResult = documentFormatter.formatContent(content);

        if (!formatResult.success || isFailure(formatResult)) {
            console.error('HLedger auto-format failed:', isFailure(formatResult) ? formatResult.error : 'Unknown error');
            return;
        }

        const formattedContent = formatResult.data;
        console.log('Content formatted successfully');

        // Check if content actually changed
        if (formattedContent === content) {
            console.log('Content unchanged, skipping edit');
            return;
        }

        // Apply the formatting using a text edit
        const editor = vscode.window.activeTextEditor;
        console.log(`Active editor found: ${!!editor}, matches document: ${editor && editor.document === document}`);

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
                vscode.window.setStatusBarMessage('hledger: Document formatted on save', 3000);

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
 * Document formatting functionality for hledger files using DocumentFormatter.
 * Provides comprehensive formatting including proper indentation, amount and comment alignment.
 */

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

        
        // Register document save event handler for automatic formatting
        const saveHandler = vscode.workspace.onDidSaveTextDocument(async (document) => {
            await handleDocumentSave(document);
        });
        context.subscriptions.push(saveHandler);
        
        // Register Enter key handler for smart indentation
        const enterCommand = new HLedgerEnterCommand();
        context.subscriptions.push(enterCommand);

        // Register Tab key handler for amount alignment positioning
        const tabCommand = new HLedgerTabCommand();
        context.subscriptions.push(tabCommand);


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

        
        // Register toggle format on save command
        context.subscriptions.push(
            vscode.commands.registerCommand('hledger.toggleFormatOnSave', async () => {
                const config = vscode.workspace.getConfiguration('hledger');
                const isFormatOnSaveEnabled = config.get<boolean>('formatOnSave', false);

                // Toggle the format on save setting
                const newValue = !isFormatOnSaveEnabled;
                await config.update('formatOnSave', newValue, vscode.ConfigurationTarget.WorkspaceFolder);

                const status = newValue ? 'enabled' : 'disabled';
                vscode.window.showInformationMessage(`Format on save ${status}`);
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