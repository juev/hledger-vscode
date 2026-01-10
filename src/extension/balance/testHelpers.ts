import { CommodityCode } from '../types';
import { CommodityFormat } from '../services/NumberFormatService';

export interface NumberFormatContext {
    readonly commodityFormats: ReadonlyMap<CommodityCode, CommodityFormat> | null;
    readonly defaultCommodity: CommodityCode | null;
}

export function createUSFormatContext(): NumberFormatContext {
    return {
        commodityFormats: new Map<CommodityCode, CommodityFormat>([
            ['USD' as CommodityCode, {
                format: { decimalMark: '.', groupSeparator: ',', decimalPlaces: 2, useGrouping: true },
                symbol: 'USD',
                symbolBefore: true,
                symbolSpacing: false,
                template: '$1,000.00'
            }],
            ['$' as CommodityCode, {
                format: { decimalMark: '.', groupSeparator: ',', decimalPlaces: 2, useGrouping: true },
                symbol: '$',
                symbolBefore: true,
                symbolSpacing: false,
                template: '$1,000.00'
            }]
        ]),
        defaultCommodity: 'USD' as CommodityCode
    };
}

export function createEUFormatContext(): NumberFormatContext {
    return {
        commodityFormats: new Map<CommodityCode, CommodityFormat>([
            ['RUB' as CommodityCode, {
                format: { decimalMark: ',', groupSeparator: '.', decimalPlaces: 2, useGrouping: true },
                symbol: 'RUB',
                symbolBefore: false,
                symbolSpacing: true,
                template: '1.000,00 RUB'
            }],
            ['EUR' as CommodityCode, {
                format: { decimalMark: ',', groupSeparator: ' ', decimalPlaces: 2, useGrouping: true },
                symbol: 'EUR',
                symbolBefore: false,
                symbolSpacing: true,
                template: '1 000,00 EUR'
            }]
        ]),
        defaultCommodity: 'RUB' as CommodityCode
    };
}

export function createMixedFormatContext(): NumberFormatContext {
    return {
        commodityFormats: new Map<CommodityCode, CommodityFormat>([
            ['USD' as CommodityCode, {
                format: { decimalMark: '.', groupSeparator: ',', decimalPlaces: 2, useGrouping: true },
                symbol: 'USD',
                symbolBefore: true,
                symbolSpacing: false,
                template: '$1,000.00'
            }],
            ['RUB' as CommodityCode, {
                format: { decimalMark: ',', groupSeparator: '.', decimalPlaces: 2, useGrouping: true },
                symbol: 'RUB',
                symbolBefore: false,
                symbolSpacing: true,
                template: '1.000,00 RUB'
            }],
            ['EUR' as CommodityCode, {
                format: { decimalMark: ',', groupSeparator: ' ', decimalPlaces: 2, useGrouping: true },
                symbol: 'EUR',
                symbolBefore: false,
                symbolSpacing: true,
                template: '1 000,00 EUR'
            }]
        ]),
        defaultCommodity: 'RUB' as CommodityCode
    };
}

export function createEmptyContext(): NumberFormatContext {
    return {
        commodityFormats: new Map(),
        defaultCommodity: null
    };
}
