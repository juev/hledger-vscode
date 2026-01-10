import { AccountName, CommodityCode } from '../types';

/**
 * Type of posting for balance calculation purposes.
 * - real: Normal posting, must balance
 * - unbalancedVirtual: (account) - exempt from balancing
 * - balancedVirtual: [account] - must balance among themselves separately
 */
export type PostingType = 'real' | 'unbalancedVirtual' | 'balancedVirtual';

/**
 * Parsed amount from a posting line.
 * Supports cost notation (@ and @@) for commodity conversion.
 */
export interface ParsedPostingAmount {
    readonly value: number;
    readonly commodity: CommodityCode;
    readonly precision: number;
    readonly cost?: {
        readonly value: number;
        readonly commodity: CommodityCode;
        readonly isTotal: boolean;
        readonly precision: number;
    };
    readonly isBalanceAssertionOnly: boolean;
}

/**
 * Parsed posting with full context for balance checking.
 */
export interface ParsedPosting {
    readonly rawAccount: string;
    readonly account: AccountName;
    readonly type: PostingType;
    readonly amount: ParsedPostingAmount | null;
    readonly lineNumber: number;
}

/**
 * Complete parsed transaction for balance validation.
 */
export interface ParsedTransaction {
    readonly date: string;
    readonly headerLineNumber: number;
    readonly postings: readonly ParsedPosting[];
    readonly description: string;
}

/**
 * Detailed balance error information.
 */
export interface BalanceError {
    readonly type: 'imbalanced' | 'multipleInferred' | 'parseError';
    readonly message: string;
    readonly commodity?: CommodityCode;
    readonly difference?: number;
    readonly postingGroup?: 'real' | 'balancedVirtual';
}

/**
 * Result of balance validation for a transaction.
 */
export type BalanceResult =
    | { readonly status: 'balanced' }
    | { readonly status: 'unbalanced'; readonly errors: readonly BalanceError[] }
    | { readonly status: 'error'; readonly message: string };
