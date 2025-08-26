// main.ts - Simplified entry point for hledger extension
// ~100 lines according to REFACTORING.md FASE G

import * as vscode from 'vscode';
import { HLedgerParser, ParsedHLedgerData } from './HLedgerParser';
import { HLedgerConfig } from './HLedgerConfig';
import { SimpleProjectCache } from './SimpleProjectCache';
import { HLedgerCompletionProvider } from './HLedgerCompletionProvider';
import { HLedgerEnterCommand } from './HLedgerEnterCommand';
import { registerColorConfiguration } from './ColorConfiguration';
import { SimpleFuzzyMatcher } from './SimpleFuzzyMatcher';
import { createCacheKey, CacheValue } from './types';

// Global instances for simplified architecture
let globalConfig: HLedgerConfig;

// Main activation function
export function activate(context: vscode.ExtensionContext): void {
    try {
        // Initialize global config with simple architecture
        const parser = new HLedgerParser();
        const cache = new SimpleProjectCache();
        globalConfig = new HLedgerConfig(parser, cache);
        
        // Register unified completion provider for all types
        const completionProvider = new HLedgerCompletionProvider(globalConfig);
        context.subscriptions.push(
            vscode.languages.registerCompletionItemProvider(
                'hledger', completionProvider, ':', ' ', '@', '#', ';'
            )
        );
        
        // Register Enter key handler for smart indentation
        const enterCommand = new HLedgerEnterCommand();
        context.subscriptions.push(enterCommand);
        
        // Register color configuration commands
        registerColorConfiguration(context);
        
        console.log('HLedger extension activated with simplified architecture (FASE G)');
        
    } catch (error) {
        console.error('HLedger extension activation failed:', error);
    }
}

export function deactivate(): void {
    try {
        if (globalConfig) {
            globalConfig.clearCache();
        }
        console.log('HLedger extension deactivated');
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
        const path = require('path');
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