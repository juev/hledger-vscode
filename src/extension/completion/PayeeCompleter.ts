// PayeeCompleter.ts - Simple payee completion logic
// ~50 lines according to REFACTORING.md FASE G

import * as vscode from 'vscode';
import { HLedgerConfig } from '../HLedgerConfig';
import { CompletionContext, PayeeName } from '../types';
import { SimpleFuzzyMatcher, FuzzyMatch } from '../SimpleFuzzyMatcher';

export class PayeeCompleter {
    private fuzzyMatcher: SimpleFuzzyMatcher;

    constructor(private config: HLedgerConfig) {
        this.fuzzyMatcher = new SimpleFuzzyMatcher();
    }

    complete(context: CompletionContext): vscode.CompletionItem[] {
        const payees = this.config.getPayeesByUsage();
        const matches = this.fuzzyMatcher.match(context.query, payees, {
            usageCounts: this.config.payeeUsage,
            maxResults: 30
        });

        return matches.map(match => this.createCompletionItem(match));
    }

    private createCompletionItem(match: FuzzyMatch): vscode.CompletionItem {
        const item = new vscode.CompletionItem(match.item, vscode.CompletionItemKind.Text);
        item.detail = 'Payee';
        item.sortText = this.getSortText(match);
        
        const usageCount = this.config.payeeUsage.get(match.item as PayeeName) || 0;
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