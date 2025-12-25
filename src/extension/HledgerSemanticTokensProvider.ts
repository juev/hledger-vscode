import * as vscode from 'vscode';

// Keep token types in sync with package.json -> contributes.semanticTokenTypes
const TOKEN_TYPES = [
  'account',
  'amount',
  'comment',
  'date',
  'time',
  'accountVirtual',
  'commodity',
  'payee',
  'note',
  'tag',
  'directive',
  'operator',
  'code',
  'link',
] as const;

type TokenType = (typeof TOKEN_TYPES)[number];
const TOKEN_INDEX: Record<TokenType, number> = Object.fromEntries(
  TOKEN_TYPES.map((t, i) => [t, i])
) as Record<TokenType, number>;

export const HLEDGER_SEMANTIC_TOKENS_LEGEND = new vscode.SemanticTokensLegend([...TOKEN_TYPES]);

/**
 * Provides semantic tokens for key hledger constructs, complementing TextMate grammar.
 * Designed to be conservative and fast; it highlights the most important entities.
 * Supports both full-document and range-based tokenization for better performance.
 */
export class HledgerSemanticTokensProvider
  implements
    vscode.DocumentSemanticTokensProvider,
    vscode.DocumentRangeSemanticTokensProvider,
    vscode.Disposable
{
  private tokenCache = new Map<string, { version: number; tokens: vscode.SemanticTokens }>();

  provideDocumentSemanticTokens(
    document: vscode.TextDocument
  ): vscode.ProviderResult<vscode.SemanticTokens> {
    // Check if semantic highlighting is enabled
    const config = vscode.workspace.getConfiguration('hledger', document.uri);
    const enabled = config.get<boolean>('semanticHighlighting.enabled', true);

    if (!enabled) {
      // Return empty tokens if disabled - fall back to TextMate grammar
      return new vscode.SemanticTokensBuilder(HLEDGER_SEMANTIC_TOKENS_LEGEND).build();
    }

    // Check cache first
    const cacheKey = document.uri.toString();
    const cached = this.tokenCache.get(cacheKey);
    if (cached && cached.version === document.version) {
      return cached.tokens;
    }

    const tokens = this.buildTokens(document);

    // Cache the result
    this.tokenCache.set(cacheKey, { version: document.version, tokens });

    // Limit cache size to prevent memory leaks
    // When limit is exceeded, remove 25% of oldest entries for better cache management
    if (this.tokenCache.size > 20) {
      const entriesToRemove = Math.max(1, Math.floor(this.tokenCache.size * 0.25));
      const keys = Array.from(this.tokenCache.keys());
      for (let i = 0; i < entriesToRemove && i < keys.length; i++) {
        const key = keys[i];
        if (key) this.tokenCache.delete(key);
      }
    }

    return tokens;
  }

  provideDocumentRangeSemanticTokens(
    document: vscode.TextDocument,
    range: vscode.Range
  ): vscode.ProviderResult<vscode.SemanticTokens> {
    // Check if semantic highlighting is enabled
    const config = vscode.workspace.getConfiguration('hledger', document.uri);
    const enabled = config.get<boolean>('semanticHighlighting.enabled', true);

    if (!enabled) {
      // Return empty tokens if disabled
      return new vscode.SemanticTokensBuilder(HLEDGER_SEMANTIC_TOKENS_LEGEND).build();
    }

    return this.buildTokens(document, range);
  }

  private buildTokens(document: vscode.TextDocument, range?: vscode.Range): vscode.SemanticTokens {
    const builder = new vscode.SemanticTokensBuilder(HLEDGER_SEMANTIC_TOKENS_LEGEND);

    const startLine = range?.start.line ?? 0;
    const endLine = range?.end.line ?? document.lineCount - 1;

    // Common regex helpers (kept simple for performance/readability)
    const urlRe = /\b(?:https?|ftp):\/\/[^\s,;]+/g;
    const timeRe = /\b\d{1,2}:\d{2}(?::\d{2})?\b/g;
    const dateRe =
      /\b\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\b|\b\d{1,2}[-/.]\d{1,2}(?:[-/.]\d{2,4})?\b|\b\d{4}\b/g;
    const tagRe = /\b([\p{L}][\p{L}\p{N}_-]*)(:)\s*([^,;\n\r\s]*(?:\s[^,;\n\r\s]+)*)/gu;

    // Transaction header: date [status] (code) payee [| note]
    const headerRe =
      /^(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{1,2}[-/.]\d{1,2}|\d{4})\s*([*!])?\s*(\([^)]+\))?\s*([^|;]*?)(\|[^;]*)?(?=\s*;|$)/;

    // Posting with 2+ spaces between account and amount-ish remainder
    const postingRe = /^(\s+)([^;\s][^;]*?\S)\s{2,}([^;]+)(?=;|$)/;

    // Operators and amounts inside the posting remainder
    const opBalanceAssertRe = /(==)/g; // balance assertion
    const opPriceAssignRe = /(=)/g; // price assignment, header auto too
    const opCostTotalRe = /(@@)/g;
    const opCostUnitRe = /(@)/g;
    const opPeriodicRe = /^(~)\b/; // periodic transaction line
    const opTimeclockRe = /^([ioh])\b/; // timeclock line operator

    // Amount with optional trailing commodity (suffix form)
    const amountSuffixRe =
      /([-+]?(?:\d{1,3}(?:[\s,']\d{3})*|\d+)(?:[.,]\d+)?)(?:\s+([\p{L}\p{N}\p{Sc}]+|"[^"]+"))?/gu;
    // Commodity followed by amount (prefix form)
    const amountPrefixRe =
      /([\p{L}\p{N}\p{Sc}]+|"[^"]+")\s*([-+]?(?:\d{1,3}(?:[\s,']\d{3})*|\d+)(?:[.,]\d+)?)/gu;

    for (let line = startLine; line <= endLine && line < document.lineCount; line++) {
      const text = document.lineAt(line).text;
      const trimmed = text.trimStart();

      // Performance: skip empty lines and extremely long lines (potential pathological input)
      if (trimmed === '' || text.length > 1000) {
        continue;
      }

      // 1) Full-line comments
      if (trimmed.startsWith(';') || trimmed.startsWith('#')) {
        const start = text.length - trimmed.length;
        this.push(builder, line, start, text.length - start, 'comment');
        // Links and tags inside comments
        this.pushAllMatches(builder, line, text, urlRe, 'link');
        this.pushTagKeys(builder, line, text, tagRe);
        continue;
      }

      // 2) Transaction header
      const header = headerRe.exec(text);
      if (header) {
        const base = header.index;
        const [full, date, status, code, payee, note] = header;
        // date
        if (date) this.pushGroup(builder, line, text, base, full, date, 'date');
        // status operator
        if (status) this.pushGroup(builder, line, text, base, full, status, 'operator');
        // code (parentheses)
        if (code) this.pushGroup(builder, line, text, base, full, code, 'code');
        // payee
        if (payee?.trim()) this.pushGroup(builder, line, text, base, full, payee.trim(), 'payee');
        // note (starts with '|')
        if (note) {
          const noteText = note.startsWith('|') ? note.slice(1).trimStart() : note;
          this.pushGroup(builder, line, text, base, full, noteText, 'note');
        }
      }

      // 3) Inline comments
      const inlineIdx = text.indexOf(';');
      if (inlineIdx >= 0) {
        this.push(builder, line, inlineIdx, text.length - inlineIdx, 'comment');
        // Search for tags and links inside inline comments
        const commentText = text.slice(inlineIdx);
        this.pushAllMatchesWithOffset(builder, line, commentText, inlineIdx, urlRe, 'link');
        this.pushTagKeysInSection(builder, line, commentText, inlineIdx, tagRe);
      }

      // 4) Directives (account, alias, commodity, include, P, D, Y, payee, tag, ...)
      const dirMatch = /^(account|alias|commodity|decimal-mark|include|P|D|Y|payee|tag)\b/.exec(
        text
      );
      if (dirMatch && typeof dirMatch[1] === 'string') {
        const kw = dirMatch[1];
        if (kw.length > 0) this.push(builder, line, dirMatch.index, kw.length, 'directive');
      }

      // 5) Posting lines: account  <2+ spaces>  remainder
      const posting = postingRe.exec(text);
      if (posting) {
        const whole = posting[0];
        const accountText = posting[2] ?? '';
        const remainder = posting[3] ?? '';
        const baseIndex = posting.index;

        // account or virtual account
        if (accountText.length > 0) {
          const accountRel = whole.indexOf(accountText);
          if (accountRel >= 0) {
            const accountStart = baseIndex + accountRel;
            const isVirtual = /^(\(|\[).*(\)|\])$/.test(accountText.trim());
            this.push(
              builder,
              line,
              accountStart,
              accountText.length,
              isVirtual ? 'accountVirtual' : 'account'
            );
          }
        }

        const remainderRel = remainder.length > 0 ? whole.indexOf(remainder) : -1;
        const remainderStart = remainderRel >= 0 ? baseIndex + remainderRel : -1;

        // Operators inside remainder
        if (remainderStart >= 0) {
          this.pushAllMatchesWithOffset(
            builder,
            line,
            remainder,
            remainderStart,
            opBalanceAssertRe,
            'operator'
          );
          this.pushAllMatchesWithOffset(
            builder,
            line,
            remainder,
            remainderStart,
            opPriceAssignRe,
            'operator'
          );
          this.pushAllMatchesWithOffset(
            builder,
            line,
            remainder,
            remainderStart,
            opCostTotalRe,
            'operator'
          );
          this.pushAllMatchesWithOffset(
            builder,
            line,
            remainder,
            remainderStart,
            opCostUnitRe,
            'operator'
          );

          // Amounts and commodities (both forms)
          this.pushAmounts(
            builder,
            line,
            remainder,
            remainderStart,
            amountSuffixRe,
            amountPrefixRe
          );
        }
      }

      // 6) Periodic and timeclock operators at line start
      const periodic = opPeriodicRe.exec(text);
      if (periodic && typeof periodic[1] === 'string')
        this.push(builder, line, periodic.index, periodic[1].length, 'operator');
      const timeclock = opTimeclockRe.exec(text);
      if (timeclock && typeof timeclock[1] === 'string')
        this.push(builder, line, timeclock.index, timeclock[1].length, 'operator');

      // 7) Dates, times, code, links, notes elsewhere on the line
      this.pushAllMatches(builder, line, text, dateRe, 'date');
      this.pushAllMatches(builder, line, text, timeRe, 'time');
      this.pushAllMatches(builder, line, text, /\([^)]+\)/g, 'code');
      this.pushAllMatches(builder, line, text, urlRe, 'link');

      // Tags should only be highlighted in comments and notes, not in account names
      // Comments are already handled above, so we only need to check notes after |
      const pipeIdx = text.indexOf('|');
      if (pipeIdx >= 0 && (inlineIdx < 0 || pipeIdx < inlineIdx)) {
        const noteText = text.slice(pipeIdx + 1).trimStart();
        const noteStart = pipeIdx + 1 + (text.length - (pipeIdx + 1) - noteText.length);
        if (noteText.length > 0) {
          this.push(builder, line, noteStart, noteText.length, 'note');
          // Search for tags only within the note section
          this.pushTagKeysInSection(builder, line, noteText, noteStart, tagRe);
        }
      }
    }

    return builder.build();
  }

  private push(
    builder: vscode.SemanticTokensBuilder,
    line: number,
    startChar: number,
    length: number,
    type: TokenType
  ): void {
    builder.push(line, startChar, length, TOKEN_INDEX[type]);
  }

  private pushAllMatches(
    builder: vscode.SemanticTokensBuilder,
    line: number,
    text: string,
    re: RegExp,
    type: TokenType
  ): void {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      if (m[0].length === 0) {
        // Avoid zero-length match infinite loop
        re.lastIndex++;
        continue;
      }
      this.push(builder, line, m.index, m[0].length, type);
    }
  }

  private pushAllMatchesWithOffset(
    builder: vscode.SemanticTokensBuilder,
    line: number,
    text: string,
    offset: number,
    re: RegExp,
    type: TokenType
  ): void {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      if (m[0].length === 0) {
        re.lastIndex++;
        continue;
      }
      this.push(builder, line, offset + m.index, m[0].length, type);
    }
  }

  private pushGroup(
    builder: vscode.SemanticTokensBuilder,
    line: number,
    text: string,
    base: number,
    full: string,
    groupText: string,
    type: TokenType
  ): void {
    if (!groupText) return;
    const rel = full.indexOf(groupText);
    if (rel < 0) return;
    const start = base + rel;
    this.push(builder, line, start, groupText.length, type);
  }

  private pushTagKeys(
    builder: vscode.SemanticTokensBuilder,
    line: number,
    text: string,
    tagRe: RegExp
  ): void {
    tagRe.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = tagRe.exec(text))) {
      const key = m[1];
      if (key) this.push(builder, line, m.index, key.length, 'tag');
    }
  }

  private pushTagKeysInSection(
    builder: vscode.SemanticTokensBuilder,
    line: number,
    text: string,
    offset: number,
    tagRe: RegExp
  ): void {
    tagRe.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = tagRe.exec(text))) {
      const key = m[1];
      if (key) this.push(builder, line, offset + m.index, key.length, 'tag');
    }
  }

  private pushAmounts(
    builder: vscode.SemanticTokensBuilder,
    line: number,
    text: string,
    offset: number,
    suffixRe: RegExp,
    prefixRe: RegExp
  ): void {
    // Try suffix form first (amount [commodity])
    suffixRe.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = suffixRe.exec(text))) {
      const [full, amount, commodity] = m;
      if (full.length === 0) {
        suffixRe.lastIndex++;
        continue;
      }
      if (typeof amount === 'string' && amount.length > 0) {
        const amountStart = full.indexOf(amount);
        if (amountStart >= 0)
          this.push(builder, line, offset + m.index + amountStart, amount.length, 'amount');
      }
      if (typeof commodity === 'string' && commodity.length > 0) {
        const commodityStart = full.indexOf(commodity);
        if (commodityStart >= 0)
          this.push(
            builder,
            line,
            offset + m.index + commodityStart,
            commodity.length,
            'commodity'
          );
      }
    }

    // Then prefix form (commodity amount)
    prefixRe.lastIndex = 0;
    while ((m = prefixRe.exec(text))) {
      const [full, commodity, amount] = m;
      if (full.length === 0) {
        prefixRe.lastIndex++;
        continue;
      }
      if (typeof commodity === 'string' && commodity.length > 0) {
        const commodityStart = full.indexOf(commodity);
        if (commodityStart >= 0)
          this.push(
            builder,
            line,
            offset + m.index + commodityStart,
            commodity.length,
            'commodity'
          );
      }
      if (typeof amount === 'string' && amount.length > 0) {
        const amountStart = full.indexOf(amount);
        if (amountStart >= 0)
          this.push(builder, line, offset + m.index + amountStart, amount.length, 'amount');
      }
    }
  }

  /**
   * Cleanup method to prevent memory leaks.
   * Clears the token cache when the provider is disposed.
   */
  dispose(): void {
    this.tokenCache.clear();
  }
}
