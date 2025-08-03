# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Visual Studio Code extension for hledger journal files (plain text accounting). It provides syntax highlighting, IntelliSense features (account/date/commodity completion), and language support for `.journal`, `.hledger`, and `.ledger` files.

## Development Commands

```bash
# Install dependencies
npm install

# Compile TypeScript to JavaScript
npm run compile

# Watch mode for development
npm run watch

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Package extension (creates .vsix file)
npm run package

# Publish to VS Code marketplace
npm run publish
```

## Architecture

### Key Components

1. **Main Extension Entry**: `src/extension/main.ts` - TypeScript source with proper type definitions
2. **Syntax Highlighting**: `syntaxes/hledger.tmLanguage.json` - Comprehensive TextMate grammar supporting full hledger syntax with customizable colors
3. **Completion System Architecture** (Modular design):
   - **Base Classes**:
     - `FuzzyMatcher` (`src/extension/completion/base/FuzzyMatcher.ts`) - Centralized fuzzy matching algorithm with Unicode support
     - `CompletionItemFactory` (`src/extension/completion/base/CompletionItemFactory.ts`) - Standardized completion item creation
     - `BaseCompletionProvider` (`src/extension/completion/base/BaseCompletionProvider.ts`) - Abstract base class for all providers
   - **Completion Providers**:
     - `KeywordCompletionProvider` (`src/extension/completion/providers/KeywordCompletionProvider.ts`) - hledger directives with fuzzy matching ✅ REFACTORED
     - `AccountCompletionProvider` (in `main.ts`) - Hierarchical account suggestions with frequency-based prioritization
     - `CommodityCompletionProvider` (in `main.ts`) - Currency and cryptocurrency symbols with frequency-based prioritization
     - `DateCompletionProvider` (in `main.ts`) - Smart date suggestions with improved Enter key handling
     - `PayeeCompletionProvider` (in `main.ts`) - Store/merchant completion with frequency-based prioritization
     - `TagCompletionProvider` (in `main.ts`) - Tag/category completion with frequency-based prioritization
4. **Smart Indentation**: `HLedgerEnterCommand` and `HLedgerEnterKeyProvider` - Intelligent Enter key handling
5. **Completion Limits**: Configurable maximum number of completion items via `hledger.autoCompletion.maxResults` (default 25) and `hledger.autoCompletion.maxAccountResults` (default 30)

### Important Design Patterns

1. **Project-Based Caching**: `ProjectCache` class manages persistent caches per project/workspace
   - No automatic invalidation for optimal performance
   - Separate caches for different projects/file groups
   - Cache cleared only on extension deactivation
   - **Frequency tracking**: Maintains usage counters for all completion types
2. **Enhanced Parsing**: Extracts payees, tags, accounts, and metadata with frequency counting
   - Payees from transaction descriptions with intelligent fuzzy matching and usage frequency tracking
   - Tags from comments (tag:value format) with fuzzy matching and frequency counting
   - Accounts with hierarchical fuzzy matching and usage frequency tracking
   - Commodities with fuzzy matching support and frequency counting
   - Full Unicode support including Cyrillic
   - Advanced substring matching for all completion providers
   - **Frequency-based prioritization**: Most used items appear first in completion lists
   - **Unified behavior**: Both automatic (typing) and manual (Ctrl+Space) completion use identical filtering and sorting logic
3. **Color Customization**: Configurable colors through VS Code settings with automatic application via TextMate scopes
   - Uses `applyCustomColors()` function to apply user-defined colors from `hledger.colors.*` settings
   - Writes to workspace settings only (not global) via `tokenColorCustomizations`
   - Automatically triggered on configuration changes
   - Production-ready code without debug logging
5. **Smart Indentation**: Context-aware Enter key handling for proper transaction formatting
6. **Performance**: Optimized for large codebases with smart caching and selective file scanning
7. **Modular Architecture** (NEW): Beginning transition to modular design with separation of concerns
   - Fuzzy matching logic extracted to reusable class
   - Standardized completion item creation
   - Base provider class for consistent behavior
   - Improved testability with isolated components

### File Parsing

The `HLedgerConfig` class handles parsing of hledger files to extract:

- Account definitions (`account` directives) with usage frequency tracking
- Used accounts (from transactions) with usage frequency tracking
- Commodity definitions with usage frequency tracking
- Include directives for modular files
- Transaction dates
- Payees/merchants from transaction descriptions with usage frequency tracking
- Tags/categories from comments (`tag:value` format) with usage frequency tracking
- **Usage counters**: Maintains `Map<string, number>` for accounts, payees, tags, and commodities
- **Frequency-based methods**: `getAccountsByUsage()`, `getPayeesByUsage()`, `getTagsByUsage()`, `getCommoditiesByUsage()`

## Testing

Testing infrastructure uses Jest with TypeScript support:

```bash
# Run all tests
npm test

# Run tests in watch mode  
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

### Test Structure

- **Unit Tests**: Located in `src/extension/__tests__/`
- **Test Configuration**: `jest.config.js` with ts-jest preset
- **Mock VSCode API**: `src/__mocks__/vscode.ts` for testing without VSCode
- **Test Coverage**: Includes core classes, completion providers, caching, and fuzzy matching
- **Test Files**: 10 test suites covering 102 test cases

### Manual Testing

Uses `testdata/test.journal` file which demonstrates:

- Multi-language support (Cyrillic characters)
- Various transaction formats  
- Account aliases and commodity definitions

## GitHub Actions

- **CI**: Runs on all branches, tests Node.js 18.x and 20.x
- **Release**: Triggers on version tags (e.g., `v1.0.0`)

## Important Notes

1. Main source is TypeScript (`src/extension/main.ts`) with proper type definitions
2. Activation event: `onLanguage:hledger`
3. File associations: `.journal`, `.hledger`, `.ledger`
4. Dependencies: No external dependencies for file scanning (uses built-in Node.js `fs`)
5. Syntax highlighting: Uses TextMate grammar with comprehensive scopes for all hledger elements
6. Configuration: Supports extensive color customization through `hledger.colors.*` settings and auto-completion settings
7. Smart indentation: Configurable through `hledger.smartIndent.enabled` setting
8. Completion limits: Configurable via `hledger.autoCompletion.maxResults` (default: 25) and `hledger.autoCompletion.maxAccountResults` (default: 30)
9. Unified completion behavior: Both automatic (typing) and manual (Ctrl+Space) completions work identically
10. Follows hledger 1.43 specification
