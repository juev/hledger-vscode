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
      maxResults: 30,
      caseSensitive: context.isCaseSensitive ?? false,
    });

    return matches.map((match) => this.createCompletionItem(match, context));
  }

  private createCompletionItem(
    match: FuzzyMatch,
    context: CompletionContext
  ): vscode.CompletionItem {
    const item = new vscode.CompletionItem(match.item, vscode.CompletionItemKind.Text);
    item.detail = 'Payee';
    item.sortText = this.getSortText(match);

    // Set replacement range if available
    if (context.range && context.position) {
      item.range = new vscode.Range(
        new vscode.Position(context.range.start.line, context.range.start.character),
        new vscode.Position(context.range.end.line, context.range.end.character)
      );
    }

    const usageCount = this.config.payeeUsage.get(match.item as PayeeName) || 0;
    if (usageCount > 1) {
      item.documentation = new vscode.MarkdownString(`Used ${usageCount} times`);
    }

    return item;
  }

  private getSortText(match: FuzzyMatch): string {
    // Cap score to prevent negative values with high usage counts (usageCount * 20 can exceed 1000)
    const cappedScore = Math.min(Math.round(match.score), 999);
    const scoreStr = (1000 - cappedScore).toString().padStart(4, '0');
    return `${scoreStr}_${match.item}`;
  }
}
