// AccountCompleter.ts - Simple account completion logic
// ~70 lines according to REFACTORING.md FASE G

import * as vscode from 'vscode';
import { HLedgerConfig } from '../HLedgerConfig';
import { CompletionContext, AccountName } from '../types';
import { SimpleFuzzyMatcher, FuzzyMatch } from '../SimpleFuzzyMatcher';

/**
 * Enhanced AccountCompleter with type safety and better performance
 * Uses branded types for compile-time safety
 */
export class AccountCompleter {
    private fuzzyMatcher: SimpleFuzzyMatcher;

    constructor(private config: HLedgerConfig) {
        this.fuzzyMatcher = new SimpleFuzzyMatcher();
    }

    complete(context: CompletionContext): vscode.CompletionItem[] {
        const accounts = this.config.getAccountsByUsage();
        const matches = this.fuzzyMatcher.match(context.query, accounts, {
            usageCounts: this.config.accountUsage,
            maxResults: 50,
            exactMatchBonus: 200,
            prefixMatchBonus: 100
        });

        return matches.map(match => this.createCompletionItem(match));
    }

    private createCompletionItem(match: FuzzyMatch<AccountName>): vscode.CompletionItem {
        const item = new vscode.CompletionItem(match.item, vscode.CompletionItemKind.Class);
        item.detail = 'Account';
        item.sortText = this.getSortText(match);
        
        // Enhanced documentation with usage information
        const usageCount = this.config.accountUsage.get(match.item) || 0;
        const documentation = new vscode.MarkdownString();
        
        if (match.item.includes(':')) {
            const parts = match.item.split(':');
            documentation.appendMarkdown(`**Account hierarchy:** ${parts.join(' → ')}\n\n`);
        }
        
        documentation.appendMarkdown(`**Usage count:** ${usageCount}\n`);
        documentation.appendMarkdown(`**Match score:** ${Math.round(match.score)}`);
        
        item.documentation = documentation;

        return item;
    }

    private getSortText(match: FuzzyMatch<AccountName>): string {
        // Enhanced sorting with better score handling
        // Higher scores should come first, so we invert the score
        const scoreStr = (10000 - Math.round(match.score)).toString().padStart(5, '0');
        return `${scoreStr}_${match.item}`;
    }
}