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
npx tsc --noEmit       # TypeScript strict type check (run before committing)
```

### Running Single Tests

```bash
# Run a single test file
npx jest src/extension/__tests__/LSPManager.test.ts

# Run tests matching a pattern
npx jest --testNamePattern="should start LSP server"

# Run tests in a specific directory
npx jest src/extension/import/__tests__/
```

## Build System

- **Bundler**: esbuild (entry: `src/extension/main.ts` → `out/extension/main.js`)
- **Node.js**: Requires 20.0.0+ (`node20` target)
- **TypeScript**: Strict mode with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`

## Architecture

### Core Components

- **main.ts**: Entry point with LSP client initialization and service factory pattern
- **LSPManager**: Manages hledger-lsp Language Server lifecycle (start, stop, restart)
- **BinaryManager**: Downloads and manages hledger-lsp binary across platforms (darwin-arm64/x64, linux-x64, windows-x64)
- **StartupChecker**: Verifies LSP availability on activation, prompts for installation if missing
- **InlineCompletionProvider**: Ghost text completions for transaction templates using LSP data
- **CLI Commands**: Direct hledger CLI integration (balance, stats, income statement)
- **Import Commands**: CSV/TSV import with account resolution

### LSP Features

The hledger-lsp Language Server provides:

- **Parsing & Validation**: Full hledger syntax parsing with diagnostics
- **Completion**: Context-aware completion for accounts, payees, commodities, dates, tags
- **Semantic Tokens**: Rich syntax highlighting with 16 token types
- **Formatting**: Automatic transaction alignment and formatting
- **Code Actions**: Quick fixes for common issues (e.g., balance assertions)
- **Hover**: Documentation and information on hover
- **Navigation**: Go to Definition, Find References
- **Folding**: Transaction and directive folding ranges
- **Document Links**: Clickable include directives
- **Workspace Symbols**: Symbol search across all files

### Highlighting

Syntax highlighting is provided exclusively by the Language Server using semantic tokens:

- **Semantic Tokens**: 16 token types (account, amount, date, payee, etc.)
- **TextMate Scopes**: Standard scopes (e.g., `entity.name.namespace`, `constant.numeric`, `entity.name.function`) recognized by all VS Code themes
- **Requires**: hledger-lsp server must be running
- **Configuration**: Enabled via `hledger.features.semanticTokens` (default: true)

**Color Priority:**
1. `semanticTokenScopes` → TextMate scope → theme tokenColors (HIGHEST)
2. `superType` → fallback to standard semantic type (if no scope match)
3. Theme defaults (LOWEST)

The extension uses standard TextMate scopes without `.hledger` suffixes, ensuring proper theme integration. Users can customize colors either per token type (`"account:hledger": "#color"`) or globally via TextMate scope rules.

**Fallback behavior:** When the Language Server is not running or semantic tokens are disabled, VS Code automatically uses the TextMate grammar (`syntaxes/hledger.tmLanguage.json`) for syntax highlighting. Basic syntax highlighting is always available, but semantic tokens from LSP provide richer, context-aware highlighting.

### Completion

**Note:** After LSP migration, completion functionality is provided by the hledger-lsp server via `textDocument/completion` protocol. The LSP server handles:
- Context-aware completion (accounts, payees, dates, commodities, tags)
- Frequency-based prioritization
- Fuzzy matching
- Transaction templates

The extension's `InlineCompletionProvider` handles ghost text completions for transaction templates using data from LSP.

### Inline Ghost Text Completion

**Trigger rules** (`InlineCompletionProvider.ts`):

- Minimum 2 characters before showing payee ghost text (`minPayeeChars` setting)
- Template ghost text uses `SnippetString` for tabstops, not plain text

### Key Directories

- `src/extension/lsp/` - LSP client and manager (LSPManager, BinaryManager, StartupChecker)
- `src/extension/inline/` - Ghost text completion (InlineCompletionProvider)
- `src/extension/import/` - CSV/TSV import with account resolution
- `src/extension/cli/` - Direct hledger CLI integration (balance, stats, income statement)
- `src/extension/commands/` - VS Code commands (smart enter, smart tab, etc.)
- `syntaxes/` - TextMate grammar (fallback syntax highlighting)

### Testing

- Jest with ts-jest preset; VS Code mocked in `src/__mocks__/vscode.ts`
- Grammar tests use `vscode-textmate` and `vscode-oniguruma` for accurate scope testing
- `grammar.snapshot.test.ts` detects unintended grammar changes

## Important Implementation Details

### Completion

**Note:** Completion is provided by hledger-lsp server via the Language Server Protocol. The LSP handles all completion triggers and context-aware suggestions.

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
   - Adding/modifying configuration options (update Essential Settings section)
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

CHANGELOG.md updated automatically by ci/cd. Do not edit directly.

### Documentation Style

- Use clear, concise language
- Include code examples where helpful
- Maintain consistent formatting (tables, headers)
- Keep configuration reference tables up-to-date
- Test all example code snippets
