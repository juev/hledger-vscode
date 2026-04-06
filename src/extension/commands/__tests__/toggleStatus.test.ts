import * as vscode from "vscode";
import {
  isTransactionHeader,
  isPostingLine,
  parseLineStatus,
  nextStatus,
  buildStatusEdit,
  cycleStatus,
  setStatus,
  type TransactionStatus,
  type StatusInfo,
} from "../toggleStatus";

describe("isTransactionHeader", () => {
  it("matches standard date format YYYY-MM-DD", () => {
    expect(isTransactionHeader("2024-01-15 Grocery Store")).toBe(true);
  });

  it("matches date with slashes", () => {
    expect(isTransactionHeader("2024/01/15 Grocery Store")).toBe(true);
  });

  it("matches date with dots", () => {
    expect(isTransactionHeader("2024.01.15 Grocery Store")).toBe(true);
  });

  it("matches date without leading zeros", () => {
    expect(isTransactionHeader("2024-1-5 Grocery Store")).toBe(true);
  });

  it("matches date with pending status", () => {
    expect(isTransactionHeader("2024-01-15 ! Pending")).toBe(true);
  });

  it("matches date with cleared status", () => {
    expect(isTransactionHeader("2024-01-15 * Cleared")).toBe(true);
  });

  it("matches date with secondary date", () => {
    expect(isTransactionHeader("2024-01-15=2024-01-20 Payment")).toBe(true);
  });

  it("matches date with code", () => {
    expect(isTransactionHeader("2024-01-15 * (CHK12345) Payment")).toBe(true);
  });

  it("does not match posting line", () => {
    expect(isTransactionHeader("    assets:checking  $100")).toBe(false);
  });

  it("does not match empty line", () => {
    expect(isTransactionHeader("")).toBe(false);
  });

  it("does not match comment line", () => {
    expect(isTransactionHeader("; This is a comment")).toBe(false);
  });

  it("does not match directive", () => {
    expect(isTransactionHeader("account assets:checking")).toBe(false);
  });

  it("does not match indented line with date-like text", () => {
    expect(isTransactionHeader("  2024-01-15 something")).toBe(false);
  });

  it("matches date without year (MM-DD)", () => {
    expect(isTransactionHeader("04-03 ВкусВилл")).toBe(true);
  });

  it("matches date without year with slashes", () => {
    expect(isTransactionHeader("01/15 Payment")).toBe(true);
  });

  it("matches date without year with status", () => {
    expect(isTransactionHeader("04-03 ! Pending")).toBe(true);
  });

  it("matches date without year with secondary date", () => {
    expect(isTransactionHeader("04-03=04-05 Payment")).toBe(true);
  });
});

describe("isPostingLine", () => {
  it("matches posting with spaces indent", () => {
    expect(isPostingLine("    assets:checking  $100")).toBe(true);
  });

  it("matches posting with tab indent", () => {
    expect(isPostingLine("\tassets:checking  $100")).toBe(true);
  });

  it("matches posting with cleared status", () => {
    expect(isPostingLine("    * assets:checking  $100")).toBe(true);
  });

  it("matches posting with pending status", () => {
    expect(isPostingLine("    ! assets:checking  $100")).toBe(true);
  });

  it("matches virtual posting with parentheses", () => {
    expect(isPostingLine("    (assets:checking)  $100")).toBe(true);
  });

  it("matches virtual posting with brackets", () => {
    expect(isPostingLine("    [assets:checking]  $100")).toBe(true);
  });

  it("matches posting without amount", () => {
    expect(isPostingLine("    assets:checking")).toBe(true);
  });

  it("does not match transaction header", () => {
    expect(isPostingLine("2024-01-15 Grocery")).toBe(false);
  });

  it("does not match empty line", () => {
    expect(isPostingLine("")).toBe(false);
  });

  it("does not match comment-only line without indent", () => {
    expect(isPostingLine("; comment")).toBe(false);
  });

  it("does not match indented comment line", () => {
    expect(isPostingLine("    ; posting comment")).toBe(false);
  });
});

