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
import { createCacheKey } from './types';
import { registerFormattingProviders } from './HLedgerFormattingProvider';
import { HledgerSemanticTokensProvider, HLEDGER_SEMANTIC_TOKENS_LEGEND } from './HledgerSemanticTokensProvider';
import { HLedgerCliService } from './services/HLedgerCliService';
import { HLedgerCliCommands } from './HLedgerCliCommands';
import { ErrorNotificationHandler } from './utils/ErrorNotificationHandler';

// Global instances for simplified architecture (to be replaced with proper DI)
let globalConfig: HLedgerConfig | null = null;
let cliService: HLedgerCliService | null = null;
let cliCommands: HLedgerCliCommands | null = null;
let errorNotificationHandler: ErrorNotificationHandler | null = null;

// Main activation function
export function activate(context: vscode.ExtensionContext): void {
    try {
        // Initialize global instances with proper null checks
        initializeGlobalInstances();

        // Add CLI service to subscriptions for proper cleanup
        if (cliService) {
            context.subscriptions.push(cliService);
        }

        // Add error notification handler to subscriptions
        if (errorNotificationHandler) {
            context.subscriptions.push(errorNotificationHandler);
        }

        // Register strict completion provider with necessary triggers
        // VS Code requires explicit triggers - 24x7 IntelliSense doesn't work automatically
        if (!globalConfig) {
            throw new Error('HLedger: Global config not initialized');
        }
        const strictProvider = new StrictCompletionProvider(globalConfig);

        // Register the provider for completion items
        context.subscriptions.push(
            vscode.languages.registerCompletionItemProvider(
                'hledger',
                strictProvider,
                // Triggers for different completion contexts (space intentionally excluded):
                '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',  // Date completion at line start
                ':',  // Account hierarchy
                '@',  // Commodities
                ';'   // Comments (future use)
            )
        );

        // Register the provider itself for proper disposal (prevents RegexCache memory leak)
        context.subscriptions.push(strictProvider);


        // Register formatting providers for hledger files
        registerFormattingProviders(context);

        // Register Enter key handler for smart indentation
        const enterCommand = new HLedgerEnterCommand();
        context.subscriptions.push(enterCommand);

        // Register Tab key handler for amount alignment positioning
        const tabCommand = new HLedgerTabCommand();
        context.subscriptions.push(tabCommand);

        // Register semantic tokens provider for dynamic coloring with range support
        const semanticProvider = new HledgerSemanticTokensProvider();
        context.subscriptions.push(
            vscode.languages.registerDocumentSemanticTokensProvider(
                { language: 'hledger' },
                semanticProvider,
                HLEDGER_SEMANTIC_TOKENS_LEGEND
            )
        );

        // Also register range provider for better performance on large files
        context.subscriptions.push(
            vscode.languages.registerDocumentRangeSemanticTokensProvider(
                { language: 'hledger' },
                semanticProvider,
                HLEDGER_SEMANTIC_TOKENS_LEGEND
            )
        );

        // Register the semantic provider itself for proper disposal
        context.subscriptions.push(semanticProvider);

        // FS watcher for journal files: invalidate cache on change
        const watcher = vscode.workspace.createFileSystemWatcher('**/*.{journal,hledger,ledger}');
        const onFsChange = (): void => {
            try {
                if (globalConfig) {
                    globalConfig.clearCache();
                }
            } catch (err) {
                console.error('HLedger: cache clear failed after FS change', err);
            }
        };
        watcher.onDidCreate(onFsChange, null, context.subscriptions);
        watcher.onDidChange(onFsChange, null, context.subscriptions);
        watcher.onDidDelete(onFsChange, null, context.subscriptions);
        context.subscriptions.push(watcher);


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

        // Register CLI commands
        if (!cliCommands) {
            throw new Error('HLedger: CLI commands not initialized');
        }

        // Register CLI commands handler for proper disposal
        context.subscriptions.push(cliCommands);

        context.subscriptions.push(
            vscode.commands.registerCommand('hledger.cli.balance', async () => {
                if (cliCommands) {
                    await cliCommands.insertBalance();
                }
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('hledger.cli.stats', async () => {
                if (cliCommands) {
                    await cliCommands.insertStats();
                }
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('hledger.cli.incomestatement', async () => {
                if (cliCommands) {
                    await cliCommands.insertIncomestatement();
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
        // Use proper cleanup function
        disposeGlobalInstances();
        // Extension deactivation complete
    } catch (error) {
        console.error('HLedger extension deactivation error:', error);
    }
}

/**
 * Helper function to get config for a document (for backward compatibility).
 * Creates global config instance if it doesn't exist.
 * @deprecated Use proper dependency injection instead of global state
 */
export function getConfig(document: vscode.TextDocument): HLedgerConfig {
    if (!globalConfig) {
        const parser = new HLedgerParser();
        const cache = new SimpleProjectCache();
        globalConfig = new HLedgerConfig(parser, cache);
    }

    globalConfig.getConfigForDocument(document);
    return globalConfig;
}

/**
 * Get the global error notification handler instance
 * @returns ErrorNotificationHandler instance or null if not initialized
 */
export function getErrorNotificationHandler(): ErrorNotificationHandler | null {
    return errorNotificationHandler;
}

/**
 * Global initialization function to ensure proper setup
 * Should be called during extension activation
 */
export function initializeGlobalInstances(): void {
    if (!globalConfig) {
        const parser = new HLedgerParser();
        const cache = new SimpleProjectCache();
        globalConfig = new HLedgerConfig(parser, cache);
    }

    cliService ??= new HLedgerCliService();
    cliCommands ??= new HLedgerCliCommands(cliService);
    errorNotificationHandler ??= new ErrorNotificationHandler();
}

/**
 * Cleanup function to dispose global instances
 * Should be called during extension deactivation
 */
export function disposeGlobalInstances(): void {
    try {
        // Dispose all global instances in reverse order of initialization
        if (globalConfig) {
            globalConfig.dispose();
        }
        if (cliCommands) {
            cliCommands.dispose();
        }
        if (cliService) {
            cliService.dispose();
        }
        if (errorNotificationHandler) {
            errorNotificationHandler.dispose();
        }
        // Reset global variables to null (type-safe)
        globalConfig = null;
        cliService = null;
        cliCommands = null;
        errorNotificationHandler = null;
    } catch (error) {
        console.error('HLedger: Error disposing global instances:', error);
    }
}

// Public API exports
export { HLedgerConfig } from './HLedgerConfig';
export { HLedgerParser } from './HLedgerParser';
export { SimpleProjectCache } from './SimpleProjectCache';
export { SimpleFuzzyMatcher } from './SimpleFuzzyMatcher';