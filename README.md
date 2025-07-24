# hledger for Visual Studio Code

Syntax highlighting and IntelliSense support for [hledger](https://hledger.org) journal files in Visual Studio Code.

## Features

- **Enhanced Syntax Highlighting**: Advanced syntax highlighting with dedicated colors for:
  - **Currencies and commodities** (USD, RUB, EUR, BTC, etc.)
  - **Account types** (Assets, Expenses, Income, Liabilities, Equity) with different colors
  - **Tags and categories** in comments (`#hashtags`, `key:value` pairs)
  - **Payee|note format** with separate highlighting for payees and notes
  - **Cost/price notation** (`@` and `@@`) and balance assertions (`=`, `==`)
  - **Multiple date formats** (YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD, MM-DD, etc.)
- **Advanced IntelliSense Auto-completion**:
  - **Smart Account Completion**: Suggests accounts from `account` directives and used accounts from transactions
  - **Date Completion**: Smart date suggestions with last used date, today, and yesterday (supports all hledger date formats)
  - **Commodity Completion**: Common currencies and cryptocurrencies
  - **Payee Completion**: Auto-completion for payees/stores from transaction history
  - **Tag Completion**: Smart completion for tags and categories (`#hashtags` and `key:value` pairs)
  - **Directive Completion**: hledger directives (account, commodity, include, etc.)
- **hledger 1.43 Compliance**: Full support for the latest hledger specification including:
  - All date formats (YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD with . / - separators)
  - Payee|note format in transactions
  - Cost/price notation (@ unit cost, @@ total cost)
  - Balance assertions (= soft, == strict)
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

## Currency Highlighting

To make currencies (USD, RUB, EUR, BTC, etc.) appear in maroon color, add this to your VS Code `settings.json`:

```json
{
  "editor.tokenColorCustomizations": {
    "textMateRules": [
      {
        "scope": "entity.name.type.commodity",
        "settings": {
          "foreground": "#800000"
        }
      }
    ]
  }
}
```

This will make all currencies and commodities display in maroon color (#800000) while other elements use your theme's default colors.

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
- **Last used date** from the document appears first
- **Today's date** and **yesterday's date** as alternatives
- Supports both full (YYYY-MM-DD) and short (MM-DD) date formats

**Smart Indentation**:

- Automatic indentation after transaction dates
- Proper posting alignment within transactions
- Maintains indentation context

### Dynamic Configuration

The extension automatically scans your workspace for:

- `account` directive definitions
- Account usage patterns from transactions
- Commodity declarations
- Performance-optimized caching system

## Documentation

This extension follows the official [hledger manual (1.43)](https://hledger.org/1.43/hledger.html) specification. For complete hledger syntax and usage information, please refer to the official documentation.

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

When contributing, please ensure that any syntax additions or changes align with the official hledger documentation.

## Credits

The extension icon is taken from the official [hledger website](https://hledger.org).

## License

MIT
