// TagCompleter.ts - Simple tag completion logic
// ~50 lines according to REFACTORING.md FASE G

import * as vscode from 'vscode';
import { HLedgerConfig } from '../HLedgerConfig';
import { CompletionContext, TagName } from '../types';
import { SimpleFuzzyMatcher, FuzzyMatch } from '../SimpleFuzzyMatcher';

export class TagCompleter {
    private fuzzyMatcher: SimpleFuzzyMatcher;

    constructor(private config: HLedgerConfig) {
        this.fuzzyMatcher = new SimpleFuzzyMatcher();
    }

    complete(context: CompletionContext): vscode.CompletionItem[] {
        const tags = this.config.getTagsByUsage();
        const matches = this.fuzzyMatcher.match(context.query, tags, {
            usageCounts: this.config.tagUsage,
            maxResults: 25
        });

        return matches.map(match => this.createCompletionItem(match));
    }

    private createCompletionItem(match: FuzzyMatch): vscode.CompletionItem {
        const item = new vscode.CompletionItem(match.item, vscode.CompletionItemKind.Property);
        item.detail = 'Tag';
        item.sortText = this.getSortText(match);
        item.insertText = `${match.item}:`;
        
        const usageCount = this.config.tagUsage.get(match.item as TagName) || 0;
        if (usageCount > 1) {
            item.documentation = new vscode.MarkdownString(`Used ${usageCount} times`);
        }

        return item;
    }

    private getSortText(match: FuzzyMatch): string {
        const scoreStr = (1000 - match.score).toString().padStart(4, '0');
        return `${scoreStr}_${match.item}`;
    }
}