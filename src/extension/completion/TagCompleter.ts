// TagCompleter.ts - Tag value completion system
// Specialized for tag value completion after tag names
// ~100 lines focused on tag value functionality

import * as vscode from 'vscode';
import { HLedgerConfig } from '../HLedgerConfig';
import { CompletionContext, TagName, TagValue, UsageCount, createTagName, createTagValue } from '../types';
import { SimpleFuzzyMatcher, FuzzyMatch } from '../SimpleFuzzyMatcher';

/**
 * Specialized TagCompleter for both tag name and tag value completion.
 * Handles two completion modes:
 * 1. Tag name completion (type: 'tag') - suggests "category", "project", etc.
 * 2. Tag value completion (type: 'tag_value') - suggests values after "category:"
 */
export class TagCompleter {
    private fuzzyMatcher: SimpleFuzzyMatcher;
    
    // Unicode-aware regex for extracting tag names from context
    private static readonly TAG_NAME_PATTERN = /([\p{L}\p{N}_-]+):\s*[\p{L}\p{N}_-]*$/u;

    constructor(private config: HLedgerConfig) {
        this.fuzzyMatcher = new SimpleFuzzyMatcher();
    }

    /**
     * Main completion method for both tag names and tag values.
     * Routes to appropriate completion method based on context type.
     */
    complete(context: CompletionContext): vscode.CompletionItem[] {
        if (context.type === 'tag') {
            // Complete tag names
            const items = this.completeTagNames(context);
            return items;
        } else if (context.type === 'tag_value') {
            // Extract tag name if cursor is positioned after "tagname:"
            const tagName = this.extractTagNameFromContext(context);
            
            if (tagName) {
                // Complete tag values for the extracted tag name
                const items = this.completeTagValues(context, tagName);
                return items;
            }
        }
        
        // If no valid context or tag name found, return empty array
        return [];
    }

    /**
     * Extract tag name from completion context when cursor is positioned after "tagname:".
     * Returns null if not in tag value completion context.
     */
    private extractTagNameFromContext(context: CompletionContext): TagName | null {
        const match = TagCompleter.TAG_NAME_PATTERN.exec(context.query);
        if (!match || !match[1]) {
            return null;
        }
        
        const tagName = match[1];
        return createTagName(tagName);
    }


    /**
     * Complete tag values for a specific tag name (Phase 2).
     * Provides values that have been used with the specified tag.
     */
    private completeTagValues(context: CompletionContext, tagName: TagName): vscode.CompletionItem[] {
        // ESSENTIAL FIX: Refresh config for current document before getting tag values
        // This ensures TagCompleter gets fresh data instead of stale cached data
        if (context.document) {
            // Get VS Code TextDocument through workspace
            const vsDocument = vscode.workspace.textDocuments.find(doc => doc.uri.path === context.document!.uri);
            if (vsDocument) {
                this.config.getConfigForDocument(vsDocument);
            }
        }
        
        const tagValues = this.config.getTagValuesByUsageFor(tagName);
        
        if (tagValues.length === 0) {
            return [];
        }

        // Extract the value part of the query (after "tagname:")
        // Query format: "; tag:" or "; tag:partial_value"
        // We need to extract everything after the tag name and colon
        const tagStart = context.query.indexOf(`${tagName}:`);
        const valueStart = tagStart + tagName.length + 1; // +1 for the colon
        const valueQuery = context.query.substring(valueStart).trim();
        
        const matches = this.fuzzyMatcher.match(valueQuery, tagValues, {
            usageCounts: this.getTagValueUsageMap(tagName) as ReadonlyMap<string, UsageCount>,
            maxResults: 20
        });
        
        const items = matches.map(match => this.createTagValueCompletionItem(match, tagName));
        
        return items;
    }


    /**
     * Create completion item for tag value.
     */
    private createTagValueCompletionItem(match: FuzzyMatch, tagName: TagName): vscode.CompletionItem {
        const tagValue = match.item as TagValue;
        const item = new vscode.CompletionItem(tagValue, vscode.CompletionItemKind.EnumMember);
        item.detail = `Value for ${tagName}`;
        item.sortText = this.getSortText(match);
        item.insertText = tagValue;
        
        const pairKey = `${tagName}:${tagValue}`;
        const usageCount = this.config.tagValueUsage.get(pairKey) || 0;
        if (usageCount > 1) {
            item.documentation = new vscode.MarkdownString(
                `Tag value \`${tagName}:${tagValue}\` used ${usageCount} times`
            );
        }

        return item;
    }

    /**
     * Get usage map for tag values of a specific tag name.
     * Converts the global tagValueUsage map to a tag-specific map.
     */
    private getTagValueUsageMap(tagName: TagName): Map<string, UsageCount> {
        const usageMap = new Map<string, UsageCount>();
        const globalUsage = this.config.tagValueUsage;
        
        globalUsage.forEach((count, key) => {
            if (key.startsWith(`${tagName}:`)) {
                const value = key.substring(tagName.length + 1);
                usageMap.set(value, count);
            }
        });
        
        return usageMap;
    }

    /**
     * Complete tag names (Phase 1).
     * Provides tag names like "category", "project", "type".
     */
    private completeTagNames(context: CompletionContext): vscode.CompletionItem[] {
        const tagNames = this.config.getTagsByUsage();
        
        if (tagNames.length === 0) {
            return [];
        }

        const matches = this.fuzzyMatcher.match(context.query, tagNames, {
            usageCounts: this.config.tagUsage as ReadonlyMap<string, UsageCount>,
            maxResults: 20
        });

        return matches.map(match => this.createTagNameCompletionItem(match));
    }

    /**
     * Create completion item for tag name.
     * Adds colon and trigger for tag value completion if values exist.
     */
    private createTagNameCompletionItem(match: FuzzyMatch): vscode.CompletionItem {
        const tagName = match.item as TagName;
        const item = new vscode.CompletionItem(tagName, vscode.CompletionItemKind.Property);
        item.detail = `Tag name`;
        item.sortText = this.getSortText(match);
        item.insertText = `${tagName}:`;
        
        const usageCount = this.config.tagUsage.get(tagName) || 0;
        if (usageCount > 1) {
            item.documentation = new vscode.MarkdownString(
                `Tag \`${tagName}\` used ${usageCount} times`
            );
        }

        // Check if this tag has values - if so, trigger value completion after insertion
        const tagValues = this.config.getTagValuesByUsageFor(tagName);
        if (tagValues.length > 0) {
            // Add command to trigger suggestions after the colon is inserted
            item.command = {
                command: 'editor.action.triggerSuggest',
                title: 'Trigger tag value suggestions'
            };
        }

        return item;
    }

    /**
     * Generate sort text for fuzzy match results.
     * Higher scores appear first, then alphabetical order.
     */
    private getSortText(match: FuzzyMatch): string {
        const scoreStr = (1000 - match.score).toString().padStart(4, '0');
        return `${scoreStr}_${match.item}`;
    }
}