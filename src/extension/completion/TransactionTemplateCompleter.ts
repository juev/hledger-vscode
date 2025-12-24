// TransactionTemplateCompleter.ts - Transaction template completion logic
// Provides complete transaction suggestions based on historical payee-account patterns

import * as vscode from "vscode";
import { HLedgerConfig } from "../HLedgerConfig";
import {
  CompletionContext,
  PayeeName,
  TransactionTemplate,
  TemplateKey,
} from "../types";
import { SimpleFuzzyMatcher, FuzzyMatch } from "../SimpleFuzzyMatcher";

/**
 * Maximum number of transaction templates to return in completions.
 * Prevents overwhelming the user with too many suggestions.
 */
const MAX_TEMPLATE_RESULTS = 50;

/**
 * Provides transaction template completions based on historical transactions.
 * When a payee name is entered, suggests complete transactions with
 * accounts and amounts based on past usage patterns.
 */
export class TransactionTemplateCompleter {
  private fuzzyMatcher: SimpleFuzzyMatcher;

  constructor(private config: HLedgerConfig) {
    this.fuzzyMatcher = new SimpleFuzzyMatcher();
  }

  /**
   * Generates completion items for transaction templates matching the query.
   * Uses fuzzy matching on payee names and sorts by usage count.
   */
  complete(context: CompletionContext): vscode.CompletionItem[] {
    const payees = this.config.getPayeesWithTemplates();
    if (payees.length === 0) {
      return [];
    }

    // Match payees using fuzzy matching
    const matches = this.fuzzyMatcher.match(context.query, payees, {
      maxResults: MAX_TEMPLATE_RESULTS,
    });

    // Collect all template completion items
    const items: vscode.CompletionItem[] = [];

    for (const match of matches) {
      const templates = this.config.getTemplatesForPayee(match.item);

      for (const template of templates) {
        const item = this.createCompletionItem(template, context, items.length);
        items.push(item);

        if (items.length >= MAX_TEMPLATE_RESULTS) {
          break;
        }
      }

      if (items.length >= MAX_TEMPLATE_RESULTS) {
        break;
      }
    }

    // Sort all items by recent usage (descending), fall back to total usage
    items.sort((a, b) => {
      const aRecent = (a as CompletionItemWithUsage).recentUsage ?? 0;
      const bRecent = (b as CompletionItemWithUsage).recentUsage ?? 0;
      if (aRecent !== bRecent) return bRecent - aRecent;
      const aUsage = (a as CompletionItemWithUsage).usageCount ?? 0;
      const bUsage = (b as CompletionItemWithUsage).usageCount ?? 0;
      return bUsage - aUsage;
    });

    // Re-assign sortText after sorting
    items.forEach((item, index) => {
      item.sortText = this.getSortText(
        (item as CompletionItemWithUsage).recentUsage ?? 0,
        index,
      );
    });

    return items;
  }

  /**
   * Creates a completion item for a transaction template.
   * Generates a VS Code snippet with tabstops for amounts.
   */
  private createCompletionItem(
    template: TransactionTemplate,
    context: CompletionContext,
    index: number,
  ): CompletionItemWithUsage {
    const item = new vscode.CompletionItem(
      template.payee,
      vscode.CompletionItemKind.Snippet,
    ) as CompletionItemWithUsage;

    // Get recent usage count for this template
    const templateKey = this.getTemplateKey(template);
    const recentUsage = this.config.getRecentTemplateUsage(
      template.payee,
      templateKey,
    );

    item.detail = `Transaction template (${recentUsage} recent, ${template.usageCount} total)`;

    // Build snippet with tabstops for amounts
    const snippetText = this.buildSnippet(template);
    item.insertText = new vscode.SnippetString(snippetText);

    // Use identical filterText for all items (gopls hack)
    item.filterText = context.query || "";

    // Initial sortText (will be reassigned after sorting)
    item.sortText = this.getSortText(recentUsage, index);

    // Store usage counts for sorting
    item.usageCount = template.usageCount;
    item.recentUsage = recentUsage;

    // Documentation showing template preview
    item.documentation = this.buildDocumentation(template, recentUsage);

    return item;
  }

  /**
   * Generates a template key from a template's postings.
   * Format: sorted account names joined by "|".
   */
  private getTemplateKey(template: TransactionTemplate): TemplateKey {
    return template.postings
      .map((p) => p.account)
      .sort()
      .join("|") as TemplateKey;
  }

  /**
   * Builds the snippet string for a transaction template.
   * Uses tabstops for amounts to allow easy editing.
   */
  private buildSnippet(template: TransactionTemplate): string {
    const lines: string[] = [template.payee];
    let tabstopIndex = 1;

    for (const posting of template.postings) {
      const amountPart =
        posting.amount !== null
          ? `  \${${tabstopIndex++}:${posting.amount}}`
          : "";
      lines.push(`    ${posting.account}${amountPart}`);
    }

    // Final tabstop for cursor position
    lines.push(`$0`);

    return lines.join("\n");
  }

  /**
   * Builds documentation for a transaction template.
   */
  private buildDocumentation(
    template: TransactionTemplate,
    recentUsage: number,
  ): vscode.MarkdownString {
    const doc = new vscode.MarkdownString();
    doc.appendMarkdown(`**Payee:** ${template.payee}\n\n`);
    doc.appendMarkdown(`**Accounts:**\n`);

    for (const posting of template.postings) {
      const amountStr = posting.amount ?? "(inferred)";
      doc.appendMarkdown(`- ${posting.account}: ${amountStr}\n`);
    }

    if (template.lastUsedDate) {
      doc.appendMarkdown(`\n**Last used:** ${template.lastUsedDate}`);
    }

    doc.appendMarkdown(`\n**Recent usage:** ${recentUsage} (last 50 transactions)`);
    doc.appendMarkdown(`\n**Total usage:** ${template.usageCount}`);

    return doc;
  }

  /**
   * Generates sortText for proper ordering in VS Code completions.
   * Uses index-based sorting with usage count as secondary key.
   */
  private getSortText(usageCount: number, index: number): string {
    const indexStr = index.toString().padStart(5, "0");
    // Cap score and invert for lexicographic ordering (higher usage = lower number = first)
    const cappedScore = Math.min(usageCount, 999);
    const scoreStr = (1000 - cappedScore).toString().padStart(4, "0");
    return `${indexStr}_${scoreStr}`;
  }
}

/**
 * Extended CompletionItem with usage counts for sorting.
 */
interface CompletionItemWithUsage extends vscode.CompletionItem {
  usageCount?: number;
  recentUsage?: number;
}
