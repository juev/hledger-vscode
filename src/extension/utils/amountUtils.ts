/**
 * Escapes special regex characters in a string.
 */
export function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface AmountParts {
  amountOnly: string;
  commodityPart: string;
}

/**
 * Extracts numeric amount from amount string, handling both prefix and suffix commodities.
 * Returns the amount without commodity and the commodity part for snippet formatting.
 */
export function extractAmountParts(
  amount: string,
  commodity: string | undefined,
): AmountParts {
  if (!commodity) {
    return { amountOnly: amount, commodityPart: "" };
  }

  const escaped = escapeRegExp(commodity);
  let amountOnly = amount;

  // Try suffix first (e.g., "100 USD" or "100USD")
  const suffixResult = amount.replace(new RegExp(`\\s*${escaped}$`), "");
  if (suffixResult !== amount) {
    amountOnly = suffixResult;
  } else {
    // Try prefix (e.g., "$100" or "$ 100")
    amountOnly = amount.replace(new RegExp(`^${escaped}\\s*`), "");
  }

  return {
    amountOnly,
    commodityPart: ` ${commodity}`,
  };
}
