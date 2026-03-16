import * as vscode from "vscode";
import { enterAndSuggest } from "../enterAndSuggest";

describe("enterAndSuggest", () => {
  let executeCommandMock: jest.Mock;

  beforeEach(() => {
    executeCommandMock = vscode.commands.executeCommand as jest.Mock;
    executeCommandMock.mockClear();
    executeCommandMock.mockResolvedValue(undefined);
  });

  it("executes default Enter then triggers inline suggestion", async () => {
    await enterAndSuggest();

    expect(executeCommandMock).toHaveBeenCalledTimes(2);
    expect(executeCommandMock).toHaveBeenNthCalledWith(1, "type", {
      text: "\n",
    });
    expect(executeCommandMock).toHaveBeenNthCalledWith(
      2,
      "editor.action.inlineSuggest.trigger",
    );
  });

  it("still triggers inline suggestion if type command fails", async () => {
    executeCommandMock.mockImplementation((cmd: string) => {
      if (cmd === "type") return Promise.reject(new Error("type failed"));
      return Promise.resolve(undefined);
    });

    await enterAndSuggest();

    expect(executeCommandMock).toHaveBeenCalledWith(
      "editor.action.inlineSuggest.trigger",
    );
  });
});
