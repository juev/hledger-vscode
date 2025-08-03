import * as vscode from 'vscode';
import { FuzzyMatch } from './FuzzyMatcher';

export interface CompletionItemOptions {
    kind: vscode.CompletionItemKind;
    detail?: string;
    documentation?: string;
    insertText?: string;
    filterText?: string;
    preselect?: boolean;
    command?: vscode.Command;
    additionalTextEdits?: vscode.TextEdit[];
}

export interface CompletionContext {
    position: vscode.Position;
    typedText: string;
    linePrefix?: string;
}

/**
 * Factory for creating standardized completion items across all providers
 */
export class CompletionItemFactory {
    /**
     * Creates completion items from fuzzy matches
     * @param matches - Array of fuzzy matches
     * @param options - Base options for all items
     * @param context - Completion context
     * @returns Array of VSCode completion items
     */
    createFromMatches(
        matches: FuzzyMatch[],
        options: CompletionItemOptions,
        context: CompletionContext
    ): vscode.CompletionItem[] {
        return matches.map((match, index) => 
            this.createItem(match.item, index, options, context)
        );
    }
    
    /**
     * Creates a single completion item
     */
    createItem(
        label: string,
        sortIndex: number,
        options: CompletionItemOptions,
        context: CompletionContext
    ): vscode.CompletionItem {
        const item = new vscode.CompletionItem(label, options.kind);
        
        // Set detail and documentation
        if (options.detail) {
            item.detail = options.detail;
        }
        
        if (options.documentation) {
            item.documentation = options.documentation;
        }
        
        // Set text insertions
        item.insertText = options.insertText || label;
        item.filterText = options.filterText || label;
        
        // Use zero-based sort order to maintain fuzzy match ranking
        const sortOrder = sortIndex.toString().padStart(3, '0');
        item.sortText = sortOrder + '_' + label;
        
        // Set preselect for top items
        if (options.preselect && sortIndex < 2) {
            item.preselect = true;
        }
        
        // Set range if we have typed text to replace
        if (context.typedText) {
            item.range = new vscode.Range(
                context.position.line,
                context.position.character - context.typedText.length,
                context.position.line,
                context.position.character
            );
        }
        
        // Add command if specified
        if (options.command) {
            item.command = options.command;
        }
        
        // Add additional text edits if specified
        if (options.additionalTextEdits) {
            item.additionalTextEdits = options.additionalTextEdits;
        }
        
        return item;
    }
    
    /**
     * Creates completion items for items with usage counts
     */
    createFromUsageData<T extends { count: number }>(
        items: T[],
        labelExtractor: (item: T) => string,
        options: CompletionItemOptions,
        context: CompletionContext,
        detailFormatter?: (item: T) => string
    ): vscode.CompletionItem[] {
        return items.map((item, index) => {
            const label = labelExtractor(item);
            const itemOptions = { ...options };
            
            if (detailFormatter) {
                itemOptions.detail = detailFormatter(item);
            } else if (item.count > 0) {
                itemOptions.detail = `${options.detail || ''} (used ${item.count} times)`.trim();
            }
            
            return this.createItem(label, index, itemOptions, context);
        });
    }
}