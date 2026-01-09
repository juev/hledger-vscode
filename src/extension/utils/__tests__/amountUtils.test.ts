import { escapeRegExp, extractAmountParts } from "../amountUtils";

describe("amountUtils", () => {
  describe("escapeRegExp", () => {
    it("should escape dollar sign", () => {
      expect(escapeRegExp("$")).toBe("\\$");
    });

    it("should escape multiple special characters", () => {
      expect(escapeRegExp("$100.00")).toBe("\\$100\\.00");
    });

    it("should escape all regex metacharacters", () => {
      expect(escapeRegExp(".*+?^${}()|[]\\")).toBe(
        "\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\",
      );
    });

    it("should not modify regular text", () => {
      expect(escapeRegExp("USD")).toBe("USD");
      expect(escapeRegExp("EUR")).toBe("EUR");
    });
  });

  describe("extractAmountParts", () => {
    describe("suffix commodity", () => {
      it("should extract amount with space-separated suffix commodity", () => {
        const result = extractAmountParts("100 USD", "USD");
        expect(result.amountOnly).toBe("100");
        expect(result.commodityPart).toBe(" USD");
      });

      it("should extract amount with no-space suffix commodity", () => {
        const result = extractAmountParts("100USD", "USD");
        expect(result.amountOnly).toBe("100");
        expect(result.commodityPart).toBe(" USD");
      });

      it("should handle decimal amounts with suffix", () => {
        const result = extractAmountParts("1,234.56 EUR", "EUR");
        expect(result.amountOnly).toBe("1,234.56");
        expect(result.commodityPart).toBe(" EUR");
      });
    });

    describe("prefix commodity", () => {
      it("should extract amount with prefix dollar sign", () => {
        const result = extractAmountParts("$100", "$");
        expect(result.amountOnly).toBe("100");
        expect(result.commodityPart).toBe(" $");
      });

      it("should extract amount with space-separated prefix", () => {
        const result = extractAmountParts("$ 100", "$");
        expect(result.amountOnly).toBe("100");
        expect(result.commodityPart).toBe(" $");
      });

      it("should extract amount with euro prefix", () => {
        const result = extractAmountParts("€50", "€");
        expect(result.amountOnly).toBe("50");
        expect(result.commodityPart).toBe(" €");
      });

      it("should handle decimal amounts with prefix", () => {
        const result = extractAmountParts("$1,234.56", "$");
        expect(result.amountOnly).toBe("1,234.56");
        expect(result.commodityPart).toBe(" $");
      });
    });

    describe("no commodity", () => {
      it("should return amount unchanged when no commodity", () => {
        const result = extractAmountParts("100", undefined);
        expect(result.amountOnly).toBe("100");
        expect(result.commodityPart).toBe("");
      });

      it("should handle empty string commodity as undefined", () => {
        const result = extractAmountParts("100", "");
        expect(result.amountOnly).toBe("100");
        expect(result.commodityPart).toBe("");
      });
    });

    describe("negative amounts", () => {
      it("should preserve negative sign with suffix commodity", () => {
        const result = extractAmountParts("-100 USD", "USD");
        expect(result.amountOnly).toBe("-100");
        expect(result.commodityPart).toBe(" USD");
      });

      it("should preserve negative sign with prefix commodity", () => {
        const result = extractAmountParts("$-100", "$");
        expect(result.amountOnly).toBe("-100");
        expect(result.commodityPart).toBe(" $");
      });
    });
  });
});
