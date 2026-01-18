/**
 * InlineCompletionProvider - Provides inline ghost text completions.
 *
 * Supports two completion modes:
 * 1. Payee completion - shows remainder of most-used matching payee
 * 2. Template completion - calls LSP textDocument/inlineCompletion for posting lines
 */
import * as vscode from "vscode";
import { InlinePositionAnalyzer } from "./InlinePositionAnalyzer";

interface LSPClient {
  sendRequest<R>(method: string, params?: unknown): Promise<R>;
}

interface LSPClientProvider {
  getClient(): LSPClient | null;
}

interface LSPInlineCompletionItem {
  insertText: string;
  filterText?: string;
  range?: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
}

interface LSPInlineCompletionList {
  items: LSPInlineCompletionItem[];
}

interface LSPCompletionDataResponse {
  payees: string[];
  templates: unknown[];
}

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

  constructor(private readonly clientProvider: LSPClientProvider) {
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
  async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken,
  ): Promise<vscode.InlineCompletionItem[] | undefined> {
    console.log("[InlineCompletion] provideInlineCompletionItems called");

    if (token.isCancellationRequested) {
      console.log("[InlineCompletion] cancelled");
      return undefined;
    }

    const client = this.clientProvider.getClient();
    console.log("[InlineCompletion] client:", client ? "available" : "null");
    if (!client) {
      return undefined;
    }

    const line = document.lineAt(position.line).text;
    const isPosting = this.isPostingLine(line);
    console.log("[InlineCompletion] line:", JSON.stringify(line));
    console.log("[InlineCompletion] isPostingLine:", isPosting);

    if (isPosting) {
      console.log("[InlineCompletion] calling LSP for template completion...");
      const result = await this.provideTemplateCompletionViaLSP(
        client,
        document,
        position,
      );
      console.log("[InlineCompletion] LSP result:", JSON.stringify(result));
      return result;
    }

    await this.refreshCache(client);

    const payeeSet = new Set<string>(this.cachedPayees);

    const inlineContext = this.analyzer.analyzePosition(
      document,
      position,
      payeeSet,
    );

    if (inlineContext.type === "payee") {
      return this.providePayeeCompletion(
        inlineContext.prefix,
        this.cachedPayees,
        position,
      );
    }

    return undefined;
  }

  /**
   * Checks if the line is a posting line (has 2+ spaces/tabs indent).
   */
  private isPostingLine(line: string): boolean {
    return /^[\t ]{2,}/.test(line);
  }

  /**
   * Provides template completion via LSP textDocument/inlineCompletion.
   */
  private async provideTemplateCompletionViaLSP(
    client: LSPClient,
    document: vscode.TextDocument,
    position: vscode.Position,
  ): Promise<vscode.InlineCompletionItem[] | undefined> {
    const params = {
      textDocument: { uri: document.uri.toString() },
      position: { line: position.line, character: position.character },
      context: { triggerKind: 2 },
    };
    console.log(
      "[InlineCompletion] LSP request params:",
      JSON.stringify(params),
    );

    try {
      const response = await client.sendRequest<LSPInlineCompletionList>(
        "textDocument/inlineCompletion",
        params,
      );

      console.log(
        "[InlineCompletion] LSP raw response:",
        JSON.stringify(response),
      );

      if (!response?.items?.length) {
        console.log("[InlineCompletion] no items in response");
        return undefined;
      }

      const items = response.items.map((item) => {
        const range = item.range
          ? new vscode.Range(
              item.range.start.line,
              item.range.start.character,
              item.range.end.line,
              item.range.end.character,
            )
          : new vscode.Range(position, position);

        console.log(
          "[InlineCompletion] creating item:",
          JSON.stringify({ insertText: item.insertText, range }),
        );
        return new vscode.InlineCompletionItem(item.insertText, range);
      });

      return items;
    } catch (error) {
      console.error("[InlineCompletion] LSP request failed:", error);
      return undefined;
    }
  }

  /**
   * Refreshes the payee cache if needed.
   */
  private async refreshCache(client: LSPClient): Promise<void> {
    const now = Date.now();
    if (now - this.lastCacheTime > this.cacheRefreshInterval) {
      try {
        const response = await client.sendRequest<LSPCompletionDataResponse>(
          "hledger/completionData",
          { query: "" },
        );
        if (response?.payees) {
          this.cachedPayees = response.payees;
        }
        this.lastCacheTime = now;
      } catch (error) {
        console.error("Failed to refresh payee cache:", error);
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
   * Cleanup method for resource disposal.
   */
  dispose(): void {
    // Currently no resources to dispose
  }
}
