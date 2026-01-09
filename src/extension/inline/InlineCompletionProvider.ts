/**
 * InlineCompletionProvider - Provides inline ghost text completions.
 *
 * Supports two completion modes:
 * 1. Payee completion - shows remainder of most-used matching payee
 * 2. Template completion - shows transaction postings for complete payee with snippet tabstops
 */
import * as vscode from "vscode";
import { HLedgerConfig } from "../HLedgerConfig";
import { InlinePositionAnalyzer } from "./InlinePositionAnalyzer";
import { TransactionTemplate, PayeeName, TemplatePosting } from "../types";

/**
 * Provides inline (ghost text) completions for hledger files.
 * Implements VS Code's InlineCompletionItemProvider interface.
 */
export class InlineCompletionProvider
  implements vscode.InlineCompletionItemProvider
{
  private analyzer: InlinePositionAnalyzer;

  constructor(private config: HLedgerConfig) {
    this.analyzer = new InlinePositionAnalyzer(this.getMinPayeeChars());
  }

  /**
   * Gets the minimum payee characters config with bounds validation.
   * Clamps value to valid range 1-10 to ensure safe runtime behavior.
   */
  private getMinPayeeChars(): number {
    const config = vscode.workspace.getConfiguration("hledger");
    const value = config.get<number>("inlineCompletion.minPayeeChars", 2);
    return Math.max(1, Math.min(10, value));
  }

  /**
   * Provides inline completion items for the current cursor position.
   * Returns at most one completion item (the best match).
   */
  provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken,
  ): vscode.InlineCompletionItem[] | undefined {
    // Update config for current document, excluding current line
    this.config.getConfigForDocument(document, position.line);

    // Get known payees for exact matching
    const payees = this.config.getPayeesByUsage();
    const payeeSet = new Set<string>(payees);

    // Analyze position to determine context
    const inlineContext = this.analyzer.analyzePosition(
      document,
      position,
      payeeSet,
    );

    // Route to appropriate handler
    switch (inlineContext.type) {
      case "payee":
        return this.providePayeeCompletion(
          inlineContext.prefix,
          payees,
          position,
        );
      case "template":
        return this.provideTemplateCompletion(inlineContext.payee, position);
      default:
        return undefined;
    }
  }

  /**
   * Provides payee completion by finding the first matching payee.
   * Returns only the remainder (ghost text) of the payee name.
   *
   * @param prefix - The typed prefix to match against
   * @param payees - Payees sorted by usage (most used first)
   * @param position - Current cursor position
   */
  private providePayeeCompletion(
    prefix: string,
    payees: PayeeName[],
    position: vscode.Position,
  ): vscode.InlineCompletionItem[] | undefined {
    const lowerPrefix = prefix.toLowerCase();

    // Find first matching payee (already sorted by usage)
    const match = payees.find((p) => p.toLowerCase().startsWith(lowerPrefix));

    if (!match) {
      return undefined;
    }

    // Calculate remainder (ghost text)
    const remainder = match.slice(prefix.length);

    // No ghost text if prefix matches entire payee
    if (!remainder) {
      return undefined;
    }

    const item = new vscode.InlineCompletionItem(
      remainder,
      new vscode.Range(position, position),
    );

    return [item];
  }

  /**
   * Provides template completion for a complete payee.
   * Returns the most frequently used template as a SnippetString with tabstops for amounts.
   *
   * @param payee - The complete payee name
   * @param position - Current cursor position
   */
  private provideTemplateCompletion(
    payee: PayeeName,
    position: vscode.Position,
  ): vscode.InlineCompletionItem[] | undefined {
    const templates = this.config.getTemplatesForPayee(payee);

    if (templates.length === 0) {
      return undefined;
    }

    // Use the first template (already sorted by usage, highest first)
    const template = templates[0];
    if (!template) {
      return undefined;
    }

    const snippet = this.buildTemplateSnippet(template);

    // Normalize position to column 0 to ensure proper indentation
    // The range replaces from start of line to cursor, ensuring 4-space indent
    const startOfLine = new vscode.Position(position.line, 0);

    const item = new vscode.InlineCompletionItem(
      snippet,
      new vscode.Range(startOfLine, position),
    );

    // No command needed - SnippetString tabstops handle cursor positioning

    return [item];
  }

  /**
   * Escapes special snippet characters in text.
   * In snippet syntax, $, }, and \ are special characters that must be escaped.
   */
  private escapeSnippetText(text: string): string {
    return text.replace(/\\/g, "\\\\").replace(/\$/g, "\\$").replace(/}/g, "\\}");
  }

  /**
   * Escapes special regex characters in a string.
   */
  private escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * Extracts numeric amount from amount string, handling both prefix and suffix commodities.
   * Returns the amount without commodity and the commodity part for snippet formatting.
   */
  private extractAmountParts(
    amount: string,
    commodity: string | undefined,
  ): { amountOnly: string; commodityPart: string } {
    if (!commodity) {
      return { amountOnly: amount, commodityPart: "" };
    }

    const escaped = this.escapeRegExp(commodity);
    let amountOnly = amount;

    // Try suffix first (e.g., "100 USD" or "100USD")
    const suffixResult = amount.replace(new RegExp(`\\s*${escaped}$`), "");
    if (suffixResult !== amount) {
      amountOnly = suffixResult;
    } else {
      // Try prefix (e.g., "$100" or "$ 100")
      amountOnly = amount.replace(new RegExp(`^${escaped}\\s*`), "");
    }

    return {
      amountOnly,
      commodityPart: ` ${commodity}`,
    };
  }

  /**
   * Builds a SnippetString for a transaction template.
   * Amount fields are wrapped in tabstops (${1:amount}, ${2:amount}, etc.)
   * to enable Tab navigation after insertion.
   * Aligns amounts to the configured alignment column.
   */
  private buildTemplateSnippet(template: TransactionTemplate): vscode.SnippetString {
    const alignmentColumn = this.config.getAmountAlignmentColumn();
    const parts: string[] = [];
    let tabstopIndex = 1;
    const indent = "    "; // 4 spaces

    for (let i = 0; i < template.postings.length; i++) {
      const posting: TemplatePosting | undefined = template.postings[i];
      if (!posting) continue;

      // Escape special snippet characters in account name
      const escapedAccount = this.escapeSnippetText(posting.account);

      // Calculate spacing for alignment
      let amountPart = "";
      if (posting.amount !== null) {
        const accountPartLength = indent.length + posting.account.length;
        const spacesToAdd = Math.max(2, alignmentColumn - accountPartLength);
        const spacing = " ".repeat(spacesToAdd);
        const { amountOnly, commodityPart } = this.extractAmountParts(
          posting.amount,
          posting.commodity ?? undefined,
        );
        amountPart = `${spacing}\${${tabstopIndex++}:${this.escapeSnippetText(amountOnly)}}${commodityPart}`;
      }

      // First line: no leading newline (cursor already on new line)
      // Subsequent lines: add newline before
      if (i === 0) {
        parts.push(`${indent}${escapedAccount}${amountPart}`);
      } else {
        parts.push(`\n${indent}${escapedAccount}${amountPart}`);
      }
    }

    // Final tabstop for exiting snippet mode
    parts.push("\n$0");

    return new vscode.SnippetString(parts.join(""));
  }

  /**
   * Cleanup method for resource disposal.
   */
  dispose(): void {
    // Currently no resources to dispose
  }
}
