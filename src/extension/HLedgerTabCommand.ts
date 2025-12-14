import * as vscode from "vscode";
import { DocumentFormatter, TransactionBlock } from "./DocumentFormatter";

/**
 * Handles Tab key press for amount alignment positioning in hledger files.
 * Provides smart cursor positioning when entering amounts in transaction postings.
 */
export class HLedgerTabCommand implements vscode.Disposable {
  private disposable: vscode.Disposable;
  private documentFormatter: DocumentFormatter;

  constructor() {
    this.documentFormatter = new DocumentFormatter();
    this.disposable = vscode.commands.registerTextEditorCommand(
      "hledger.onTab",
      this.onTab,
      this,
    );
  }

  private async onTab(
    textEditor: vscode.TextEditor,
    edit: vscode.TextEditorEdit,
  ): Promise<void> {
    const document = textEditor.document;

    // Check if this is an hledger file
    if (document.languageId !== "hledger") {
      // If not an hledger file, execute standard tab action
      await vscode.commands.executeCommand("default:type", { text: "\t" });
      return;
    }

    const position = textEditor.selection.active;

    // Check if we're in a posting line after account name
    const tabAction = this.analyzeTabContext(document, position);

    if (!tabAction.shouldAlign) {
      // Standard tab behavior
      await vscode.commands.executeCommand("default:type", { text: "\t" });
      return;
    }

    // Apply smart positioning
    await this.applySmartPositioning(textEditor, edit, tabAction);
  }

