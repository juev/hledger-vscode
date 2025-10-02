# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Visual Studio Code extension for hledger (plain text accounting) that provides syntax highlighting, intelligent code completion, and smart indentation for `.journal`, `.hledger`, and `.ledger` files.

## Development Commands

- **Build**: `npm run build` - Compiles TypeScript to production build
- **Development**: `npm run compile` - Compiles with development config
- **Watch**: `npm run watch` - Watches for changes and recompiles
- **Test**: `npm run test` - Runs Jest tests
- **Test Watch**: `npm run test:watch` - Runs tests in watch mode
- **Coverage**: `npm run test:coverage` - Runs tests with coverage report
- **Package**: `npm run package` - Creates VSIX package for distribution
- **Clean**: `npm run clean` - Removes build artifacts

## Architecture

### Core Components

- **main.ts** (142 lines): Entry point with simplified architecture using global config instances
- **StrictCompletionProvider**: Context-aware completion system with position analysis
- **HLedgerParser**: Parses hledger files and extracts accounts, payees, tags, commodities
- **SimpleProjectCache**: Project-based caching with smart invalidation
- **HLedgerConfig**: Configuration management and coordination

### Completion System

The extension uses a **strict completion architecture** with:
- Position-based analysis to determine completion context
- Context validation for accurate suggestions
- Single completion type per position
- Frequency-based prioritization for accounts and payees

### File Structure

```
src/
├── extension/
│   ├── main.ts                    # Entry point
│   ├── StrictCompletionProvider.ts # Main completion logic
│   ├── HLedgerParser.ts           # File parsing
│   ├── SimpleProjectCache.ts      # Caching system
│   ├── HLedgerConfig.ts           # Configuration
│   ├── types.ts                   # Type definitions with branded types
│   ├── strict/                    # Position analysis and validation
│   ├── completion/                # Individual completion providers
│   └── __tests__/                 # Test files
├── __mocks__/vscode.ts            # VS Code API mocks
└── syntaxes/hledger.tmLanguage.json # TextMate grammar
```

### Type System

Uses modern TypeScript with branded types for type safety:
- `AccountName`, `PayeeName`, `TagName`, `CommodityCode` - Domain-specific branded types
- Strict type checking enabled in tsconfig.json
- Result types for better error handling

### Testing

- Jest test framework with ts-jest preset
- VS Code API mocked in `src/__mocks__/vscode.ts`
- Comprehensive test coverage for completion providers
- Test files follow `*.test.ts` naming pattern in `__tests__` directories

## Key Features

- **Auto-completion**: Context-aware suggestions for dates, accounts, payees, commodities, tags, and directives
- **Smart Indentation**: Automatic indentation for transactions and postings
- **Project-Based Caching**: Efficient workspace parsing with cache invalidation
- **Multi-language Support**: Full Unicode support including Cyrillic characters

## Configuration Settings

- `hledger.autoCompletion.enabled`: Enable/disable auto-completion
- `hledger.autoCompletion.maxResults`: Maximum completion results (default: 25)
- `hledger.autoCompletion.maxAccountResults`: Maximum account results (default: 30)
- `hledger.smartIndent.enabled`: Enable/disable smart indentation

## Important Notes

- Completion triggers: digits (0-9) for dates, space for context, ':' for accounts, '@' for commodities, ';' for comments
- The extension automatically activates for `.journal`, `.hledger`, and `.ledger` files
- Uses strict TypeScript configuration with enhanced type checking
- Legacy compatibility wrappers provided for deprecated APIs