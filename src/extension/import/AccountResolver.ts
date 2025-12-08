/**
 * Smart account resolver with multiple detection strategies
 * Determines hledger accounts from CSV data automatically
 */

import {
    AccountResolution,
    AccountResolutionSource,
    ImportOptions,
    BUILTIN_CATEGORY_MAPPING,
    BUILTIN_MERCHANT_PATTERNS,
} from './types';

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
            confidence: 0,
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
                confidence: 0.95,
                source: 'category',
            };
        }

        // Partial match (category contains key or key contains category)
        for (const [key, account] of this.categoryMapping) {
            if (normalizedCategory.includes(key) || key.includes(normalizedCategory)) {
                return {
                    account,
                    confidence: 0.8,
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
                    confidence: 0.85,
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
                confidence: 0.5,
                source: 'sign',
            };
        } else if (amount < 0) {
            return {
                account: this.defaultDebitAccount,
                confidence: 0.5,
                source: 'sign',
            };
        }

        return {
            account: this.defaultPlaceholder,
            confidence: 0,
            source: 'default',
        };
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
            try {
                patterns.push({
                    regex: new RegExp(pattern, 'i'),
                    account,
                });
            } catch {
                // Skip invalid regex patterns
                console.warn(`Invalid user pattern: ${pattern}`);
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
