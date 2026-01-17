/**
 * InlineCompletionProvider - Provides inline ghost text completions.
 *
 * Supports two completion modes:
 * 1. Payee completion - shows remainder of most-used matching payee
 * 2. Template completion - shows transaction postings for complete payee with snippet tabstops
 */
import * as vscode from "vscode";
import { InlinePositionAnalyzer } from "./InlinePositionAnalyzer";
import {
  CompletionDataProvider,
  TransactionTemplate,
  Posting,
} from "../lsp/CompletionDataProvider";
import { extractAmountParts } from "../utils/amountUtils";

/**
 * Provides inline (ghost text) completions for hledger files.
 * Implements VS Code's InlineCompletionItemProvider interface.
 */
export class InlineCompletionProvider
  implements vscode.InlineCompletionItemProvider
{
  private analyzer: InlinePositionAnalyzer;
  private cachedPayees: string[] = [];
  private lastCacheTime = 0;
  private readonly cacheRefreshInterval = 5000;

  constructor(private readonly dataProvider: CompletionDataProvider) {
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
   * Gets the configured alignment column from VS Code settings.
   */
  private getAlignmentColumn(): number {
    const config = vscode.workspace.getConfiguration("hledger");
    const value = config.get<number>("formatting.amountAlignmentColumn", 40);
    return value > 0 ? value : 40;
  }

  /**
   * Provides inline completion items for the current cursor position.
   * Returns at most one completion item (the best match).
   */
  async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken,
  ): Promise<vscode.InlineCompletionItem[] | undefined> {
    await this.refreshCache();

    const payeeSet = new Set<string>(this.cachedPayees);

    const inlineContext = this.analyzer.analyzePosition(
      document,
      position,
      payeeSet,
    );

    switch (inlineContext.type) {
      case "payee":
        return this.providePayeeCompletion(
          inlineContext.prefix,
          this.cachedPayees,
          position,
        );
      case "template":
        return await this.provideTemplateCompletion(
          inlineContext.payee,
          position,
        );
      default:
        return undefined;
    }
  }

  /**
   * Refreshes the payee cache if needed.
   */
  private async refreshCache(): Promise<void> {
    const now = Date.now();
    if (now - this.lastCacheTime > this.cacheRefreshInterval) {
      try {
        const data = await this.dataProvider.getCompletionData("");
        this.cachedPayees = data.payees;
        this.lastCacheTime = now;
      } catch {
        // Keep existing cache on error
      }
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
    payees: string[],
    position: vscode.Position,
  ): vscode.InlineCompletionItem[] | undefined {
    const lowerPrefix = prefix.toLowerCase();

    const match = payees.find((p) => p.toLowerCase().startsWith(lowerPrefix));

    if (!match) {
      return undefined;
    }

    const remainder = match.slice(prefix.length);

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
  private async provideTemplateCompletion(
    payee: string,
    position: vscode.Position,
  ): Promise<vscode.InlineCompletionItem[] | undefined> {
    const data = await this.dataProvider.getCompletionData(payee);

    const templates = data.templates.filter(
      (t) => t.payee.toLowerCase() === payee.toLowerCase(),
    );

    if (templates.length === 0) {
      return undefined;
    }

    const template = templates[0];
    if (!template) {
      return undefined;
    }

    const snippet = this.buildTemplateSnippet(template);

    const startOfLine = new vscode.Position(position.line, 0);

    const item = new vscode.InlineCompletionItem(
      snippet,
      new vscode.Range(startOfLine, position),
    );

    return [item];
  }

  /**
   * Escapes special snippet characters in text.
   * In snippet syntax, $, }, and \ are special characters that must be escaped.
   */
  private escapeSnippetText(text: string): string {
    return text
      .replace(/\\/g, "\\\\")
      .replace(/\$/g, "\\$")
      .replace(/}/g, "\\}");
  }

  /**
   * Builds a SnippetString for a transaction template.
   * Amount fields are wrapped in tabstops (${1:amount}, ${2:amount}, etc.)
   * to enable Tab navigation after insertion.
   * Aligns amounts to the configured alignment column.
   */
  private buildTemplateSnippet(
    template: TransactionTemplate,
  ): vscode.SnippetString {
    const alignmentColumn = this.getAlignmentColumn();
    const parts: string[] = [];
    let tabstopIndex = 1;
    const indent = "    ";

    for (let i = 0; i < template.postings.length; i++) {
      const posting: Posting | undefined = template.postings[i];
      if (!posting) continue;

      const escapedAccount = this.escapeSnippetText(posting.account);

      let amountPart = "";
      if (posting.amount !== undefined) {
        const accountPartLength = indent.length + posting.account.length;
        const spacesToAdd = Math.max(2, alignmentColumn - accountPartLength);
        const spacing = " ".repeat(spacesToAdd);
        const { amountOnly, commodityPart } = extractAmountParts(
          posting.amount,
          posting.commodity ?? undefined,
        );
        amountPart = `${spacing}\${${tabstopIndex++}:${this.escapeSnippetText(amountOnly)}}${commodityPart}`;
      }

      if (i === 0) {
        parts.push(`${indent}${escapedAccount}${amountPart}`);
      } else {
        parts.push(`\n${indent}${escapedAccount}${amountPart}`);
      }
    }

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
