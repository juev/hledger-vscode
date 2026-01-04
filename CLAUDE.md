# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Documentation Reference

**Important:** Always consult `docs/hledger.md` first for hledger format reference. For questions not covered, refer to the [official hledger documentation](https://hledger.org/hledger.html).

### Critical hledger Syntax Rules

These rules are essential when implementing validation or completion features:

1. **Two-space delimiter**: Account and amount MUST be separated by 2+ spaces or tab. Single space causes amount to be parsed as part of account name.
2. **Balance assertions without amount**: Valid syntax - posting can have `= $500` without an amount before it.
3. **Virtual postings**: `()` = unbalanced virtual, `[]` = balanced virtual (must balance among themselves)
4. **Sign placement**: `-$100`, `$-100`, and `-100 USD` are all valid and equivalent.

## Project Overview

VS Code extension for hledger plain text accounting. Supported file extensions: `.journal`, `.hledger`, `.ledger`

## Development Commands

```bash
npm run build          # Production build with esbuild
npm run watch          # Watch mode with esbuild
npm run test           # Run all Jest tests
npm run test:watch     # Tests in watch mode
npm run test:coverage  # Tests with coverage report
npm run lint           # ESLint check
npm run lint:fix       # ESLint with auto-fix
npm run package        # Create VSIX for distribution
```

### Running Single Tests

```bash
# Run a single test file
npx jest src/extension/__tests__/HLedgerParser.workspace.test.ts

# Run tests matching a pattern
npx jest --testNamePattern="should parse accounts"

# Run tests in a specific directory
npx jest src/extension/import/__tests__/
```

## Build System

- **Bundler**: esbuild (entry: `src/extension/main.ts` → `out/extension/main.js`)
- **Node.js**: Requires 20.0.0+ (`node20` target)
- **TypeScript**: Strict mode with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`

## Architecture

### Core Components

- **main.ts**: Entry point with service factory pattern, explicit `vscode.Disposable` management
- **StrictCompletionProvider**: Context-aware completion with position analysis
- **HLedgerParser**: Three-stage parsing pipeline (Lexer → AST Builder → File Processor)
- **SimpleProjectCache**: File caching with `mtimeMs` validation for incremental updates
- **HLedgerConfig**: Configuration management; `resetData()` preserves cache, `clearCache()` invalidates all

### Parser Pipeline

1. **HLedgerLexer** (`lexer/`) - Tokenizes content into typed tokens
2. **HLedgerASTBuilder** (`ast/`) - Extracts accounts, payees, tags with frequency counts
3. **HLedgerFileProcessor** (`processor/`) - Handles includes with cycle detection

Legacy parsing (`enhanceWithLegacyParsing()`) handles commodity format templates and complex tag extraction not yet migrated to AST.

### Highlighting

Dual-layer system:
- **TextMate Grammar** (`syntaxes/hledger.tmLanguage.json`): Always active
- **Semantic Tokens** (optional): 14 token types, enabled via `hledger.semanticHighlighting.enabled`

### Completion

- Position-based context detection in `strict/StrictPositionAnalyzer.ts`
- `CompletionSuppressor` prevents completions in forbidden zones
- Frequency-based prioritization for accounts/payees
- FZF-style gap-based fuzzy matching (fewer gaps = higher score)
- Transaction templates with SnippetString tabstops for cursor navigation

### VS Code Completion Sorting (gopls hack)

**Problem:** VS Code ignores custom `sortText` ordering and re-sorts completions by its own fuzzy matching score. This breaks frequency-based sorting (e.g., "Доходы:Продажа" appears before "Расходы:Продукты" even when the latter has 1000x more uses).

**Solution (from gopls):** Force VS Code to respect our ordering by making all items have equal fuzzy scores:

1. **Return `CompletionList` with `isIncomplete: true`** - Prevents VS Code from caching and re-sorting
2. **Set identical `filterText` for all items** - Use the query string (`context.query`) as filterText for every completion item
3. **Use index-based `sortText`** - Format: `"00001_score_name"` with zero-padded index as primary key

```typescript
// StrictCompletionProvider.ts
return new vscode.CompletionList(result, true);  // isIncomplete=true

// AccountCompleter.ts
item.filterText = context.query || '';  // Same for all items
item.sortText = `${index.toString().padStart(5, '0')}_${scoreStr}_${match.item}`;
```

**Score inversion for lexicographic ordering:**
```typescript
// High score = low sortText number = appears first
const cappedScore = Math.min(Math.round(match.score), 9999);
const scoreStr = (10000 - cappedScore).toString().padStart(5, '0');
```

**Cap scores to prevent overflow:** `usageCount * 20` can exceed max values, causing negative sortText. Always cap: `Math.min(score, 9999)` for accounts, `Math.min(score, 999)` for others.

### Completion Filtering (Cache Pollution Prevention)

**Problem:** Incomplete typed text (e.g., "прод" while typing "Расходы:Продукты") could appear in completion results through two mechanisms:

1. **Cache pollution**: `mergeCurrentData()` mutated shared Set/Map references, polluting workspace cache
2. **Low-usage exact matches**: Incomplete text saved previously could appear as valid completions

**Solution (two-part fix):**

1. **Cache isolation** (`HLedgerConfig.ts`): Clone workspace data before merging current document data
   ```typescript
   // When currentLine is provided, clone first to avoid cache mutation
   if (currentLine !== undefined && this.data) {
     this.data = this.cloneData(this.data);
   }
   this.mergeCurrentData(currentData);
   ```

2. **Filter low-usage exact matches** (`AccountCompleter.ts`):
   ```typescript
   const filteredMatches = matches.filter(match => {
     const isExactQueryMatch = match.item.toLowerCase() === context.query.toLowerCase();
     const usageCount = this.config.accountUsage.get(match.item) ?? 0;
     const isLowUsage = usageCount <= 2;
     return !(isExactQueryMatch && isLowUsage);
   });
   ```

**Why usage count ≤ 2?** Low count (1-2) likely indicates incomplete typing that was saved; established accounts have higher counts.

### Transaction Templates

**Template key format**: Keys use `||` delimiter with sorted accounts: `generateTemplateKey(accounts).join("||")`. Prevents collision when same payee has different account combinations.

**Buffer limits**:
- `MAX_RECENT_TRANSACTIONS_PER_PAYEE = 50` - circular buffer for frequency-based sorting
- `MAX_TEMPLATES_PER_PAYEE = 5` - only 5 unique templates kept per payee

**Alignment preservation**: `maxAccountNameLength` must be preserved when cloning data in `createMutableData()`. Use displayed account length (not escaped) for alignment calculation.

### Inline Ghost Text Completion

**Trigger rules** (`InlineCompletionProvider.ts`):
- Minimum 2 characters before showing payee ghost text (`minPayeeChars` setting)
- Template ghost text uses `SnippetString` for tabstops, not plain text

### Key Directories

- `src/extension/completion/` - Individual completers (Account, Commodity, Date, Payee, Tag, TransactionTemplate)
- `src/extension/inline/` - Ghost text completion (InlineCompletionProvider)
- `src/extension/strict/` - Position analysis and validation
- `src/extension/import/` - CSV/TSV import with account resolution
- `src/extension/actions/` - Code actions (balance assertions, quick fixes)
- `src/extension/diagnostics/` - Validation on save/open
- `src/extension/services/` - NumberFormatService, HLedgerCliService

### Type System

Branded types for domain safety: `AccountName`, `PayeeName`, `TagName`, `CommodityCode`

### Testing

- Jest with ts-jest preset; VS Code mocked in `src/__mocks__/vscode.ts`
- Grammar tests use `vscode-textmate` and `vscode-oniguruma` for accurate scope testing
- `grammar.snapshot.test.ts` detects unintended grammar changes

## Important Implementation Details

### Completion Triggers

- Digits (0-9) for dates
- Space for context-aware completion
- `:` for account hierarchy navigation
- `@` for commodities
- `;` for comments/tags

### CLI Integration

Commands (`hledger.cli.balance`, `hledger.cli.incomestatement`, `hledger.cli.stats`) insert results as comments.

**Journal file resolution priority:**
1. `LEDGER_FILE` environment variable
2. `hledger.cli.journalFile` setting
3. Current open file

**Security:** Paths validated against shell metacharacters (`;`, `&`, `|`, `` ` ``, `$`, etc.) to prevent command injection.

