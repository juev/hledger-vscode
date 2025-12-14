/**
 * Regular expression patterns used throughout the hledger extension.
 * Centralized for better maintainability and consistency.
 */
export class RegexPatterns {
  // Date patterns
  static readonly DATE_FULL = /^(\d{4}[-/.]\d{2}[-/.]\d{2}|\d{2}[-/.]\d{2})/;
  static readonly DATE_LINE_START =
    /^(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2})$/u;
  static readonly DATE_WITH_STATUS =
    /^(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2})\s*[*!]?\s*$/u;
  static readonly AFTER_DATE_PATTERN =
    /^(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2})\s*[*!]?\s+[\p{L}\p{N}\s\p{P}]*$/u;
  static readonly DATE_WITH_STATUS_AND_SPACE =
    /^(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2})\s*[*!]?\s+$/u;

  // Special patterns for digit "0"
  static readonly ZERO_START = /^0$/u;
  static readonly ZERO_MONTH = /^0[1-9]$/u;
  static readonly ZERO_PARTIAL_DATE = /^0[1-9][-/]?\d{0,2}$/u;

  // Transaction patterns
  static readonly TRANSACTION_LINE =
    /^(\d{4}[-/.]\d{2}[-/.]\d{2}|\d{2}[-/.]\d{2})/;
  static readonly TRANSACTION_CODE = /^\([^)]+\)\s*/;
  static readonly TRANSACTION_STATUS = /^[*!]\s*/;

  // Comment patterns
  static readonly COMMENT_LINE = /[;#](.*)$/;
  static readonly COMMENT_SEMICOLON = /;/;
  static readonly COMMENT_HASH = /#/;

  // Tag patterns
  static readonly TAG_PATTERN =
    /([\p{L}\p{N}_]+):\s*([^,;#]*?)(?=\s*(?:,|$))/gu;
  static readonly TAG_NAME_PREFIX = /([\p{L}\p{N}_]+):/u;

  // Account patterns
  static readonly ACCOUNT_NAME = /^[\p{L}\p{N}\s\p{P}]+/u;
  static readonly ACCOUNT_HIERARCHY = /[:\s]+/g;

  // Amount patterns
  static readonly AMOUNT_EXTRACTION = /(\p{Sc}|[\p{L}]{2,}\d*|[A-Z]{2,}\d*)/u;
  static readonly DECIMAL_MATCH = /(.*?)([,.])([0-9]{1,4})$/;
  static readonly AMOUNT_SPLIT = /\s{2,}|\t/;
  static readonly NUMBERS = /\p{N}/u;

  // Commodity patterns
  static readonly COMMODITY_DETECTION = /([\p{L}\p{Sc}]+)\s*$/u;
  static readonly COMMODITY_CLEANUP = /[\p{L}\p{Sc}]+\s*$/u;

  // Directive patterns
  static readonly ALIAS_DIRECTIVE = /alias\s+([^=]+)=(.+)/;
  static readonly COMMODITY_DIRECTIVE = /^commodity\s+(.*)/;
  static readonly FORMAT_DIRECTIVE = /^format\s+(.*)/;
  static readonly DECIMAL_MARK_DIRECTIVE = /^decimal-mark\s+(.*)/;
  static readonly DEFAULT_COMMODITY_DIRECTIVE = /^D\s+(.*)/;
  static readonly ACCOUNT_DIRECTIVE = /^account\s+(.*)/;

  // Whitespace and spacing patterns
  static readonly MULTIPLE_SPACES = /\s{2,}/;
  static readonly LEADING_SPACES = /^\s+/;
  static readonly TRAILING_SPACES = /\s+$/;

  // Number formatting patterns
  static readonly GROUPING_DETECTION = /[,.]/g;
  static readonly CURRENCY_SYMBOLS = /\p{Sc}/u;

  // Misc patterns
  static readonly INLINE_COMMENT_REMOVAL = /\s*;.*/;
  static readonly SQUARE_BRACKETS = /\[.*?\]/g;
  static readonly PARENTHESES = /\(.*?\)/g;
}
