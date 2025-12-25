// KeywordCompletionProvider test - now integrated in HLedgerCompletionProvider
// This functionality is now tested through HLedgerCompletionProvider

import { HLEDGER_KEYWORDS } from '../types';

describe('Keyword Completion (Legacy Test)', () => {
  it('should have hledger keywords defined', () => {
    expect(HLEDGER_KEYWORDS).toBeDefined();
    expect(HLEDGER_KEYWORDS.length).toBeGreaterThan(0);
    expect(HLEDGER_KEYWORDS).toContain('account');
    expect(HLEDGER_KEYWORDS).toContain('commodity');
  });
});
