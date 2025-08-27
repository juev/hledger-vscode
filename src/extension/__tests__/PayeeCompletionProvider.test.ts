// PayeeCompletionProvider test - now integrated in modular completers
// This functionality is now tested through PayeeCompleter

import { HLedgerConfig } from '../HLedgerConfig';
import { PayeeCompleter } from '../completion/PayeeCompleter';

describe('Payee Completion (Legacy Test)', () => {
    let config: HLedgerConfig;
    let completer: PayeeCompleter;

    beforeEach(() => {
        config = new HLedgerConfig();
        completer = new PayeeCompleter(config);
    });

    it('should create payee completer', () => {
        expect(completer).toBeDefined();
    });

    it('should provide empty completions for empty data', () => {
        const context = { type: 'payee' as const, query: '' };
        const completions = completer.complete(context);
        expect(completions).toBeDefined();
        expect(completions.length).toBe(0);
    });
});