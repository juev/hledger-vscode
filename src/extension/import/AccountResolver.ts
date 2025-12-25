/**
 * Smart account resolver with multiple detection strategies
 * Determines hledger accounts from CSV data automatically
 */

import * as vscode from 'vscode';
import {
  AccountResolution,
  AccountResolutionSource,
  ImportOptions,
  PayeeAccountHistory,
  BUILTIN_CATEGORY_MAPPING,
  BUILTIN_MERCHANT_PATTERNS,
} from './types';
import { SimpleFuzzyMatcher, FuzzyMatch } from '../SimpleFuzzyMatcher';
import { AccountName, PayeeName } from '../types';

/**
 * Confidence thresholds for account resolution strategies.
 * Higher values indicate more reliable detection methods.
 * History from user's journal takes highest priority.
 */
const CONFIDENCE = {
  /** Exact payee match from journal history - highest confidence */
  HISTORY_EXACT: 0.95,
  /** Fuzzy payee match from journal history */
  HISTORY_FUZZY: 0.85,
  /** Direct category match from CSV column (demoted below history) */
  CATEGORY_EXACT: 0.8,
  /** Partial category match (contains/contained by) */
  CATEGORY_PARTIAL: 0.75,
  /** Merchant pattern regex match */
  MERCHANT_PATTERN: 0.7,
  /** Fallback: amount sign heuristic (positive=income, negative=expense) */
  AMOUNT_SIGN: 0.5,
  /** Default placeholder when no strategy matches */
  DEFAULT: 0,
} as const;

/**
 * Cache for compiled regex patterns to avoid recompilation
 */
interface PatternCache {
  regex: RegExp;
  account: string;
}

/**
 * LRU cache with size limit and eviction
 * Follows the pattern from StrictPositionAnalyzer.RegexCache
 */
class LRUCache<K, V> {
  private readonly maxSize: number;
  private cache = new Map<K, V>();

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to end for LRU behavior
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Evict least recently used (first item)
      const iterator = this.cache.keys().next();
      if (!iterator.done && iterator.value !== undefined) {
        this.cache.delete(iterator.value);
      }
    }
    this.cache.set(key, value);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

/**
 * Account resolver with smart detection strategies
 *
 * Resolution priority:
 * 1. Journal history (if history provided and enabled)
 * 2. Category column mapping (if category provided)
 * 3. Merchant pattern matching (regex against description)
 * 4. Amount sign heuristic (positive = income, negative = expense)
 * 5. Default placeholder (TODO:account)
 */
export class AccountResolver {
  private readonly categoryMapping: Map<string, string>;
  private readonly merchantPatterns: PatternCache[];
  private readonly defaultDebitAccount: string;
  private readonly defaultCreditAccount: string;
  private readonly defaultPlaceholder: string;
  /**
   * Partial match cache: 100 entries supports ~100 unique categories per import session.
   * At ~50 bytes/entry (key + value reference), max memory footprint is ~5KB.
   * This balances memory efficiency with high cache hit rates for typical imports.
   */
  private readonly partialMatchCache = new LRUCache<string, AccountResolution | null>(100);
  private readonly payeeHistory: PayeeAccountHistory | null;
  private readonly useHistory: boolean;
  private readonly fuzzyMatcher: SimpleFuzzyMatcher;

  constructor(options: ImportOptions, payeeHistory?: PayeeAccountHistory) {
    // Build category mapping (case-insensitive)
    this.categoryMapping = new Map();

    // Add built-in mappings first
    for (const [category, account] of Object.entries(BUILTIN_CATEGORY_MAPPING)) {
      this.categoryMapping.set(category.toLowerCase(), account);
    }

    // Override with user-provided mappings
    for (const [category, account] of Object.entries(options.categoryMapping)) {
      this.categoryMapping.set(category.toLowerCase(), account);
    }

    // Compile merchant patterns
    this.merchantPatterns = this.compilePatterns(options.merchantPatterns);

    this.defaultDebitAccount = options.defaultDebitAccount;
    this.defaultCreditAccount = options.defaultCreditAccount;
    this.defaultPlaceholder = options.defaultBalancingAccount;

    // Initialize history-based resolution
    this.payeeHistory = payeeHistory ?? null;
    this.useHistory = options.useJournalHistory !== false && this.payeeHistory !== null;
    this.fuzzyMatcher = new SimpleFuzzyMatcher();
  }

