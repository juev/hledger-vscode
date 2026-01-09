import * as vscode from "vscode";
import { AmountFormatterService } from "./services/AmountFormatterService";

/**
 * Utilities for handling Enter key press with smart indentation logic
 */
export class HLedgerEnterKeyProvider {
  /**
   * Handles Enter key press and returns corresponding actions
   */
  static handleEnterKey(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): { indentAction: vscode.IndentAction; appendText?: string } | null {
    const currentLine = document.lineAt(position.line);
    const currentLineText = currentLine.text;
    const trimmedText = currentLineText.trim();

    // Case 1: Empty line without indent -> new line without indent
    if (trimmedText === "" && currentLineText === "") {
      return {
        indentAction: vscode.IndentAction.None,
      };
    }

    // Case 2: Line with only indent -> new line without indent
    if (trimmedText === "" && currentLineText.match(/^\s+$/)) {
      return {
        indentAction: vscode.IndentAction.Outdent,
      };
    }

    // Case 3: Line with date -> new line with indent
    if (
      currentLineText.match(
        /^(\d{4}[-/.]?\d{1,2}[-/.]?\d{1,2}|\d{1,2}[-/.]?\d{1,2})\s*(\*|!)?\s*(\([^)]+\))?\s*\S.*$/,
      )
    ) {
      return {
        indentAction: vscode.IndentAction.Indent,
      };
    }

    // Case 4: Line with indent and content -> new line preserving indent
    if (currentLineText.match(/^\s+\S.*$/)) {
      const indentMatch = currentLineText.match(/^(\s+)/);
      const currentIndent = indentMatch?.[1] ?? "    ";

      return {
        indentAction: vscode.IndentAction.None,
        appendText: currentIndent,
      };
    }

    // By default return null to use standard behavior
    return null;
  }
}

/**
 * Command for handling Enter key press
 */
export class HLedgerEnterCommand implements vscode.Disposable {
  private disposable: vscode.Disposable;
  private amountFormatter: AmountFormatterService | null = null;

  constructor(amountFormatter?: AmountFormatterService) {
    this.amountFormatter = amountFormatter ?? null;
    this.disposable = vscode.commands.registerTextEditorCommand(
      "hledger.onEnter",
      this.onEnter,
      this,
    );
  }

  setAmountFormatter(formatter: AmountFormatterService): void {
    this.amountFormatter = formatter;
  }

  private async onEnter(
    textEditor: vscode.TextEditor,
    _edit: vscode.TextEditorEdit,
  ): Promise<void> {
    const document = textEditor.document;

    if (document.languageId !== "hledger") {
      // If this is not an hledger file, execute standard action
      await vscode.commands.executeCommand("default:type", { text: "\n" });
      return;
    }

    // Check context - if autocompletion is active, pass control back
    // In this case our command should not have triggered due to when condition in package.json

    const selections = textEditor.selections;
    const edits: {
      selection: vscode.Selection;
      action: ReturnType<typeof HLedgerEnterKeyProvider.handleEnterKey>;
    }[] = [];

    // Process each cursor
    for (const selection of selections) {
      const position = selection.active;
      const action = HLedgerEnterKeyProvider.handleEnterKey(document, position);
      edits.push({ selection, action });
    }

    // Apply changes
    await textEditor.edit((editBuilder) => {
      for (const { selection, action } of edits) {
        const position = selection.active;
        const currentLine = document.lineAt(position.line);
        const currentLineText = currentLine.text;

        // Try to format the current line before inserting newline
        if (this.amountFormatter) {
          const alignmentColumn = this.amountFormatter.getAlignmentColumn();
          const formattedLine = this.amountFormatter.formatPostingLine(currentLineText, alignmentColumn);
          if (formattedLine !== null && formattedLine !== currentLineText) {
            // Replace the entire line with formatted version
            const lineRange = currentLine.range;
            editBuilder.replace(lineRange, formattedLine);
          }
        }

        if (!action) {
          // Standard behavior for this cursor only
          editBuilder.insert(position, "\n");
          continue;
        }

        let insertText = "\n";

        switch (action.indentAction) {
          case vscode.IndentAction.None:
            if (action.appendText) {
              insertText += action.appendText;
            }
            break;

          case vscode.IndentAction.Indent:
            insertText += "    "; // 4 spaces for indent
            break;

          case vscode.IndentAction.Outdent:
            // New line without indent (already included in insertText = '\n')
            break;
        }

        editBuilder.insert(position, insertText);
      }
    });
  }

  dispose(): void {
    this.disposable.dispose();
  }
}