describe("parseLineStatus", () => {
  describe("transaction headers", () => {
    it("parses unmarked transaction", () => {
      const result = parseLineStatus("2024-01-15 Grocery Store");
      expect(result).toEqual<StatusInfo>({
        type: "transaction",
        status: "",
        statusStart: 11,
        statusEnd: 11,
      });
    });

    it("parses pending transaction", () => {
      const result = parseLineStatus("2024-01-15 ! Grocery Store");
      expect(result).toEqual<StatusInfo>({
        type: "transaction",
        status: "!",
        statusStart: 11,
        statusEnd: 13,
      });
    });

    it("parses cleared transaction", () => {
      const result = parseLineStatus("2024-01-15 * Grocery Store");
      expect(result).toEqual<StatusInfo>({
        type: "transaction",
        status: "*",
        statusStart: 11,
        statusEnd: 13,
      });
    });

    it("parses transaction with secondary date", () => {
      const result = parseLineStatus("2024-01-15=2024-01-20 Payment");
      expect(result).toEqual<StatusInfo>({
        type: "transaction",
        status: "",
        statusStart: 22,
        statusEnd: 22,
      });
    });

    it("parses cleared transaction with secondary date", () => {
      const result = parseLineStatus("2024-01-15=2024-01-20 * Payment");
      expect(result).toEqual<StatusInfo>({
        type: "transaction",
        status: "*",
        statusStart: 22,
        statusEnd: 24,
      });
    });

    it("parses transaction with code", () => {
      const result = parseLineStatus("2024-01-15 * (CHK) Payment");
      expect(result).toEqual<StatusInfo>({
        type: "transaction",
        status: "*",
        statusStart: 11,
        statusEnd: 13,
      });
    });

    it("parses date with slashes", () => {
      const result = parseLineStatus("2024/01/15 ! Payment");
      expect(result).toEqual<StatusInfo>({
        type: "transaction",
        status: "!",
        statusStart: 11,
        statusEnd: 13,
      });
    });

    it("parses date without leading zeros", () => {
      const result = parseLineStatus("2024-1-5 Payment");
      expect(result).toEqual<StatusInfo>({
        type: "transaction",
        status: "",
        statusStart: 9,
        statusEnd: 9,
      });
    });

    it("parses date with multiple spaces before description (unmarked)", () => {
      const result = parseLineStatus("2024-01-15   Grocery Store");
      expect(result).toEqual<StatusInfo>({
        type: "transaction",
        status: "",
        statusStart: 13,
        statusEnd: 13,
      });
    });

    it("parses pending status with multiple spaces after date", () => {
      const result = parseLineStatus("2024-01-15  ! Grocery Store");
      expect(result).toEqual<StatusInfo>({
        type: "transaction",
        status: "!",
        statusStart: 12,
        statusEnd: 14,
      });
    });

    it("parses cleared status with multiple spaces after date", () => {
      const result = parseLineStatus("2024-01-15  * Grocery Store");
      expect(result).toEqual<StatusInfo>({
        type: "transaction",
        status: "*",
        statusStart: 12,
        statusEnd: 14,
      });
    });

    it("parses date without year (MM-DD)", () => {
      const result = parseLineStatus("04-03 ВкусВилл");
      expect(result).toEqual<StatusInfo>({
        type: "transaction",
        status: "",
        statusStart: 6,
        statusEnd: 6,
      });
    });

    it("parses date without year with pending status", () => {
      const result = parseLineStatus("04-03 ! ВкусВилл");
      expect(result).toEqual<StatusInfo>({
        type: "transaction",
        status: "!",
        statusStart: 6,
        statusEnd: 8,
      });
    });

    it("parses date without year with cleared status", () => {
      const result = parseLineStatus("04-03 * ВкусВилл");
      expect(result).toEqual<StatusInfo>({
        type: "transaction",
        status: "*",
        statusStart: 6,
        statusEnd: 8,
      });
    });
  });

  describe("posting lines", () => {
    it("parses unmarked posting", () => {
      const result = parseLineStatus("    assets:checking  $100");
      expect(result).toEqual<StatusInfo>({
        type: "posting",
        status: "",
        statusStart: 4,
        statusEnd: 4,
      });
    });

    it("parses cleared posting", () => {
      const result = parseLineStatus("    * assets:checking  $100");
      expect(result).toEqual<StatusInfo>({
        type: "posting",
        status: "*",
        statusStart: 4,
        statusEnd: 6,
      });
    });

    it("parses pending posting", () => {
      const result = parseLineStatus("    ! assets:checking  $100");
      expect(result).toEqual<StatusInfo>({
        type: "posting",
        status: "!",
        statusStart: 4,
        statusEnd: 6,
      });
    });

    it("parses posting with tab indent", () => {
      const result = parseLineStatus("\tassets:checking  $100");
      expect(result).toEqual<StatusInfo>({
        type: "posting",
        status: "",
        statusStart: 1,
        statusEnd: 1,
      });
    });

    it("parses cleared posting with tab indent", () => {
      const result = parseLineStatus("\t* assets:checking  $100");
      expect(result).toEqual<StatusInfo>({
        type: "posting",
        status: "*",
        statusStart: 1,
        statusEnd: 3,
      });
    });

    it("parses virtual posting with parentheses (no status)", () => {
      const result = parseLineStatus("    (assets:checking)  $100");
      expect(result).toEqual<StatusInfo>({
        type: "posting",
        status: "",
        statusStart: 4,
        statusEnd: 4,
      });
    });

    it("parses virtual posting with brackets (no status)", () => {
      const result = parseLineStatus("    [assets:checking]  $100");
      expect(result).toEqual<StatusInfo>({
        type: "posting",
        status: "",
        statusStart: 4,
        statusEnd: 4,
      });
    });
  });

  describe("non-matching lines", () => {
    it("returns undefined for empty line", () => {
      expect(parseLineStatus("")).toBeUndefined();
    });

    it("returns undefined for comment line", () => {
      expect(parseLineStatus("; comment")).toBeUndefined();
    });

    it("returns undefined for directive", () => {
      expect(parseLineStatus("account assets:checking")).toBeUndefined();
    });

    it("returns undefined for indented comment", () => {
      expect(parseLineStatus("    ; posting comment")).toBeUndefined();
    });
  });
});

