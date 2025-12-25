/**
 * InlinePositionAnalyzer - Analyzes cursor position for inline completions.
 *
 * Determines whether the cursor is in a position suitable for:
 * 1. Payee completion (typing after date)
 * 2. Transaction template insertion (complete payee entered)
 */
import * as vscode from 'vscode';
import { PayeeName } from '../types';

/**
 * Discriminated union representing inline completion context.
 * Enables type-safe handling of different completion scenarios.
 */
export type InlineContext =
  | { type: 'none' }
  | { type: 'payee'; prefix: string; payeeStartPos: number }
  | { type: 'template'; payee: PayeeName; insertPosition: vscode.Position };

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
   * Minimum characters required before showing inline payee completion.
   * Configurable via hledger.inlineCompletion.minPayeeChars setting.
   */
  private readonly minPayeeChars: number;

  constructor(minPayeeChars: number = 2) {
    this.minPayeeChars = minPayeeChars;
  }

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
    knownPayees: ReadonlySet<string>
  ): InlineContext {
    const line = document.lineAt(position.line).text;

    // Check for template context: cursor on EMPTY line after transaction header
    // This prevents template from being auto-accepted with payee completion
    if (line.trim().length === 0 && position.line > 0) {
      return this.checkTemplateContext(document, position, knownPayees);
    }

    // Check for indented lines (posting lines) - no inline completion
    if (InlinePositionAnalyzer.INDENTED_LINE.test(line)) {
      return { type: 'none' };
    }

    // Check for comment lines
    if (InlinePositionAnalyzer.COMMENT_LINE.test(line.trimStart())) {
      return { type: 'none' };
    }

    // Check for directive lines
    if (InlinePositionAnalyzer.DIRECTIVE_LINE.test(line)) {
      return { type: 'none' };
    }

    // Try to match date pattern for payee completion
    const dateMatch = line.match(InlinePositionAnalyzer.DATE_IN_TRANSACTION);
    if (!dateMatch) {
      return { type: 'none' };
    }

    const dateEndPos = dateMatch[0].length;
    const cursorPos = position.character;

    // Cursor must be at or after date end
    if (cursorPos < dateEndPos) {
      return { type: 'none' };
    }

    // Extract payee portion (from date end to cursor)
    const payeePortion = line.substring(dateEndPos, cursorPos);

    // Check for payee prefix (partial match)
    const prefix = payeePortion.trim();

    // Require minimum characters for payee prefix (configurable)
    if (prefix.length < this.minPayeeChars) {
      return { type: 'none' };
    }

    // If prefix exactly matches a known payee and cursor at end of line,
    // return none - template will be offered on next line after Enter
    const isCursorAtEnd = cursorPos >= line.trimEnd().length;
    if (isCursorAtEnd && knownPayees.has(prefix)) {
      return { type: 'none' };
    }

    return {
      type: 'payee',
      prefix,
      payeeStartPos: dateEndPos + payeePortion.indexOf(prefix.charAt(0)),
    };
  }

  /**
   * Checks if we're on an empty line after a transaction header with known payee.
   * Template completion is only offered when cursor is on a NEW line after the header.
   *
   * @param document - The text document
   * @param position - Current cursor position (on empty line)
   * @param knownPayees - Set of known payee names
   * @returns Template context if valid, none otherwise
   */
  private checkTemplateContext(
    document: vscode.TextDocument,
    position: vscode.Position,
    knownPayees: ReadonlySet<string>
  ): InlineContext {
    const prevLine = document.lineAt(position.line - 1).text;

    // Previous line must be a transaction header (date + payee)
    const dateMatch = prevLine.match(InlinePositionAnalyzer.DATE_IN_TRANSACTION);
    if (!dateMatch) {
      return { type: 'none' };
    }

    // Extract and validate payee
    const payee = prevLine.substring(dateMatch[0].length).trim();
    if (!payee || !knownPayees.has(payee)) {
      return { type: 'none' };
    }

    // Check that transaction doesn't already have postings
    // (no indented lines following the header)
    if (!this.isValidTemplateContext(document, position.line - 1)) {
      return { type: 'none' };
    }

    return {
      type: 'template',
      payee: payee as PayeeName,
      insertPosition: position,
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
  private isValidTemplateContext(document: vscode.TextDocument, currentLine: number): boolean {
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
