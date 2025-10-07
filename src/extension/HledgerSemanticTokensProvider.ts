import * as vscode from 'vscode';

export const HLEDGER_SEMANTIC_TOKENS_LEGEND = new vscode.SemanticTokensLegend([
  'account',
  'amount',
  'comment',
]);

/**
 * Provides semantic tokens for key hledger constructs (account, amount, comment).
 * This complements the TextMate grammar and enables per-user color configuration.
 */
export class HledgerSemanticTokensProvider implements vscode.DocumentSemanticTokensProvider {
  provideDocumentSemanticTokens(document: vscode.TextDocument): vscode.ProviderResult<vscode.SemanticTokens> {
    const builder = new vscode.SemanticTokensBuilder(HLEDGER_SEMANTIC_TOKENS_LEGEND);

    const postingPattern = /^(\s+)([^;\s][^;]*?\S)\s{2,}(-?\d+(?:[.,]\d+)?)/; // indent, account, amount

    for (let line = 0; line < document.lineCount; line++) {
      const text = document.lineAt(line).text;
      const trimmed = text.trimStart();

      // Full-line comments starting with ';' or '#'
      if (trimmed.startsWith(';') || trimmed.startsWith('#')) {
        const start = text.length - trimmed.length;
        builder.push(line, start, text.length - start, 2); // 'comment'
        continue;
      }

      // Inline comments in a line
      const inlineIdx = text.indexOf(';');
      if (inlineIdx >= 0) {
        builder.push(line, inlineIdx, text.length - inlineIdx, 2); // 'comment'
      }

      // Posting with account and amount separated by 2+ spaces
      const match = postingPattern.exec(text);
      if (match) {
        const wholeMatch = match[0];
        const account = match[2];
        const amount = match[3];
        const baseIndex = match.index;

        if (account && amount) {
          const accountRel = wholeMatch.indexOf(account);
          const amountRel = wholeMatch.indexOf(amount);
          if (accountRel >= 0 && amountRel >= 0) {
            const accountStart = baseIndex + accountRel;
            const amountStart = baseIndex + amountRel;
            builder.push(line, accountStart, account.length, 0); // 'account'
            builder.push(line, amountStart, amount.length, 1);   // 'amount'
          }
        }
      }
    }

    return builder.build();
  }
}
