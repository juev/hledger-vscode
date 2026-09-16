/**
 * Smart account resolver with multiple detection strategies
 * Determines hledger accounts from CSV data automatically
 */

import * as vscode from 'vscode';
import Decimal from 'decimal.js';
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
    /** Fuzzy payee match from journal history - below needsReview threshold (0.7) */
    HISTORY_FUZZY: 0.6,
    /** Direct category match from CSV column (demoted below history) */
    CATEGORY_EXACT: 0.80,
    /** Partial category match (contains/contained by) */
    CATEGORY_PARTIAL: 0.75,
    /** Merchant pattern regex match */
    MERCHANT_PATTERN: 0.70,
    /** Fallback: amount sign heuristic (positive=income, negative=expense) */
    AMOUNT_SIGN: 0.5,
    /** Default placeholder when no strategy matches */
    DEFAULT: 0,
} as const;

/**
 * Wall-clock budget for probing one user-supplied pattern against inputs that
 * make a catastrophically backtracking regexp explode. A safe pattern answers
 * each probe in microseconds; a pathological one takes seconds to minutes.
 */
const MAX_PATTERN_PROBE_MS = 250;

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
    resolve(
        description: string,
        category?: string,
        amount?: Decimal | number
    ): AccountResolution {
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

            // Contains-match requires the substring to be at least 3 chars
            // to prevent short payees ("ID", "A") matching unrelated descriptions
            const minContainsLength = 3;
            if (
                (payeeLower.length >= minContainsLength && descLower.includes(payeeLower)) ||
                (descLower.length >= minContainsLength && payeeLower.includes(descLower))
            ) {
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
    private selectBestAccount(
        payee: PayeeName,
        accounts: ReadonlySet<AccountName>
    ): AccountName {
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
    private resolveFromAmount(amount: Decimal | number): AccountResolution {
        const isPositive = typeof amount === 'number'
            ? amount > 0
            : !amount.isZero() && amount.isPositive();
        const isNegative = typeof amount === 'number'
            ? amount < 0
            : !amount.isZero() && amount.isNegative();

        if (isPositive) {
            return {
                account: this.defaultCreditAccount,
                confidence: CONFIDENCE.AMOUNT_SIGN,
                source: 'sign',
            };
        } else if (isNegative) {
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
     * Validate regex pattern for safety (prevent ReDoS attacks).
     * Rejects patterns with constructs that can cause catastrophic backtracking:
     * - Nested quantifiers: (a+)+, (a*)+, (a+)*, (a*)*
     * - Repeated alternations with quantified branches: (ab|ab)*
     * - Wildcards inside a quantified group: (.+)+
     * - Backreferences with quantifiers: (.+)\1+
     * - Patterns that still blow up when matched at run time (see probePatternCost)
     */
    private validateRegexSafety(pattern: string): boolean {
        // Limit pattern length to prevent ReDoS complexity attacks.
        // 100 chars is sufficient for merchant patterns like "AMAZON|AMZN|WHOLE\s*FOODS"
        // while reducing attack surface from user-provided configuration.
        if (pattern.length > 100) {
            return false;
        }

        if (this.hasNestedQuantifiers(pattern)) {
            return false;
        }

        if (this.hasBackreferenceWithQuantifier(pattern)) {
            return false;
        }

        if (this.probePatternCost(pattern)) {
            return false;
        }

        return true;
    }

    /**
     * Detect a quantified group whose body can itself match a variable amount of
     * text. A single-level pattern like `(abc|abd)+` is linear in practice, so
     * only nesting or a repeated alternative counts as dangerous.
     *
     * The pattern is scanned with a small recursive-descent walk so that inner
     * groups are visited: a flat regex like `/\([^)]*[+*}]\)[+*{]/` cannot see
     * past the first `)`, which is how `^((a+))+$` used to slip through.
     */
    private hasNestedQuantifiers(pattern: string): boolean {
        return this.findQuantifiedAmbiguity(pattern, 0, pattern.length);
    }

    /**
     * Walk `pattern[from..to)` looking for a quantified group with an ambiguous
     * body. Returns true as soon as one is found.
     */
    private findQuantifiedAmbiguity(pattern: string, from: number, to: number): boolean {
        let i = from;

        while (i < to) {
            const char = pattern[i];

            // Skip escaped characters so \( does not open a group.
            if (char === '\\') {
                i += 2;
                continue;
            }

            if (char === '[') {
                i = this.skipCharacterClass(pattern, i, to);
                continue;
            }

            if (char !== '(') {
                i++;
                continue;
            }

            const close = this.findGroupEnd(pattern, i, to);
            if (close === -1) {
                // Unbalanced: let RegExp reject it later.
                return false;
            }

            const afterGroup = this.skipQuantifier(pattern, close + 1, to);
            // A group and its own quantifier are a single element; skipping the
            // quantifier here keeps it from being read as part of whatever
            // follows, which would hide a nested quantifier inside a group.
            const quantified = afterGroup > close + 1;

            if (quantified && this.isAmbiguousGroupBody(pattern, i + 1, close)) {
                return true;
            }

            // Recurse into the group's body so nested groups are inspected even
            // when the outer group is not quantified. The body ends at `close`:
            // `afterGroup` belongs to this element, and handing it to the scan
            // would expose this group's own quantifier to the level below as a
            // stray character.
            if (this.findQuantifiedAmbiguity(pattern, i + 1, close)) {
                return true;
            }

            i = afterGroup;
        }

        return false;
    }

    /**
     * Index just past the quantifier starting at `index`, or `index` itself when
     * there is none. Handles `+`, `*`, `?` and `{n}`, `{n,}`, `{n,m}`.
     */
    private skipQuantifier(pattern: string, index: number, to: number): number {
        const char = pattern[index];
        if (char === '+' || char === '*' || char === '?') {
            return index + 1;
        }

        if (char !== '{') {
            return index;
        }

        // A brace that is not a quantifier (for example a literal `{` in a
        // pattern without an escape) does not consume anything.
        const match = /^\{\d+(?:,\d*)?\}/.exec(pattern.slice(index, to));
        return match ? index + match[0].length : index;
    }

    /** Index of the `)` matching the `(` at `open`, or -1 if unbalanced. */
    private findGroupEnd(pattern: string, open: number, to: number): number {
        let depth = 0;
        let i = open;

        while (i < to) {
            const char = pattern[i];

            if (char === '\\') {
                i += 2;
                continue;
            }

            if (char === '[') {
                i = this.skipCharacterClass(pattern, i, to);
                continue;
            }

            if (char === '(') {
                depth++;
            } else if (char === ')') {
                depth--;
                if (depth === 0) {
                    return i;
                }
            }

            i++;
        }

        return -1;
    }

    /** Index just past the character class starting at `open`. */
    private skipCharacterClass(pattern: string, open: number, to: number): number {
        let i = open + 1;
        // A `]` in the first position is a literal, not the closing bracket.
        if (pattern[i] === '^') {
            i++;
        }
        if (pattern[i] === ']') {
            i++;
        }

        while (i < to) {
            if (pattern[i] === '\\') {
                i += 2;
                continue;
            }
            if (pattern[i] === ']') {
                return i + 1;
            }
            i++;
        }

        return to;
    }

    /**
     * True when a group body can match a variable-length string, which is what
     * makes an enclosing quantifier exponential: it contains a quantified atom,
     * a wildcard, or ambiguous alternatives.
     */
    private isAmbiguousGroupBody(pattern: string, from: number, to: number): boolean {
        let i = from;

        while (i < to) {
            const char = pattern[i];

            if (char === '\\') {
                i += 2;
                continue;
            }

            if (char === '[') {
                i = this.skipCharacterClass(pattern, i, to);
                continue;
            }

            // A wildcard matches a variable amount of text on its own.
            if (char === '.') {
                return true;
            }

            if (char === '(') {
                const close = this.findGroupEnd(pattern, i, to);
                if (close === -1) {
                    return false;
                }
                // A quantified nested group makes the enclosing repetition
                // ambiguous, as in ((a)+)+. A non-quantified wrapper is
                // transparent: whether the wrap repeats depends on the body
                // inside it, so keep looking at the same level.
                if (this.skipQuantifier(pattern, close + 1, to) > close + 1) {
                    return true;
                }
                i = close + 1;
                continue;
            }

            i++;
        }

        return this.hasQuantifiedAtom(pattern, from, to) ||
            this.hasRepeatedAlternationBranch(pattern, from, to);
    }

    /**
     * True when the body quantifies something that can match a variable amount
     * of text: `a+`, `\w*`, `[abc]{2,}`, or a quantified group. A non-quantified
     * wrapper around such an atom counts too, which is what makes `(((a+)))+`
     * ambiguous.
     */
    private hasQuantifiedAtom(pattern: string, from: number, to: number): boolean {
        let i = from;

        while (i < to) {
            const char = pattern[i];

            if (char === '\\') {
                if (this.skipQuantifier(pattern, i + 2, to) > i + 2) {
                    return true;
                }
                i += 2;
                continue;
            }

            if (char === '[') {
                const afterClass = this.skipCharacterClass(pattern, i, to);
                if (this.skipQuantifier(pattern, afterClass, to) > afterClass) {
                    return true;
                }
                i = afterClass;
                continue;
            }

            if (char === '(') {
                const close = this.findGroupEnd(pattern, i, to);
                if (close === -1) {
                    return false;
                }
                if (this.skipQuantifier(pattern, close + 1, to) > close + 1) {
                    return true;
                }
                if (this.hasQuantifiedAtom(pattern, i + 1, close)) {
                    return true;
                }
                i = close + 1;
                continue;
            }

            if (this.skipQuantifier(pattern, i + 1, to) > i + 1) {
                return true;
            }

            i++;
        }

        return false;
    }

    /**
     * True when a group's alternatives are ambiguous under repetition: one
     * branch repeats, or one branch is a prefix/suffix of another, as in
     * `(a|ab)*`. Distinct alternatives of equal footing like `(abc|abd)+` stay
     * allowed — they are linear in practice, and rejecting them would refuse
     * ordinary merchant patterns.
     */
    private hasRepeatedAlternationBranch(pattern: string, from: number, to: number): boolean {
        const body = pattern.slice(from, to);
        if (!body.includes('|')) {
            return false;
        }

        const branches = body
            .split('|')
            .map((branch) => branch.trim())
            .filter((branch) => branch.length > 0);

        // An alternative that repeats gives the engine several ways to match
        // the same text, so the enclosing quantifier backtracks exponentially.
        if (new Set(branches).size < branches.length) {
            return true;
        }

        for (let i = 0; i < branches.length; i++) {
            for (let j = i + 1; j < branches.length; j++) {
                const a = branches[i];
                const b = branches[j];
                if (a === undefined || b === undefined) {
                    continue;
                }
                if (a.startsWith(b) || b.startsWith(a) || a.endsWith(b) || b.endsWith(a)) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Last-resort guard: run the compiled pattern against inputs that make a
     * catastrophically backtracking regexp explode, and reject it if it does.
     * Patterns whose ambiguity the structural checks cannot see (`a*a*a*a*b`
     * style) are caught here instead of freezing the extension host.
     */
    private probePatternCost(pattern: string): boolean {
        const inputLength = 24;
        const probes = [
            'a'.repeat(inputLength),
            'a'.repeat(inputLength) + 'X',
            `SHOP ${'a'.repeat(inputLength)}`,
        ];

        let regex: RegExp;
        try {
            regex = new RegExp(pattern, 'i');
        } catch {
            // Invalid patterns are reported separately by the compiler.
            return false;
        }

        for (const probe of probes) {
            const started = Date.now();
            regex.test(probe);
            if (Date.now() - started > MAX_PATTERN_PROBE_MS) {
                return true;
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
     * Compile regex patterns for merchant matching.
     *
     * User patterns are checked first so that a configured pattern overrides a
     * built-in one for the same payee, and built-ins are ordered most-specific
     * first: `AMAZON PRIME` must reach its own account before the generic
     * `AMAZON` entry claims it.
     */
    private compilePatterns(userPatterns: Record<string, string>): PatternCache[] {
        const patterns: PatternCache[] = [];

        // User patterns take precedence; they are matched before the built-ins.
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

        const builtIns = Object.entries(BUILTIN_MERCHANT_PATTERNS)
            // Longest pattern text first, so a specific entry is never shadowed
            // by a broader one; ties keep the table's own order.
            .map(([pattern, account], index) => ({ pattern, account, index }))
            .sort((a, b) => b.pattern.length - a.pattern.length || a.index - b.index);

        for (const { pattern, account } of builtIns) {
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

}
