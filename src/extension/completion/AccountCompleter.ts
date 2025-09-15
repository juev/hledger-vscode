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
            prefixMatchBonus: 100,
            caseSensitive: context.isCaseSensitive ?? false
        });

        return matches.map(match => this.createCompletionItem(match, context));
    }

    private createCompletionItem(match: FuzzyMatch<AccountName>, context: CompletionContext): vscode.CompletionItem {
        const fullAccountName = match.item;
        
        // Create completion item with explicit control over display
        const item = new vscode.CompletionItem(
            fullAccountName,  // Use full account name as the label
            vscode.CompletionItemKind.Class
        );
        
        item.detail = 'Account';
        item.sortText = this.getSortText(match);
        
        // Explicitly set insertText to ensure full account path is inserted
        item.insertText = fullAccountName;
        
        // Set replacement range if available
        if (context.range && context.position) {
            item.range = new vscode.Range(
                new vscode.Position(context.range.start.line, context.range.start.character),
                new vscode.Position(context.range.end.line, context.range.end.character)
            );
        }
        
        // Enhanced documentation with usage information
        const usageCount = this.config.accountUsage.get(fullAccountName) || 0;
        const documentation = new vscode.MarkdownString();
        
        if (fullAccountName.includes(':')) {
            const parts = fullAccountName.split(':');
            documentation.appendMarkdown(`**Account hierarchy:** ${parts.join(' → ')}
`);
        }
        
        documentation.appendMarkdown(`**Usage count:** ${usageCount}`);
        
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