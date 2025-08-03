import * as vscode from 'vscode';
import { BaseCompletionProvider, CompletionData } from '../base/BaseCompletionProvider';
import { CompletionItemOptions } from '../base/CompletionItemFactory';
import { getConfig } from '../../main';

/**
 * Provides completion for tags in comment lines (after semicolon)
 */
export class TagCompletionProvider extends BaseCompletionProvider {
    protected shouldProvideCompletions(
        document: vscode.TextDocument,
        position: vscode.Position
    ): boolean {
        const linePrefix = document.lineAt(position).text.substring(0, position.character);
        
        // Trigger in comments (after semicolon) when typing tag: or #
        return linePrefix.match(/;\s*.*([a-zA-Z\u0400-\u04FF][a-zA-Z\u0400-\u04FF0-9_]*)?:?$/) !== null || 
               linePrefix.match(/;\s*.*#([a-zA-Z\u0400-\u04FF][a-zA-Z\u0400-\u04FF0-9_]*)?$/) !== null;
    }
    
    protected getCompletionData(
        document: vscode.TextDocument,
        position: vscode.Position
    ): CompletionData | null {
        const linePrefix = document.lineAt(position).text.substring(0, position.character);
        const config = getConfig(document);
        const tagsByUsage = config.getTagsByUsage();
        
        if (tagsByUsage.length === 0) {
            return null;
        }
        
        // Look for tag:value format or #tag format
        const tagMatch = linePrefix.match(/([a-zA-Z\u0400-\u04FF][a-zA-Z\u0400-\u04FF0-9_]*)(:?)$/);
        const typedText = tagMatch ? tagMatch[1] : '';
        
        // Convert to string array for fuzzy matcher
        const items = tagsByUsage.map(t => t.tag);
        
        // Create usage counts map
        const usageCounts = new Map<string, number>();
        tagsByUsage.forEach(t => {
            usageCounts.set(t.tag, t.count);
        });
        
        return {
            items,
            query: typedText,
            usageCounts
        };
    }
    
    protected getCompletionItemOptions(data: CompletionData): CompletionItemOptions {
        return {
            kind: vscode.CompletionItemKind.Keyword,
            detail: 'Tag/Category',
            insertText: '' // Will be customized in provideCompletionItems
        };
    }
    
    /**
     * Override to customize completion items with tag-specific metadata
     */
    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext
    ): vscode.ProviderResult<vscode.CompletionItem[]> {
        const items = super.provideCompletionItems(document, position, token, context);
        
        if (!items || !Array.isArray(items)) {
            return items;
        }
        
        // Customize each item
        return items.map(item => {
            const config = getConfig(document);
            const tagsByUsage = config.getTagsByUsage();
            const tagInfo = tagsByUsage.find(t => t.tag === item.label);
            
            if (tagInfo && tagInfo.count > 0) {
                item.detail = `Tag/Category (used ${tagInfo.count} times)`;
            }
            
            // Set insert text for tag:value format
            item.insertText = item.label.toString() + ':';
            
            return item;
        });
    }
}