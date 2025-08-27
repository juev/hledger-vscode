// TagCompleter.ts - Dual-phase tag completion system
// Enhanced to support both tag name completion and tag value completion
// ~150 lines to support advanced functionality

import * as vscode from 'vscode';
import { HLedgerConfig } from '../HLedgerConfig';
import { CompletionContext, TagName, TagValue, UsageCount, createTagName, createTagValue } from '../types';
import { SimpleFuzzyMatcher, FuzzyMatch } from '../SimpleFuzzyMatcher';

/**
 * Enhanced TagCompleter supporting dual-phase completion:
 * 1. Tag name completion (e.g., "category:")
 * 2. Tag value completion after tag name (e.g., "category:work")
 */
export class TagCompleter {
    private fuzzyMatcher: SimpleFuzzyMatcher;
    
    // Unicode-aware regex for extracting tag names from context
    private static readonly TAG_NAME_PATTERN = /([\p{L}\p{N}_-]+):\s*[\p{L}\p{N}_-]*$/u;

    constructor(private config: HLedgerConfig) {
        this.fuzzyMatcher = new SimpleFuzzyMatcher();
    }

    /**
     * Main completion method supporting dual-phase completion.
     * Determines whether to complete tag names or tag values based on context.
     */
    complete(context: CompletionContext): vscode.CompletionItem[] {
        // Extract tag name if cursor is positioned after "tagname:"
        const tagName = this.extractTagNameFromContext(context);
        
        if (tagName) {
            // Phase 2: Complete tag values for the extracted tag name
            return this.completeTagValues(context, tagName);
        } else {
            // Phase 1: Complete tag names
            return this.completeTagNames(context);
        }
    }

    /**
     * Extract tag name from completion context when cursor is positioned after "tagname:".
     * Returns null if not in tag value completion context.
     */
    private extractTagNameFromContext(context: CompletionContext): TagName | null {
        const match = TagCompleter.TAG_NAME_PATTERN.exec(context.query);
        if (!match) {
            return null;
        }
        
        const tagName = match[1];
        return createTagName(tagName);
    }

    /**
     * Complete tag names with ":" suffix (Phase 1).
     * Current behavior for backward compatibility.
     */
    private completeTagNames(context: CompletionContext): vscode.CompletionItem[] {
        const tags = this.config.getTagsByUsage();
        const matches = this.fuzzyMatcher.match(context.query, tags, {
            usageCounts: this.config.tagUsage,
            maxResults: 25
        });

        return matches.map(match => this.createTagNameCompletionItem(match));
    }

    /**
     * Complete tag values for a specific tag name (Phase 2).
     * Provides values that have been used with the specified tag.
     */
    private completeTagValues(context: CompletionContext, tagName: TagName): vscode.CompletionItem[] {
        const tagValues = this.config.getTagValuesByUsageFor(tagName);
        
        if (tagValues.length === 0) {
            return [];
        }

        // Extract the value part of the query (after "tagname:")
        const valueQuery = context.query.replace(TagCompleter.TAG_NAME_PATTERN, '');
        
        const matches = this.fuzzyMatcher.match(valueQuery, tagValues, {
            usageCounts: this.getTagValueUsageMap(tagName) as ReadonlyMap<string, UsageCount>,
            maxResults: 20
        });

        return matches.map(match => this.createTagValueCompletionItem(match, tagName));
    }

    /**
     * Create completion item for tag name with ":" suffix.
     * Includes command to trigger suggestions for tag values after insertion if values exist.
     */
    private createTagNameCompletionItem(match: FuzzyMatch): vscode.CompletionItem {
        const tagName = match.item as TagName;
        const item = new vscode.CompletionItem(tagName, vscode.CompletionItemKind.Property);
        item.detail = 'Tag';
        item.sortText = this.getSortText(match);
        item.insertText = `${tagName}:`;
        
        // Add command to trigger suggestion for tag values only if values exist for this tag
        const tagValues = this.config.getTagValuesByUsageFor(tagName);
        if (tagValues.length > 0) {
            item.command = {
                command: 'editor.action.triggerSuggest',
                title: 'Trigger tag value suggestions'
            };
        }
        
        const usageCount = this.config.tagUsage.get(tagName) || 0;
        if (usageCount > 1) {
            item.documentation = new vscode.MarkdownString(`Tag used ${usageCount} times`);
        }

        return item;
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
     * Generate sort text for fuzzy match results.
     * Higher scores appear first, then alphabetical order.
     */
    private getSortText(match: FuzzyMatch): string {
        const scoreStr = (1000 - match.score).toString().padStart(4, '0');
        return `${scoreStr}_${match.item}`;
    }
}