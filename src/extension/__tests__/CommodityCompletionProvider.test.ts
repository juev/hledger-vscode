// CommodityCompletionProvider test - now integrated in modular completers
// This functionality is now tested through CommodityCompleter

import { HLedgerConfig } from '../HLedgerConfig';
import { CommodityCompleter } from '../completion/CommodityCompleter';

describe('Commodity Completion (Legacy Test)', () => {
    let config: HLedgerConfig;
    let completer: CommodityCompleter;

    beforeEach(() => {
        config = new HLedgerConfig();
        completer = new CommodityCompleter(config);
    });

    it('should create commodity completer', () => {
        expect(completer).toBeDefined();
    });

    it('should provide empty completions for empty data', () => {
        const context = { type: 'commodity' as const, query: '' };
        const completions = completer.complete(context);
        expect(completions).toBeDefined();
        expect(completions.length).toBe(0);
    });
});