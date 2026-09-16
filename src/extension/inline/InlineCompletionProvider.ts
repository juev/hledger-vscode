/**
 * InlineCompletionProvider - Provides inline ghost text completions via LSP.
 *
 * Delegates to hledger-lsp's textDocument/inlineCompletion for transaction templates.
 * LSP determines context and returns plain text postings (no snippets/tabstops).
 */
import * as vscode from "vscode";

const LSP_REQUEST_TIMEOUT_MS = 5000;

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  token: vscode.CancellationToken
): Promise<T | undefined> {
  return new Promise((resolve) => {
    let resolved = false;
    let disposable: vscode.Disposable | undefined;

    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        disposable?.dispose();
        resolve(undefined);
      }
    }, timeoutMs);

    disposable = token.onCancellationRequested(() => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        resolve(undefined);
      }
    });

    promise
      .then((result) => {
        if (!resolved) {
          resolved = true;
          disposable?.dispose();
          clearTimeout(timeoutId);
          resolve(result);
        }
      })
      .catch(() => {
        if (!resolved) {
          resolved = true;
          disposable?.dispose();
          clearTimeout(timeoutId);
          resolve(undefined);
        }
      });
  });
}

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
/**
 * Sink for non-fatal failures. Defaults to the console, which is all that is
 * available when the provider is constructed outside the extension host.
 */
export interface InlineCompletionLogger {
  warn(message: string): void;
}

const consoleLogger: InlineCompletionLogger = {
  warn: (message: string) => console.warn(message),
};

export class InlineCompletionProvider
  implements vscode.InlineCompletionItemProvider
{
  constructor(
    private readonly getClient: () => LSPClient | null,
    private readonly logger: InlineCompletionLogger = consoleLogger,
  ) {}

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
    const config = vscode.workspace.getConfiguration("hledger");
    if (!config.get<boolean>("features.inlineCompletion", true)) {
      return undefined;
    }

    const client = this.getClient();
    if (!client) {
      return undefined;
    }

    if (token.isCancellationRequested) {
      return undefined;
    }

    if (context.selectedCompletionInfo) {
      return undefined;
    }

    try {
      const response = await withTimeout(
        client.sendRequest<LSPInlineCompletionList>(
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
        ),
        LSP_REQUEST_TIMEOUT_MS,
        token
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
    } catch (error: unknown) {
      // The default console.debug level hides this, and a server that stops
      // answering then looks like "ghost text just stopped working".
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`[InlineCompletionProvider] Request failed: ${message}`);
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
