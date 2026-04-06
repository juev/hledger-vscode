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

const POSTING_STATUS_RE = /^(\s+)([*!]\s+)?/;

export function isTransactionHeader(lineText: string): boolean {
  return TRANSACTION_HEADER_RE.test(lineText);
}

export function isPostingLine(lineText: string): boolean {
  if (lineText.length === 0) return false;
  const firstChar = lineText[0];
  if (firstChar !== " " && firstChar !== "\t") return false;
  // Indented comment lines are not postings
  const trimmed = lineText.trimStart();
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
    const statusMatch = /^([*!])\s+/.exec(restAfterDate);

    if (statusMatch) {
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
    return {
      type: "posting",
      status: statusChar,
      statusStart: indent.length,
      statusEnd: indent.length + statusGroup.length,
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

  const newText = newStatus === "" ? "" : `${newStatus} `;

  return { range: new vscode.Range(start, end), newText };
}

export async function cycleStatus(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== "hledger") return;

  const line = editor.selection.active.line;
  const lineText = editor.document.lineAt(line).text;
  const info = parseLineStatus(lineText);
  if (!info) return;

  const newStatus = nextStatus(info.status);
  const edit = buildStatusEdit(lineText, line, newStatus);
  if (!edit) return;

  await editor.edit((editBuilder) => {
    editBuilder.replace(edit.range, edit.newText);
  });
}

export async function setStatus(
  status: TransactionStatus,
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== "hledger") return;

  const line = editor.selection.active.line;
  const lineText = editor.document.lineAt(line).text;
  const edit = buildStatusEdit(lineText, line, status);
  if (!edit) return;

  await editor.edit((editBuilder) => {
    editBuilder.replace(edit.range, edit.newText);
  });
}
