import {
  applySortingHack,
  convertTemplateToSnippet,
  processCompletionList,
  CompletionItem,
  CompletionList,
} from "../completionMiddleware";

describe("applySortingHack", () => {
  it("sets same filterText for all items", () => {
    const items: CompletionItem[] = [
      { label: "Expenses:Food", sortText: "00001" },
      { label: "Expenses:Transport", sortText: "00002" },
    ];

    const result = applySortingHack(items, "Exp");

    expect(result[0]?.filterText).toBe("Exp");
    expect(result[1]?.filterText).toBe("Exp");
  });

  it("preserves sortText", () => {
    const items: CompletionItem[] = [
      { label: "Account1", sortText: "00001" },
      { label: "Account2", sortText: "00002" },
    ];

    const result = applySortingHack(items, "Acc");

    expect(result[0]?.sortText).toBe("00001");
    expect(result[1]?.sortText).toBe("00002");
  });

  it("uses empty string when query is undefined", () => {
    const items: CompletionItem[] = [{ label: "Test" }];

    const result = applySortingHack(items, undefined);

    expect(result[0]?.filterText).toBe("");
  });
});

describe("convertTemplateToSnippet", () => {
  it("converts template with placeholders to snippet", () => {
    const template = `2025-01-01 Test Payee
    Expenses:Food  \${1:$0.00}
    Assets:Bank  \${2}`;

    const result = convertTemplateToSnippet(template);

    expect(result).toContain("${1:");
    expect(result).toContain("${2}");
  });

  it("preserves template without placeholders", () => {
    const template = `2025-01-01 Test Payee
    Expenses:Food  $100.00
    Assets:Bank`;

    const result = convertTemplateToSnippet(template);

    expect(result).toBe(template);
  });

  it("adds final tabstop if not present", () => {
    const template = `2025-01-01 Test Payee
    Expenses:Food  $100.00
    Assets:Bank`;

    const result = convertTemplateToSnippet(template, { addFinalTabstop: true });

    expect(result).toContain("$0");
  });
});

describe("processCompletionList", () => {
  it("returns isIncomplete as true for gopls hack", () => {
    const list: CompletionList = {
      isIncomplete: false,
      items: [{ label: "Test" }],
    };

    const result = processCompletionList(list, "Te");

    expect(result.isIncomplete).toBe(true);
  });

  it("applies sorting hack to all items", () => {
    const list: CompletionList = {
      isIncomplete: false,
      items: [
        { label: "Item1", sortText: "00001" },
        { label: "Item2", sortText: "00002" },
      ],
    };

    const result = processCompletionList(list, "It");

    expect(result.items[0]?.filterText).toBe("It");
    expect(result.items[1]?.filterText).toBe("It");
  });

  it("handles empty items list", () => {
    const list: CompletionList = {
      isIncomplete: false,
      items: [],
    };

    const result = processCompletionList(list, "query");

    expect(result.items).toEqual([]);
    expect(result.isIncomplete).toBe(true);
  });

  it("converts template items to snippets", () => {
    const list: CompletionList = {
      isIncomplete: false,
      items: [
        {
          label: "Test Payee",
          insertText: "2025-01-01 Test Payee\n  Expenses:Food  ${1:$0.00}\n  Assets:Bank",
          insertTextFormat: 2,
        },
      ],
    };

    const result = processCompletionList(list, "Test");

    expect(result.items[0]?.insertTextFormat).toBe(2);
    expect(result.items[0]?.insertText).toContain("${1:");
  });
});
