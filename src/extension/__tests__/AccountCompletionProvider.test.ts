// AccountCompletionProvider test - now integrated in modular completers
// This functionality is now tested through AccountCompleter

import { HLedgerConfig } from '../HLedgerConfig';
import { AccountCompleter } from '../completion/AccountCompleter';

describe('Account Completion (Legacy Test)', () => {
  let config: HLedgerConfig;
  let completer: AccountCompleter;

  beforeEach(() => {
    config = new HLedgerConfig();
    completer = new AccountCompleter(config);
  });

  it('should create account completer', () => {
    expect(completer).toBeDefined();
  });

  it('should provide empty completions for empty data', () => {
    const context = { type: 'account' as const, query: '' };
    const completions = completer.complete(context);
    expect(completions).toBeDefined();
    expect(completions.length).toBe(0);
  });

  it('should provide account completions', () => {
    // Add some test data
    config.parseContent('account Assets:Cash\naccount Expenses:Food');

    const context = { type: 'account' as const, query: 'ass' };
    const completions = completer.complete(context);
    expect(completions.length).toBeGreaterThan(0);
  });
});
