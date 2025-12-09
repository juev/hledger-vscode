/**
 * Smart account resolver with multiple detection strategies
 * Determines hledger accounts from CSV data automatically
 */

import * as vscode from 'vscode';
import {
    AccountResolution,
    AccountResolutionSource,
    ImportOptions,
    BUILTIN_CATEGORY_MAPPING,
    BUILTIN_MERCHANT_PATTERNS,
} from './types';

/**
 * Confidence thresholds for account resolution strategies.
 * Higher values indicate more reliable detection methods.
 */
const CONFIDENCE = {
    /** Direct category match from CSV column */
    CATEGORY_EXACT: 0.95,
    /** Partial category match (contains/contained by) */
    CATEGORY_PARTIAL: 0.8,
    /** Merchant pattern regex match */
    MERCHANT_PATTERN: 0.85,
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
 * 1. Category column mapping (if category provided)
 * 2. Merchant pattern matching (regex against description)
 * 3. Amount sign heuristic (positive = income, negative = expense)
 * 4. Default placeholder (TODO:account)
 */
export class AccountResolver {
    private readonly categoryMapping: Map<string, string>;
    private readonly merchantPatterns: PatternCache[];
    private readonly defaultDebitAccount: string;
    private readonly defaultCreditAccount: string;
    private readonly defaultPlaceholder: string;

    constructor(options: ImportOptions) {
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
        // Strategy 1: Category mapping (highest confidence)
        if (category) {
            const categoryResult = this.resolveFromCategory(category);
            if (categoryResult) {
                return categoryResult;
            }
        }

        // Strategy 2: Merchant pattern matching
        if (description) {
            const patternResult = this.resolveFromPattern(description);
            if (patternResult) {
                return patternResult;
            }
        }

        // Strategy 3: Amount sign heuristic
        if (amount !== undefined) {
            return this.resolveFromAmount(amount);
        }

        // Strategy 4: Default placeholder
        return {
            account: this.defaultPlaceholder,
            confidence: CONFIDENCE.DEFAULT,
            source: 'default',
        };
    }

    /**
     * Resolve account from category column
     */
    private resolveFromCategory(category: string): AccountResolution | null {
        const normalizedCategory = category.toLowerCase().trim();

        // Direct match
        const directMatch = this.categoryMapping.get(normalizedCategory);
        if (directMatch) {
            return {
                account: directMatch,
                confidence: CONFIDENCE.CATEGORY_EXACT,
                source: 'category',
            };
        }

        // Partial match (category contains key or key contains category)
        for (const [key, account] of this.categoryMapping) {
            if (normalizedCategory.includes(key) || key.includes(normalizedCategory)) {
                return {
                    account,
                    confidence: CONFIDENCE.CATEGORY_PARTIAL,
                    source: 'category',
                };
            }
        }

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
