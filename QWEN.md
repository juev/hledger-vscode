# QWEN.md

This file documents the architecture and implementation details of the hledger VS Code extension for future reference and development.

## Extension Overview

The hledger VS Code extension provides syntax highlighting, IntelliSense features (account/date/commodity/tag value completion), and language support for `.journal`, `.hledger`, and `.ledger` files.

### Core Components

1. **Extension Entry Point**: `src/extension/main.ts`
2. **Configuration & Parsing Layer**:
   - `HLedgerConfig.ts` - Configuration management and data coordination
   - `HLedgerParser.ts` - Synchronous file parsing for hledger syntax
   - `SimpleProjectCache.ts` - Basic Map-based caching with workspace isolation
3. **Completion System**: Modular design with specialized completers
4. **Type Safety & Domain Modeling**: `types.ts` with branded types for domain safety
5. **Syntax Highlighting**: `syntaxes/hledger.tmLanguage.json`

## Completion Providers

The extension implements a strict position-based completion system with the following providers:

### 1. Date Completer (`DateCompleter.ts`)

- **Trigger**: Beginning of line when typing digits
- **Functionality**: Provides smart date suggestions (today, yesterday, last week, etc.)
- **Context**: Only active at line start (`LineContext.LineStart`)
- **Examples**: `2024-01-15` or `01/15`

### 2. Payee Completer (`PayeeCompleter.ts`)

- **Trigger**: After date + space(s)
- **Functionality**: Suggests transaction payees/descriptions based on usage frequency
- **Context**: `LineContext.AfterDate`
- **Examples**: After `2024-01-15`, suggests "Amazon", "Walmart", etc.

### 3. Account Completer (`AccountCompleter.ts`)

- **Trigger**: Indented lines (expense/income categories)
- **Functionality**: Suggests account names with frequency-based prioritization
- **Context**: `LineContext.InPosting`
- **Examples**: `Assets:Checking`, `Expenses:Groceries`

### 4. Commodity Completer (`CommodityCompleter.ts`)

- **Trigger**: After amount + single space
- **Functionality**: Suggests currency/commodity symbols
- **Context**: `LineContext.AfterAmount`
- **Examples**: After `100.00`, suggests "USD", "EUR", "BTC"

### 5. Tag Completer (`TagCompleter.ts`)

- **Triggers**:
  - Tag names: In comment contexts (`LineContext.InComment`)
  - Tag values: After tag name and colon in comments (`LineContext.InTagValue`)
- **Functionality**:
  - Tag name completion (e.g., "category", "project")
  - Tag value completion (e.g., after "category:", suggests "groceries", "dining")
- **Examples**:
  - In comment: `; category:` suggests tag names
  - After tag: `; category:` suggests tag values like "groceries"

## Position Analysis System

The extension uses a strict position-based system to determine which completions to show:

### Line Contexts (`LineContext` enum)

1. `LineStart` - Beginning of line for date completion
2. `AfterDate` - After date + space for payee completion
3. `InPosting` - Indented lines for account completion
4. `AfterAmount` - After amount + single space for commodity completion
5. `InComment` - In comment lines for tag name completion
6. `InTagValue` - After tag name and colon for tag value completion
7. `Forbidden` - Forbidden zone (after amount + two or more spaces) - no completions

### Key Components

1. **StrictPositionAnalyzer.ts**: Determines the current line context based on cursor position
2. **CompletionSuppressor.ts**: Suppresses inappropriate completions based on context
3. **StrictPositionValidator.ts**: Validates if a position allows specific completion types

## International Number Format Support

The extension supports various international number formats through `NumberFormatService.ts`:

- Both comma (`,`) and period (`.`) as decimal separators
- Various group separators (space, comma, period, apostrophe)
- Support for `commodity` format directives (e.g., `commodity 1 000,00 EUR`)
- Support for `decimal-mark` directives (e.g., `decimal-mark ,`)

## Architecture Patterns

1. **Type Safety**: Branded types system with runtime validation
2. **Modular Completion Architecture**: Each completer handles one completion type
3. **Simple Caching Strategy**: Map-based project cache with workspace isolation
4. **Configuration-Driven Behavior**: All behavior controlled via VS Code settings
5. **File System Integration**: Synchronous parsing with include file support
6. **Frequency Intelligence**: Usage-based completion prioritization

## Configuration Settings

- `hledger.autoCompletion.enabled` - Enable/disable completion
- `hledger.autoCompletion.maxResults` - Limit completion results
- `hledger.autoCompletion.maxAccountResults` - Limit account completions
- `hledger.smartIndent.enabled` - Smart indentation on Enter key

## Key Features from CLAUDE.md

### Enhanced Syntax Highlighting (v0.3.0)

1. **URL Recognition**: Automatic detection and highlighting of HTTP/HTTPS/FTP URLs in comments
2. **Timeclock Entry Support**: Full syntax support for hledger timeclock entries (`i`, `o`, `h` commands)
3. **CSV Directive Support**: Recognition of CSV import directives (`source`, `separator`, `skip`, etc.)
4. **Improved Comment Processing**: Enhanced comment block and inline comment handling

### Critical Tag Completion Fix (v0.2.1)

Successfully resolved critical tag completion issue where multiple completion providers were incorrectly activating simultaneously. The fix ensures that completion suppression logic NEVER interferes with tag value completions in comment contexts.

### Unicode Support

1. Uses `\p{L}` instead of `[A-Za-z]` for all letter matching
2. Uses `toLocaleLowerCase()` instead of `toLowerCase()` for international characters
3. Uses `localeCompare()` instead of basic string comparison
4. All regex patterns include `/u` flag for Unicode support

### Development Commands

```bash
npm install        # Install dependencies
npm run compile    # Compile TypeScript to JavaScript
npm run watch      # Watch mode for development
npm test           # Run tests
npm run package    # Package extension (creates .vsix file)
```
