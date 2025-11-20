// HLedgerLexer test - Tests for lexical analysis and tokenization

import { HLedgerLexer, TokenType } from "../HLedgerLexer";
import { createAccountName } from "../../types";

describe("HLedgerLexer", () => {
  let lexer: HLedgerLexer;

  beforeEach(() => {
    lexer = new HLedgerLexer();
  });

  describe("parsePostingInfo", () => {
    describe("trailing whitespace handling", () => {
      it("should trim whitespace when account precedes comment", () => {
        const result = lexer.parsePostingInfo("Assets:Cash ; comment");
        expect(result.account).toBe(createAccountName("Assets:Cash"));
      });

      it("should trim whitespace when account with spaces precedes comment", () => {
        const result = lexer.parsePostingInfo(
          "Expenses:Software Licenses ; comment",
        );
        expect(result.account).toBe(
          createAccountName("Expenses:Software Licenses"),
        );
      });

      it("should trim whitespace when account with Cyrillic and spaces precedes comment", () => {
        const result = lexer.parsePostingInfo(
          "Расходы:Программное обеспечение ; комментарий",
        );
        expect(result.account).toBe(
          createAccountName("Расходы:Программное обеспечение"),
        );
      });

      it("should trim whitespace when account precedes hash comment", () => {
        const result = lexer.parsePostingInfo("Assets:Bank Account # note");
        expect(result.account).toBe(createAccountName("Assets:Bank Account"));
      });

      it("should handle account with no comment correctly", () => {
        const result = lexer.parsePostingInfo("Assets:Cash");
        expect(result.account).toBe(createAccountName("Assets:Cash"));
      });

      it("should handle account with amount and comment correctly", () => {
        const result = lexer.parsePostingInfo(
          "Assets:Cash  100 USD ; paid in cash",
        );
        expect(result.account).toBe(createAccountName("Assets:Cash"));
      });

      it("should handle account with tab separator before comment", () => {
        const result = lexer.parsePostingInfo("Assets:Cash\t; comment");
        expect(result.account).toBe(createAccountName("Assets:Cash"));
      });
    });

    describe("account name extraction", () => {
      it("should extract simple account name", () => {
        const result = lexer.parsePostingInfo("Assets:Cash");
        expect(result.account).toBe(createAccountName("Assets:Cash"));
      });

      it("should extract account name with spaces", () => {
        const result = lexer.parsePostingInfo("Expenses:Software Licenses");
        expect(result.account).toBe(
          createAccountName("Expenses:Software Licenses"),
        );
      });

      it("should extract account name with Cyrillic characters", () => {
        const result = lexer.parsePostingInfo("Активы:Наличные");
        expect(result.account).toBe(createAccountName("Активы:Наличные"));
      });

      it("should extract account name before two spaces", () => {
        const result = lexer.parsePostingInfo("Assets:Cash  100");
        expect(result.account).toBe(createAccountName("Assets:Cash"));
      });

      it("should extract account name before tab", () => {
        const result = lexer.parsePostingInfo("Assets:Cash\t100");
        expect(result.account).toBe(createAccountName("Assets:Cash"));
      });
    });

    describe("amount extraction", () => {
      it("should extract simple amount", () => {
        const result = lexer.parsePostingInfo("Assets:Cash  100");
        expect(result.amount).toBe("100");
      });

      it("should extract amount with commodity", () => {
        const result = lexer.parsePostingInfo("Assets:Cash  100 USD");
        expect(result.amount).toBe("100USD");
      });

      it("should extract negative amount", () => {
        const result = lexer.parsePostingInfo("Expenses:Food  -25.50");
        expect(result.amount).toBe("-25.50");
      });

      it("should extract amount with decimal", () => {
        const result = lexer.parsePostingInfo("Assets:Bank  1,234.56 EUR");
        expect(result.amount).toBe("1,234.56EUR");
      });

      it("should handle posting without amount", () => {
        const result = lexer.parsePostingInfo("Assets:Cash");
        expect(result.amount).toBe("");
      });
    });

    describe("commodity extraction", () => {
      it("should extract currency commodity", () => {
        const result = lexer.parsePostingInfo("Assets:Cash  100 USD");
        expect(result.commodity?.toString()).toBe("USD");
      });

      it("should extract symbol commodity", () => {
        const result = lexer.parsePostingInfo("Assets:Cash  100 $");
        expect(result.commodity?.toString()).toBe("$");
      });

      it("should extract Cyrillic commodity", () => {
        const result = lexer.parsePostingInfo("Assets:Cash  100 ₽");
        expect(result.commodity?.toString()).toBe("₽");
      });

      it("should return undefined when no commodity present", () => {
        const result = lexer.parsePostingInfo("Assets:Cash  100");
        expect(result.commodity).toBeUndefined();
      });
    });
  });

  describe("isTransactionLine", () => {
    it("should identify transaction line with YYYY-MM-DD date", () => {
      expect(lexer.isTransactionLine("2024-11-20 * Payee")).toBe(true);
    });

    it("should identify transaction line with YYYY/MM/DD date", () => {
      expect(lexer.isTransactionLine("2024/11/20 * Payee")).toBe(true);
    });

    it("should identify transaction line with MM-DD date", () => {
      expect(lexer.isTransactionLine("11-20 * Payee")).toBe(true);
    });

    it("should not identify posting as transaction", () => {
      expect(lexer.isTransactionLine("  Assets:Cash")).toBe(false);
    });

    it("should not identify comment as transaction", () => {
      expect(lexer.isTransactionLine("; comment")).toBe(false);
    });
  });

  describe("isPostingLine", () => {
    it("should identify space-indented posting", () => {
      expect(lexer.isPostingLine("  Assets:Cash")).toBe(true);
    });

    it("should identify tab-indented posting", () => {
      expect(lexer.isPostingLine("\tAssets:Cash")).toBe(true);
    });

    it("should not identify transaction as posting", () => {
      expect(lexer.isPostingLine("2024-11-20 * Payee")).toBe(false);
    });

    it("should not identify indented comment as posting", () => {
      expect(lexer.isPostingLine("  ; comment")).toBe(false);
    });
  });

  describe("tokenizeLine", () => {
    it("should tokenize empty line", () => {
      const token = lexer.tokenizeLine("", 1);
      expect(token.type).toBe(TokenType.EMPTY);
    });

    it("should tokenize comment line", () => {
      const token = lexer.tokenizeLine("; comment", 1);
      expect(token.type).toBe(TokenType.COMMENT);
    });

    it("should tokenize transaction line", () => {
      const token = lexer.tokenizeLine("2024-11-20 * Test Payee", 1);
      expect(token.type).toBe(TokenType.TRANSACTION);
      expect(token.payee?.toString()).toBe("Test Payee");
    });

    it("should tokenize posting line", () => {
      const token = lexer.tokenizeLine("  Assets:Cash  100 USD", 1);
      expect(token.type).toBe(TokenType.POSTING);
      expect(token.account).toBe(createAccountName("Assets:Cash"));
    });

    it("should tokenize account directive", () => {
      const token = lexer.tokenizeLine("account Assets:Cash", 1);
      expect(token.type).toBe(TokenType.ACCOUNT_DIRECTIVE);
      expect(token.account).toBe(createAccountName("Assets:Cash"));
    });

    it("should tokenize commodity directive", () => {
      const token = lexer.tokenizeLine("commodity USD", 1);
      expect(token.type).toBe(TokenType.COMMODITY_DIRECTIVE);
      expect(token.commoditySymbol).toBe("USD");
    });

    it("should tokenize include directive", () => {
      const token = lexer.tokenizeLine("include other.journal", 1);
      expect(token.type).toBe(TokenType.INCLUDE_DIRECTIVE);
    });
  });

  describe("parseTransactionInfo", () => {
    it("should parse simple transaction", () => {
      const result = lexer.parseTransactionInfo("2024-11-20 Test Payee");
      expect(result.date).toBe("2024-11-20");
      expect(result.payee.toString()).toBe("Test Payee");
    });

    it("should parse transaction with status", () => {
      const result = lexer.parseTransactionInfo("2024-11-20 * Test Payee");
      expect(result.status).toBe("*");
      expect(result.payee.toString()).toBe("Test Payee");
    });

    it("should parse transaction with code", () => {
      const result = lexer.parseTransactionInfo(
        "2024-11-20 * (123) Test Payee",
      );
      expect(result.code).toBe("(123)");
      expect(result.payee.toString()).toBe("Test Payee");
    });

    it("should strip comment from payee", () => {
      const result = lexer.parseTransactionInfo(
        "2024-11-20 Test Payee ; comment",
      );
      expect(result.payee.toString()).toBe("Test Payee");
    });

    it("should handle empty transaction line", () => {
      const result = lexer.parseTransactionInfo("");
      expect(result.date).toBe("");
      expect(result.payee.toString()).toBe("Unknown");
    });
  });

  describe("extractTagsFromLine", () => {
    it("should extract simple tag", () => {
      const tags = lexer.extractTagsFromLine("Test #tag");
      expect(tags.size).toBe(1);
      expect(tags.has("tag" as any)).toBe(true);
    });

    it("should extract tag with value", () => {
      const tags = lexer.extractTagsFromLine("Test #tag:value");
      expect(tags.size).toBe(1);
      expect(tags.has("tag" as any)).toBe(true);
    });

    it("should extract multiple tags", () => {
      const tags = lexer.extractTagsFromLine("Test #tag1 #tag2:value");
      expect(tags.size).toBe(2);
    });

    it("should return empty map when no tags present", () => {
      const tags = lexer.extractTagsFromLine("Test with no tags");
      expect(tags.size).toBe(0);
    });
  });

  describe("tokenizeContent", () => {
    it("should tokenize multi-line content", () => {
      const content = `2024-11-20 * Test Payee
  Assets:Cash  100 USD
  Expenses:Food

; Comment line`;
      const tokens = lexer.tokenizeContent(content);
      expect(tokens).toHaveLength(5);
      expect(tokens[0]?.type).toBe(TokenType.TRANSACTION);
      expect(tokens[1]?.type).toBe(TokenType.POSTING);
      expect(tokens[2]?.type).toBe(TokenType.POSTING);
      expect(tokens[3]?.type).toBe(TokenType.EMPTY);
      expect(tokens[4]?.type).toBe(TokenType.COMMENT);
    });

    it("should handle empty content", () => {
      const tokens = lexer.tokenizeContent("");
      expect(tokens).toHaveLength(1);
      expect(tokens[0]?.type).toBe(TokenType.EMPTY);
    });
  });
});
