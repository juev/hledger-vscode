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

        // FS watcher for journal files: invalidate cache on change
        const watcher = vscode.workspace.createFileSystemWatcher('**/*.{journal,hledger,ledger}');
        const onFsChange = () => {
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

    if (!cliService) {
        cliService = new HLedgerCliService();
    }

    if (!cliCommands) {
        cliCommands = new HLedgerCliCommands(cliService);
    }

    if (!errorNotificationHandler) {
        errorNotificationHandler = new ErrorNotificationHandler();
    }
}

/**
 * Cleanup function to dispose global instances
 * Should be called during extension deactivation
 */
export function disposeGlobalInstances(): void {
    try {
        if (globalConfig) {
            globalConfig.clearCache();
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

    get(key: string): ParsedHLedgerData | null {
        return this.cache.get(createCacheKey(key));
    }

    set(key: string, value: ParsedHLedgerData): void {
        return this.cache.set(createCacheKey(key), value);
    }

    clear(): void {
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

    getConfig(): null {
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

    get(key: string): ParsedHLedgerData | null {
        return this.cache.get(createCacheKey(key));
    }

    set(key: string, value: ParsedHLedgerData): void {
        return this.cache.set(createCacheKey(key), value);
    }

    clear(): void {
        return this.cache.clear();
    }

    getConfig(projectPath: string): ParsedHLedgerData | null {
        return this.cache.get(createCacheKey(projectPath));
    }

    initializeProject(projectPath: string): ParsedHLedgerData | null {
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