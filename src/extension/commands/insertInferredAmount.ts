import * as vscode from "vscode";

interface LSPClient {
  sendRequest<R>(method: string, params?: unknown): Promise<R>;
}

interface LSPTextEdit {
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  newText: string;
}

interface LSPCodeAction {
  title?: string;
  kind?: string;
  edit?: {
    changes?: Record<string, LSPTextEdit[]>;
  };
}

/** Kind the Language Server tags the inferred-amount action with. */
const INFERRED_AMOUNT_KIND = "quickfix.hledger.insertInferredAmount";

const DEFAULT_TIMEOUT_MS = 600;

function requestWithTimeout(
  client: LSPClient,
  params: unknown,
  timeoutMs: number,
): Promise<LSPCodeAction[] | null | undefined> {
  return new Promise((resolve) => {
    let resolved = false;

    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(undefined);
      }
    }, timeoutMs);

    client
      .sendRequest<LSPCodeAction[] | null>("textDocument/codeAction", params)
      .then((result) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          resolve(result);
        }
      })
      .catch(() => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          resolve(undefined);
        }
      });
  });
}

/**
 * Writes the amount hledger infers for the posting under the cursor into the
 * document, aligned to the amount column. Silent when there is nothing to
 * infer — it is bound to a key, so a message on every miss would be noise.
 */
export async function insertInferredAmount(
  getClient: () => LSPClient | null,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (editor?.document.languageId !== "hledger") {
    return;
  }

  const client = getClient();
  if (!client) {
    return;
  }

  const { document, selection } = editor;
  const position = selection.active;
  const cursor = { line: position.line, character: position.character };

  const actions = await requestWithTimeout(
    client,
    {
      textDocument: { uri: document.uri.toString() },
      range: { start: cursor, end: cursor },
      context: { diagnostics: [], only: [INFERRED_AMOUNT_KIND] },
    },
    timeoutMs,
  );

  const action = actions?.find((candidate) => candidate.kind === INFERRED_AMOUNT_KIND);
  const changes = action?.edit?.changes;
  // The server keys the edit by the URI it was handed, but normalization on
  // either side can still make the strings differ; the action only ever edits
  // the document it was requested for, so fall back to the single entry.
  const edits =
    changes?.[document.uri.toString()] ?? Object.values(changes ?? {})[0];
  if (!edits || edits.length === 0) {
    return;
  }

  const workspaceEdit = new vscode.WorkspaceEdit();
  for (const edit of edits) {
    workspaceEdit.replace(
      document.uri,
      new vscode.Range(
        edit.range.start.line,
        edit.range.start.character,
        edit.range.end.line,
        edit.range.end.character,
      ),
      edit.newText,
    );
  }

  if (!(await vscode.workspace.applyEdit(workspaceEdit))) {
    return;
  }

  const lastEdit = edits[edits.length - 1];
  if (lastEdit) {
    const line = lastEdit.range.start.line;
    const character = lastEdit.range.start.character + lastEdit.newText.length;
    editor.selection = new vscode.Selection(line, character, line, character);
  }
}
