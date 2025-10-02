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

// Global instances for simplified architecture
let globalConfig: HLedgerConfig;

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

  
        // Register formatting providers for hledger files
        registerFormattingProviders(context);

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