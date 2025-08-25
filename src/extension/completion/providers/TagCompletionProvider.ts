import * as vscode from 'vscode';
import { BaseCompletionProvider, CompletionData } from '../base/BaseCompletionProvider';
import { CompletionItemOptions } from '../base/CompletionItemFactory';
import { getConfig } from '../../main';
import { TagEntry, unbranded } from '../../types';

interface TagInfo {
    tag: TagEntry;
    detail: string;
    usageCount: number;
}

interface TagValueInfo {
    value: string;
    detail: string;
    usageCount: number;
}

/**
 * Provides completion for tags and their values in comment lines (after semicolon)
 * Supports both tag name completion and tag value completion based on context
 */
export class TagCompletionProvider extends BaseCompletionProvider {
    // Temporary storage for completion info during completion
    private tagInfoMap?: Map<string, TagInfo>;
    private tagValueInfoMap?: Map<string, TagValueInfo>;
    
    protected shouldProvideCompletions(
        document: vscode.TextDocument,
        position: vscode.Position
    ): boolean {
        const linePrefix = document.lineAt(position).text.substring(0, position.character);
        
        // Trigger in comments (after semicolon) in these cases:
        // 1. When typing tag name: ; Event or ; Subscription
        // 2. When typing tag value after colon: ; Event: or ; Subscription:
        return linePrefix.match(/;\s*.*([a-zA-Z\u0400-\u04FF][a-zA-Z\u0400-\u04FF0-9_]*)?:?.*$/) !== null;
    }
    
    protected getCompletionData(
        document: vscode.TextDocument,
        position: vscode.Position
    ): CompletionData | null {
        const linePrefix = document.lineAt(position).text.substring(0, position.character);
        const config = getConfig(document);
        
        // Check if we're completing a tag value (after colon, with optional spaces, anywhere in comment)
        // Find the comment section first, then look for the last tag
        const commentMatch = linePrefix.match(/;\s*(.*)$/);
        if (commentMatch) {
            const commentText = commentMatch[1];
            // Find all tag patterns in the comment
            const tagMatches = [...commentText.matchAll(/([a-zA-Z\u0400-\u04FF][a-zA-Z\u0400-\u04FF0-9_]*)\s*:\s*/g)];
            
            if (tagMatches.length > 0) {
                // Get the last tag match
                const lastTagMatch = tagMatches[tagMatches.length - 1];
                const tagName = lastTagMatch[1];
                const tagEndIndex = lastTagMatch.index! + lastTagMatch[0].length;
                const typedValue = commentText.substring(tagEndIndex);
                const tagValuesByUsage = config.getTagValuesByUsage(tagName);
                
                if (tagValuesByUsage.length === 0) {
                    return null;
                }
                
                // Build tag value info list with metadata
                const tagValueInfoList: TagValueInfo[] = tagValuesByUsage.map(({value, count}) => ({
                    value,
                    detail: count > 0 ? `${tagName} value (used ${count} times)` : `${tagName} value`,
                    usageCount: count
                }));
                
                // Create usage counts map for fuzzy matcher
                const usageCounts = new Map<string, number>();
                tagValueInfoList.forEach(info => {
                    usageCounts.set(info.value, info.usageCount);
                });
                
                // Store tag value info in a map for later lookup
                this.tagValueInfoMap = new Map<string, TagValueInfo>();
                tagValueInfoList.forEach(info => {
                    this.tagValueInfoMap!.set(info.value, info);
                });
                
                return {
                    items: tagValueInfoList.map(info => info.value),
                    query: typedValue,
                    usageCounts
                };
            }
        }
        
        // If we get here, we're completing a tag name (not a value)
        const commentMatch2 = linePrefix.match(/;\s*(.*)$/);
        if (commentMatch2) {
            // Completing tag name
            const tagsByUsage = config.getTagsByUsage();
            
            if (tagsByUsage.length === 0) {
                return null;
            }
            
            // Look for tag name being typed anywhere in the comment
            // This handles cases like "; comment comment Event" or "; Event" 
            const tagMatch = linePrefix.match(/;\s*.*?([a-zA-Z\u0400-\u04FF][a-zA-Z\u0400-\u04FF0-9_]*)$/);
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
                usageCounts.set(unbranded(info.tag), info.usageCount);
            });
            
            // Store tag info in a map for later lookup
            this.tagInfoMap = new Map<string, TagInfo>();
            tagInfoList.forEach(info => {
                this.tagInfoMap!.set(unbranded(info.tag), info);
            });
            
            return {
                items: tagInfoList.map(info => unbranded(info.tag)),
                query: typedText,
                usageCounts
            };
        }
        
        // No completion data available
        return null;
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
        
        const linePrefix = document.lineAt(position).text.substring(0, position.character);
        // Check if we're completing a tag value by looking for the last tag pattern
        const commentMatch = linePrefix.match(/;\s*(.*)$/);
        let isCompletingValue = false;
        if (commentMatch) {
            const commentText = commentMatch[1];
            const tagMatches = [...commentText.matchAll(/([a-zA-Z\u0400-\u04FF][a-zA-Z\u0400-\u04FF0-9_]*)\s*:\s*/g)];
            isCompletingValue = tagMatches.length > 0;
        }
        
        // Customize each item based on what we're completing
        return items.map(item => {
            if (isCompletingValue) {
                // Completing tag value
                const tagValueInfo = this.tagValueInfoMap?.get(item.label.toString());
                if (tagValueInfo) {
                    item.detail = tagValueInfo.detail;
                    item.kind = vscode.CompletionItemKind.Value;
                }
                // Insert text is just the value
                item.insertText = item.label.toString();
            } else {
                // Completing tag name
                const tagInfo = this.tagInfoMap?.get(item.label.toString());
                if (tagInfo) {
                    item.detail = tagInfo.detail;
                    item.kind = vscode.CompletionItemKind.Keyword;
                }
                // Set insert text for tag:value format (with colon and space for better UX)
                item.insertText = item.label.toString() + ': ';
            }
            
            return item;
        });
    }
    
    /**
     * Invalidates cached tag information
     */
    public invalidateCache(): void {
        this.tagInfoMap = undefined;
        this.tagValueInfoMap = undefined;
    }
}