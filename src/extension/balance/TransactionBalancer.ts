import { CommodityCode } from '../types';
import { ParsedTransaction, ParsedPosting, BalanceResult, BalanceError } from './types';
import { NumberFormatContext } from './AmountParser';

export class TransactionBalancer {
    private static readonly DEFAULT_TOLERANCE = 1e-10;
    private static readonly CURRENCY_SYMBOL_PATTERN = /^[\p{Sc}]$/u;

    constructor(private readonly tolerance: number = TransactionBalancer.DEFAULT_TOLERANCE) {}

    checkBalance(transaction: ParsedTransaction, formatContext?: NumberFormatContext): BalanceResult {
        if (transaction.postings.length === 0) {
            return { status: 'balanced' };
        }

        const realPostings = transaction.postings.filter(p => p.type === 'real');
        const balancedVirtualPostings = transaction.postings.filter(p => p.type === 'balancedVirtual');

        const errors: BalanceError[] = [];

        const realResult = this.checkPostingGroup(realPostings, 'real', formatContext);
        errors.push(...realResult);

        if (balancedVirtualPostings.length > 0) {
            const virtualResult = this.checkPostingGroup(balancedVirtualPostings, 'balancedVirtual', formatContext);
            errors.push(...virtualResult);
        }

        if (errors.length === 0) {
            return { status: 'balanced' };
        }

        return { status: 'unbalanced', errors };
    }

    private checkPostingGroup(
        postings: readonly ParsedPosting[],
        group: 'real' | 'balancedVirtual',
        formatContext?: NumberFormatContext
    ): BalanceError[] {
        const errors: BalanceError[] = [];

        if (postings.length === 0) {
            return errors;
        }

        const inferredCount = postings.filter(p => p.amount === null).length;
        if (inferredCount > 1) {
            errors.push({
                type: 'multipleInferred',
                message: `Transaction has ${inferredCount} postings without amounts; at most one is allowed`,
                postingGroup: group,
            });
            return errors;
        }

        const commodityBalances = this.sumByCommodity(postings);

        for (const [commodity, balance] of commodityBalances) {
            const roundedSum = this.roundToPrecision(balance.sum, balance.precision);

            if (Math.abs(roundedSum) > this.tolerance) {
                if (inferredCount === 1) {
                    continue;
                }

                const commodityDisplay = commodity || 'no commodity';
                const differenceDisplay = this.formatAmount(roundedSum, commodity, balance.precision, formatContext);

                errors.push({
                    type: 'imbalanced',
                    message: `Transaction is unbalanced in ${commodityDisplay}; difference is ${differenceDisplay}`,
                    commodity,
                    difference: roundedSum,
                    postingGroup: group,
                });
            }
        }

        return errors;
    }

    private sumByCommodity(
        postings: readonly ParsedPosting[]
    ): Map<CommodityCode, { sum: number; precision: number }> {
        const balances = new Map<CommodityCode, { sum: number; precision: number }>();

        for (const posting of postings) {
            if (posting.amount === null) continue;
            if (posting.amount.isBalanceAssertionOnly) continue;

            const { value, commodity, precision, cost } = posting.amount;

            if (cost) {
                // cost.value is always positive (sign stripped in AmountParser).
                // Calculate total cost: for unit price (@) multiply by quantity,
                // for total price (@@) use directly. Then apply original value's sign.
                const costValue = cost.isTotal ? cost.value : Math.abs(value) * cost.value;
                const convertedValue = value >= 0 ? costValue : -costValue;

                this.addToBalance(balances, cost.commodity, convertedValue, cost.precision);
            } else {
                this.addToBalance(balances, commodity, value, precision);
            }
        }

        return balances;
    }

    private addToBalance(
        balances: Map<CommodityCode, { sum: number; precision: number }>,
        commodity: CommodityCode,
        value: number,
        precision: number
    ): void {
        const existing = balances.get(commodity);
        if (existing) {
            existing.sum += value;
            existing.precision = Math.max(existing.precision, precision);
        } else {
            balances.set(commodity, { sum: value, precision });
        }
    }

    private roundToPrecision(value: number, precision: number): number {
        const factor = Math.pow(10, precision);
        return Math.round(value * factor) / factor;
    }

    private formatAmount(
        value: number,
        commodity: CommodityCode,
        precision: number,
        formatContext?: NumberFormatContext
    ): string {
        const absValue = Math.abs(value);
        const sign = value < 0 ? '-' : '';

        if (!commodity) {
            return `${sign}${absValue.toFixed(precision)}`;
        }

        const format = formatContext?.commodityFormats?.get(commodity);
        const symbolBefore = format?.symbolBefore ?? TransactionBalancer.CURRENCY_SYMBOL_PATTERN.test(commodity);

        return symbolBefore
            ? `${sign}${commodity}${absValue.toFixed(precision)}`
            : `${sign}${absValue.toFixed(precision)} ${commodity}`;
    }
}