  /**
   * Resolve account for a transaction
   *
   * @param description - Transaction description/payee
   * @param category - Optional category from CSV
   * @param amount - Optional amount (for sign-based heuristic)
   * @returns Account resolution with confidence and source
   */
  resolve(description: string, category?: string, amount?: number): AccountResolution {
    // Strategy 1: Journal history (highest priority)
    if (this.useHistory && description) {
      const historyResult = this.resolveFromHistory(description);
      if (historyResult) {
        return historyResult;
      }
    }

    // Strategy 2: Category mapping
    if (category) {
      const categoryResult = this.resolveFromCategory(category);
      if (categoryResult) {
        return categoryResult;
      }
    }

    // Strategy 3: Merchant pattern matching
    if (description) {
      const patternResult = this.resolveFromPattern(description);
      if (patternResult) {
        return patternResult;
      }
    }

    // Strategy 4: Amount sign heuristic
    if (amount !== undefined) {
      return this.resolveFromAmount(amount);
    }

    // Strategy 5: Default placeholder
    return {
      account: this.defaultPlaceholder,
      confidence: CONFIDENCE.DEFAULT,
      source: 'default',
    };
  }

  /**
   * Resolve account from journal history.
   * Tries exact match first, then fuzzy matching.
   */
  private resolveFromHistory(description: string): AccountResolution | null {
    if (!this.payeeHistory) {
      return null;
    }

    // Normalize description for matching
    const normalizedDesc = description.normalize('NFC');

    // Try exact match first (case-insensitive)
    const exactResult = this.findExactPayeeMatch(normalizedDesc);
    if (exactResult) {
      return exactResult;
    }

    // Try fuzzy match
    return this.findFuzzyPayeeMatch(normalizedDesc);
  }

  /**
   * Find exact payee match from history (case-insensitive).
   */
  private findExactPayeeMatch(description: string): AccountResolution | null {
    if (!this.payeeHistory) {
      return null;
    }

    const descLower = description.toLowerCase();

    for (const [payee, accounts] of this.payeeHistory.payeeAccounts) {
      const payeeLower = payee.toLowerCase();
      if (payeeLower === descLower) {
        const bestAccount = this.selectBestAccount(payee, accounts);
        return {
          account: bestAccount,
          confidence: CONFIDENCE.HISTORY_EXACT,
          source: 'history',
        };
      }
    }

    return null;
  }

  /**
   * Find fuzzy payee match from history.
   * Uses SimpleFuzzyMatcher to find partial matches.
   */
  private findFuzzyPayeeMatch(description: string): AccountResolution | null {
    if (!this.payeeHistory) {
      return null;
    }

    const payees = Array.from(this.payeeHistory.payeeAccounts.keys());
    if (payees.length === 0) {
      return null;
    }

    // Check if description contains any payee or payee contains description
    const descLower = description.toLowerCase();

    for (const payee of payees) {
      const payeeLower = payee.toLowerCase();

      // Description contains payee (e.g., "AMAZON.COM*123" contains "Amazon")
      if (descLower.includes(payeeLower) || payeeLower.includes(descLower)) {
        const accounts = this.payeeHistory.payeeAccounts.get(payee);
        if (accounts) {
          const bestAccount = this.selectBestAccount(payee, accounts);
          return {
            account: bestAccount,
            confidence: CONFIDENCE.HISTORY_FUZZY,
            source: 'history',
          };
        }
      }
    }

    // Use fuzzy matcher for more flexible matching
    const matches: FuzzyMatch<PayeeName>[] = this.fuzzyMatcher.match(
      description,
      payees as PayeeName[],
      { maxResults: 1 }
    );

    if (matches.length > 0 && matches[0] && matches[0].score > 0) {
      const matchedPayee = matches[0].item;
      const accounts = this.payeeHistory?.payeeAccounts.get(matchedPayee);
      if (accounts) {
        const bestAccount = this.selectBestAccount(matchedPayee, accounts);
        return {
          account: bestAccount,
          confidence: CONFIDENCE.HISTORY_FUZZY,
          source: 'history',
        };
      }
    }

    return null;
  }

  /**
   * Select the best account from a set of accounts for a payee.
   * Prioritizes by usage frequency, then alphabetically.
   */
  private selectBestAccount(payee: PayeeName, accounts: ReadonlySet<AccountName>): AccountName {
    if (accounts.size === 0) {
      return this.defaultPlaceholder as AccountName;
    }

    if (accounts.size === 1) {
      // Size check guarantees element exists
      return Array.from(accounts)[0]!;
    }

    // Sort by usage count descending, then alphabetically
    const accountArray = Array.from(accounts);
    accountArray.sort((a, b) => {
      const keyA = `${payee}::${a}`;
      const keyB = `${payee}::${b}`;
      const usageA = this.payeeHistory?.pairUsage.get(keyA) ?? 0;
      const usageB = this.payeeHistory?.pairUsage.get(keyB) ?? 0;

      if (usageA !== usageB) {
        return usageB - usageA; // Higher usage first
      }

      return a.localeCompare(b); // Alphabetically for ties
    });

    // Array has at least 2 elements (size > 1 check above)
    return accountArray[0]!;
  }

