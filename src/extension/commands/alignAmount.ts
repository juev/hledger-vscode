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

const DEFAULT_TIMEOUT_MS = 3000;

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
  if (!editor || editor.document.languageId !== "hledger") {
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

  if (edits && edits.length > 0) {
    const workspaceEdit = new vscode.WorkspaceEdit();
    for (const edit of edits) {
      workspaceEdit.replace(
        document.uri as unknown as vscode.Uri,
        new vscode.Range(
          edit.range.start.line,
          edit.range.start.character,
          edit.range.end.line,
          edit.range.end.character,
        ),
        edit.newText,
      );
    }
    await vscode.workspace.applyEdit(workspaceEdit);
  } else {
    await fallbackTab();
  }
}
