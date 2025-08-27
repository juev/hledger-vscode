// DateCompletionProvider test - now integrated in modular completers
// This functionality is now tested through DateCompleter

import { HLedgerConfig } from '../HLedgerConfig';
import { DateCompleter } from '../completion/DateCompleter';

describe('Date Completion (Legacy Test)', () => {
    let config: HLedgerConfig;
    let completer: DateCompleter;

    beforeEach(() => {
        config = new HLedgerConfig();
        completer = new DateCompleter(config);
    });

    it('should create date completer', () => {
        expect(completer).toBeDefined();
    });

    it('should provide date completions', () => {
        const context = { type: 'date' as const, query: '' };
        const completions = completer.complete(context);
        expect(completions).toBeDefined();
        expect(completions.length).toBeGreaterThan(0);
        
        // Should include today's date
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const hasToday = completions.some(c => c.label === todayStr);
        expect(hasToday).toBe(true);
    });
});