  /**
   * Resolve account from category column
   */
  private resolveFromCategory(category: string): AccountResolution | null {
    const normalizedCategory = category.toLowerCase().trim();

    // Direct match (no cache needed - Map.get is O(1))
    const directMatch = this.categoryMapping.get(normalizedCategory);
    if (directMatch) {
      return {
        account: directMatch,
        confidence: CONFIDENCE.CATEGORY_EXACT,
        source: 'category',
      };
    }

    // Check partial match cache
    if (this.partialMatchCache.has(normalizedCategory)) {
      return this.partialMatchCache.get(normalizedCategory) ?? null;
    }

    // Partial match (category contains key or key contains category)
    for (const [key, account] of this.categoryMapping) {
      if (normalizedCategory.includes(key) || key.includes(normalizedCategory)) {
        const result: AccountResolution = {
          account,
          confidence: CONFIDENCE.CATEGORY_PARTIAL,
          source: 'category',
        };
        this.partialMatchCache.set(normalizedCategory, result);
        return result;
      }
    }

    // Cache miss (no partial match found)
    this.partialMatchCache.set(normalizedCategory, null);
    return null;
  }

  /**
   * Resolve account from merchant pattern matching
   */
  private resolveFromPattern(description: string): AccountResolution | null {
    const normalizedDescription = description.toUpperCase();

    for (const { regex, account } of this.merchantPatterns) {
      if (regex.test(normalizedDescription)) {
        return {
          account,
          confidence: CONFIDENCE.MERCHANT_PATTERN,
          source: 'pattern',
        };
      }
    }

    return null;
  }

  /**
   * Resolve account from amount sign
   */
  private resolveFromAmount(amount: number): AccountResolution {
    if (amount > 0) {
      return {
        account: this.defaultCreditAccount,
        confidence: CONFIDENCE.AMOUNT_SIGN,
        source: 'sign',
      };
    } else if (amount < 0) {
      return {
        account: this.defaultDebitAccount,
        confidence: CONFIDENCE.AMOUNT_SIGN,
        source: 'sign',
      };
    }

    return {
      account: this.defaultPlaceholder,
      confidence: CONFIDENCE.DEFAULT,
      source: 'default',
    };
  }

  /**
   * Validate regex pattern for safety (prevent ReDoS attacks)
   * Rejects patterns with constructs that can cause catastrophic backtracking:
   * - Nested quantifiers: (a+)+, (a*)+, (a+)*, (a*)*
   * - Overlapping alternations with quantifiers: (a|a)+, (a|ab)+
   * - Backreferences with quantifiers: (.+)\1+
   * - Exponential patterns: (a|b|ab)+
   */
  private validateRegexSafety(pattern: string): boolean {
    // Limit pattern length to prevent ReDoS complexity attacks.
    // 100 chars is sufficient for merchant patterns like "AMAZON|AMZN|WHOLE\s*FOODS"
    // while reducing attack surface from user-provided configuration.
    if (pattern.length > 100) {
      return false;
    }

    // Check for dangerous ReDoS patterns
    if (this.hasNestedQuantifiers(pattern)) {
      return false;
    }

    if (this.hasOverlappingAlternations(pattern)) {
      return false;
    }

    if (this.hasBackreferenceWithQuantifier(pattern)) {
      return false;
    }

    return true;
  }

