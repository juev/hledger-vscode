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

const DEFAULT_TIMEOUT_MS = 600;

async function fallbackTab(): Promise<void> {
  await vscode.commands.executeCommand("tab");
}

function requestWithTimeout(
  client: LSPClient,
  params: unknown,
  timeoutMs: number,
): Promise<LSPTextEdit[] | null | undefined> {
  return new Promise((resolve) => {
    let resolved = false;

    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(undefined);
      }
    }, timeoutMs);

    client
      .sendRequest<LSPTextEdit[] | null>(
        "textDocument/onTypeFormatting",
        params,
      )
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

export async function alignAmount(
  getClient: () => LSPClient | null,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (editor?.document.languageId !== "hledger") {
    await fallbackTab();
    return;
  }

  const client = getClient();
  if (!client) {
    await fallbackTab();
    return;
  }

  const { document, selection } = editor;
  const position = selection.active;
  // The alignment range is computed by the server against the document as it
  // is now; anything typed while the request is in flight shifts it.
  const documentVersion = document.version;

  const config = vscode.workspace.getConfiguration("editor");
  const tabSize = config.get<number>("tabSize", 4);
  const insertSpaces = config.get<boolean>("insertSpaces", true);

  const edits = await requestWithTimeout(
    client,
    {
      textDocument: { uri: document.uri.toString() },
      position: { line: position.line, character: position.character },
      ch: "\t",
      options: { tabSize, insertSpaces },
    },
    timeoutMs,
  );

  if (document.version !== documentVersion || editor !== vscode.window.activeTextEditor) {
    // The document moved on: the server's ranges no longer describe it.
    return;
  }

  if (edits && edits.length > 0) {
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
      // The edit was refused (read-only document, for example); fall back so
      // Tab still does something instead of disappearing.
      await fallbackTab();
    }
  } else {
    await fallbackTab();
  }
}
