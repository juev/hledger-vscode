import * as vscode from 'vscode';
import { BaseCompletionProvider, CompletionData } from '../base/BaseCompletionProvider';
import { CompletionItemOptions } from '../base/CompletionItemFactory';
import { getConfig } from '../../main';

interface TagInfo {
    tag: string;
    detail: string;
    usageCount: number;
}

/**
 * Provides completion for tags in comment lines (after semicolon)
 */
export class TagCompletionProvider extends BaseCompletionProvider {
    // Temporary storage for tag info during completion
    private tagInfoMap?: Map<string, TagInfo>;
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
        
        // Build tag info list with metadata
        const tagInfoList: TagInfo[] = tagsByUsage.map(({tag, count}) => ({
            tag,
            detail: count > 0 ? `Tag/Category (used ${count} times)` : 'Tag/Category',
            usageCount: count
        }));
        
        // Create usage counts map for fuzzy matcher
        const usageCounts = new Map<string, number>();
        tagInfoList.forEach(info => {
            usageCounts.set(info.tag, info.usageCount);
        });
        
        // Store tag info in a map for later lookup
        this.tagInfoMap = new Map<string, TagInfo>();
        tagInfoList.forEach(info => {
            this.tagInfoMap!.set(info.tag, info);
        });
        
        return {
            items: tagInfoList.map(info => info.tag),
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
        
        // Customize each item with tag-specific metadata
        return items.map(item => {
            const tagInfo = this.tagInfoMap?.get(item.label.toString());
            if (tagInfo) {
                item.detail = tagInfo.detail;
            }
            
            // Set insert text for tag:value format
            item.insertText = item.label.toString() + ':';
            
            return item;
        });
    }
    
    /**
     * Invalidates cached tag information
     */
    public invalidateCache(): void {
        this.tagInfoMap = undefined;
    }
}