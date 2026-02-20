import * as fs from "fs";
import * as path from "path";
import { Registry, INITIAL, IGrammar, StateStack } from "vscode-textmate";
import { loadWASM, OnigScanner, OnigString } from "vscode-oniguruma";

const grammarPath = path.resolve(
  __dirname,
  "../../../syntaxes/hledger-rules.tmLanguage.json"
);

describe("hledger-rules grammar tokenization", () => {
  let grammar: IGrammar;

  beforeAll(async () => {
    const wasmBin = fs.readFileSync(
      path.join(
        __dirname,
        "../../../node_modules/vscode-oniguruma/release/onig.wasm"
      )
    ).buffer;
    await loadWASM(wasmBin);

    const registry = new Registry({
      onigLib: Promise.resolve({
        createOnigScanner: (sources: string[]) => new OnigScanner(sources),
        createOnigString: (str: string) => new OnigString(str),
      }),
      loadGrammar: async (scopeName: string) => {
        if (scopeName === "source.hledger-rules") {
          return JSON.parse(fs.readFileSync(grammarPath, "utf-8"));
        }
        return null;
      },
    });

    const loaded = await registry.loadGrammar("source.hledger-rules");
    if (!loaded) throw new Error("Failed to load hledger-rules grammar");
    grammar = loaded;
  }, 15000);

  function scopesAt(line: string, charIndex: number): string[] {
    const { tokens } = grammar.tokenizeLine(line, INITIAL);
    for (const token of tokens) {
      if (token.startIndex <= charIndex && charIndex < token.endIndex) {
        return token.scopes;
      }
    }
    return [];
  }

  function tokenizeLines(lines: string[]): Array<{ text: string; scopes: string[] }[]> {
    let state: StateStack = INITIAL;
    return lines.map((line) => {
      const { tokens, ruleStack } = grammar.tokenizeLine(line, state);
      state = ruleStack;
      return tokens.map((token) => ({
        text: line.substring(token.startIndex, token.endIndex),
        scopes: token.scopes,
      }));
    });
  }

  describe("comments", () => {
    it("# comment gets comment.line scope", () => {
      const scopes = scopesAt("# this is a comment", 0);
      expect(scopes.some((s) => s.startsWith("comment.line"))).toBe(true);
    });

    it("; comment gets comment.line scope", () => {
      const scopes = scopesAt("; semicolon comment", 0);
      expect(scopes.some((s) => s.startsWith("comment.line"))).toBe(true);
    });

    it("* comment gets comment.line scope", () => {
      const scopes = scopesAt("* asterisk comment", 0);
      expect(scopes.some((s) => s.startsWith("comment.line"))).toBe(true);
    });
  });

  describe("directives", () => {
    it("skip gets keyword.control.directive scope", () => {
      const scopes = scopesAt("skip 2", 0);
      expect(scopes.some((s) => s.includes("keyword.control.directive"))).toBe(true);
    });

    it("fields gets keyword.control.directive scope", () => {
      const scopes = scopesAt("fields date, description, amount", 0);
      expect(scopes.some((s) => s.includes("keyword.control.directive"))).toBe(true);
    });

    it("newest-first gets keyword.control.directive scope", () => {
      const scopes = scopesAt("newest-first", 0);
      expect(scopes.some((s) => s.includes("keyword.control.directive"))).toBe(true);
    });

    it("latest-first gets keyword.control.directive scope", () => {
      const scopes = scopesAt("latest-first", 0);
      expect(scopes.some((s) => s.includes("keyword.control.directive"))).toBe(true);
    });

    it("fields directive value gets string.unquoted.value scope", () => {
      const line = "fields date, description, amount";
      const { tokens } = grammar.tokenizeLine(line, INITIAL);
      const valueToken = tokens.find((t) =>
        line.substring(t.startIndex, t.endIndex).includes("date, description, amount")
      );
      expect(valueToken).toBeDefined();
      expect(valueToken!.scopes.some((s) => s.includes("string.unquoted.value"))).toBe(true);
    });

    it("date-format directive value gets string.unquoted.value scope", () => {
      const line = "date-format %Y-%m-%d";
      const { tokens } = grammar.tokenizeLine(line, INITIAL);
      const valueToken = tokens.find((t) =>
        line.substring(t.startIndex, t.endIndex).includes("%Y-%m-%d")
      );
      expect(valueToken).toBeDefined();
      expect(valueToken!.scopes.some((s) => s.includes("string.unquoted.value"))).toBe(true);
    });

    it("skip directive value gets string.unquoted.value scope", () => {
      const line = "skip 2";
      const { tokens } = grammar.tokenizeLine(line, INITIAL);
      const valueToken = tokens.find((t) =>
        line.substring(t.startIndex, t.endIndex).includes("2")
      );
      expect(valueToken).toBeDefined();
      expect(valueToken!.scopes.some((s) => s.includes("string.unquoted.value"))).toBe(true);
    });

    it("separator directive value gets string.unquoted.value scope", () => {
      const line = "separator TAB";
      const { tokens } = grammar.tokenizeLine(line, INITIAL);
      const valueToken = tokens.find((t) =>
        line.substring(t.startIndex, t.endIndex).includes("TAB")
      );
      expect(valueToken).toBeDefined();
      expect(valueToken!.scopes.some((s) => s.includes("string.unquoted.value"))).toBe(true);
    });

    it("include directive value gets string.unquoted.value scope", () => {
      const line = "include common.rules";
      const { tokens } = grammar.tokenizeLine(line, INITIAL);
      const valueToken = tokens.find((t) =>
        line.substring(t.startIndex, t.endIndex).includes("common.rules")
      );
      expect(valueToken).toBeDefined();
      expect(valueToken!.scopes.some((s) => s.includes("string.unquoted.value"))).toBe(true);
    });

    it("newest-first boolean directive emits no value token", () => {
      const line = "newest-first";
      const { tokens } = grammar.tokenizeLine(line, INITIAL);
      const valueToken = tokens.find((t) =>
        t.scopes.some((s) => s.includes("string.unquoted.value"))
      );
      expect(valueToken).toBeUndefined();
    });
  });

  describe("if/end keywords", () => {
    it("if keyword gets keyword.control.if scope", () => {
      const scopes = scopesAt("if Groceries", 0);
      expect(scopes.some((s) => s.includes("keyword.control.if"))).toBe(true);
    });

    it("end keyword gets keyword.control.end scope", () => {
      const result = tokenizeLines(["if Groceries", "  account1 Expenses:Food", "end"]);
      const endLineTokens = result[2]!;
      const endToken = endLineTokens.find((t) => t.text.trim() === "end");
      expect(endToken).toBeDefined();
      expect(endToken!.scopes.some((s) => s.includes("keyword.control.end"))).toBe(true);
    });

    it("regex on if line gets string.regexp scope", () => {
      const line = "if Groceries";
      const { tokens } = grammar.tokenizeLine(line, INITIAL);
      const patternToken = tokens.find((t) =>
        line.substring(t.startIndex, t.endIndex).includes("Groceries")
      );
      expect(patternToken).toBeDefined();
      expect(patternToken!.scopes.some((s) => s.includes("string.regexp"))).toBe(true);
    });
  });

  describe("if-block regex condition lines", () => {
    it("multi-line condition in if-block gets string.regexp scope", () => {
      const result = tokenizeLines([
        "if",
        "GROCERY_STORE",
        "  account1 Expenses:Food",
        "end",
      ]);
      const conditionTokens = result[1]!;
      const mainToken = conditionTokens.find((t) => t.text.includes("GROCERY_STORE"));
      expect(mainToken).toBeDefined();
      expect(mainToken!.scopes.some((s) => s.includes("string.regexp"))).toBe(true);
    });

    it("field assignment inside if-block gets field-assignment scopes", () => {
      const result = tokenizeLines([
        "if",
        "GROCERY",
        "  account1 Expenses:Food",
        "end",
      ]);
      const fieldTokens = result[2]!;
      const fieldName = fieldTokens.find((t) => t.text.trim() === "account1");
      expect(fieldName).toBeDefined();
      expect(fieldName!.scopes.some((s) => s.includes("variable.parameter.field"))).toBe(true);
    });
  });

  describe("field assignments", () => {
    it("account1 field name gets variable.parameter.field scope", () => {
      const { tokens } = grammar.tokenizeLine("account1 Expenses:Food", INITIAL);
      const fieldToken = tokens.find((t) =>
        t.scopes.some((s) => s.includes("variable.parameter.field"))
      );
      expect(fieldToken).toBeDefined();
    });

    it("field value gets string.unquoted.value scope", () => {
      const { tokens } = grammar.tokenizeLine("account1 Expenses:Food", INITIAL);
      const valueToken = tokens.find((t) =>
        t.scopes.some((s) => s.includes("string.unquoted.value"))
      );
      expect(valueToken).toBeDefined();
    });

    it("indented field assignment inside if-block gets proper scopes", () => {
      const result = tokenizeLines([
        "if PATTERN",
        "  account1 Expenses:Food",
        "end",
      ]);
      const fieldTokens = result[1]!;
      const fieldName = fieldTokens.find((t) => t.text.trim() === "account1");
      expect(fieldName).toBeDefined();
      expect(fieldName!.scopes.some((s) => s.includes("variable.parameter.field"))).toBe(true);
    });
  });
});