describe("nextStatus", () => {
  it("cycles unmarked to pending", () => {
    expect(nextStatus("")).toBe("!");
  });

  it("cycles pending to cleared", () => {
    expect(nextStatus("!")).toBe("*");
  });

  it("cycles cleared to unmarked", () => {
    expect(nextStatus("*")).toBe("");
  });
});

describe("buildStatusEdit", () => {
  describe("transaction headers", () => {
    it("unmarked → pending: inserts '! ' after date", () => {
      const edit = buildStatusEdit("2024-01-15 Grocery Store", 0, "!");
      expect(edit).toBeDefined();
      expect(edit!.range).toEqual(new vscode.Range(0, 11, 0, 11));
      expect(edit!.newText).toBe("! ");
    });

    it("unmarked → cleared: inserts '* ' after date", () => {
      const edit = buildStatusEdit("2024-01-15 Grocery Store", 0, "*");
      expect(edit).toBeDefined();
      expect(edit!.range).toEqual(new vscode.Range(0, 11, 0, 11));
      expect(edit!.newText).toBe("* ");
    });

    it("pending → cleared: replaces '! ' with '* '", () => {
      const edit = buildStatusEdit("2024-01-15 ! Grocery Store", 0, "*");
      expect(edit).toBeDefined();
      expect(edit!.range).toEqual(new vscode.Range(0, 11, 0, 13));
      expect(edit!.newText).toBe("* ");
    });

    it("cleared → pending: replaces '* ' with '! '", () => {
      const edit = buildStatusEdit("2024-01-15 * Grocery Store", 0, "!");
      expect(edit).toBeDefined();
      expect(edit!.range).toEqual(new vscode.Range(0, 11, 0, 13));
      expect(edit!.newText).toBe("! ");
    });

    it("pending → unmarked: removes '! '", () => {
      const edit = buildStatusEdit("2024-01-15 ! Grocery Store", 0, "");
      expect(edit).toBeDefined();
      expect(edit!.range).toEqual(new vscode.Range(0, 11, 0, 13));
      expect(edit!.newText).toBe("");
    });

    it("cleared → unmarked: removes '* '", () => {
      const edit = buildStatusEdit("2024-01-15 * Grocery Store", 0, "");
      expect(edit).toBeDefined();
      expect(edit!.range).toEqual(new vscode.Range(0, 11, 0, 13));
      expect(edit!.newText).toBe("");
    });

    it("returns undefined when status unchanged", () => {
      const edit = buildStatusEdit("2024-01-15 * Grocery Store", 0, "*");
      expect(edit).toBeUndefined();
    });

    it("handles secondary date", () => {
      const edit = buildStatusEdit("2024-01-15=2024-01-20 Payment", 5, "!");
      expect(edit).toBeDefined();
      expect(edit!.range).toEqual(new vscode.Range(5, 22, 5, 22));
      expect(edit!.newText).toBe("! ");
    });

    it("handles transaction with code", () => {
      const edit = buildStatusEdit("2024-01-15 * (CHK) Payment", 2, "!");
      expect(edit).toBeDefined();
      expect(edit!.range).toEqual(new vscode.Range(2, 11, 2, 13));
      expect(edit!.newText).toBe("! ");
    });

    it("uses correct line number", () => {
      const edit = buildStatusEdit("2024-01-15 Grocery", 42, "!");
      expect(edit).toBeDefined();
      expect(edit!.range.start.line).toBe(42);
      expect(edit!.range.end.line).toBe(42);
    });
  });

  describe("posting lines", () => {
    it("unmarked → pending: inserts '! ' after indent", () => {
      const edit = buildStatusEdit("    assets:checking  $100", 1, "!");
      expect(edit).toBeDefined();
      expect(edit!.range).toEqual(new vscode.Range(1, 4, 1, 4));
      expect(edit!.newText).toBe("! ");
    });

    it("unmarked → cleared: inserts '* ' after indent", () => {
      const edit = buildStatusEdit("    assets:checking  $100", 1, "*");
      expect(edit).toBeDefined();
      expect(edit!.range).toEqual(new vscode.Range(1, 4, 1, 4));
      expect(edit!.newText).toBe("* ");
    });

    it("cleared → pending: replaces '* ' with '! '", () => {
      const edit = buildStatusEdit("    * assets:checking  $100", 1, "!");
      expect(edit).toBeDefined();
      expect(edit!.range).toEqual(new vscode.Range(1, 4, 1, 6));
      expect(edit!.newText).toBe("! ");
    });

    it("pending → cleared: replaces '! ' with '* '", () => {
      const edit = buildStatusEdit("    ! assets:checking  $100", 1, "*");
      expect(edit).toBeDefined();
      expect(edit!.range).toEqual(new vscode.Range(1, 4, 1, 6));
      expect(edit!.newText).toBe("* ");
    });

    it("cleared → unmarked: removes '* '", () => {
      const edit = buildStatusEdit("    * assets:checking  $100", 1, "");
      expect(edit).toBeDefined();
      expect(edit!.range).toEqual(new vscode.Range(1, 4, 1, 6));
      expect(edit!.newText).toBe("");
    });

    it("pending → unmarked: removes '! '", () => {
      const edit = buildStatusEdit("    ! assets:checking  $100", 1, "");
      expect(edit).toBeDefined();
      expect(edit!.range).toEqual(new vscode.Range(1, 4, 1, 6));
      expect(edit!.newText).toBe("");
    });

    it("handles tab indent", () => {
      const edit = buildStatusEdit("\tassets:checking  $100", 3, "*");
      expect(edit).toBeDefined();
      expect(edit!.range).toEqual(new vscode.Range(3, 1, 3, 1));
      expect(edit!.newText).toBe("* ");
    });
  });

  describe("non-matching lines", () => {
    it("returns undefined for empty line", () => {
      expect(buildStatusEdit("", 0, "!")).toBeUndefined();
    });

    it("returns undefined for comment line", () => {
      expect(buildStatusEdit("; comment", 0, "!")).toBeUndefined();
    });

    it("returns undefined for directive", () => {
      expect(buildStatusEdit("account assets:checking", 0, "!")).toBeUndefined();
    });
  });
});

