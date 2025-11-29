// main.ts - Simplified entry point for hledger extension
// Refactored architecture with ~190 lines (FASE G)

import * as vscode from 'vscode';
import { StrictCompletionProvider } from './StrictCompletionProvider';
import { HLedgerEnterCommand } from './HLedgerEnterCommand';
import { HLedgerTabCommand } from './HLedgerTabCommand';
import { registerFormattingProviders } from './HLedgerFormattingProvider';
import { HledgerSemanticTokensProvider, HLEDGER_SEMANTIC_TOKENS_LEGEND } from './HledgerSemanticTokensProvider';
import { createServices } from './services';
import { SimpleFuzzyMatcher } from './SimpleFuzzyMatcher';
import { HLedgerCodeActionProvider } from './actions/HLedgerCodeActionProvider';
import { HLedgerDiagnosticsProvider } from './diagnostics/HLedgerDiagnosticsProvider';

// Main activation function
export function activate(context: vscode.ExtensionContext): void {
    try {
        // Create services once with service factory pattern
        const services = createServices();
        context.subscriptions.push(services);

        // Register strict completion provider with explicit trigger characters
        // VS Code CompletionItemProvider requires trigger characters to activate completion;
        // automatic completion on every keystroke is not supported by the API and would degrade performance
        const strictProvider = new StrictCompletionProvider(services.config);

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

        // Register code action provider for balance assertions and quick fixes
        const codeActionProvider = new HLedgerCodeActionProvider(services.config);
        context.subscriptions.push(
            vscode.languages.registerCodeActionsProvider(
                'hledger',
                codeActionProvider,
                {
                    providedCodeActionKinds: HLedgerCodeActionProvider.providedCodeActionKinds
                }
            )
        );

        // Register diagnostics provider for validation on save
        const diagnosticsProvider = new HLedgerDiagnosticsProvider(services.config);
        context.subscriptions.push(diagnosticsProvider);

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

        // FS watcher for journal files: reset data on change, preserve cache for mtimeMs validation
        // This enables incremental updates - only modified files will be reparsed
        const watcher = vscode.workspace.createFileSystemWatcher('**/*.{journal,hledger,ledger}');
        const onFsChange = (): void => {
            try {
                // Reset data without clearing cache - SimpleProjectCache.get() validates mtimeMs automatically
                // This provides ~50x speedup for large projects by avoiding full workspace reparsing
                services.config.resetData();
            } catch (err) {
                console.error('HLedger: data reset failed after FS change', err);
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
        context.subscriptions.push(
            vscode.commands.registerCommand('hledger.cli.balance', async () => {
                await services.cliCommands.insertBalance();
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('hledger.cli.stats', async () => {
                await services.cliCommands.insertStats();
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('hledger.cli.incomestatement', async () => {
                await services.cliCommands.insertIncomestatement();
            })
        );


        // Extension activation complete

    } catch (error) {
        console.error('HLedger extension activation failed:', error);
    }
}

export function deactivate(): void {
    // Cleanup happens automatically through context.subscriptions
}

// Public API exports
export { HLedgerConfig } from './HLedgerConfig';
export { HLedgerParser } from './HLedgerParser';
export { SimpleProjectCache as WorkspaceCache } from './SimpleProjectCache';
export { SimpleFuzzyMatcher, FuzzyMatch } from './SimpleFuzzyMatcher';

/**
 * Helper function for fuzzy matching that wraps SimpleFuzzyMatcher.
 * Used by tests and external consumers for simple prefix-based matching.
 *
 * @template T - String type to match against
 * @param query - Search query string
 * @param items - Array of items to search through
 * @returns Array of FuzzyMatch results sorted by relevance
 */
export function fuzzyMatch<T extends string>(query: string, items: readonly T[]): Array<{ item: T; score: number }> {
    const matcher = new SimpleFuzzyMatcher();
    return matcher.match(query, items);
}