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
    // Template context is now detected on EMPTY line after transaction header
    // This prevents template from being auto-accepted with payee completion

    it("should detect template context on empty line after transaction header", () => {
      const document = new MockTextDocument(["2024-12-23 Coffee Shop", ""]);
      const position = new Position(1, 0); // On empty line after header
      const knownPayees = new Set<string>(["Coffee Shop"]);

      const result = analyzer.analyzePosition(document, position, knownPayees);

      expect(result.type).toBe("template");
      if (result.type === "template") {
        expect(result.payee).toBe("Coffee Shop");
      }
    });

    it("should detect template context on empty line with status marker in header", () => {
      const document = new MockTextDocument(["2024-12-23 * Coffee Shop", ""]);
      const position = new Position(1, 0); // On empty line after header
      const knownPayees = new Set<string>(["Coffee Shop"]);

      const result = analyzer.analyzePosition(document, position, knownPayees);

      expect(result.type).toBe("template");
      if (result.type === "template") {
        expect(result.payee).toBe("Coffee Shop");
      }
    });

    it("should detect template context when previous line has known payee", () => {
      const document = new MockTextDocument(["2024-12-23 Grocery Store", ""]);
      const position = new Position(1, 0);
      const knownPayees = new Set<string>(["Grocery Store"]);

      const result = analyzer.analyzePosition(document, position, knownPayees);

      expect(result.type).toBe("template");
    });

    it("should NOT detect template when cursor is on same line as payee", () => {
      // This is the key fix: template should NOT trigger on same line as payee
      const document = new MockTextDocument(["2024-12-23 Coffee Shop", ""]);
      const position = new Position(0, 22); // On same line as payee
      const knownPayees = new Set<string>(["Coffee Shop"]);

      const result = analyzer.analyzePosition(document, position, knownPayees);

      // Should be none (not template, not payee - cursor at end of exact match)
      expect(result.type).toBe("none");
    });

    it("should NOT detect template when payee is not an exact match", () => {
      const document = new MockTextDocument(["2024-12-23 Coffee", ""]);
      const position = new Position(1, 0); // On empty line
      const knownPayees = new Set<string>(["Coffee Shop"]);

      const result = analyzer.analyzePosition(document, position, knownPayees);

      // Payee "Coffee" is not in knownPayees
      expect(result.type).toBe("none");
    });

    it("should NOT detect template when transaction already has postings", () => {
      const document = new MockTextDocument([
        "2024-12-23 Coffee Shop",
        "    Expenses:Food  5.00",
        "",
      ]);
      const position = new Position(2, 0); // On empty line after postings
      const knownPayees = new Set<string>(["Coffee Shop"]);

      const result = analyzer.analyzePosition(document, position, knownPayees);

      // Previous line is posting, not header
      expect(result.type).toBe("none");
    });

    it("should handle Unicode payees for template context", () => {
      const document = new MockTextDocument(["2024-12-23 Магазин", ""]);
      const position = new Position(1, 0); // On empty line after header
      const knownPayees = new Set<string>(["Магазин"]);

      const result = analyzer.analyzePosition(document, position, knownPayees);

      expect(result.type).toBe("template");
      if (result.type === "template") {
        expect(result.payee).toBe("Магазин");
      }
    });

    it("should NOT detect template on first line of document", () => {
      const document = new MockTextDocument([""]);
      const position = new Position(0, 0);
      const knownPayees = new Set<string>(["Coffee Shop"]);

      const result = analyzer.analyzePosition(document, position, knownPayees);

      // No previous line to check for header
      expect(result.type).toBe("none");
    });

    it("should NOT detect template when previous line is not a transaction header", () => {
      const document = new MockTextDocument(["; comment line", ""]);
      const position = new Position(1, 0);
      const knownPayees = new Set<string>(["Coffee Shop"]);

      const result = analyzer.analyzePosition(document, position, knownPayees);

      expect(result.type).toBe("none");
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

    it("should return none for empty lines without preceding transaction header", () => {
      const document = new MockTextDocument([""]);
      const position = new Position(0, 0);
      const knownPayees = new Set<string>(["Coffee Shop"]);

      const result = analyzer.analyzePosition(document, position, knownPayees);

      // First line is empty, no previous line to check
      expect(result.type).toBe("none");
    });

    it("should return none for empty line after non-transaction line", () => {
      const document = new MockTextDocument(["account Assets:Cash", ""]);
      const position = new Position(1, 0);
      const knownPayees = new Set<string>(["Assets:Cash"]);

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

    it("should detect payee context when typing after known payee text", () => {
      const document = new MockTextDocument(["2024-12-23 Coffee Shop extra"]);
      const position = new Position(0, 28); // At end of "extra"
      const knownPayees = new Set<string>(["Coffee Shop"]);

      const result = analyzer.analyzePosition(document, position, knownPayees);

      // Should be payee context - user is typing more text
      expect(result.type).toBe("payee");
      if (result.type === "payee") {
        expect(result.prefix).toBe("Coffee Shop extra");
      }
    });
  });
});
