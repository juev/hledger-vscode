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
 * Cache for compiled regex patterns to avoid recompilation
 */
interface PatternCache {
    regex: RegExp;
    account: string;
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
    private readonly partialMatchCache = new Map<string, AccountResolution | null>();
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
        amount?: number
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
     * Rejects patterns with nested quantifiers that can cause catastrophic backtracking
     */
    private validateRegexSafety(pattern: string): boolean {
        // Reject patterns with dangerous constructs (nested quantifiers)
        // Examples: (a+)+, (a*)+, (a+){n}, (a+)*, etc.
        const dangerousPattern = /\([^)]*[+*]\)[+*{]/;
        if (dangerousPattern.test(pattern)) {
            return false;
        }

        // Limit pattern length to prevent complexity attacks
        if (pattern.length > 200) {
            return false;
        }

        return true;
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
    static formatWithAnnotation(
        resolution: AccountResolution,
        includeAnnotation = true
    ): string {
        if (!includeAnnotation || resolution.source === 'default') {
            return resolution.account;
        }

        return `${resolution.account}  ; matched: ${this.describeSource(resolution.source)}`;
    }
}
