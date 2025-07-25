# hledger for Visual Studio Code

Full-featured Visual Studio Code extension providing comprehensive syntax highlighting, intelligent code completion, and project-based caching for [hledger](https://hledger.org) journal files.

## Features

- **Enhanced Syntax Highlighting**: Advanced syntax highlighting for:
  - **Currencies and commodities** (USD, RUB, EUR, BTC, etc.)
  - **Account types** (Assets, Expenses, Income, Liabilities, Equity)
  - **Tags and categories** in comments (`key:value` pairs)
  - **Payee|note format** with separate highlighting for payees and notes
  - **Cost/price notation** (`@` and `@@`) and balance assertions (`=`, `==`)
  - **Multiple date formats** (YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD, MM-DD, etc.)
- **Advanced IntelliSense Auto-completion**:
  - **Smart Account Completion**: Suggests accounts from `account` directives and used accounts from transactions
  - **Date Completion**: Smart date suggestions with last used date, today, and yesterday (supports all hledger date formats)
  - **Commodity Completion**: Common currencies and cryptocurrencies
  - **Payee Completion**: Auto-completion for payees/stores from transaction history
  - **Tag Completion**: Smart completion for tags and categories (`key:value` pairs)
  - **Directive Completion**: hledger directives (account, commodity, include, etc.)
- **hledger 1.43 Compliance**: Full support for the latest hledger specification including:
  - All date formats (YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD with . / - separators)
  - Payee|note format in transactions
  - Cost/price notation (@ unit cost, @@ total cost)
  - Balance assertions (= single commodity, == sole commodity)
  - Posting date tags (`date:YYYY-MM-DD`)
- **Multi-language Support**: Full support for Cyrillic and other Unicode characters in account names and tags
- **Smart Indentation**: Automatic indentation for transactions and postings
- **Performance Optimized**: Project-based persistent caching system for large codebases
- **Language Configuration**:
  - Comment support (`;`, `#`)
  - Bracket matching and auto-closing pairs
  - Smart indentation rules

## Supported File Extensions

- `.journal`
- `.hledger`
- `.ledger`

## Requirements

- Visual Studio Code 1.74.0 or higher

## Installation

1. Open Visual Studio Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "hledger-vscode"
4. Click Install

## Usage

The extension automatically activates when you open a file with a supported extension (`.journal`, `.hledger`, `.ledger`).

### Syntax Highlighting

All hledger syntax elements are highlighted using standard TextMate scopes:

- Transaction dates (full and short format)
- Account names with Unicode support
- Amounts with and without commodities
- Comments (`;`, `#`)
- Directives and keywords

### IntelliSense Features

**Account Completion**:

- Type in posting lines to see intelligent account suggestions
- **Defined accounts** (from `account` directives) appear first
- **Used accounts** (from existing transactions) appear second
- **Standard prefixes** (Assets, Liabilities, etc.) appear last
- Partial matching - continues completion from where you left off

**Date Completion**:

- Type at the beginning of lines to get date suggestions
- **Last used date** from the document appears first (highest priority)
- **Today's date** and **yesterday's date** as alternatives
- Works with partial date input and supports all hledger date formats
- Automatically adds a space after date insertion

**Payee/Store Completion**:

- Auto-complete payees and store names from transaction history
- Supports both single payee format and `payee|note` format
- Intelligent parsing from transaction descriptions
- Unicode support for international store names

**Tag Completion**:

- Smart completion for `tag:value` format
- Learns from existing tags in transaction and posting comments
- Automatically adds `:` for tag:value format
- Full Unicode support including Cyrillic characters

**Commodity/Currency Completion**:

- Triggers after amount values in postings
- Includes configured commodities from `commodity` directives
- Default commodities: USD, EUR, GBP, CAD, AUD, JPY, CHF, RUB, BTC, ETH
- Supports both prefix ($ 100) and suffix (100 USD) formats

**Smart Indentation**:

- Automatic indentation after transaction dates
- Proper posting alignment within transactions
- Maintains indentation context

### Project-Based Caching System

The extension features an advanced caching system that:

- **Persistent Caching**: Maintains cache across VS Code sessions for optimal performance
- **Project-Based**: Separate caches for different projects/workspaces
- **Intelligent Scanning**: Automatically discovers hledger files in your workspace
- **Multi-File Support**: Handles `include` directives and scans multiple journal files
- **Performance Optimized**: No automatic cache invalidation - caches persist until extension deactivation

### Auto-Completion Configuration

You can control auto-completion behavior:

- **Setting**: `hledger.autoCompletion.enabled` (default: `true`)
- **When enabled**: Auto-completion triggers automatically while typing
- **When disabled**: Use Ctrl+Space to manually trigger completion
- **Trigger characters**: `[' ', ':', '/', '-', '.', '#', ';']`

## Documentation

This extension follows the official [hledger manual (1.43)](https://hledger.org/1.43/hledger.html) specification. For complete hledger syntax and usage information, please refer to the official documentation.

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

When contributing, please ensure that any syntax additions or changes align with the official hledger documentation.

## Credits

The extension icon is taken from the official [hledger website](https://hledger.org).

## License

MIT