### CSV/TSV Import Security

- **ReDoS Protection**: Pattern validation (max 100 chars, no nested quantifiers)
- **DoS Protection**: Amount strings capped at 100 characters
- **Memory Safety**: LRU cache with 100-entry limit

## Documentation Requirements

**IMPORTANT:** When making changes that affect user-facing behavior, you MUST update the documentation:

1. **User Guide** (`docs/user-guide.md`) - Update if:
   - Adding/removing/modifying configuration options
   - Adding/removing/modifying commands
   - Changing keyboard shortcuts or keybindings
   - Adding/removing features
   - Changing behavior of existing features
   - Modifying completion triggers or behavior

2. **README.md** - Update if:
   - Adding major new features (add to Features section)
   - Changing installation instructions
   - Modifying quick start workflow

3. **TROUBLESHOOTING.md** - Update if:
   - Discovering new common issues
   - Changing error handling or messages
   - Adding workarounds for known issues

4. **CHANGELOG.md** - Update for all releases following Keep a Changelog format

### Documentation Locations

| Document | Purpose | Audience |
|----------|---------|----------|
| `docs/user-guide.md` | Complete feature reference | End users |
| `README.md` | Quick overview and getting started | New users |
| `TROUBLESHOOTING.md` | Problem solving guide | Users with issues |
| `docs/hledger.md` | hledger syntax reference | Developers |
| `CLAUDE.md` | Development guidelines | AI/developers |

### Documentation Style

- Use clear, concise language
- Include code examples where helpful
- Maintain consistent formatting (tables, headers)
- Keep configuration reference tables up-to-date
- Test all example code snippets
