// TagCompletionProvider test - now integrated in modular completers
// This functionality is now tested through TagCompleter

import { HLedgerConfig } from '../HLedgerConfig';
import { TagCompleter } from '../completion/TagCompleter';

describe('Tag Completion (Legacy Test)', () => {
    let config: HLedgerConfig;
    let completer: TagCompleter;

    beforeEach(() => {
        config = new HLedgerConfig();
        completer = new TagCompleter(config);
    });

    it('should create tag completer', () => {
        expect(completer).toBeDefined();
    });

    it('should provide empty completions for empty data', () => {
        const context = { type: 'tag' as const, query: '' };
        const completions = completer.complete(context);
        expect(completions).toBeDefined();
        expect(completions.length).toBe(0);
    });
});