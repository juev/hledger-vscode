import { AccountName, CommodityCode, createAccountName, createCommodityCode } from '../types';
import { ParsedPostingAmount, ParsedPosting, PostingType } from './types';

export class AmountParser {
    private static readonly BALANCE_ASSERTION_ONLY = /^(:?={1,2}\*?)\s*(.+)$/;
    private static readonly BALANCE_ASSERTION_SUFFIX = /\s*:?={1,2}\*?\s*[^@]+$/;

    parsePostingAmount(input: string): ParsedPostingAmount | null {
        const trimmed = input.trim();
        if (!trimmed) {
            return null;
        }

        const assertionOnlyMatch = trimmed.match(AmountParser.BALANCE_ASSERTION_ONLY);
        if (assertionOnlyMatch && !this.hasAmountBeforeAssertion(trimmed)) {
            return {
                value: 0,
                commodity: '' as CommodityCode,
                precision: 0,
                isBalanceAssertionOnly: true,
            };
        }

        const amountWithoutAssertion = trimmed.replace(AmountParser.BALANCE_ASSERTION_SUFFIX, '').trim();

        const costMatch = amountWithoutAssertion.match(/^([^@]+?)\s*(@{1,2})\s*(.+)$/);
        let mainAmountStr = amountWithoutAssertion;
        let costInfo: ParsedPostingAmount['cost'] | undefined;

        if (costMatch) {
            mainAmountStr = costMatch[1]!.trim();
            const costOperator = costMatch[2]!;
            const costAmountStr = costMatch[3]!.trim();

            const costParsed = this.parseSimpleAmount(costAmountStr);
            if (costParsed) {
                costInfo = {
                    value: Math.abs(costParsed.value),
                    commodity: costParsed.commodity,
                    isTotal: costOperator === '@@',
                    precision: costParsed.precision,
                };
            }
        }

        const mainParsed = this.parseSimpleAmount(mainAmountStr);
        if (!mainParsed) {
            return null;
        }

        return {
            value: mainParsed.value,
            commodity: mainParsed.commodity,
            precision: mainParsed.precision,
            ...(costInfo && { cost: costInfo }),
            isBalanceAssertionOnly: false,
        };
    }

    private hasAmountBeforeAssertion(input: string): boolean {
        const match = input.match(/^([^=]+?)\s*={1,2}\*?\s*.+$/);
        if (!match) return false;
        const beforeAssertion = match[1]!.trim();
        if (!beforeAssertion) return false;
        return /\d/.test(beforeAssertion);
    }

    private parseSimpleAmount(input: string): { value: number; commodity: CommodityCode; precision: number } | null {
        let str = input.trim();
        if (!str) return null;

        let sign = 1;
        let commodity: CommodityCode = '' as CommodityCode;

        const leadingSignMatch = str.match(/^([+-])\s*/);
        if (leadingSignMatch) {
            sign = leadingSignMatch[1] === '-' ? -1 : 1;
            str = str.slice(leadingSignMatch[0].length);
        }

        const quotedMatch = str.match(/"[^"]+"/);
        let quotedCommodity: string | undefined;
        if (quotedMatch) {
            quotedCommodity = quotedMatch[0];
            str = str.replace(quotedMatch[0], '').trim();
        }

        const prefixCommodityMatch = str.match(/^([\p{Sc}]|[A-Za-z\p{L}]+)\s*/u);
        if (prefixCommodityMatch && !/^\d/.test(prefixCommodityMatch[1]!)) {
            const potentialCommodity = prefixCommodityMatch[1]!;
            if (!/^[eE]$/.test(potentialCommodity)) {
                commodity = potentialCommodity as CommodityCode;
                str = str.slice(prefixCommodityMatch[0].length);
            }
        }

        const innerSignMatch = str.match(/^([+-])\s*/);
        if (innerSignMatch) {
            sign = innerSignMatch[1] === '-' ? -1 : 1;
            str = str.slice(innerSignMatch[0].length);
        }

        const suffixCommodityMatch = str.match(/\s+([\p{Sc}]|[A-Za-z\p{L}]+)$/u);
        if (suffixCommodityMatch) {
            const potentialCommodity = suffixCommodityMatch[1]!;
            if (!/^[eE]\d*$/.test(potentialCommodity)) {
                if (!commodity) {
                    commodity = potentialCommodity as CommodityCode;
                }
                str = str.slice(0, -suffixCommodityMatch[0].length);
            }
        }

        if (quotedCommodity) {
            commodity = quotedCommodity as CommodityCode;
        }

        str = str.trim();

        const numberValue = this.parseNumber(str);
        if (numberValue === null) {
            return null;
        }

        return {
            value: sign * numberValue.value,
            commodity,
            precision: numberValue.precision,
        };
    }