  /**
   * Analyzes the current context to determine if Tab should trigger amount alignment.
   */
  private analyzeTabContext(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): TabAction {
    const currentLine = document.lineAt(position.line);
    const lineText = currentLine.text;
    const textBeforeCursor = lineText.substring(0, position.character);

    // Check if this is a posting line (starts with indentation)
    if (!textBeforeCursor.match(/^\s+/)) {
      return {
        shouldAlign: false,
        type: TabActionType.NONE,
        currentLine: currentLine.lineNumber,
        currentPosition: position,
      };
    }

    // Case 1: After account name with only whitespace before cursor
    // Pattern: "    Expenses:Food    " -> cursor here
    if (textBeforeCursor.match(/^\s+\S.*\s{2,}$/)) {
      return {
        shouldAlign: true,
        type: TabActionType.MOVE_TO_AMOUNT_POSITION,
        currentLine: currentLine.lineNumber,
        currentPosition: position,
      };
    }

    // Case 2: Right after account name (most common case)
    // Pattern: "    Expenses:Food" -> cursor here OR "    Assets:Cash" -> cursor here
    // Updated to support account names with spaces: "    Assets:Bank Account"
    // Account names must start with a non-whitespace character and contain at least one colon
    // Excludes comments (starting with ; or #) and invalid patterns
    // Allow zero or more characters after the colon to support accounts like "Assets:" or "Assets: "
    if (textBeforeCursor.match(/^\s+[^;#\s:].*:.*$/)) {
      return {
        shouldAlign: true,
        type: TabActionType.MOVE_TO_AMOUNT_POSITION,
        currentLine: currentLine.lineNumber,
        currentPosition: position,
      };
    }

    // Case 3: Inside or after incomplete amount entry
    // Pattern: "    Expenses:Food  1" -> cursor here
    if (textBeforeCursor.match(/^\s+\S.*\s{1,}\d*$/)) {
      return {
        shouldAlign: true,
        type: TabActionType.MOVE_TO_AMOUNT_POSITION,
        currentLine: currentLine.lineNumber,
        currentPosition: position,
      };
    }

    // Case 4: Single space after account name
    // Pattern: "    Expenses:Food " -> cursor here
    // Updated to support account names with spaces: "    Assets:Bank Account "
    // Account names must start with a non-whitespace character and contain at least one colon
    // Excludes comments (starting with ; or #) and invalid patterns
    // Allow zero or more characters after the colon to support accounts like "Assets: "
    if (textBeforeCursor.match(/^\s+[^;#\s:].*:.*\s$/)) {
      return {
        shouldAlign: true,
        type: TabActionType.MOVE_TO_AMOUNT_POSITION,
        currentLine: currentLine.lineNumber,
        currentPosition: position,
      };
    }

    // Default: no special alignment
    return {
      shouldAlign: false,
      type: TabActionType.NONE,
      currentLine: currentLine.lineNumber,
      currentPosition: position,
    };
  }

  /**
   * Applies smart positioning based on the tab action context.
   */
  private async applySmartPositioning(
    textEditor: vscode.TextEditor,
    edit: vscode.TextEditorEdit,
    tabAction: TabAction,
  ): Promise<void> {
    const document = textEditor.document;
    const currentLine = tabAction.currentLine;
    const position = tabAction.currentPosition;

    try {
      // Get optimal alignment position for this document
      const alignmentPosition = await this.getOptimalAmountPosition(
        document,
        currentLine,
      );

      if (
        alignmentPosition !== null &&
        alignmentPosition > position.character
      ) {
        // Calculate how many spaces we need to add
        const spacesToAdd = alignmentPosition - position.character;

        // Add spaces to reach the alignment position
        const spaces = " ".repeat(spacesToAdd);

        await textEditor.edit((editBuilder) => {
          editBuilder.insert(position, spaces);
        });

        // Move cursor to the new position
        const newPosition = new vscode.Position(currentLine, alignmentPosition);
        textEditor.selection = new vscode.Selection(newPosition, newPosition);
      } else {
        // Fallback to standard tab behavior
        await vscode.commands.executeCommand("default:type", { text: "\t" });
      }
    } catch {
      // Fallback to standard tab behavior
      await vscode.commands.executeCommand("default:type", { text: "\t" });
    }
  }

  /**
   * Calculates the optimal position for amount entry in the current line.
   */
  private async getOptimalAmountPosition(
    document: vscode.TextDocument,
    currentLineNumber: number,
  ): Promise<number | null> {
    try {
      // Parse the document to find all transactions
      const content = document.getText();
      const parseResult = this.documentFormatter.parseTransactions(content);

      if (!parseResult.success) {
        return null;
      }

      const transactions = parseResult.data;

      if (transactions.length === 0) {
        // For empty document, use default alignment
        return 40;
      }

      // Calculate document-wide alignment
      const documentAlignment =
        this.calculateDocumentOptimalAlignment(transactions);

      // Get the current line content to find account name length
      const currentLine = document.lineAt(currentLineNumber);
      const lineText = currentLine.text;

      // Extract account name from the current line
      const accountName = this.extractAccountName(lineText);

      if (!accountName) {
        return documentAlignment;
      }

      // Find account position in the line
      const accountPosition = this.findAccountPosition(lineText);
      const accountEndPosition = accountPosition + accountName.length;

      // Calculate amount position with minimum spacing
      const amountPosition = Math.max(
        documentAlignment,
        accountEndPosition + 2,
      );

      return amountPosition;
    } catch {
      return null;
    }
  }

  /**
   * Finds the transaction that contains the specified line number.
   */
  private findTransactionForLine(
    transactions: TransactionBlock[],
    lineNumber: number,
  ): TransactionBlock | null {
    for (const transaction of transactions) {
      // Check if the line is within the transaction range
      if (
        lineNumber === transaction.headerLineNumber ||
        transaction.postings.some(
          (posting) => posting.lineNumber === lineNumber,
        )
      ) {
        return transaction;
      }

      // Check if line is between header and first posting
      if (transaction.postings.length > 0) {
        const firstPostingLine = Math.min(
          ...transaction.postings.map((p) => p.lineNumber),
        );
        if (
          lineNumber > transaction.headerLineNumber &&
          lineNumber < firstPostingLine
        ) {
          return transaction;
        }
      }
    }
    return null;
  }

  /**
   * Extracts the account name from a posting line.
   */
  private extractAccountName(lineText: string): string | null {
    const trimmedLine = lineText.trim();

    // Find the split point between account and amount
    const separatorMatch = trimmedLine.match(/(\S.*?)(?:\s{2,}|\t)(.*)/);

    if (separatorMatch) {
      return separatorMatch[1]?.trim() ?? null;
    }

    // If no amount found, the entire trimmed line is the account name
    return trimmedLine || null;
  }

  /**
   * Finds the position (character index) of the account name in the line.
   */
  private findAccountPosition(lineText: string): number {
    const match = lineText.match(/^\s*/);
    return match ? match[0].length : 0;
  }

  /**
   * Calculates the optimal alignment column for the entire document.
   *
   * @param transactions Array of all transaction blocks to analyze
   * @returns The optimal alignment column position for the entire document
   */
  private calculateDocumentOptimalAlignment(
    transactions: TransactionBlock[],
  ): number {
    if (transactions.length === 0) {
      return 40;
    }

    // Find the maximum account name length among all postings with amounts across all transactions
    let maxAccountLength = 0;
    for (const transaction of transactions) {
      for (const posting of transaction.postings) {
        if (posting.hasAmount) {
          const accountLength =
            posting.accountPosition + posting.accountName.length;
          maxAccountLength = Math.max(maxAccountLength, accountLength);
        }
      }
    }

    // Add minimum spacing and ensure reasonable alignment
    return Math.max(maxAccountLength + 2, 40);
  }

  dispose(): void {
    this.disposable.dispose();
  }
}

/**
 * Types of tab actions for hledger files.
 */
enum TabActionType {
  NONE = "none",
  MOVE_TO_AMOUNT_POSITION = "move_to_amount_position",
}

/**
 * Represents a tab action context.
 */
interface TabAction {
  /** Whether special alignment should be applied */
  shouldAlign: boolean;
  /** Type of tab action to perform */
  type: TabActionType;
  /** Current line number */
  currentLine: number;
  /** Current cursor position */
  currentPosition: vscode.Position;
}
