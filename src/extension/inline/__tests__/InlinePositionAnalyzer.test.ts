// InlinePositionAnalyzer.test.ts - Tests for inline completion position analysis
import { Position, MockTextDocument } from "../../../__mocks__/vscode";
import {
  InlinePositionAnalyzer,
  InlineContext,
} from "../InlinePositionAnalyzer";
import { PayeeName } from "../../types";

describe("InlinePositionAnalyzer", () => {
  let analyzer: InlinePositionAnalyzer;

  beforeEach(() => {
    analyzer = new InlinePositionAnalyzer();
  });

  describe("payee context detection", () => {
    it("should detect payee context when typing after date (YYYY-MM-DD format)", () => {
      const document = new MockTextDocument(["2024-12-23 Маг"]);
      const position = new Position(0, 14); // After "Маг"
      const knownPayees = new Set<string>(["Магазин"]);

      const result = analyzer.analyzePosition(document, position, knownPayees);

      expect(result.type).toBe("payee");
      if (result.type === "payee") {
        expect(result.prefix).toBe("Маг");
        expect(result.payeeStartPos).toBe(11);
      }
    });

    it("should detect payee context when typing after short date (MM-DD format)", () => {
      const document = new MockTextDocument(["12-23 Маг"]);
      const position = new Position(0, 9);
      const knownPayees = new Set<string>(["Магазин"]);

      const result = analyzer.analyzePosition(document, position, knownPayees);

      expect(result.type).toBe("payee");
      if (result.type === "payee") {
        expect(result.prefix).toBe("Маг");
      }
    });

    it("should detect payee context with status marker (*)", () => {
      const document = new MockTextDocument(["2024-12-23 * Coff"]);
      const position = new Position(0, 17);
      const knownPayees = new Set<string>(["Coffee Shop"]);

      const result = analyzer.analyzePosition(document, position, knownPayees);

      expect(result.type).toBe("payee");
      if (result.type === "payee") {
        expect(result.prefix).toBe("Coff");
      }
    });

    it("should detect payee context with status marker (!)", () => {
      const document = new MockTextDocument(["2024-12-23 ! Coff"]);
      const position = new Position(0, 17);
      const knownPayees = new Set<string>(["Coffee Shop"]);

      const result = analyzer.analyzePosition(document, position, knownPayees);

      expect(result.type).toBe("payee");
      if (result.type === "payee") {
        expect(result.prefix).toBe("Coff");
      }
    });

    it("should require at least 1 character prefix for payee context", () => {
      const document = new MockTextDocument(["2024-12-23 "]);
      const position = new Position(0, 11);
      const knownPayees = new Set<string>(["Coffee Shop"]);

      const result = analyzer.analyzePosition(document, position, knownPayees);

      expect(result.type).toBe("none");
    });

    it("should handle Unicode payee prefixes correctly", () => {
      const document = new MockTextDocument(["2024-12-23 Каф"]);
      const position = new Position(0, 14);
      const knownPayees = new Set<string>(["Кафе"]);

      const result = analyzer.analyzePosition(document, position, knownPayees);

      expect(result.type).toBe("payee");
      if (result.type === "payee") {
        expect(result.prefix).toBe("Каф");
      }
    });

    it("should detect payee with date using slash separator", () => {
      const document = new MockTextDocument(["2024/12/23 Coffee"]);
      const position = new Position(0, 17);
      const knownPayees = new Set<string>(["Coffee Shop"]);

      const result = analyzer.analyzePosition(document, position, knownPayees);

      expect(result.type).toBe("payee");
      if (result.type === "payee") {
        expect(result.prefix).toBe("Coffee");
      }
    });
  });

  describe("template context detection", () => {
    it("should detect template context when complete payee at end of line", () => {
      const document = new MockTextDocument(["2024-12-23 Coffee Shop", ""]);
      const position = new Position(0, 22); // At end of payee
      const knownPayees = new Set<string>(["Coffee Shop"]);

      const result = analyzer.analyzePosition(document, position, knownPayees);

      expect(result.type).toBe("template");
      if (result.type === "template") {
        expect(result.payee).toBe("Coffee Shop");
      }
    });

    it("should detect template context with status marker", () => {
      const document = new MockTextDocument(["2024-12-23 * Coffee Shop", ""]);
      const position = new Position(0, 24);
      const knownPayees = new Set<string>(["Coffee Shop"]);

      const result = analyzer.analyzePosition(document, position, knownPayees);

      expect(result.type).toBe("template");
      if (result.type === "template") {
        expect(result.payee).toBe("Coffee Shop");
      }
    });

    it("should detect template context when next line is empty", () => {
      const document = new MockTextDocument(["2024-12-23 Grocery Store", ""]);
      const position = new Position(0, 24);
      const knownPayees = new Set<string>(["Grocery Store"]);

      const result = analyzer.analyzePosition(document, position, knownPayees);

      expect(result.type).toBe("template");
    });

    it("should detect template context when next line starts new transaction", () => {
      const document = new MockTextDocument([
        "2024-12-23 Coffee Shop",
        "2024-12-24 Another Transaction",
      ]);
      const position = new Position(0, 22);
      const knownPayees = new Set<string>(["Coffee Shop"]);

      const result = analyzer.analyzePosition(document, position, knownPayees);

      expect(result.type).toBe("template");
    });

    it("should detect template context when at last line of document", () => {
      const document = new MockTextDocument(["2024-12-23 Coffee Shop"]);
      const position = new Position(0, 22);
      const knownPayees = new Set<string>(["Coffee Shop"]);

      const result = analyzer.analyzePosition(document, position, knownPayees);

      expect(result.type).toBe("template");
    });

    it("should NOT detect template when payee is not an exact match", () => {
      const document = new MockTextDocument(["2024-12-23 Coffee"]);
      const position = new Position(0, 17);
      const knownPayees = new Set<string>(["Coffee Shop"]);

      const result = analyzer.analyzePosition(document, position, knownPayees);

      // Should be payee context (partial match), not template
      expect(result.type).toBe("payee");
    });

    it("should NOT detect template when next line has postings (indented)", () => {
      const document = new MockTextDocument([
        "2024-12-23 Coffee Shop",
        "    Expenses:Food  5.00",
      ]);
      const position = new Position(0, 22);
      const knownPayees = new Set<string>(["Coffee Shop"]);

      const result = analyzer.analyzePosition(document, position, knownPayees);

      // Should be none - transaction already has postings
      expect(result.type).toBe("none");
    });

    it("should handle Unicode payees for template context", () => {
      const document = new MockTextDocument(["2024-12-23 Магазин", ""]);
      const position = new Position(0, 18);
      const knownPayees = new Set<string>(["Магазин"]);

      const result = analyzer.analyzePosition(document, position, knownPayees);

      expect(result.type).toBe("template");
      if (result.type === "template") {
        expect(result.payee).toBe("Магазин");
      }
    });
  });

  describe("none context", () => {
    it("should return none for indented lines (posting lines)", () => {
      const document = new MockTextDocument([
        "2024-12-23 Coffee Shop",
        "    Expenses:Food",
      ]);
      const position = new Position(1, 17);
      const knownPayees = new Set<string>(["Coffee Shop"]);

      const result = analyzer.analyzePosition(document, position, knownPayees);

      expect(result.type).toBe("none");
    });

    it("should return none for empty lines", () => {
      const document = new MockTextDocument([""]);
      const position = new Position(0, 0);
      const knownPayees = new Set<string>(["Coffee Shop"]);

      const result = analyzer.analyzePosition(document, position, knownPayees);

      expect(result.type).toBe("none");
    });

    it("should return none for comment lines", () => {
      const document = new MockTextDocument(["; This is a comment"]);
      const position = new Position(0, 10);
      const knownPayees = new Set<string>(["Coffee Shop"]);

      const result = analyzer.analyzePosition(document, position, knownPayees);

      expect(result.type).toBe("none");
    });

    it("should return none for directive lines", () => {
      const document = new MockTextDocument(["account Assets:Cash"]);
      const position = new Position(0, 19);
      const knownPayees = new Set<string>(["Assets:Cash"]);

      const result = analyzer.analyzePosition(document, position, knownPayees);

      expect(result.type).toBe("none");
    });

    it("should return none when cursor is before date ends", () => {
      const document = new MockTextDocument(["2024-12"]);
      const position = new Position(0, 7);
      const knownPayees = new Set<string>(["Coffee Shop"]);

      const result = analyzer.analyzePosition(document, position, knownPayees);

      expect(result.type).toBe("none");
    });

    it("should return none when cursor is not at end of line for template", () => {
      const document = new MockTextDocument(["2024-12-23 Coffee Shop extra"]);
      const position = new Position(0, 22); // Not at end of line
      const knownPayees = new Set<string>(["Coffee Shop"]);

      const result = analyzer.analyzePosition(document, position, knownPayees);

      // Cursor not at end of line, so not template context
      // Should still be payee context since we're in payee area
      expect(result.type).toBe("payee");
    });
  });
});
