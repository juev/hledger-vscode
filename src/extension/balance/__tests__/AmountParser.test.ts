import { AmountParser } from '../AmountParser';
import { PostingType } from '../types';

describe('AmountParser', () => {
    let parser: AmountParser;

    beforeEach(() => {
        parser = new AmountParser();
    });

    describe('parsePostingAmount', () => {
        describe('basic amounts', () => {
            it('should parse simple integer', () => {
                const result = parser.parsePostingAmount('100');
                expect(result).not.toBeNull();
                expect(result!.value).toBe(100);
                expect(result!.commodity).toBe('');
                expect(result!.precision).toBe(0);
                expect(result!.isBalanceAssertionOnly).toBe(false);
            });

            it('should parse negative integer', () => {
                const result = parser.parsePostingAmount('-100');
                expect(result).not.toBeNull();
                expect(result!.value).toBe(-100);
            });

            it('should parse positive with explicit sign', () => {
                const result = parser.parsePostingAmount('+100');
                expect(result).not.toBeNull();
                expect(result!.value).toBe(100);
            });

            it('should parse decimal amount', () => {
                const result = parser.parsePostingAmount('100.50');
                expect(result).not.toBeNull();
                expect(result!.value).toBe(100.50);
                expect(result!.precision).toBe(2);
            });

            it('should parse amount with many decimal places', () => {
                const result = parser.parsePostingAmount('0.00000001');
                expect(result).not.toBeNull();
                expect(result!.value).toBe(0.00000001);
                expect(result!.precision).toBe(8);
            });
        });

        describe('commodity formats', () => {
            it('should parse suffix commodity: 100 USD', () => {
                const result = parser.parsePostingAmount('100 USD');
                expect(result).not.toBeNull();
                expect(result!.value).toBe(100);
                expect(result!.commodity).toBe('USD');
            });

            it('should parse prefix commodity: $100', () => {
                const result = parser.parsePostingAmount('$100');
                expect(result).not.toBeNull();
                expect(result!.value).toBe(100);
                expect(result!.commodity).toBe('$');
            });

            it('should parse prefix with space: $ 100', () => {
                const result = parser.parsePostingAmount('$ 100');
                expect(result).not.toBeNull();
                expect(result!.value).toBe(100);
                expect(result!.commodity).toBe('$');
            });

            it('should parse negative with prefix commodity: -$100', () => {
                const result = parser.parsePostingAmount('-$100');
                expect(result).not.toBeNull();
                expect(result!.value).toBe(-100);
                expect(result!.commodity).toBe('$');
            });

            it('should parse sign after prefix: $-100', () => {
                const result = parser.parsePostingAmount('$-100');
                expect(result).not.toBeNull();
                expect(result!.value).toBe(-100);
                expect(result!.commodity).toBe('$');
            });

            it('should parse negative suffix: -100 USD', () => {
                const result = parser.parsePostingAmount('-100 USD');
                expect(result).not.toBeNull();
                expect(result!.value).toBe(-100);
                expect(result!.commodity).toBe('USD');
            });

            it('should parse unicode commodity: €100', () => {
                const result = parser.parsePostingAmount('€100');
                expect(result).not.toBeNull();
                expect(result!.value).toBe(100);
                expect(result!.commodity).toBe('€');
            });

            it('should parse unicode suffix: 100 ₽', () => {
                const result = parser.parsePostingAmount('100 ₽');
                expect(result).not.toBeNull();
                expect(result!.value).toBe(100);
                expect(result!.commodity).toBe('₽');
            });

            it('should parse quoted commodity: 3 "green apples"', () => {
                const result = parser.parsePostingAmount('3 "green apples"');
                expect(result).not.toBeNull();
                expect(result!.value).toBe(3);
                expect(result!.commodity).toBe('"green apples"');
            });
        });

        describe('number grouping formats', () => {
            it('should parse US format: 1,000.00', () => {
                const result = parser.parsePostingAmount('1,000.00');
                expect(result).not.toBeNull();
                expect(result!.value).toBe(1000);
                expect(result!.precision).toBe(2);
            });

            it('should parse EU format: 1.000,00', () => {
                const result = parser.parsePostingAmount('1.000,00');
                expect(result).not.toBeNull();
                expect(result!.value).toBe(1000);
                expect(result!.precision).toBe(2);
            });

            it('should parse space grouping: 1 000,00', () => {
                const result = parser.parsePostingAmount('1 000,00');
                expect(result).not.toBeNull();
                expect(result!.value).toBe(1000);
                expect(result!.precision).toBe(2);
            });

            it('should parse large US format: 1,000,000.50', () => {
                const result = parser.parsePostingAmount('1,000,000.50');
                expect(result).not.toBeNull();
                expect(result!.value).toBe(1000000.50);
            });

            it('should parse with commodity: $1,000.00', () => {
                const result = parser.parsePostingAmount('$1,000.00');
                expect(result).not.toBeNull();
                expect(result!.value).toBe(1000);
                expect(result!.commodity).toBe('$');
            });

            it('should parse Indian numbering: 1,00,000.00', () => {
                const result = parser.parsePostingAmount('1,00,000.00');
                expect(result).not.toBeNull();
                expect(result!.value).toBe(100000);
            });
        });

        describe('scientific notation', () => {
            it('should parse positive exponent: 1E3', () => {
                const result = parser.parsePostingAmount('1E3');
                expect(result).not.toBeNull();
                expect(result!.value).toBe(1000);
            });

            it('should parse negative exponent: 1E-6', () => {
                const result = parser.parsePostingAmount('1E-6');
                expect(result).not.toBeNull();
                expect(result!.value).toBeCloseTo(0.000001);
            });

            it('should parse with commodity: EUR 1E3', () => {
                const result = parser.parsePostingAmount('EUR 1E3');
                expect(result).not.toBeNull();
                expect(result!.value).toBe(1000);
                expect(result!.commodity).toBe('EUR');
            });

            it('should parse lowercase e: 1e-6', () => {
                const result = parser.parsePostingAmount('1e-6');
                expect(result).not.toBeNull();
                expect(result!.value).toBeCloseTo(0.000001);
            });
        });

        describe('cost notation', () => {
            it('should parse unit cost @: 10 AAPL @ $150', () => {
                const result = parser.parsePostingAmount('10 AAPL @ $150');
                expect(result).not.toBeNull();
                expect(result!.value).toBe(10);
                expect(result!.commodity).toBe('AAPL');
                expect(result!.cost).toBeDefined();
                expect(result!.cost!.value).toBe(150);
                expect(result!.cost!.commodity).toBe('$');
                expect(result!.cost!.isTotal).toBe(false);
            });

            it('should parse total cost @@: 10 AAPL @@ $1500', () => {
                const result = parser.parsePostingAmount('10 AAPL @@ $1500');
                expect(result).not.toBeNull();
                expect(result!.value).toBe(10);
                expect(result!.commodity).toBe('AAPL');
                expect(result!.cost).toBeDefined();
                expect(result!.cost!.value).toBe(1500);
                expect(result!.cost!.commodity).toBe('$');
                expect(result!.cost!.isTotal).toBe(true);
            });

            it('should parse negative with cost: -10 AAPL @ $150', () => {
                const result = parser.parsePostingAmount('-10 AAPL @ $150');
                expect(result).not.toBeNull();
                expect(result!.value).toBe(-10);
                expect(result!.cost!.value).toBe(150);
            });

            it('should parse euro conversion: €100 @ $1.35', () => {
                const result = parser.parsePostingAmount('€100 @ $1.35');
                expect(result).not.toBeNull();
                expect(result!.value).toBe(100);
                expect(result!.commodity).toBe('€');
                expect(result!.cost!.value).toBe(1.35);
                expect(result!.cost!.commodity).toBe('$');
                expect(result!.cost!.precision).toBe(2);
            });

            it('should parse total euro conversion: €100 @@ $135', () => {
                const result = parser.parsePostingAmount('€100 @@ $135');
                expect(result).not.toBeNull();
                expect(result!.value).toBe(100);
                expect(result!.cost!.value).toBe(135);
                expect(result!.cost!.isTotal).toBe(true);
            });
        });

        describe('balance assertions', () => {
            it('should parse assertion only: = $500', () => {
                const result = parser.parsePostingAmount('= $500');
                expect(result).not.toBeNull();
                expect(result!.isBalanceAssertionOnly).toBe(true);
                expect(result!.value).toBe(0);
            });

            it('should parse compact assertion: =$500', () => {
                const result = parser.parsePostingAmount('=$500');
                expect(result).not.toBeNull();
                expect(result!.isBalanceAssertionOnly).toBe(true);
            });

            it('should parse double assertion: == $500', () => {
                const result = parser.parsePostingAmount('== $500');
                expect(result).not.toBeNull();
                expect(result!.isBalanceAssertionOnly).toBe(true);
                expect(result!.value).toBe(0);
            });

            it('should parse double assertion without space: ==$500', () => {
                const result = parser.parsePostingAmount('==$500');
                expect(result).not.toBeNull();
                expect(result!.isBalanceAssertionOnly).toBe(true);
                expect(result!.value).toBe(0);
            });

            it('should parse inclusive assertion: =* $500', () => {
                const result = parser.parsePostingAmount('=* $500');
                expect(result).not.toBeNull();
                expect(result!.isBalanceAssertionOnly).toBe(true);
            });

            it('should parse amount with assertion: $100 = $500', () => {
                const result = parser.parsePostingAmount('$100 = $500');
                expect(result).not.toBeNull();
                expect(result!.isBalanceAssertionOnly).toBe(false);
                expect(result!.value).toBe(100);
                expect(result!.commodity).toBe('$');
            });

            it('should parse negative assertion only: = -$500', () => {
                const result = parser.parsePostingAmount('= -$500');
                expect(result).not.toBeNull();
                expect(result!.isBalanceAssertionOnly).toBe(true);
            });

            it('should parse balance assignment: := $500', () => {
                const result = parser.parsePostingAmount(':= $500');
                expect(result).not.toBeNull();
                expect(result!.isBalanceAssertionOnly).toBe(true);
                expect(result!.value).toBe(0);
            });
        });

        describe('edge cases', () => {
            it('should return null for empty string', () => {
                const result = parser.parsePostingAmount('');
                expect(result).toBeNull();
            });

            it('should return null for whitespace only', () => {
                const result = parser.parsePostingAmount('   ');
                expect(result).toBeNull();
            });

            it('should handle trailing decimal: 10.', () => {
                const result = parser.parsePostingAmount('10.');
                expect(result).not.toBeNull();
                expect(result!.value).toBe(10);
                expect(result!.precision).toBe(0);
            });
        });

        describe('performance and security', () => {
            it('should handle long string without @ quickly (ReDoS prevention)', () => {
                const longString = '1' + '0'.repeat(1000) + ' USD';
                const start = performance.now();
                const result = parser.parsePostingAmount(longString);
                const elapsed = performance.now() - start;
                expect(elapsed).toBeLessThan(100);
                expect(result).not.toBeNull();
            });
        });

        describe('scientific notation boundary values', () => {
            it('should parse exponent at boundary: 1E308', () => {
                const result = parser.parsePostingAmount('1E308');
                expect(result).not.toBeNull();
                expect(result!.value).toBe(1e308);
            });

            it('should return null for exponent overflow: 1E309', () => {
                const result = parser.parsePostingAmount('1E309');
                expect(result).toBeNull();
            });

            it('should parse negative exponent at boundary: 1E-308', () => {
                const result = parser.parsePostingAmount('1E-308');
                expect(result).not.toBeNull();
                expect(result!.value).toBeCloseTo(1e-308);
            });

            it('should return null for negative exponent overflow: 1E-309', () => {
                const result = parser.parsePostingAmount('1E-309');
                expect(result).toBeNull();
            });

            it('should return null for very large exponent: 1E999', () => {
                const result = parser.parsePostingAmount('1E999');
                expect(result).toBeNull();
            });
        });
    });

    describe('detectPostingType', () => {
        it('should detect real posting', () => {
            const result = parser.detectPostingType('Assets:Cash');
            expect(result.type).toBe<PostingType>('real');
            expect(result.cleanAccount).toBe('Assets:Cash');
        });

        it('should detect unbalanced virtual posting: (account)', () => {
            const result = parser.detectPostingType('(Assets:Cash)');
            expect(result.type).toBe<PostingType>('unbalancedVirtual');
            expect(result.cleanAccount).toBe('Assets:Cash');
        });

        it('should detect balanced virtual posting: [account]', () => {
            const result = parser.detectPostingType('[Budget:Food]');
            expect(result.type).toBe<PostingType>('balancedVirtual');
            expect(result.cleanAccount).toBe('Budget:Food');
        });

        it('should handle internal parentheses as real: Assets:Account (note)', () => {
            const result = parser.detectPostingType('Assets:Account (note)');
            expect(result.type).toBe<PostingType>('real');
            expect(result.cleanAccount).toBe('Assets:Account (note)');
        });

        it('should handle whitespace', () => {
            const result = parser.detectPostingType('  (Assets:Cash)  ');
            expect(result.type).toBe<PostingType>('unbalancedVirtual');
            expect(result.cleanAccount).toBe('Assets:Cash');
        });

        it('should handle unicode account names', () => {
            const result = parser.detectPostingType('Активы:Наличные');
            expect(result.type).toBe<PostingType>('real');
            expect(result.cleanAccount).toBe('Активы:Наличные');
        });

        it('should handle nested colons in virtual', () => {
            const result = parser.detectPostingType('[Budget:Food:Groceries]');
            expect(result.type).toBe<PostingType>('balancedVirtual');
            expect(result.cleanAccount).toBe('Budget:Food:Groceries');
        });
    });

    describe('parsePostingLine', () => {
        it('should parse complete posting line with account and amount', () => {
            const result = parser.parsePostingLine('  Assets:Cash    $100', 5);
            expect(result).not.toBeNull();
            expect(result!.account).toBe('Assets:Cash');
            expect(result!.type).toBe<PostingType>('real');
            expect(result!.amount).not.toBeNull();
            expect(result!.amount!.value).toBe(100);
            expect(result!.lineNumber).toBe(5);
        });

        it('should parse posting without amount (inferred)', () => {
            const result = parser.parsePostingLine('  Assets:Cash', 3);
            expect(result).not.toBeNull();
            expect(result!.account).toBe('Assets:Cash');
            expect(result!.amount).toBeNull();
        });

        it('should parse virtual posting', () => {
            const result = parser.parsePostingLine('  (Equity:Opening)    $1000', 1);
            expect(result).not.toBeNull();
            expect(result!.type).toBe<PostingType>('unbalancedVirtual');
            expect(result!.account).toBe('Equity:Opening');
        });

        it('should parse posting with comment', () => {
            const result = parser.parsePostingLine('  Assets:Cash    $100  ; comment', 2);
            expect(result).not.toBeNull();
            expect(result!.amount!.value).toBe(100);
        });

        it('should parse posting with balance assertion', () => {
            const result = parser.parsePostingLine('  Assets:Cash    $100 = $500', 2);
            expect(result).not.toBeNull();
            expect(result!.amount!.value).toBe(100);
            expect(result!.amount!.isBalanceAssertionOnly).toBe(false);
        });

        it('should parse posting with only balance assertion', () => {
            const result = parser.parsePostingLine('  Assets:Cash    = $500', 2);
            expect(result).not.toBeNull();
            expect(result!.amount!.isBalanceAssertionOnly).toBe(true);
        });

        it('should parse account with spaces', () => {
            const result = parser.parsePostingLine('  Assets:Bank Account    $100', 1);
            expect(result).not.toBeNull();
            expect(result!.account).toBe('Assets:Bank Account');
        });

        it('should handle tab separator', () => {
            const result = parser.parsePostingLine('  Assets:Cash\t$100', 1);
            expect(result).not.toBeNull();
            expect(result!.account).toBe('Assets:Cash');
            expect(result!.amount!.value).toBe(100);
        });
    });
});
