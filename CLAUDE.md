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
2. **Syntax Highlighting**: `syntaxes/hledger.tmLanguage.json` - TextMate grammar supporting full hledger syntax
3. **Completion Providers**:
   - `AccountCompletionProvider` - Hierarchical account suggestions with advanced fuzzy matching and caching
   - `KeywordCompletionProvider` - hledger directives with fuzzy matching (account, commodity, include, etc.)
   - `CommodityCompletionProvider` - Currency and cryptocurrency symbols with fuzzy matching
   - `DateCompletionProvider` - Smart date suggestions
   - `PayeeCompletionProvider` - Store/merchant completion with advanced fuzzy matching and substring support
   - `TagCompletionProvider` - Tag/category completion with fuzzy matching from comments
4. **Semantic Token Provider**: `HLedgerSemanticTokensProvider` - Advanced syntax highlighting with semantic tokens
5. **Smart Indentation**: `HLedgerEnterCommand` and `HLedgerEnterKeyProvider` - Intelligent Enter key handling

### Important Design Patterns

1. **Project-Based Caching**: `ProjectCache` class manages persistent caches per project/workspace
   - No automatic invalidation for optimal performance
   - Separate caches for different projects/file groups
   - Cache cleared only on extension deactivation
2. **Enhanced Parsing**: Extracts payees, tags, accounts, and metadata
   - Payees from transaction descriptions with intelligent fuzzy matching
   - Tags from comments (tag:value format) with fuzzy matching
   - Accounts with hierarchical fuzzy matching
   - Commodities with fuzzy matching support
   - Full Unicode support including Cyrillic
   - Advanced substring matching for all completion providers
3. **Semantic Token System**: Uses camelCase token type IDs (e.g., `hledgerDate`, `hledgerAccount`) to comply with VS Code validation
4. **Color Customization**: Configurable colors through VS Code settings with automatic application
5. **Smart Indentation**: Context-aware Enter key handling for proper transaction formatting
6. **Performance**: Optimized for large codebases with smart caching and selective file scanning

### File Parsing

The `HLedgerConfig` class handles parsing of hledger files to extract:

- Account definitions (`account` directives)
- Used accounts (from transactions)
- Commodity definitions
- Include directives for modular files
- Transaction dates
- Payees/merchants from transaction descriptions
- Tags/categories from comments (`tag:value` format)
- Semantic token highlighting data

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
- **Test Files**: 8 test suites covering 72+ test cases

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
5. Semantic token types: Uses camelCase IDs to comply with VS Code pattern requirements
6. Configuration: Supports color customization and auto-completion settings
7. Smart indentation: Configurable through `hledger.smartIndent.enabled` setting
8. Follows hledger 1.43 specification