  /**
   * Detect nested quantifiers: (a+)+, (a*)+, (a+)*, (a*)*, (a+){n}, etc.
   * These cause exponential backtracking on non-matching input.
   */
  private hasNestedQuantifiers(pattern: string): boolean {
    // Pattern: group with quantifier inside, followed by another quantifier
    // Matches: (a+)+, (a*)+, (a+)*, (a*)*, (a+){2}, etc.
    // Also catches nested groups: ((a)+)+
    const nestedQuantifierPattern = /\([^)]*[+*}]\)[+*{]/;
    if (nestedQuantifierPattern.test(pattern)) {
      return true;
    }

    // Check for quantified groups containing quantified content
    // Matches patterns like: (a{2,})+, (.+)+, (.*)+
    const quantifiedGroupContent = /\([^)]*\{[^}]*\}\)[+*{]|\([^)]*[.][+*]\)[+*{]/;
    if (quantifiedGroupContent.test(pattern)) {
      return true;
    }

    return false;
  }

  /**
   * Detect overlapping alternations with quantifiers: (a|a)+, (a|ab)+, (.|a)+
   * These create ambiguous matches that cause exponential backtracking.
   */
  private hasOverlappingAlternations(pattern: string): boolean {
    // Find all groups with alternations followed by quantifiers
    const groupWithAltAndQuantifier = /\(([^)]+)\)[+*{]/g;
    let match: RegExpExecArray | null;

    while ((match = groupWithAltAndQuantifier.exec(pattern)) !== null) {
      const groupContent = match[1];
      if (groupContent === undefined) continue;

      // Check if group contains alternation
      if (!groupContent.includes('|')) {
        continue;
      }

      // Extract alternatives
      const alternatives = groupContent.split('|');
      if (alternatives.length < 2) continue;

      // Check for overlapping patterns
      if (this.hasOverlappingPatterns(alternatives)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if any alternatives overlap (one is prefix/suffix of another,
   * or they share common prefixes, or one is a wildcard).
   */
  private hasOverlappingPatterns(alternatives: string[]): boolean {
    for (let i = 0; i < alternatives.length; i++) {
      const alt1 = alternatives[i];
      if (alt1 === undefined) continue;

      // Wildcard patterns like . or .* match everything
      if (alt1 === '.' || alt1 === '.*' || alt1 === '.+') {
        return true;
      }

      for (let j = i + 1; j < alternatives.length; j++) {
        const alt2 = alternatives[j];
        if (alt2 === undefined) continue;

        // Identical alternatives
        if (alt1 === alt2) {
          return true;
        }

        // One is prefix of another: (a|ab) - "a" matches prefix of "ab"
        if (alt1.startsWith(alt2) || alt2.startsWith(alt1)) {
          return true;
        }

        // One is suffix of another: (b|ab)
        if (alt1.endsWith(alt2) || alt2.endsWith(alt1)) {
          return true;
        }

        // Check for common prefix with optional suffix: (ab|ac)
        // This is less dangerous but still problematic with quantifiers
        const minLen = Math.min(alt1.length, alt2.length);
        let commonPrefixLen = 0;
        for (let k = 0; k < minLen; k++) {
          if (alt1[k] === alt2[k]) {
            commonPrefixLen++;
          } else {
            break;
          }
        }
        // More than half of the shorter string is common prefix
        if (commonPrefixLen > minLen / 2 && commonPrefixLen > 0) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Detect backreferences followed by quantifiers: (.+)\1+, (.*)\1*
   * These can cause exponential backtracking on non-matching input.
   */
  private hasBackreferenceWithQuantifier(pattern: string): boolean {
    // Pattern: backreference (\1, \2, etc.) followed by quantifier
    const backreferenceWithQuantifier = /\\[1-9][0-9]*[+*{]/;
    return backreferenceWithQuantifier.test(pattern);
  }

  /**
   * Compile regex patterns for merchant matching
   */
  private compilePatterns(userPatterns: Record<string, string>): PatternCache[] {
    const patterns: PatternCache[] = [];

    // Add built-in patterns first
    for (const [pattern, account] of Object.entries(BUILTIN_MERCHANT_PATTERNS)) {
      try {
        patterns.push({
          regex: new RegExp(pattern, 'i'),
          account,
        });
      } catch {
        // Skip invalid regex patterns
        console.warn(`Invalid built-in pattern: ${pattern}`);
      }
    }

    // Add user patterns (they can override built-in by coming later)
    for (const [pattern, account] of Object.entries(userPatterns)) {
      // Validate pattern safety before compilation
      if (!this.validateRegexSafety(pattern)) {
        vscode.window.showWarningMessage(
          `Potentially unsafe merchant pattern "${pattern}" rejected. ` +
            `Pattern contains nested quantifiers or is too complex.`
        );
        continue;
      }

      try {
        patterns.push({
          regex: new RegExp(pattern, 'i'),
          account,
        });
      } catch (error) {
        // Notify user about invalid pattern in their configuration
        vscode.window.showWarningMessage(
          `Invalid merchant pattern "${pattern}": ${error instanceof Error ? error.message : 'Invalid regex'}. Pattern will be ignored.`
        );
      }
    }

    return patterns;
  }

  /**
   * Get human-readable description of resolution source
   */
  static describeSource(source: AccountResolutionSource): string {
    switch (source) {
      case 'category':
        return 'category column';
      case 'history':
        return 'journal history';
      case 'pattern':
        return 'merchant pattern';
      case 'sign':
        return 'amount sign';
      case 'default':
        return 'no match found';
    }
  }

  /**
   * Check if account resolution needs manual review
   */
  static needsReview(resolution: AccountResolution): boolean {
    return (
      resolution.confidence < 0.7 ||
      resolution.source === 'default' ||
      resolution.account.startsWith('TODO:') ||
      resolution.account.includes('unknown')
    );
  }

  /**
   * Format account with annotation comment
   */
  static formatWithAnnotation(resolution: AccountResolution, includeAnnotation = true): string {
    if (!includeAnnotation || resolution.source === 'default') {
      return resolution.account;
    }

    return `${resolution.account}  ; matched: ${this.describeSource(resolution.source)}`;
  }
}
