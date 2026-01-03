/**
 * Formatting utilities for amount alignment in transaction templates.
 */
import { CharacterPosition, FormattingProfile, createCharacterPosition } from "../types";

/** Default column for amount alignment when no long accounts exist */
export const DEFAULT_AMOUNT_ALIGNMENT_COLUMN = 40;

/** Standard posting indentation (4 spaces) */
export const POSTING_INDENT = 4;

/** Minimum spacing between account name and amount (2 spaces per hledger spec) */
export const MIN_AMOUNT_SPACING = 2;

/** Maximum reasonable account name length to prevent overflow */
const MAX_ACCOUNT_NAME_LENGTH = 1000;

/**
 * Calculates the amount alignment column based on maximum account name length.
 *
 * Formula: POSTING_INDENT + maxAccountNameLength + MIN_AMOUNT_SPACING
 * Minimum: DEFAULT_AMOUNT_ALIGNMENT_COLUMN (40)
 *
 * @param maxAccountNameLength - Length of the longest account name in workspace
 * @returns Column position where amounts should start
 *
 * @example
 * calculateAlignmentColumn(0)   // → 40 (default minimum)
 * calculateAlignmentColumn(30)  // → 40 (4 + 30 + 2 = 36, but min is 40)
 * calculateAlignmentColumn(44)  // → 50 (4 + 44 + 2 = 50)
 */
export function calculateAlignmentColumn(
  maxAccountNameLength: number,
): CharacterPosition {
  // Ensure non-negative and cap at reasonable maximum
  const safeLength = Math.max(0, Math.min(maxAccountNameLength, MAX_ACCOUNT_NAME_LENGTH));

  return createCharacterPosition(
    Math.max(
      POSTING_INDENT + safeLength + MIN_AMOUNT_SPACING,
      DEFAULT_AMOUNT_ALIGNMENT_COLUMN,
    ),
  );
}

/**
 * Merges two formatting profiles, keeping the larger maxAccountNameLength.
 * Used when combining data from multiple parsed sources.
 *
 * @param target - The base formatting profile
 * @param source - The formatting profile to merge in
 * @returns Merged profile with the larger maxAccountNameLength
 */
export function mergeFormattingProfiles(
  target: FormattingProfile,
  source: FormattingProfile,
): FormattingProfile {
  const maxLength = Math.max(
    target.maxAccountNameLength,
    source.maxAccountNameLength,
  );

  return {
    amountAlignmentColumn: calculateAlignmentColumn(maxLength),
    maxAccountNameLength: maxLength,
    isDefaultAlignment: maxLength === 0,
  };
}
