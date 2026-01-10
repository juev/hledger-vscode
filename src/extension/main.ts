// main.ts - Simplified entry point for hledger extension
// Refactored architecture with ~190 lines (FASE G)

import * as vscode from "vscode";
import { StrictCompletionProvider } from "./StrictCompletionProvider";
import { HLedgerEnterCommand } from "./HLedgerEnterCommand";
import { HLedgerTabCommand } from "./HLedgerTabCommand";
import { registerFormattingProviders } from "./HLedgerFormattingProvider";
import {
  HledgerSemanticTokensProvider,
  HLEDGER_SEMANTIC_TOKENS_LEGEND,
} from "./HledgerSemanticTokensProvider";
import { createServices } from "./services";
import { SimpleFuzzyMatcher } from "./SimpleFuzzyMatcher";
import { HLedgerCodeActionProvider } from "./actions/HLedgerCodeActionProvider";
import { HLedgerDiagnosticsProvider } from "./diagnostics/HLedgerDiagnosticsProvider";
import { InlineCompletionProvider } from "./inline/InlineCompletionProvider";
import { AmountFormatterService } from "./services/AmountFormatterService";
import { NumberFormatService } from "./services/NumberFormatService";

// Main activation function
export function activate(context: vscode.ExtensionContext): void {
  try {
    // Create services once with service factory pattern
    const services = createServices();
    context.subscriptions.push(services);

    // Register strict completion provider with explicit trigger characters
    // VS Code CompletionItemProvider requires trigger characters to activate completion;
    // automatic completion on every keystroke is not supported by the API and would degrade performance
    const strictProvider = new StrictCompletionProvider(services.config);

    // Register the provider for completion items
    context.subscriptions.push(
      vscode.languages.registerCompletionItemProvider(
        "hledger",
        strictProvider,
        // Triggers for different completion contexts (space intentionally excluded):
        "0",
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "8",
        "9", // Date completion at line start
        ":", // Account hierarchy
        "@", // Commodities
        ";", // Comments (future use)
      ),
    );

    // Register the provider itself for proper disposal (prevents RegexCache memory leak)
    context.subscriptions.push(strictProvider);

    // Register inline completion provider for ghost text completions
    const inlineProvider = new InlineCompletionProvider(services.config);
    context.subscriptions.push(
      vscode.languages.registerInlineCompletionItemProvider(
        "hledger",
        inlineProvider,
      ),
    );
    context.subscriptions.push(inlineProvider);

    // Register command to position cursor after template insertion
    context.subscriptions.push(
      vscode.commands.registerTextEditorCommand(
        "hledger.positionCursorAfterTemplate",
        (editor, _edit, line: number, column: number) => {
          // Bounds check: clamp line to valid document range
          const maxLine = editor.document.lineCount - 1;
          const safeLine = Math.min(Math.max(0, line), maxLine);

          // Bounds check: clamp column to valid line length
          const lineText = editor.document.lineAt(safeLine).text;
          const safeColumn = Math.min(Math.max(0, column), lineText.length);

          const newPosition = new vscode.Position(safeLine, safeColumn);
          editor.selection = new vscode.Selection(newPosition, newPosition);
        },
      ),
    );

    // Register code action provider for balance assertions and quick fixes
    const codeActionProvider = new HLedgerCodeActionProvider(services.config);
    context.subscriptions.push(
      vscode.languages.registerCodeActionsProvider(
        "hledger",
        codeActionProvider,
        {
          providedCodeActionKinds:
            HLedgerCodeActionProvider.providedCodeActionKinds,
        },
      ),
    );

    // Register diagnostics provider for validation on save
    const diagnosticsProvider = new HLedgerDiagnosticsProvider(services.config);
    context.subscriptions.push(diagnosticsProvider);

    // Register formatting providers for hledger files
    registerFormattingProviders(context);

    // Create amount formatting services
    const numberFormatService = new NumberFormatService();
    const amountFormatterService = new AmountFormatterService(
      services.config,
      numberFormatService,
    );

    // Register Enter key handler for smart indentation and amount formatting
    const enterCommand = new HLedgerEnterCommand(amountFormatterService, services.config);
    context.subscriptions.push(enterCommand);

    // Register Tab key handler for amount alignment positioning
    const tabCommand = new HLedgerTabCommand();
    context.subscriptions.push(tabCommand);

    // Selection change listener for formatting posting lines when cursor leaves
    // This handles template completion where Tab navigates between tabstops
    let lastPostingLineNumber: number | null = null;
    let lastPostingLineContent: string | null = null;
    let formatTimeout: ReturnType<typeof setTimeout> | null = null;

    const formatPostingLineIfNeeded = async (
      editor: vscode.TextEditor,
      lineNumber: number,
    ): Promise<void> => {
      try {
        if (lineNumber >= editor.document.lineCount) return;

        const line = editor.document.lineAt(lineNumber);
        const currentContent = line.text;

        services.config.getConfigForDocument(editor.document);
        const alignmentColumn = amountFormatterService.getAlignmentColumn();
        const formatted = amountFormatterService.formatPostingLine(
          currentContent,
          alignmentColumn,
        );

        if (formatted !== null && formatted !== currentContent) {
          await editor.edit(
            (editBuilder) => {
              editBuilder.replace(line.range, formatted);
            },
            { undoStopBefore: false, undoStopAfter: true },
          );
        }
      } catch {
        // Ignore errors during formatting
      }
    };

    const selectionChangeListener = vscode.window.onDidChangeTextEditorSelection(
      async (event) => {
        const editor = event.textEditor;
        if (editor.document.languageId !== "hledger") {
          lastPostingLineNumber = null;
          lastPostingLineContent = null;
          if (formatTimeout) {
            globalThis.clearTimeout(formatTimeout);
            formatTimeout = null;
          }
          return;
        }

        const currentLine = event.selections[0]?.active.line;
        if (currentLine === undefined) {
          return;
        }

        // Clear any pending debounced format
        if (formatTimeout) {
          globalThis.clearTimeout(formatTimeout);
          formatTimeout = null;
        }

        // Check if we have a tracked posting line
        if (lastPostingLineNumber !== null && lastPostingLineContent !== null) {
          const trackedLineNumber = lastPostingLineNumber;
          if (trackedLineNumber < editor.document.lineCount) {
            const trackedLine = editor.document.lineAt(trackedLineNumber);
            const currentContent = trackedLine.text;

            // Content changed from when we first tracked it
            if (currentContent !== lastPostingLineContent) {
              if (trackedLineNumber !== currentLine) {
                // Moving to different line - format immediately
                await formatPostingLineIfNeeded(editor, trackedLineNumber);
              } else {
                // Same line but content changed - debounced format (for snippet tabstops)
                formatTimeout = setTimeout(async () => {
                  await formatPostingLineIfNeeded(editor, trackedLineNumber);
                  // Update tracked content after formatting
                  if (trackedLineNumber < editor.document.lineCount) {
                    lastPostingLineContent = editor.document.lineAt(trackedLineNumber).text;
                  }
                }, 500);
              }
            }
          }
        }

        // Track current line if it's a posting line
        const currentLineText = editor.document.lineAt(currentLine).text;
        const isPostingLine = /^\s+\S/.test(currentLineText);

        if (isPostingLine) {
          lastPostingLineNumber = currentLine;
          lastPostingLineContent = currentLineText;
        } else {
          lastPostingLineNumber = null;
          lastPostingLineContent = null;
        }
      },
    );
    context.subscriptions.push(selectionChangeListener);

    // Register semantic tokens provider for dynamic coloring with range support
    const semanticProvider = new HledgerSemanticTokensProvider();
    context.subscriptions.push(
      vscode.languages.registerDocumentSemanticTokensProvider(
        { language: "hledger" },
        semanticProvider,
        HLEDGER_SEMANTIC_TOKENS_LEGEND,
      ),
    );

    // Also register range provider for better performance on large files
    context.subscriptions.push(
      vscode.languages.registerDocumentRangeSemanticTokensProvider(
        { language: "hledger" },
        semanticProvider,
        HLEDGER_SEMANTIC_TOKENS_LEGEND,
      ),
    );

    // Register the semantic provider itself for proper disposal
    context.subscriptions.push(semanticProvider);

    // FS watcher for journal files: reset data on change, preserve cache for mtimeMs validation
    // This enables incremental updates - only modified files will be reparsed
    const watcher = vscode.workspace.createFileSystemWatcher(
      "**/*.{journal,hledger,ledger}",
    );
    const onFsChange = (): void => {
      try {
        // Reset data without clearing cache - SimpleProjectCache.get() validates mtimeMs automatically
        // This provides ~50x speedup for large projects by avoiding full workspace reparsing
        services.config.resetData();
      } catch (err) {
        console.error("HLedger: data reset failed after FS change", err);
      }
    };
    watcher.onDidCreate(onFsChange, null, context.subscriptions);
    watcher.onDidChange(onFsChange, null, context.subscriptions);
    watcher.onDidDelete(onFsChange, null, context.subscriptions);
    context.subscriptions.push(watcher);

    // Register manual completion commands
    context.subscriptions.push(
      vscode.commands.registerCommand("hledger.triggerDateCompletion", () => {
        vscode.commands.executeCommand("editor.action.triggerSuggest");
      }),
    );

    context.subscriptions.push(
      vscode.commands.registerCommand(
        "hledger.triggerAccountCompletion",
        () => {
          vscode.commands.executeCommand("editor.action.triggerSuggest");
        },
      ),
    );

    // Register CLI commands
    context.subscriptions.push(
      vscode.commands.registerCommand("hledger.cli.balance", async () => {
        await services.cliCommands.insertBalance();
      }),
    );

    context.subscriptions.push(
      vscode.commands.registerCommand("hledger.cli.stats", async () => {
        await services.cliCommands.insertStats();
      }),
    );

    context.subscriptions.push(
      vscode.commands.registerCommand(
        "hledger.cli.incomestatement",
        async () => {
          await services.cliCommands.insertIncomestatement();
        },
      ),
    );

    // Register import commands
    context.subscriptions.push(
      vscode.commands.registerCommand(
        "hledger.import.fromSelection",
        async () => {
          await services.importCommands.importFromSelection();
        },
      ),
    );

    context.subscriptions.push(
      vscode.commands.registerCommand("hledger.import.fromFile", async () => {
        await services.importCommands.importFromFile();
      }),
    );

    // Register amount formatting command
    context.subscriptions.push(
      vscode.commands.registerTextEditorCommand(
        "hledger.formatAmounts",
        async (editor) => {
          const document = editor.document;
          if (document.languageId !== "hledger") {
            return;
          }

          const content = document.getText();
          const formatted = amountFormatterService.formatDocumentContent(content);

          if (formatted !== content) {
            const fullRange = new vscode.Range(
              document.positionAt(0),
              document.positionAt(content.length),
            );
            await editor.edit((editBuilder) => {
              editBuilder.replace(fullRange, formatted);
            });
          }
        },
      ),
    );

    // Extension activation complete
  } catch (error) {
    console.error("HLedger extension activation failed:", error);
  }
}

export function deactivate(): void {
  // Cleanup happens automatically through context.subscriptions
}

// Public API exports
export { HLedgerConfig } from "./HLedgerConfig";
export { HLedgerParser } from "./HLedgerParser";
export { SimpleProjectCache as WorkspaceCache } from "./SimpleProjectCache";
export { SimpleFuzzyMatcher, FuzzyMatch } from "./SimpleFuzzyMatcher";

/**
 * Helper function for fuzzy matching that wraps SimpleFuzzyMatcher.
 * Used by tests and external consumers for simple prefix-based matching.
 *
 * @template T - String type to match against
 * @param query - Search query string
 * @param items - Array of items to search through
 * @returns Array of FuzzyMatch results sorted by relevance
 */
export function fuzzyMatch<T extends string>(
  query: string,
  items: readonly T[],
): Array<{ item: T; score: number }> {
  const matcher = new SimpleFuzzyMatcher();
  return matcher.match(query, items);
}
