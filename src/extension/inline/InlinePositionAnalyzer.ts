/**
 * InlinePositionAnalyzer - Analyzes cursor position for inline completions.
 *
 * Determines whether the cursor is in a position suitable for:
 * 1. Payee completion (typing after date)
 * 2. Transaction template insertion (complete payee entered)
 */
import * as vscode from "vscode";
import { PayeeName } from "../types";

/**
 * Discriminated union representing inline completion context.
 * Enables type-safe handling of different completion scenarios.
 */
export type InlineContext =
  | { type: "none" }
  | { type: "payee"; prefix: string; payeeStartPos: number }
  | { type: "template"; payee: PayeeName; insertPosition: vscode.Position };

/**
 * Analyzes cursor position to determine inline completion context.
 * Handles payee prefix matching and template insertion detection.
 */
export class InlinePositionAnalyzer {
  /**
   * Date pattern matching both YYYY-MM-DD and MM-DD formats with optional status.
   * Captures the full date portion including trailing whitespace and status marker.
   */
  private static readonly DATE_IN_TRANSACTION =
    /^(?:\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2})\s*[*!]?\s*/;

  /**
   * Pattern to detect indented lines (posting lines).
   */
  private static readonly INDENTED_LINE = /^\s+/;

  /**
   * Pattern to detect comment lines.
   */
  private static readonly COMMENT_LINE = /^[;#]/;

  /**
   * Pattern to detect directive lines.
   */
  private static readonly DIRECTIVE_LINE =
    /^(account|alias|commodity|payee|tag|include|year|apply|end|default|format|note|assert|check)\s/;

  /**
   * Analyzes the cursor position and returns the appropriate inline context.
   *
   * @param document - The text document being edited
   * @param position - Current cursor position
   * @param knownPayees - Set of known payee names for exact matching
   * @returns InlineContext indicating the type of completion available
   */
  analyzePosition(
    document: vscode.TextDocument,
    position: vscode.Position,
    knownPayees: ReadonlySet<string>,
  ): InlineContext {
    const line = document.lineAt(position.line).text;

    // Early exit for empty lines
    if (line.trim().length === 0) {
      return { type: "none" };
    }

    // Check for indented lines (posting lines) - no inline completion
    if (InlinePositionAnalyzer.INDENTED_LINE.test(line)) {
      return { type: "none" };
    }

    // Check for comment lines
    if (InlinePositionAnalyzer.COMMENT_LINE.test(line.trimStart())) {
      return { type: "none" };
    }

    // Check for directive lines
    if (InlinePositionAnalyzer.DIRECTIVE_LINE.test(line)) {
      return { type: "none" };
    }

    // Try to match date pattern
    const dateMatch = line.match(InlinePositionAnalyzer.DATE_IN_TRANSACTION);
    if (!dateMatch) {
      return { type: "none" };
    }

    const dateEndPos = dateMatch[0].length;
    const cursorPos = position.character;

    // Cursor must be at or after date end
    if (cursorPos < dateEndPos) {
      return { type: "none" };
    }

    // Extract payee portion (from date end to cursor)
    const payeePortion = line.substring(dateEndPos, cursorPos);
    const fullPayeeLine = line.substring(dateEndPos).trimEnd();

    // Check if we have a complete payee (exact match with known payee)
    const isExactPayeeMatch = knownPayees.has(fullPayeeLine);
    const isCursorAtEnd = cursorPos === line.length;

    if (isExactPayeeMatch && isCursorAtEnd) {
      // Check if template context is valid (next line is empty, doesn't exist, or starts new transaction)
      const isTemplateContextValid = this.isValidTemplateContext(
        document,
        position.line,
      );

      if (isTemplateContextValid) {
        return {
          type: "template",
          payee: fullPayeeLine as PayeeName,
          insertPosition: position,
        };
      } else {
        // Transaction already has postings
        return { type: "none" };
      }
    }

    // Check for payee prefix (partial match)
    const prefix = payeePortion.trim();

    // Require at least 1 character for payee prefix
    if (prefix.length < 1) {
      return { type: "none" };
    }

    return {
      type: "payee",
      prefix,
      payeeStartPos: dateEndPos + payeePortion.indexOf(prefix.charAt(0)),
    };
  }

  /**
   * Checks if the context is valid for template insertion.
   * Template is only valid if next line is empty, doesn't exist, or starts a new transaction.
   *
   * @param document - The text document
   * @param currentLine - Current line number
   * @returns true if template insertion is valid
   */
  private isValidTemplateContext(
    document: vscode.TextDocument,
    currentLine: number,
  ): boolean {
    // If we're at the last line of the document, template is valid
    if (currentLine >= document.lineCount - 1) {
      return true;
    }

    const nextLine = document.lineAt(currentLine + 1).text;

    // Empty line is valid
    if (nextLine.trim().length === 0) {
      return true;
    }

    // If next line is indented, transaction already has postings
    if (InlinePositionAnalyzer.INDENTED_LINE.test(nextLine)) {
      return false;
    }

    // Next line starts new transaction (non-indented, not empty)
    return true;
  }
}
