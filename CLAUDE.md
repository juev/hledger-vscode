# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Documentation Reference

**Important:** Project documentation is located in the `docs/` directory. Always consult `docs/hledger.md` first for hledger format reference and feature specifications. For questions not covered in local docs, refer to the [official hledger documentation](https://hledger.org/hledger.html).

### Critical hledger Syntax Rules (for validation/completion development)

These rules are essential when implementing validation or completion features:

1. **Two-space delimiter**: Account and amount MUST be separated by 2+ spaces or tab. Single space causes amount to be parsed as part of account name.

2. **Balance assertions without amount**: Valid syntax - posting can have `= $500` without an amount before it. The posting contributes zero to transaction.

3. **Virtual postings**:
   - `()` = **Unbalanced** virtual (not required to balance)
   - `[]` = **Balanced** virtual (must balance among themselves)

4. **Sign placement**: `-$100`, `$-100`, and `-100 USD` are all valid and equivalent.

5. **Balance assertions and auto postings**: Assertions ARE affected by `--auto` flag.

6. **Costs in assertions**: Cost amounts (`@`) in balance assertions are ignored.

For complete syntax reference, see [docs/hledger.md](docs/hledger.md).

## Project Overview

This is a Visual Studio Code extension for hledger (plain text accounting) that provides:

- Syntax highlighting (TextMate grammar + optional semantic tokens)
- Intelligent code completion with context awareness
- Smart indentation and document formatting
- Validation diagnostics and quick fixes
- CLI integration for reports

Supported file extensions: `.journal`, `.hledger`, `.ledger`

## Development Commands

- **Build**: `npm run build` - Compiles TypeScript to production build with esbuild
- **Development**: `npm run compile` - Compiles with development config (TypeScript only)
- **Watch**: `npm run watch` - Watches for changes and recompiles with esbuild
- **Test**: `npm run test` - Runs Jest tests
- **Test Watch**: `npm run test:watch` - Runs tests in watch mode
- **Coverage**: `npm run test:coverage` - Runs tests with coverage report
- **Package**: `npm run package` - Creates VSIX package for distribution
- **Clean**: `npm run clean` - Removes build artifacts
- **Lint**: `npm run lint` - Runs ESLint on TypeScript files
- **Lint Fix**: `npm run lint:fix` - Runs ESLint with auto-fix

## Build System

The project uses **esbuild** for fast, efficient bundling:

### Configuration (`esbuild.js`)

- **Entry Point**: `src/extension/main.ts`
- **Output**: `out/extension/main.js`
- **Format**: CommonJS (`cjs`)
- **Platform**: Node.js
- **Target**: `node20` - Optimized for Node.js 20.x runtime
- **Bundling**: Single-file bundle with tree-shaking
- **External**: VS Code API (`vscode`) excluded from bundle
- **Production**: Minified output with metafile generation
- **Development**: Source maps enabled for debugging

### TypeScript Configuration

- **Target**: ES2018 for broad compatibility
- **Module**: CommonJS
- **Strict Mode**: Enabled with enhanced type checking
- **Output**: `out/` directory (used by TypeScript compiler for development)

### Node.js Version Requirements

- **Minimum**: Node.js 20.0.0 (specified in `package.json` engines)
- **CI/CD**: GitHub Actions uses Node.js 20.x
- **esbuild Target**: `node20` ensures output is optimized for Node.js 20 features

## Architecture

### Core Components

- **main.ts** (~190 lines): Entry point with service factory pattern, explicit `vscode.Disposable` management
- **StrictCompletionProvider**: Context-aware completion system with position analysis
- **HLedgerParser**: Parses hledger files using three-stage pipeline
- **SimpleProjectCache**: Project-based caching with smart invalidation
- **HLedgerConfig**: Configuration management and coordination
- **HLedgerCliService**: CLI integration service for running hledger commands
- **HLedgerCliCommands**: Command handlers for inserting CLI reports as comments
- **HLedgerCodeActionProvider**: Provides balance assertions and quick fixes
- **HLedgerDiagnosticsProvider**: Validation diagnostics on save/open
- **HledgerSemanticTokensProvider**: Optional semantic tokens with caching and range support
- **DocumentFormatter**: Full document formatting with alignment
- **NumberFormatService**: International number formatting support

### Highlighting System

The extension provides **dual-layer highlighting**:

1. **TextMate Grammar** (`syntaxes/hledger.tmLanguage.json`): Basic syntax highlighting, always active
2. **Semantic Tokens** (optional): Enhanced highlighting with 14 token types, caching, and range-based tokenization for large files

Semantic tokens are disabled by default and can be enabled via `hledger.semanticHighlighting.enabled`.

### Completion System

The extension uses a **strict completion architecture** with:

- Position-based analysis to determine completion context
- **CompletionSuppressor** for intelligent suppression in forbidden zones
- Context validation for accurate suggestions
- Single completion type per position
- Frequency-based prioritization for accounts and payees
- Abbreviation matching (type "ef" to match "Expenses:Food")

### Formatting System

Document formatting support includes:

- **Smart amount alignment**: Aligns amounts to a configurable column
- **Comment alignment**: Aligns inline comments
- **International number formats**: Supports different decimal marks (`.` or `,`) and group separators (` `, `,`, `.`)
- **Balance assertion preservation**: Maintains balance assertions during formatting
- **Multi-currency support**: Handles mixed currency postings

### Caching Strategy

The extension implements **incremental caching** for optimal performance:

- **SimpleProjectCache** validates files by modification time (`mtimeMs`)
- **parseWorkspace()** checks cache before parsing each file
- **File watcher** resets data but preserves cache for validation
- Only modified files are reparsed on changes

**Performance impact:**

- For 50+ file projects, provides ~50x speedup on file changes
- Changed file detection is automatic via `mtimeMs` comparison
- Cache invalidation happens only for modified files
- Backward compatible - works with or without cache

**Implementation details:**

- `HLedgerParser.parseWorkspace(path, cache?)` - optional cache parameter
- `HLedgerConfig.resetData()` - preserves cache, resets parsed data
- `HLedgerConfig.clearCache()` - full cache invalidation (config changes)
- File system watcher uses `resetData()` for incremental updates

### Parser Architecture

The extension uses a **three-stage parsing pipeline** for processing hledger files:

**Pipeline Stages:**

1. **HLedgerLexer** (`lexer/HLedgerLexer.ts`) - Tokenizes raw file content into typed tokens
   - Identifies transactions, postings, directives, comments
   - Produces structured token stream for AST building

2. **HLedgerASTBuilder** (`ast/HLedgerASTBuilder.ts`) - Builds structured data from tokens
   - Extracts accounts, payees, tags, commodities from token stream
   - Maintains usage frequency counts for completion ranking
   - Tracks account definitions vs. usage for validation

3. **HLedgerFileProcessor** (`processor/HLedgerFileProcessor.ts`) - Handles file I/O and include directives
   - Processes include directives recursively with cycle detection
   - Manages file system operations and error handling
   - Returns processing results with errors/warnings for user notification

**Legacy Integration:**

The parser maintains backward compatibility through a hybrid approach:

- `HLedgerParser.parseContent()` uses the AST Builder for basic entity extraction
- Calls `enhanceWithLegacyParsing()` for advanced features not yet in AST:
  - Commodity format templates (multi-line directives)
  - Complex tag extraction with regex patterns
  - Decimal mark directives and format detection

**Error Handling:**

- `HLedgerFileProcessor` returns structured errors/warnings in results
- `ErrorNotificationHandler` displays errors to users via VS Code notifications
- Errors include file context and actionable messages

**Performance Considerations:**

- AST-based parsing is faster than regex-heavy legacy parsing
- Pattern precompilation in `StrictPositionAnalyzer` avoids hot-path regex creation
- `RegexCache` with LRU eviction (50-pattern limit) prevents memory bloat
- Large files (>1MB) automatically use async file processing

### File Structure

```plain
src/
├── __mocks__/
│   └── vscode.ts                      # VS Code API mocks for testing
└── extension/
    ├── main.ts                        # Entry point with service factory
    ├── types.ts                       # Type definitions (branded types)
    ├── services.ts                    # Service factory and types
    ├── StrictCompletionProvider.ts    # Main completion logic
    ├── HLedgerParser.ts               # File parsing orchestration
    ├── HLedgerConfig.ts               # Configuration management
    ├── HLedgerCliCommands.ts          # CLI command handlers
    ├── HledgerSemanticTokensProvider.ts # Semantic tokens with caching
    ├── HLedgerFormattingProvider.ts   # VS Code formatting integration
    ├── DocumentFormatter.ts           # Formatting logic
    ├── HLedgerEnterCommand.ts         # Smart Enter key handler
    ├── HLedgerTabCommand.ts           # Smart Tab for amount alignment
    ├── RegexPatterns.ts               # Regex pattern definitions
    ├── SimpleProjectCache.ts          # Project-based caching
    ├── SimpleFuzzyMatcher.ts          # Fuzzy matching utility
    ├── ast/                           # Abstract Syntax Tree
    │   └── HLedgerASTBuilder.ts       # AST construction from tokens
    ├── lexer/                         # Tokenization
    │   ├── HLedgerLexer.ts            # Token stream generation
    │   └── __tests__/
    ├── processor/                     # File processing
    │   ├── HLedgerFileProcessor.ts    # Include handling, cycle detection
    │   └── __tests__/
    ├── services/                      # Service layer
    │   ├── HLedgerCliService.ts       # CLI service implementation
    │   ├── NumberFormatService.ts     # International number formatting
    │   ├── index.ts
    │   └── __tests__/
    ├── strict/                        # Position analysis and validation
    │   ├── StrictPositionAnalyzer.ts  # Position context detection
    │   ├── StrictPositionValidator.ts # Validation rules
    │   └── CompletionSuppressor.ts    # Intelligent completion filtering
    ├── completion/                    # Individual completion providers
    │   ├── AccountCompleter.ts
    │   ├── CommodityCompleter.ts
    │   ├── DateCompleter.ts
    │   ├── PayeeCompleter.ts
    │   └── TagCompleter.ts
    ├── actions/                       # Code actions
    │   ├── HLedgerCodeActionProvider.ts
    │   └── __tests__/
    ├── diagnostics/                   # Validation diagnostics
    │   ├── HLedgerDiagnosticsProvider.ts
    │   └── __tests__/
    ├── utils/                         # Utilities
    │   └── ErrorNotificationHandler.ts
    └── __tests__/                     # Test files (28+ test files)

docs/
└── hledger.md                         # Comprehensive hledger format reference

syntaxes/
└── hledger.tmLanguage.json            # TextMate grammar
```

### Type System

Uses modern TypeScript with branded types for type safety:

- `AccountName`, `PayeeName`, `TagName`, `CommodityCode` - Domain-specific branded types
- Strict type checking enabled in tsconfig.json
- Result types for better error handling

### Testing

- Jest test framework with ts-jest preset
- VS Code API mocked in `src/__mocks__/vscode.ts`
- Comprehensive test coverage (28+ test files)
- Test files follow `*.test.ts` naming pattern in `__tests__` directories

**Grammar Testing:**

- `grammar.test.ts` - Functional tests validating TextMate scope application
- `grammar.snapshot.test.ts` - Snapshot tests for detecting unintended grammar changes
- Uses `vscode-textmate` and `vscode-oniguruma` for accurate tokenization testing
- Tests multi-language support (English, Russian/Cyrillic)

## Key Features

- **Auto-completion**: Context-aware suggestions for dates, accounts, payees, commodities, tags, and directives
  - **Tag Value Completion**: Complete tag values after typing "tag:"
  - **Abbreviation Matching**: Type "ef" to match "Expenses:Food"
  - **Completion Suppression**: Intelligent filtering based on cursor position
- **Syntax Highlighting**: Dual-layer system with TextMate grammar and optional semantic tokens
- **Smart Indentation**: Automatic indentation for transactions and postings
- **Document Formatting**: Amount and comment alignment with international number support
- **Code Actions**: Quick fixes and refactorings
  - **Balance Assertions**: Add balance assertions to postings
  - **Quick Fixes**: Auto-fix undefined accounts and tag format issues
- **Validation Diagnostics**: Real-time validation on save
  - Warns about undefined accounts (considers parent accounts)
  - Suggests proper tag format (tag:value)
  - Validates specific tags require values (date, date2)
  - Detects malformed amounts
- **Project-Based Caching**: Efficient workspace parsing with cache invalidation
- **CLI Integration**: Direct integration with hledger CLI for reports and statistics
- **Multi-language Support**: Full Unicode support including Cyrillic characters

## Configuration Settings

- `hledger.autoCompletion.enabled`: Enable/disable auto-completion
- `hledger.autoCompletion.maxResults`: Maximum completion results (default: 25)
- `hledger.autoCompletion.maxAccountResults`: Maximum account results (default: 30)
- `hledger.smartIndent.enabled`: Enable/disable smart indentation
- `hledger.semanticHighlighting.enabled`: Enable/disable semantic tokens (default: false)
- `hledger.cli.path`: Path to hledger executable (auto-detected if empty)
- `hledger.cli.journalFile`: Path to main hledger journal file (uses LEDGER_FILE env var or current file if empty)
- `hledger.diagnostics.enabled`: Enable/disable validation diagnostics on save/open (default: true)

## CLI Commands

The extension provides direct integration with hledger CLI commands that insert results as comments:

- **Balance Sheet** (`hledger.cli.balance`): Inserts `hledger bs` output showing assets, liabilities, and net worth
- **Income Statement** (`hledger.cli.incomestatement`): Inserts `hledger incomestatement` output showing revenues and expenses
- **Statistics** (`hledger.cli.stats`): Inserts `hledger stats` output with file statistics

### Journal File Resolution Priority

1. `LEDGER_FILE` environment variable (highest priority, validated for security)
2. `hledger.cli.journalFile` setting (validated for security)
3. Current open file (fallback, trusted from VS Code)

**Security:** Paths from environment variables and configuration settings are validated to prevent command injection attacks. Paths containing shell metacharacters (`;`, `&`, `|`, `` ` ``, `$`, `()`, `[]`, `{}`, `^`, `"`, `\`, `<`, `>`) are rejected with a clear error message. File existence and readability are also verified.

## Important Notes

- Completion triggers: digits (0-9) for dates, space for context, ':' for accounts, '@' for commodities, ';' for comments
- CLI commands insert results as formatted comments at cursor position
- The extension automatically activates for `.journal`, `.hledger`, and `.ledger` files
- Uses strict TypeScript configuration with enhanced type checking
- Legacy compatibility wrappers provided for deprecated APIs
- Documentation in `docs/hledger.md` provides comprehensive hledger format reference