    private parseNumber(input: string): { value: number; precision: number } | null {
        let str = input.trim();
        if (!str) return null;

        const scientificMatch = str.match(/^([\d\s,.']+)[eE]([+-]?\d+)$/);
        let scientificExponent = 0;
        if (scientificMatch) {
            str = scientificMatch[1]!;
            scientificExponent = parseInt(scientificMatch[2]!, 10);
            if (Math.abs(scientificExponent) > 308) {
                return null;
            }
        }

        str = str.replace(/\s/g, '');

        const lastDot = str.lastIndexOf('.');
        const lastComma = str.lastIndexOf(',');

        let decimalMark: string | null = null;
        let precision = 0;

        if (lastDot > lastComma) {
            decimalMark = '.';
        } else if (lastComma > lastDot) {
            decimalMark = ',';
        } else if (lastDot === -1 && lastComma === -1) {
            decimalMark = null;
        }

        if (decimalMark === '.') {
            const afterDecimal = str.slice(lastDot + 1);
            if (afterDecimal.length > 0 && !/[,.]/.test(afterDecimal)) {
                precision = afterDecimal.length;
                str = str.replace(/,/g, '');
            } else if (afterDecimal.length === 0) {
                precision = 0;
                str = str.replace(/,/g, '').replace(/\.$/, '');
            } else {
                str = str.replace(/\./g, '').replace(',', '.');
                precision = str.includes('.') ? str.split('.')[1]!.length : 0;
            }
        } else if (decimalMark === ',') {
            const afterDecimal = str.slice(lastComma + 1);
            if (afterDecimal.length > 0 && !/[,.]/.test(afterDecimal)) {
                precision = afterDecimal.length;
                str = str.replace(/\./g, '').replace(',', '.');
            } else {
                str = str.replace(/,/g, '');
                precision = 0;
            }
        } else {
            str = str.replace(/[,.]/g, '');
        }

        const value = parseFloat(str);
        if (isNaN(value)) {
            return null;
        }

        const finalValue = scientificExponent !== 0 ? value * Math.pow(10, scientificExponent) : value;

        return { value: finalValue, precision };
    }

    detectPostingType(rawAccount: string): { type: PostingType; cleanAccount: AccountName } {
        const trimmed = rawAccount.trim();

        if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
            return {
                type: 'unbalancedVirtual',
                cleanAccount: createAccountName(trimmed.slice(1, -1)),
            };
        }

        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            return {
                type: 'balancedVirtual',
                cleanAccount: createAccountName(trimmed.slice(1, -1)),
            };
        }

        return {
            type: 'real',
            cleanAccount: createAccountName(trimmed),
        };
    }

    parsePostingLine(line: string, lineNumber: number): ParsedPosting | null {
        const trimmed = line.trim();
        if (!trimmed) return null;

        const accountAmountMatch = line.match(/^\s+(.*?)(?:\s{2,}|\t)(.+?)(?:\s*;.*)?$/);

        if (accountAmountMatch) {
            const rawAccount = accountAmountMatch[1]!.trim();
            const amountPart = accountAmountMatch[2]!.trim();

            const { type, cleanAccount } = this.detectPostingType(rawAccount);
            const amount = this.parsePostingAmount(amountPart);

            return {
                rawAccount,
                account: cleanAccount,
                type,
                amount,
                lineNumber,
            };
        }

        const accountOnlyMatch = line.match(/^\s+(.+?)(?:\s*;.*)?$/);
        if (accountOnlyMatch) {
            const rawAccount = accountOnlyMatch[1]!.trim();

            if (/\s{2,}|\t/.test(rawAccount)) {
                const parts = rawAccount.split(/\s{2,}|\t/);
                const accountPart = parts[0]!.trim();
                const amountPart = parts.slice(1).join(' ').trim();

                const { type, cleanAccount } = this.detectPostingType(accountPart);
                const amount = amountPart ? this.parsePostingAmount(amountPart) : null;

                return {
                    rawAccount: accountPart,
                    account: cleanAccount,
                    type,
                    amount,
                    lineNumber,
                };
            }

            const { type, cleanAccount } = this.detectPostingType(rawAccount);

            return {
                rawAccount,
                account: cleanAccount,
                type,
                amount: null,
                lineNumber,
            };
        }

        return null;
    }
}
