/**
 * InlineCompletionProvider - Provides inline ghost text completions.
 *
 * Supports two completion modes:
 * 1. Payee completion - shows remainder of most-used matching payee
 * 2. Template completion - shows transaction postings for complete payee
 */
import * as vscode from "vscode";
import { HLedgerConfig } from "../HLedgerConfig";
import { InlinePositionAnalyzer } from "./InlinePositionAnalyzer";
import { TransactionTemplate, PayeeName } from "../types";

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
   * Returns the most frequently used template as ghost text.
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

    const { text: ghostText, amountColumn } =
      this.buildTemplateGhostText(template);

    // Normalize position to column 0 to ensure proper indentation
    // The range replaces from start of line to cursor, ensuring 4-space indent
    const startOfLine = new vscode.Position(position.line, 0);

    const item = new vscode.InlineCompletionItem(
      ghostText,
      new vscode.Range(startOfLine, position),
    );

    // Add command to position cursor at the amount field after insertion
    if (amountColumn !== null) {
      item.command = {
        command: "hledger.positionCursorAfterTemplate",
        title: "Position cursor at amount",
        arguments: [position.line, amountColumn],
      };
    }

    return [item];
  }

  /**
   * Result of building template ghost text.
   */
  private buildTemplateGhostText(template: TransactionTemplate): {
    text: string;
    amountColumn: number | null;
  } {
    const lines: string[] = [];
    let amountColumn: number | null = null;
    const indent = 4;
    const separator = 2; // two spaces before amount

    for (let i = 0; i < template.postings.length; i++) {
      const posting = template.postings[i];
      if (!posting) continue;

      const amountPart = posting.amount !== null ? `  ${posting.amount}` : "";

      // Calculate amount column for first posting with amount
      if (amountColumn === null && posting.amount !== null && i === 0) {
        amountColumn = indent + posting.account.length + separator;
      }

      // First line: no leading newline (cursor already on new line)
      // Subsequent lines: add newline before
      if (i === 0) {
        lines.push(`    ${posting.account}${amountPart}`);
      } else {
        lines.push(`\n    ${posting.account}${amountPart}`);
      }
    }

    return { text: lines.join(""), amountColumn };
  }

  /**
   * Cleanup method for resource disposal.
   */
  dispose(): void {
    // Currently no resources to dispose
  }
}
