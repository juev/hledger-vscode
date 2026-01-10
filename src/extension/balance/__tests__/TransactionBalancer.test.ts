import { TransactionBalancer } from '../TransactionBalancer';
import { ParsedTransaction, ParsedPosting, ParsedPostingAmount, PostingType } from '../types';
import { AccountName, CommodityCode } from '../../types';

function createPosting(
    account: string,
    amount: Partial<ParsedPostingAmount> | null,
    type: PostingType = 'real',
    lineNumber = 1
): ParsedPosting {
    return {
        rawAccount: account,
        account: account as AccountName,
        type,
        amount: amount ? {
            value: amount.value ?? 0,
            commodity: (amount.commodity ?? '') as CommodityCode,
            precision: amount.precision ?? 2,
            ...(amount.cost && { cost: amount.cost }),
            isBalanceAssertionOnly: amount.isBalanceAssertionOnly ?? false,
        } : null,
        lineNumber,
    };
}

function createTransaction(postings: ParsedPosting[], date = '2024-01-15'): ParsedTransaction {
    return {
        date,
        headerLineNumber: 0,
        postings,
        description: 'Test Transaction',
    };
}

describe('TransactionBalancer', () => {
    let balancer: TransactionBalancer;

    beforeEach(() => {
        balancer = new TransactionBalancer();
    });

    describe('simple balancing', () => {
        it('should return balanced for two postings summing to zero', () => {
            const transaction = createTransaction([
                createPosting('Expenses:Food', { value: 50, commodity: '$' }),
                createPosting('Assets:Cash', { value: -50, commodity: '$' }),
            ]);

            const result = balancer.checkBalance(transaction);
            expect(result.status).toBe('balanced');
        });

        it('should return unbalanced for two postings not summing to zero', () => {
            const transaction = createTransaction([
                createPosting('Expenses:Food', { value: 50, commodity: '$' }),
                createPosting('Assets:Cash', { value: -40, commodity: '$' }),
            ]);

            const result = balancer.checkBalance(transaction);
            expect(result.status).toBe('unbalanced');
            if (result.status === 'unbalanced') {
                expect(result.errors[0]!.type).toBe('imbalanced');
                expect(result.errors[0]!.difference).toBe(10);
            }
        });

        it('should return balanced for multiple postings summing to zero', () => {
            const transaction = createTransaction([
                createPosting('Expenses:Food', { value: 30, commodity: '$' }),
                createPosting('Expenses:Transport', { value: 20, commodity: '$' }),
                createPosting('Assets:Cash', { value: -50, commodity: '$' }),
            ]);

            const result = balancer.checkBalance(transaction);
            expect(result.status).toBe('balanced');
        });

        it('should return balanced for empty commodity', () => {
            const transaction = createTransaction([
                createPosting('Expenses:Food', { value: 50, commodity: '' }),
                createPosting('Assets:Cash', { value: -50, commodity: '' }),
            ]);

            const result = balancer.checkBalance(transaction);
            expect(result.status).toBe('balanced');
        });
    });

    describe('inferred amounts', () => {
        it('should return balanced when one amount is inferred', () => {
            const transaction = createTransaction([
                createPosting('Expenses:Food', { value: 50, commodity: '$' }),
                createPosting('Assets:Cash', null),
            ]);

            const result = balancer.checkBalance(transaction);
            expect(result.status).toBe('balanced');
        });

        it('should return error when multiple amounts are inferred', () => {
            const transaction = createTransaction([
                createPosting('Expenses:Food', null),
                createPosting('Assets:Cash', null),
            ]);

            const result = balancer.checkBalance(transaction);
            expect(result.status).toBe('unbalanced');
            if (result.status === 'unbalanced') {
                expect(result.errors[0]!.type).toBe('multipleInferred');
            }
        });

        it('should handle inferred amount with multiple specified amounts', () => {
            const transaction = createTransaction([
                createPosting('Expenses:Food', { value: 30, commodity: '$' }),
                createPosting('Expenses:Transport', { value: 20, commodity: '$' }),
                createPosting('Assets:Cash', null),
            ]);

            const result = balancer.checkBalance(transaction);
            expect(result.status).toBe('balanced');
        });
    });

    describe('multi-commodity', () => {
        it('should return balanced when each commodity sums to zero', () => {
            const transaction = createTransaction([
                createPosting('Expenses:Food', { value: 50, commodity: 'USD' }),
                createPosting('Assets:USD', { value: -50, commodity: 'USD' }),
                createPosting('Expenses:EuroFood', { value: 30, commodity: 'EUR' }),
                createPosting('Assets:EUR', { value: -30, commodity: 'EUR' }),
            ]);

            const result = balancer.checkBalance(transaction);
            expect(result.status).toBe('balanced');
        });

        it('should return unbalanced when one commodity does not balance', () => {
            const transaction = createTransaction([
                createPosting('Expenses:Food', { value: 50, commodity: 'USD' }),
                createPosting('Assets:USD', { value: -50, commodity: 'USD' }),
                createPosting('Expenses:EuroFood', { value: 30, commodity: 'EUR' }),
                createPosting('Assets:EUR', { value: -25, commodity: 'EUR' }),
            ]);

            const result = balancer.checkBalance(transaction);
            expect(result.status).toBe('unbalanced');
            if (result.status === 'unbalanced') {
                expect(result.errors[0]!.commodity).toBe('EUR');
            }
        });

        it('should report all unbalanced commodities', () => {
            const transaction = createTransaction([
                createPosting('Expenses:Food', { value: 50, commodity: 'USD' }),
                createPosting('Assets:USD', { value: -40, commodity: 'USD' }),
                createPosting('Expenses:EuroFood', { value: 30, commodity: 'EUR' }),
                createPosting('Assets:EUR', { value: -25, commodity: 'EUR' }),
            ]);

            const result = balancer.checkBalance(transaction);
            expect(result.status).toBe('unbalanced');
            if (result.status === 'unbalanced') {
                expect(result.errors.length).toBe(2);
            }
        });
    });

    describe('cost notation', () => {
        it('should return balanced for unit cost @', () => {
            const transaction = createTransaction([
                createPosting('Assets:Stocks', {
                    value: 10,
                    commodity: 'AAPL',
                    cost: { value: 150, commodity: '$' as CommodityCode, isTotal: false, precision: 2 },
                }),
                createPosting('Assets:Cash', { value: -1500, commodity: '$' }),
            ]);

            const result = balancer.checkBalance(transaction);
            expect(result.status).toBe('balanced');
        });

        it('should return balanced for total cost @@', () => {
            const transaction = createTransaction([
                createPosting('Assets:Stocks', {
                    value: 10,
                    commodity: 'AAPL',
                    cost: { value: 1500, commodity: '$' as CommodityCode, isTotal: true, precision: 2 },
                }),
                createPosting('Assets:Cash', { value: -1500, commodity: '$' }),
            ]);

            const result = balancer.checkBalance(transaction);
            expect(result.status).toBe('balanced');
        });

        it('should return unbalanced when cost does not match', () => {
            const transaction = createTransaction([
                createPosting('Assets:Stocks', {
                    value: 10,
                    commodity: 'AAPL',
                    cost: { value: 150, commodity: '$' as CommodityCode, isTotal: false, precision: 2 },
                }),
                createPosting('Assets:Cash', { value: -1400, commodity: '$' }),
            ]);

            const result = balancer.checkBalance(transaction);
            expect(result.status).toBe('unbalanced');
        });

        it('should handle euro to dollar conversion', () => {
            const transaction = createTransaction([
                createPosting('Assets:EUR', {
                    value: 100,
                    commodity: 'EUR',
                    cost: { value: 1.10, commodity: 'USD' as CommodityCode, isTotal: false, precision: 2 },
                }),
                createPosting('Assets:USD', { value: -110, commodity: 'USD' }),
            ]);

            const result = balancer.checkBalance(transaction);
            expect(result.status).toBe('balanced');
        });

        it('should handle negative amounts with cost', () => {
            const transaction = createTransaction([
                createPosting('Assets:Stocks', {
                    value: -10,
                    commodity: 'AAPL',
                    cost: { value: 150, commodity: '$' as CommodityCode, isTotal: false, precision: 2 },
                }),
                createPosting('Assets:Cash', { value: 1500, commodity: '$' }),
            ]);

            const result = balancer.checkBalance(transaction);
            expect(result.status).toBe('balanced');
        });
    });

    describe('virtual postings', () => {
        it('should ignore unbalanced virtual postings', () => {
            const transaction = createTransaction([
                createPosting('Expenses:Food', { value: 50, commodity: '$' }, 'real'),
                createPosting('Assets:Cash', { value: -50, commodity: '$' }, 'real'),
                createPosting('Budget:Food', { value: 50, commodity: '$' }, 'unbalancedVirtual'),
            ]);

            const result = balancer.checkBalance(transaction);
            expect(result.status).toBe('balanced');
        });

        it('should check balanced virtual postings separately', () => {
            const transaction = createTransaction([
                createPosting('Expenses:Food', { value: 50, commodity: '$' }, 'real'),
                createPosting('Assets:Cash', { value: -50, commodity: '$' }, 'real'),
                createPosting('Budget:Food', { value: -50, commodity: '$' }, 'balancedVirtual'),
                createPosting('Budget:Available', { value: 50, commodity: '$' }, 'balancedVirtual'),
            ]);

            const result = balancer.checkBalance(transaction);
            expect(result.status).toBe('balanced');
        });

        it('should return unbalanced when virtual postings do not balance', () => {
            const transaction = createTransaction([
                createPosting('Expenses:Food', { value: 50, commodity: '$' }, 'real'),
                createPosting('Assets:Cash', { value: -50, commodity: '$' }, 'real'),
                createPosting('Budget:Food', { value: -50, commodity: '$' }, 'balancedVirtual'),
                createPosting('Budget:Available', { value: 40, commodity: '$' }, 'balancedVirtual'),
            ]);

            const result = balancer.checkBalance(transaction);
            expect(result.status).toBe('unbalanced');
            if (result.status === 'unbalanced') {
                expect(result.errors[0]!.postingGroup).toBe('balancedVirtual');
            }
        });

        it('should allow separate inferred amounts in real and virtual groups', () => {
            const transaction = createTransaction([
                createPosting('Expenses:Food', { value: 50, commodity: '$' }, 'real'),
                createPosting('Assets:Cash', null, 'real'),
                createPosting('Budget:Food', { value: -50, commodity: '$' }, 'balancedVirtual'),
                createPosting('Budget:Available', null, 'balancedVirtual'),
            ]);

            const result = balancer.checkBalance(transaction);
            expect(result.status).toBe('balanced');
        });
    });

    describe('balance assertions', () => {
        it('should treat balance assertion only as zero contribution', () => {
            const transaction = createTransaction([
                createPosting('Assets:Checking', {
                    value: 0,
                    commodity: '$',
                    isBalanceAssertionOnly: true,
                }),
                createPosting('Expenses:Adjustment', { value: 0, commodity: '$' }),
            ]);

            const result = balancer.checkBalance(transaction);
            expect(result.status).toBe('balanced');
        });

        it('should use actual value when amount has assertion', () => {
            const transaction = createTransaction([
                createPosting('Assets:Checking', {
                    value: 100,
                    commodity: '$',
                    isBalanceAssertionOnly: false,
                }),
                createPosting('Income:Salary', { value: -100, commodity: '$' }),
            ]);

            const result = balancer.checkBalance(transaction);
            expect(result.status).toBe('balanced');
        });
    });

    describe('balancing precision', () => {
        it('should use highest precision in transaction', () => {
            const transaction = createTransaction([
                createPosting('Expenses:Food', { value: 50.123, commodity: '$', precision: 3 }),
                createPosting('Assets:Cash', { value: -50.123, commodity: '$', precision: 3 }),
            ]);

            const result = balancer.checkBalance(transaction);
            expect(result.status).toBe('balanced');
        });

        it('should round correctly at precision boundary', () => {
            const transaction = createTransaction([
                createPosting('Expenses:Food', { value: 33.33, commodity: '$', precision: 2 }),
                createPosting('Expenses:Food', { value: 33.33, commodity: '$', precision: 2 }),
                createPosting('Expenses:Food', { value: 33.34, commodity: '$', precision: 2 }),
                createPosting('Assets:Cash', { value: -100, commodity: '$', precision: 2 }),
            ]);

            const result = balancer.checkBalance(transaction);
            expect(result.status).toBe('balanced');
        });

        it('should handle very small differences within precision', () => {
            const transaction = createTransaction([
                createPosting('Expenses:Food', { value: 10.00, commodity: '$', precision: 2 }),
                createPosting('Assets:Cash', { value: -10.001, commodity: '$', precision: 3 }),
            ]);

            const result = balancer.checkBalance(transaction);
            expect(result.status).toBe('unbalanced');
        });
    });

    describe('balance assertion only with inferred', () => {
        it('should return balanced for balance assertion only with inferred amount', () => {
            const transaction = createTransaction([
                createPosting('Assets:Checking', {
                    value: 0,
                    commodity: '$',
                    isBalanceAssertionOnly: true,
                }),
                createPosting('Income:Salary', null),
            ]);

            const result = balancer.checkBalance(transaction);
            expect(result.status).toBe('balanced');
        });
    });

    describe('edge cases', () => {
        it('should handle empty transaction (no postings)', () => {
            const transaction = createTransaction([]);

            const result = balancer.checkBalance(transaction);
            expect(result.status).toBe('balanced');
        });

        it('should handle single posting with inferred amount', () => {
            const transaction = createTransaction([
                createPosting('Assets:Cash', null),
            ]);

            const result = balancer.checkBalance(transaction);
            expect(result.status).toBe('balanced');
        });

        it('should handle unicode commodities', () => {
            const transaction = createTransaction([
                createPosting('Expenses:Food', { value: 1000, commodity: '₽' }),
                createPosting('Assets:Cash', { value: -1000, commodity: '₽' }),
            ]);

            const result = balancer.checkBalance(transaction);
            expect(result.status).toBe('balanced');
        });

        it('should handle large numbers', () => {
            const transaction = createTransaction([
                createPosting('Assets:Investment', { value: 1000000000, commodity: '$' }),
                createPosting('Assets:Cash', { value: -1000000000, commodity: '$' }),
            ]);

            const result = balancer.checkBalance(transaction);
            expect(result.status).toBe('balanced');
        });

        it('should handle very small numbers', () => {
            const transaction = createTransaction([
                createPosting('Assets:Crypto', { value: 0.00000001, commodity: 'BTC', precision: 8 }),
                createPosting('Assets:Cash', { value: -0.00000001, commodity: 'BTC', precision: 8 }),
            ]);

            const result = balancer.checkBalance(transaction);
            expect(result.status).toBe('balanced');
        });
    });
});