describe("cycleStatus", () => {
  let editMock: jest.Mock;

  function setupEditor(lineText: string, line: number = 0): void {
    editMock = jest.fn().mockImplementation(
      (callback: (builder: { replace: jest.Mock }) => void) => {
        const builder = { replace: jest.fn() };
        callback(builder);
        return Promise.resolve(true);
      },
    );

    (vscode.window as any).activeTextEditor = {
      document: {
        languageId: "hledger",
        lineAt: jest.fn().mockReturnValue({ text: lineText }),
      },
      selection: {
        active: new vscode.Position(line, 0),
      },
      edit: editMock,
    };
  }

  beforeEach(() => {
    (vscode.window as any).activeTextEditor = undefined;
  });

  it("does nothing when no active editor", async () => {
    await cycleStatus();
    // No error thrown
  });

  it("does nothing for non-hledger files", async () => {
    (vscode.window as any).activeTextEditor = {
      document: { languageId: "plaintext" },
      selection: { active: new vscode.Position(0, 0) },
    };
    await cycleStatus();
    // No error thrown
  });

  it("does nothing on empty line", async () => {
    setupEditor("");
    await cycleStatus();
    expect(editMock).not.toHaveBeenCalled();
  });

  it("does nothing on comment line", async () => {
    setupEditor("; comment");
    await cycleStatus();
    expect(editMock).not.toHaveBeenCalled();
  });

  it("cycles unmarked transaction to pending", async () => {
    setupEditor("2024-01-15 Grocery Store");
    await cycleStatus();
    expect(editMock).toHaveBeenCalledTimes(1);
    const builder = { replace: jest.fn() };
    editMock.mock.calls[0][0](builder);
    expect(builder.replace).toHaveBeenCalledWith(
      new vscode.Range(0, 11, 0, 11),
      "! ",
    );
  });

  it("cycles pending transaction to cleared", async () => {
    setupEditor("2024-01-15 ! Grocery Store");
    await cycleStatus();
    expect(editMock).toHaveBeenCalledTimes(1);
    const builder = { replace: jest.fn() };
    editMock.mock.calls[0][0](builder);
    expect(builder.replace).toHaveBeenCalledWith(
      new vscode.Range(0, 11, 0, 13),
      "* ",
    );
  });

  it("cycles cleared transaction to unmarked", async () => {
    setupEditor("2024-01-15 * Grocery Store");
    await cycleStatus();
    expect(editMock).toHaveBeenCalledTimes(1);
    const builder = { replace: jest.fn() };
    editMock.mock.calls[0][0](builder);
    expect(builder.replace).toHaveBeenCalledWith(
      new vscode.Range(0, 11, 0, 13),
      "",
    );
  });

  it("cycles unmarked posting to pending", async () => {
    setupEditor("    assets:checking  $100", 1);
    await cycleStatus();
    expect(editMock).toHaveBeenCalledTimes(1);
    const builder = { replace: jest.fn() };
    editMock.mock.calls[0][0](builder);
    expect(builder.replace).toHaveBeenCalledWith(
      new vscode.Range(1, 4, 1, 4),
      "! ",
    );
  });

  it("cycles cleared posting to unmarked", async () => {
    setupEditor("    * assets:checking  $100", 2);
    await cycleStatus();
    expect(editMock).toHaveBeenCalledTimes(1);
    const builder = { replace: jest.fn() };
    editMock.mock.calls[0][0](builder);
    expect(builder.replace).toHaveBeenCalledWith(
      new vscode.Range(2, 4, 2, 6),
      "",
    );
  });
});

