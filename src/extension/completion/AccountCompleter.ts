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
    /**
     * Threshold for filtering low-usage exact matches from completions.
     * Usage count of 1-2 likely indicates incomplete typing that was saved,
     * while count > 2 indicates an established account name.
     */
    private static readonly LOW_USAGE_THRESHOLD = 2;

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

        // Filter out the query itself if it appears as a low-usage match
        // This prevents incomplete typed text from appearing in completions
        // (e.g., typing "прод" and canceling should not show "прод" as account)
        const filteredMatches = matches.filter(match => {
            const isExactQueryMatch = match.item.toLowerCase() === context.query.toLowerCase();
            const usageCount = this.config.accountUsage.get(match.item as AccountName) ?? 0;
            const isLowUsage = usageCount <= AccountCompleter.LOW_USAGE_THRESHOLD;
            // Exclude if it's an exact match with low usage
            return !(isExactQueryMatch && isLowUsage);
        });

        return filteredMatches.map((match, index) => this.createCompletionItem(match, context, index));
    }

    private createCompletionItem(match: FuzzyMatch<AccountName>, context: CompletionContext, index: number): vscode.CompletionItem {
        const fullAccountName = match.item;

        // Create completion item with explicit control over display
        const item = new vscode.CompletionItem(
            fullAccountName,  // Use full account name as the label
            vscode.CompletionItemKind.Class
        );

        item.detail = 'Account';

        // Use index-based sortText to guarantee our ordering
        // VS Code sorts by sortText first, then by label
        item.sortText = this.getSortText(match, index);

        // filterText controls VS Code's fuzzy matching
        // Use the same filterText (query) for all items so VS Code gives equal fuzzy scores
        // This forces VS Code to fall back to sortText ordering (the "gopls hack")
        item.filterText = context.query || '';

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

    private getSortText(match: FuzzyMatch<AccountName>, index: number): string {
        // Use index as primary sort key to guarantee our ordering
        // VS Code respects sortText ordering when items have same prefix
        // Format: "00001_score_name" ensures lexicographic ordering matches our ranking
        const indexStr = index.toString().padStart(5, '0');
        // Cap score to prevent negative values with high usage counts (usageCount * 20 can exceed 10000)
        const cappedScore = Math.min(Math.round(match.score), 9999);
        const scoreStr = (10000 - cappedScore).toString().padStart(5, '0');
        return `${indexStr}_${scoreStr}_${match.item}`;
    }
}