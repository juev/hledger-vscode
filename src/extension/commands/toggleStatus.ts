import * as vscode from "vscode";

export type TransactionStatus = "" | "!" | "*";

export interface StatusInfo {
  type: "transaction" | "posting";
  status: TransactionStatus;
  /** Character index where status starts (or insertion point if unmarked) */
  statusStart: number;
  /** Character index after status + trailing space (equals statusStart if unmarked) */
  statusEnd: number;
}

// Matches date with optional year: "2024-01-15", "01-15", "04-03", "2024/1/5"
// Also handles optional secondary date after "="
const DATE_PART = "(?:\\d{4}[-/.])?\\d{1,2}[-/.]\\d{1,2}";
const TRANSACTION_HEADER_RE = new RegExp(
  `^(${DATE_PART}(?:=${DATE_PART})?)\\s+`,
);

// A posting's status mark is `*` or `!` followed by a space, and hledger also
// accepts it without one (`*assets:cash` is the account `assets:cash`).
const POSTING_STATUS_RE = /^(\s+)([*!](?:[ \t]+(?=\S)|(?=\S)))?/;

// A transaction header's status mark is `*` or `!` followed by a space, with
// the same no-space tolerance. The captured whitespace is what the text after
// the mark starts with, so a missing space can be added without touching any
// space the author chose to keep.
const HEADER_STATUS_RE = /^([*!])(\s*)/;

export function isTransactionHeader(lineText: string): boolean {
  return TRANSACTION_HEADER_RE.test(lineText);
}

export function isPostingLine(lineText: string): boolean {
  if (lineText.length === 0) return false;
  const firstChar = lineText[0];
  if (firstChar !== " " && firstChar !== "\t") return false;
  const trimmed = lineText.trimStart();
  // An indented line with nothing but whitespace is neither a posting nor a
  // comment: hledger rejects a bare status mark written onto it.
  if (trimmed.length === 0) return false;
  // Indented comment lines are not postings
  if (trimmed.startsWith(";")) return false;
  return true;
}

export function parseLineStatus(lineText: string): StatusInfo | undefined {
  // Try transaction header first
  const headerMatch = TRANSACTION_HEADER_RE.exec(lineText);
  if (headerMatch) {
    // headerMatch[0] includes date + all trailing whitespace (via \s+)
    const afterWhitespace = headerMatch[0].length;

    const restAfterDate = lineText.substring(afterWhitespace);
    const statusMatch = HEADER_STATUS_RE.exec(restAfterDate);

    if (statusMatch) {
      // The range is the mark plus the space it is written with, which is what
      // the replacement text is written over. hledger keeps the mark and the
      // description apart by a space, so a mark written without one is
      // rewritten with one. Any further space is left alone, which keeps a
      // hand-aligned description aligned across a status toggle.
      return {
        type: "transaction",
        status: statusMatch[1] as TransactionStatus,
        statusStart: afterWhitespace,
        statusEnd: afterWhitespace + statusMatch[0].length,
      };
    }

    return {
      type: "transaction",
      status: "",
      statusStart: afterWhitespace,
      statusEnd: afterWhitespace,
    };
  }

  // Try posting line
  if (!isPostingLine(lineText)) return undefined;

  const postingMatch = POSTING_STATUS_RE.exec(lineText);
  if (!postingMatch) return undefined;

  const indent = postingMatch[1]!;
  const statusGroup = postingMatch[2]; // e.g., "* " or "! " or undefined

  if (statusGroup) {
    const statusChar = statusGroup[0] as TransactionStatus;
    // The range covers the mark and the space it is written with, which is what
    // the replacement text is written over. A mark written without a space
    // (`*assets:cash` is the account `assets:cash`) has nothing to rewrite
    // there, so only the mark itself is replaced.
    const hasSeparator = statusGroup.length > 1;
    return {
      type: "posting",
      status: statusChar,
      statusStart: indent.length,
      statusEnd: indent.length + (hasSeparator ? 2 : 1),
    };
  }

  return {
    type: "posting",
    status: "",
    statusStart: indent.length,
    statusEnd: indent.length,
  };
}

export function nextStatus(current: TransactionStatus): TransactionStatus {
  switch (current) {
    case "":
      return "!";
    case "!":
      return "*";
    case "*":
      return "";
  }
}

export function buildStatusEdit(
  lineText: string,
  line: number,
  newStatus: TransactionStatus,
): { range: vscode.Range; newText: string } | undefined {
  const info = parseLineStatus(lineText);
  if (!info) return undefined;

  if (info.status === newStatus) return undefined;

  const start = new vscode.Position(line, info.statusStart);
  const end = new vscode.Position(line, info.statusEnd);

  // A posting status may be written with no space after it, where the mark is
  // part of the account name (`*assets:cash`). Adding a space there would
  // rename the account, so only the mark is rewritten.
  const hasSeparator = info.status === "" || info.statusEnd - info.statusStart > 1;
  const separator = info.type === "posting" && !hasSeparator ? "" : " ";
  const newText = newStatus === "" ? "" : `${newStatus}${separator}`;

  return { range: new vscode.Range(start, end), newText };
}

export async function cycleStatus(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (editor?.document.languageId !== "hledger") return;

  const edits = [...new Set(editor.selections.map((selection) => selection.active.line))]
    .map((line) => {
      const lineText = editor.document.lineAt(line).text;
      const info = parseLineStatus(lineText);
      return info ? buildStatusEdit(lineText, line, nextStatus(info.status)) : undefined;
    })
    .filter((edit): edit is { range: vscode.Range; newText: string } => edit !== undefined);
  if (edits.length === 0) return;

  await editor.edit((editBuilder) => {
    for (const edit of edits) {
      editBuilder.replace(edit.range, edit.newText);
    }
  });
}

export async function setStatus(
  status: TransactionStatus,
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (editor?.document.languageId !== "hledger") return;

  const edits = [...new Set(editor.selections.map((selection) => selection.active.line))]
    .map((line) => buildStatusEdit(editor.document.lineAt(line).text, line, status))
    .filter((edit): edit is { range: vscode.Range; newText: string } => edit !== undefined);
  if (edits.length === 0) return;

  await editor.edit((editBuilder) => {
    for (const edit of edits) {
      editBuilder.replace(edit.range, edit.newText);
    }
  });
}
