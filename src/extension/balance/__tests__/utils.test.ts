import { hasBalanceAssertion, BALANCE_ASSERTION_PATTERN } from '../utils';

describe('Balance Assertion Utils', () => {
    describe('BALANCE_ASSERTION_PATTERN', () => {
        it('should match single equals assertion', () => {
            expect('  Assets:Cash  = $500'.match(BALANCE_ASSERTION_PATTERN)).toBeTruthy();
        });

        it('should match double equals assertion', () => {
            expect('  Assets:Cash  == $500'.match(BALANCE_ASSERTION_PATTERN)).toBeTruthy();
        });

        it('should match asterisk assertion', () => {
            expect('  Assets:Cash  =* $500'.match(BALANCE_ASSERTION_PATTERN)).toBeTruthy();
            expect('  Assets:Cash  ==* $500'.match(BALANCE_ASSERTION_PATTERN)).toBeTruthy();
        });

        it('should match balance assignment :=', () => {
            expect('  Assets:Cash  := $500'.match(BALANCE_ASSERTION_PATTERN)).toBeTruthy();
        });

        it('should match assertion after amount', () => {
            expect('  Assets:Cash  $100 = $500'.match(BALANCE_ASSERTION_PATTERN)).toBeTruthy();
        });

        it('should NOT match account name with equals', () => {
            expect('  Expenses:Meeting=Food  $100'.match(BALANCE_ASSERTION_PATTERN)).toBeFalsy();
        });

        it('should NOT match equals without surrounding spaces', () => {
            expect('  Assets:Key=Value  $100'.match(BALANCE_ASSERTION_PATTERN)).toBeFalsy();
        });
    });

    describe('hasBalanceAssertion', () => {
        it('should return true for line with single equals assertion', () => {
            expect(hasBalanceAssertion('  Assets:Cash  = $500')).toBe(true);
        });

        it('should return true for line with double equals assertion', () => {
            expect(hasBalanceAssertion('  Assets:Cash  == $500')).toBe(true);
        });

        it('should return true for line with asterisk assertion', () => {
            expect(hasBalanceAssertion('  Assets:Cash  =* $500')).toBe(true);
            expect(hasBalanceAssertion('  Assets:Cash  ==* $500')).toBe(true);
        });

        it('should return true for line with balance assignment :=', () => {
            expect(hasBalanceAssertion('  Assets:Cash  := $500')).toBe(true);
        });

        it('should return true for assertion after amount', () => {
            expect(hasBalanceAssertion('  Assets:Cash  $100 = $500')).toBe(true);
        });

        it('should return false for account name containing equals', () => {
            expect(hasBalanceAssertion('  Expenses:Meeting=Food  $100')).toBe(false);
        });

        it('should return false for comment-only line', () => {
            expect(hasBalanceAssertion('  ; comment with = sign')).toBe(false);
        });

        it('should return false for line without assertion', () => {
            expect(hasBalanceAssertion('  Assets:Cash  $100')).toBe(false);
        });

        it('should return false for transaction description line', () => {
            expect(hasBalanceAssertion('2024-01-01 Payee with = sign')).toBe(false);
        });

        it('should handle European format amounts with assertion', () => {
            expect(hasBalanceAssertion('  Assets:Cash  1.000,00 EUR = 2.000,00 EUR')).toBe(true);
        });

        it('should handle negative amounts with assertion', () => {
            expect(hasBalanceAssertion('  Assets:Cash  -$100 = $400')).toBe(true);
        });

        it('should return false for equals in commodity format directive', () => {
            expect(hasBalanceAssertion('commodity $1,000.00')).toBe(false);
        });
    });
});
