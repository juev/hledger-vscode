import * as vscode from "vscode";
import { registerFeatureRestartPrompt } from "../featureRestartPrompt";

type ConfigurationListener = (
  event: vscode.ConfigurationChangeEvent,
) => unknown;

function captureListener(): ConfigurationListener {
  const mock = vscode.workspace.onDidChangeConfiguration as unknown as jest.Mock;
  const listener = mock.mock.calls[mock.mock.calls.length - 1]?.[0];
  expect(listener).toBeDefined();
  return listener as ConfigurationListener;
}

function changeEvent(changed: string): vscode.ConfigurationChangeEvent {
  return {
    affectsConfiguration: (section: string) => section === changed,
  } as vscode.ConfigurationChangeEvent;
}

describe("registerFeatureRestartPrompt", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("offers a restart when a feature toggle changes", async () => {
    (vscode.window.showInformationMessage as unknown as jest.Mock).mockResolvedValue(
      "Restart Server",
    );

    registerFeatureRestartPrompt();
    await captureListener()(changeEvent("hledger.features"));

    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining("Restart the Language Server"),
      "Restart Server",
    );
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
      "hledger.lsp.restart",
    );
  });

  it("leaves the server alone when the prompt is dismissed", async () => {
    (vscode.window.showInformationMessage as unknown as jest.Mock).mockResolvedValue(
      undefined,
    );

    registerFeatureRestartPrompt();
    await captureListener()(changeEvent("hledger.features"));

    expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
  });

  it("ignores settings that reach the server without a restart", async () => {
    registerFeatureRestartPrompt();
    await captureListener()(changeEvent("hledger.inlayHints"));

    expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
    expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
  });

  it("returns a disposable listener", () => {
    const disposable = registerFeatureRestartPrompt();

    expect(typeof disposable.dispose).toBe("function");
  });
});
