import * as fs from "fs";
import * as path from "path";

const grammarPath = path.resolve(__dirname, "../../../syntaxes/hledger-rules.tmLanguage.json");

describe("hledger-rules TextMate grammar", () => {
  it("grammar file exists", () => {
    expect(fs.existsSync(grammarPath)).toBe(true);
  });

  it("grammar has correct scopeName", () => {
    const grammar = JSON.parse(fs.readFileSync(grammarPath, "utf-8")) as {
      scopeName: string;
    };
    expect(grammar.scopeName).toBe("source.hledger-rules");
  });

  it("grammar has patterns array", () => {
    const grammar = JSON.parse(fs.readFileSync(grammarPath, "utf-8")) as {
      patterns: unknown[];
    };
    expect(Array.isArray(grammar.patterns)).toBe(true);
    expect(grammar.patterns.length).toBeGreaterThan(0);
  });

  describe("comment patterns", () => {
    it("grammar repository has comment rule", () => {
      const grammar = JSON.parse(fs.readFileSync(grammarPath, "utf-8")) as {
        repository: Record<string, unknown>;
      };
      expect(grammar.repository).toBeDefined();
      expect(grammar.repository["comment"]).toBeDefined();
    });

    it("comment rule matches # line comments", () => {
      const grammar = JSON.parse(fs.readFileSync(grammarPath, "utf-8")) as {
        repository: {
          comment: { patterns: Array<{ match: string; name: string }> };
        };
      };
      const commentRule = grammar.repository["comment"] as {
        patterns: Array<{ match: string; name: string }>;
      };
      const patterns = commentRule.patterns;
      const hashPattern = patterns.find(
        (p) => p.match && new RegExp(p.match).test("# this is a comment")
      );
      expect(hashPattern).toBeDefined();
      expect(hashPattern?.name).toMatch(/comment/);
    });
  });

  describe("directive patterns", () => {
    it("grammar repository has directive rule", () => {
      const grammar = JSON.parse(fs.readFileSync(grammarPath, "utf-8")) as {
        repository: Record<string, unknown>;
      };
      expect(grammar.repository["directive"]).toBeDefined();
    });

    it("directive rule matches skip, fields, separator directives", () => {
      const grammar = JSON.parse(fs.readFileSync(grammarPath, "utf-8")) as {
        repository: {
          directive: { match: string; name: string };
        };
      };
      const directiveRule = grammar.repository["directive"] as {
        match: string;
        name: string;
      };
      const re = new RegExp(directiveRule.match);
      expect(re.test("skip 2")).toBe(true);
      expect(re.test("fields date, description, amount")).toBe(true);
      expect(re.test("separator ,")).toBe(true);
    });
  });

  describe("if/end keyword patterns", () => {
    it("grammar repository has if-block rule", () => {
      const grammar = JSON.parse(fs.readFileSync(grammarPath, "utf-8")) as {
        repository: Record<string, unknown>;
      };
      expect(grammar.repository["if-block"]).toBeDefined();
    });
  });

  describe("field assignment patterns", () => {
    it("grammar repository has field-assignment rule", () => {
      const grammar = JSON.parse(fs.readFileSync(grammarPath, "utf-8")) as {
        repository: Record<string, unknown>;
      };
      expect(grammar.repository["field-assignment"]).toBeDefined();
    });

    it("field-assignment rule matches account1 and amount assignments", () => {
      const grammar = JSON.parse(fs.readFileSync(grammarPath, "utf-8")) as {
        repository: {
          "field-assignment": { match: string; name?: string; captures?: unknown };
        };
      };
      const rule = grammar.repository["field-assignment"] as { match: string };
      const re = new RegExp(rule.match);
      expect(re.test("account1 Expenses:Food")).toBe(true);
      expect(re.test("amount %4")).toBe(true);
      expect(re.test("description %payee")).toBe(true);
    });
  });
});
