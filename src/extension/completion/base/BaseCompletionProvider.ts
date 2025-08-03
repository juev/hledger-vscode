import * as vscode from 'vscode';
import { FuzzyMatcher, FuzzyMatch } from './FuzzyMatcher';
import { CompletionItemFactory, CompletionContext, CompletionItemOptions } from './CompletionItemFactory';

export interface CompletionLimits {
    maxResults: number;
    maxAccountResults?: number;
}

export interface CompletionData {
    items: string[];
    query: string;
    usageCounts?: Map<string, number>;
    itemDetails?: Map<string, string>;
}

/**
 * Base class for all completion providers with common functionality
 */
export abstract class BaseCompletionProvider implements vscode.CompletionItemProvider {
    protected fuzzyMatcher: FuzzyMatcher;
    protected itemFactory: CompletionItemFactory;
    
    constructor() {
        this.fuzzyMatcher = new FuzzyMatcher();
        this.itemFactory = new CompletionItemFactory();
    }
    
    /**
     * VSCode completion provider method
     */
    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        completionContext: vscode.CompletionContext
    ): vscode.ProviderResult<vscode.CompletionItem[]> {
        // Check if provider should activate at this position
        if (!this.shouldProvideCompletions(document, position)) {
            return undefined;
        }
        
        // Get completion data specific to this provider
        const completionData = this.getCompletionData(document, position);
        if (!completionData || completionData.items.length === 0) {
            return undefined;
        }
        
        // Perform fuzzy matching
        const matches = this.fuzzyMatcher.match(
            completionData.query,
            completionData.items,
            { usageCounts: completionData.usageCounts }
        );
        
        if (matches.length === 0) {
            return undefined;
        }
        
        // Apply limits
        const limits = this.getCompletionLimits();
        const limitedMatches = this.applyLimits(matches, limits);
        
        // Create completion items
        const itemContext: CompletionContext = {
            position,
            typedText: completionData.query,
            linePrefix: document.lineAt(position).text.substring(0, position.character)
        };
        
        const options = this.getCompletionItemOptions(completionData);
        
        return this.itemFactory.createFromMatches(limitedMatches, options, itemContext);
    }
    
    /**
     * Determines if this provider should provide completions at the given position
     */
    protected abstract shouldProvideCompletions(
        document: vscode.TextDocument,
        position: vscode.Position
    ): boolean;
    
    /**
     * Gets the completion data for the current context
     */
    protected abstract getCompletionData(
        document: vscode.TextDocument,
        position: vscode.Position
    ): CompletionData | null;
    
    /**
     * Gets the completion item options for this provider
     */
    protected abstract getCompletionItemOptions(data: CompletionData): CompletionItemOptions;
    
    /**
     * Gets the completion limits from configuration
     */
    protected getCompletionLimits(): CompletionLimits {
        const config = vscode.workspace.getConfiguration('hledger.autoCompletion');
        return {
            maxResults: config.get<number>('maxResults', 25),
            maxAccountResults: config.get<number>('maxAccountResults', 30)
        };
    }
    
    /**
     * Applies completion limits based on provider type
     */
    protected applyLimits(matches: FuzzyMatch[], limits: CompletionLimits): FuzzyMatch[] {
        return matches.slice(0, limits.maxResults);
    }
    
    /**
     * Extracts the typed text from the line
     */
    protected extractTypedText(linePrefix: string, pattern: RegExp): string {
        const match = linePrefix.match(pattern);
        return match ? match[1] || '' : '';
    }
}