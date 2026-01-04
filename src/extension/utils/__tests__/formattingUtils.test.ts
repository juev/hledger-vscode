/**
 * Tests for formattingUtils - Amount alignment calculation utilities.
 */
import { calculateAlignmentColumn, DEFAULT_AMOUNT_ALIGNMENT_COLUMN, POSTING_INDENT, MIN_AMOUNT_SPACING, mergeFormattingProfiles } from "../formattingUtils";
import { createCharacterPosition, FormattingProfile } from "../../types";

describe("calculateAlignmentColumn", () => {
  describe("with default alignment column (40)", () => {
    it("returns default when account name is short", () => {
      const result = calculateAlignmentColumn(20);
      expect(result).toBe(DEFAULT_AMOUNT_ALIGNMENT_COLUMN);
    });

    it("returns default when maxAccountNameLength is 0", () => {
      const result = calculateAlignmentColumn(0);
      expect(result).toBe(DEFAULT_AMOUNT_ALIGNMENT_COLUMN);
    });

    it("returns calculated value when account is long enough", () => {
      // POSTING_INDENT (4) + 44 + MIN_AMOUNT_SPACING (2) = 50
      const result = calculateAlignmentColumn(44);
      expect(result).toBe(50);
    });

    it("handles boundary case at default column", () => {
      // POSTING_INDENT (4) + 34 + MIN_AMOUNT_SPACING (2) = 40 (equals default)
      const result = calculateAlignmentColumn(34);
      expect(result).toBe(DEFAULT_AMOUNT_ALIGNMENT_COLUMN);
    });

    it("handles negative input gracefully", () => {
      const result = calculateAlignmentColumn(-10);
      expect(result).toBe(DEFAULT_AMOUNT_ALIGNMENT_COLUMN);
    });

    it("caps extremely large account name lengths", () => {
      // Should cap at MAX_ACCOUNT_NAME_LENGTH (1000) to prevent overflow
      const result = calculateAlignmentColumn(1000000);
      // 4 + 1000 + 2 = 1006
      expect(result).toBe(POSTING_INDENT + 1000 + MIN_AMOUNT_SPACING);
    });
  });

  describe("with custom configured alignment column", () => {
    it("uses configured column as minimum when account is short", () => {
      // With configured column of 50, short account should align at 50
      const result = calculateAlignmentColumn(20, 50);
      expect(result).toBe(50);
    });

    it("respects configured column of 60", () => {
      const result = calculateAlignmentColumn(10, 60);
      expect(result).toBe(60);
    });

    it("expands beyond configured column for long accounts", () => {
      // POSTING_INDENT (4) + 60 + MIN_AMOUNT_SPACING (2) = 66
      // Even with configured column of 50, long account pushes alignment to 66
      const result = calculateAlignmentColumn(60, 50);
      expect(result).toBe(66);
    });

    it("uses configured column of 20 (minimum allowed)", () => {
      const result = calculateAlignmentColumn(5, 20);
      expect(result).toBe(20);
    });

    it("uses configured column of 120 (maximum allowed)", () => {
      const result = calculateAlignmentColumn(10, 120);
      expect(result).toBe(120);
    });

    it("falls back to default when configured column is 0", () => {
      // 0 means use default behavior
      const result = calculateAlignmentColumn(10, 0);
      expect(result).toBe(DEFAULT_AMOUNT_ALIGNMENT_COLUMN);
    });

    it("handles configured column less than minimum spacing requirement", () => {
      // Even with very small configured column, minimum spacing must be maintained
      // POSTING_INDENT (4) + 30 + MIN_AMOUNT_SPACING (2) = 36
      // Configured 10 is less than 36, so 36 wins
      const result = calculateAlignmentColumn(30, 10);
      expect(result).toBe(36);
    });
  });
});

describe("mergeFormattingProfiles", () => {
  it("keeps larger maxAccountNameLength", () => {
    const target: FormattingProfile = {
      amountAlignmentColumn: createCharacterPosition(40),
      maxAccountNameLength: 20,
      isDefaultAlignment: false,
    };
    const source: FormattingProfile = {
      amountAlignmentColumn: createCharacterPosition(40),
      maxAccountNameLength: 30,
      isDefaultAlignment: false,
    };

    const result = mergeFormattingProfiles(target, source);
    expect(result.maxAccountNameLength).toBe(30);
  });

  it("preserves target maxAccountNameLength when larger", () => {
    const target: FormattingProfile = {
      amountAlignmentColumn: createCharacterPosition(50),
      maxAccountNameLength: 50,
      isDefaultAlignment: false,
    };
    const source: FormattingProfile = {
      amountAlignmentColumn: createCharacterPosition(40),
      maxAccountNameLength: 30,
      isDefaultAlignment: false,
    };

    const result = mergeFormattingProfiles(target, source);
    expect(result.maxAccountNameLength).toBe(50);
  });

  it("recalculates amountAlignmentColumn based on merged maxAccountNameLength", () => {
    const target: FormattingProfile = {
      amountAlignmentColumn: createCharacterPosition(40),
      maxAccountNameLength: 20,
      isDefaultAlignment: true,
    };
    const source: FormattingProfile = {
      amountAlignmentColumn: createCharacterPosition(40),
      maxAccountNameLength: 50,
      isDefaultAlignment: false,
    };

    const result = mergeFormattingProfiles(target, source);
    // 4 + 50 + 2 = 56
    expect(result.amountAlignmentColumn).toBe(56);
    expect(result.isDefaultAlignment).toBe(false);
  });

  it("sets isDefaultAlignment true when both have zero maxAccountNameLength", () => {
    const target: FormattingProfile = {
      amountAlignmentColumn: createCharacterPosition(40),
      maxAccountNameLength: 0,
      isDefaultAlignment: true,
    };
    const source: FormattingProfile = {
      amountAlignmentColumn: createCharacterPosition(40),
      maxAccountNameLength: 0,
      isDefaultAlignment: true,
    };

    const result = mergeFormattingProfiles(target, source);
    expect(result.isDefaultAlignment).toBe(true);
  });
});

describe("constants", () => {
  it("DEFAULT_AMOUNT_ALIGNMENT_COLUMN is 40", () => {
    expect(DEFAULT_AMOUNT_ALIGNMENT_COLUMN).toBe(40);
  });

  it("POSTING_INDENT is 4", () => {
    expect(POSTING_INDENT).toBe(4);
  });

  it("MIN_AMOUNT_SPACING is 2", () => {
    expect(MIN_AMOUNT_SPACING).toBe(2);
  });
});