describe("setStatus", () => {
  let editMock: jest.Mock;

  function setupEditor(lineText: string, line: number = 0): void {
    editMock = jest.fn().mockImplementation(
      (callback: (builder: { replace: jest.Mock }) => void) => {
        const builder = { replace: jest.fn() };
        callback(builder);
        return Promise.resolve(true);
      },
    );

    (vscode.window as any).activeTextEditor = {
      document: {
        languageId: "hledger",
        lineAt: jest.fn().mockReturnValue({ text: lineText }),
      },
      selection: {
        active: new vscode.Position(line, 0),
      },
      edit: editMock,
    };
  }

  beforeEach(() => {
    (vscode.window as any).activeTextEditor = undefined;
  });

  it("does nothing when no active editor", async () => {
    await setStatus("*");
    // No error thrown
  });

  it("does nothing for non-hledger files", async () => {
    (vscode.window as any).activeTextEditor = {
      document: { languageId: "plaintext" },
      selection: { active: new vscode.Position(0, 0) },
    };
    await setStatus("*");
    // No error thrown
  });

  it("sets unmarked transaction to cleared", async () => {
    setupEditor("2024-01-15 Grocery Store");
    await setStatus("*");
    expect(editMock).toHaveBeenCalledTimes(1);
    const builder = { replace: jest.fn() };
    editMock.mock.calls[0][0](builder);
    expect(builder.replace).toHaveBeenCalledWith(
      new vscode.Range(0, 11, 0, 11),
      "* ",
    );
  });

  it("sets cleared transaction to unmarked", async () => {
    setupEditor("2024-01-15 * Grocery Store");
    await setStatus("");
    expect(editMock).toHaveBeenCalledTimes(1);
    const builder = { replace: jest.fn() };
    editMock.mock.calls[0][0](builder);
    expect(builder.replace).toHaveBeenCalledWith(
      new vscode.Range(0, 11, 0, 13),
      "",
    );
  });

  it("does nothing when status already matches", async () => {
    setupEditor("2024-01-15 * Grocery Store");
    await setStatus("*");
    expect(editMock).not.toHaveBeenCalled();
  });

  it("sets posting status", async () => {
    setupEditor("    assets:checking  $100", 1);
    await setStatus("*");
    expect(editMock).toHaveBeenCalledTimes(1);
    const builder = { replace: jest.fn() };
    editMock.mock.calls[0][0](builder);
    expect(builder.replace).toHaveBeenCalledWith(
      new vscode.Range(1, 4, 1, 4),
      "* ",
    );
  });

  it("does nothing on empty line", async () => {
    setupEditor("");
    await setStatus("!");
    expect(editMock).not.toHaveBeenCalled();
  });
});
