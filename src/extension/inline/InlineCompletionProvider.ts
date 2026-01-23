/**
 * InlineCompletionProvider - Provides inline ghost text completions via LSP.
 *
 * Delegates to hledger-lsp's textDocument/inlineCompletion for transaction templates.
 * LSP determines context and returns plain text postings (no snippets/tabstops).
 */
import * as vscode from "vscode";

/**
 * Minimal LSP client interface for sending requests.
 */
interface LSPClient {
  sendRequest<R>(method: string, params?: unknown): Promise<R>;
}

/**
 * LSP inline completion item structure.
 */
interface LSPInlineCompletionItem {
  insertText: string;
  range?: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
}

/**
 * LSP inline completion response structure.
 */
interface LSPInlineCompletionList {
  items: LSPInlineCompletionItem[];
}

/**
 * Provides inline (ghost text) completions for hledger files.
 * Implements VS Code's InlineCompletionItemProvider interface.
 */
export class InlineCompletionProvider
  implements vscode.InlineCompletionItemProvider
{
  constructor(private readonly getClient: () => LSPClient | null) {}

  /**
   * Provides inline completion items for the current cursor position.
   * Delegates to LSP server for context analysis and template generation.
   */
  async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken,
  ): Promise<vscode.InlineCompletionItem[] | undefined> {
    const client = this.getClient();
    if (!client) {
      return undefined;
    }

    if (token.isCancellationRequested) {
      return undefined;
    }

    try {
      const response = await client.sendRequest<LSPInlineCompletionList>(
        "textDocument/inlineCompletion",
        {
          textDocument: { uri: document.uri.toString() },
          position: { line: position.line, character: position.character },
          context: {
            triggerKind:
              context.triggerKind === vscode.InlineCompletionTriggerKind.Invoke
                ? 1
                : 2,
          },
        },
      );

      if (token.isCancellationRequested) {
        return undefined;
      }

      if (!response?.items?.length) {
        return undefined;
      }

      return response.items.map((item) => {
        const range = item.range
          ? new vscode.Range(
              item.range.start.line,
              item.range.start.character,
              item.range.end.line,
              item.range.end.character,
            )
          : new vscode.Range(position, position);

        return new vscode.InlineCompletionItem(item.insertText, range);
      });
    } catch {
      // Silently fail - LSP may be unavailable or request may have timed out
      return undefined;
    }
  }

  /**
   * Cleanup method for resource disposal.
   */
  dispose(): void {
    // No resources to dispose
  }
}
