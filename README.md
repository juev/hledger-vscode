# hledger for Visual Studio Code

Full-featured Visual Studio Code extension providing comprehensive syntax highlighting, intelligent code completion, and project-based caching for [hledger](https://hledger.org) journal files.

## Features

- **Enhanced Syntax Highlighting**: Advanced TextMate-based syntax highlighting for:
  - **Currencies and commodities** (USD, RUB, EUR, BTC, etc.)
  - **Account types** (Assets, Expenses, Income, Liabilities, Equity)
  - **Tags and categories** in comments (`key:value` pairs)
  - **Payee|note format** with separate highlighting for payees and notes
  - **Cost/price notation** (`@` and `@@`) and balance assertions (`=`, `==`)
  - **Multiple date formats** (YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD, MM-DD, etc.)
  - **Customizable colors** through VS Code settings
- **Advanced IntelliSense Auto-completion**:
  - **Smart Account Completion**: Suggests accounts from `account` directives and used accounts from transactions with **frequency-based prioritization**
  - **Date Completion**: Smart date suggestions with last used date, today, and yesterday (supports all hledger date formats)
  - **Commodity Completion**: Common currencies and cryptocurrencies **sorted by usage frequency**
  - **Payee Completion**: Auto-completion for payees/stores from transaction history **prioritized by frequency of use**
  - **Tag Completion**: Smart completion for tags and categories (`key:value` pairs) **ordered by usage frequency**
  - **Directive Completion**: hledger directives with advanced fuzzy matching (account, commodity, include, etc.)
- **hledger 1.43 Compliance**: Full support for the latest hledger specification including:
  - All date formats (YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD with . / - separators)
  - Payee|note format in transactions
  - Cost/price notation (@ unit cost, @@ total cost)
  - Balance assertions (= single commodity, == sole commodity)
  - Posting date tags (`date:YYYY-MM-DD`)
- **Multi-language Support**: Full support for Cyrillic and other Unicode characters in account names and tags
- **Smart Indentation**: Configurable automatic indentation for transactions and postings
- **Color Customization**: Extensive customization options for all syntax elements through VS Code settings
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
3. Search for "hledger" or "evsyukov.hledger"
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

- **Advanced fuzzy matching** with substring support for intelligent account suggestions
- **Frequency-based prioritization**: Most frequently used accounts appear first
- Type in posting lines to see intelligent account suggestions
- **Smart query strategies**:
  - Short queries (1-2 chars): Fast substring matching with prefix priority
  - Longer queries (3+ chars): Full fuzzy matching with advanced scoring
- **Intelligent scoring**: Prioritizes by usage frequency first, then exact prefix matches, then word boundaries, then substrings
- **Account hierarchy**: Defined accounts (from `account` directives) and used accounts, both sorted by frequency
- **Usage indicators**: Shows usage count in suggestions (e.g., "Used account (5 times)")
- Partial matching - continues completion from where you left off

**Date Completion**:

- Type at the beginning of lines to get date suggestions
- **Last used date** from the document appears first (highest priority)
- **Today's date** and **yesterday's date** as alternatives
- Works with partial date input and supports all hledger date formats
- Automatically adds a space after date insertion

**Payee/Store Completion**:

- **Advanced fuzzy matching** with substring support for intelligent payee suggestions
- **Frequency-based prioritization**: Most frequently used payees appear first
- Auto-complete payees and store names from transaction history
- **Smart query strategies**:
  - Short queries (1-2 chars): Fast substring matching with prefix priority
  - Longer queries (3+ chars): Full fuzzy matching with advanced scoring
- **Intelligent scoring**: Prioritizes by usage frequency first, then exact prefix matches, then word boundaries, then substrings
- **Usage indicators**: Shows usage count in suggestions (e.g., "Payee/Store (used 3 times)")
- Supports both single payee format and `payee|note` format
- Unicode support for international store names including Cyrillic characters
- **Examples**: 
  - Type "м" → finds "Магазин" (3 uses), "МТС" (1 use), "Мегафон" (1 use) - sorted by frequency
  - Type "зин" → finds "Магазин" (substring match)
  - Frequently used stores like "Amazon" appear before less used ones like "Costco"

**Tag Completion**:

- **Advanced fuzzy matching** with substring support for intelligent tag suggestions
- **Frequency-based prioritization**: Most frequently used tags appear first
- Smart completion for `tag:value` format
- **Smart query strategies**:
  - Short queries (1-2 chars): Fast substring matching with prefix priority
  - Longer queries (3+ chars): Full fuzzy matching with advanced scoring
- **Intelligent scoring**: Prioritizes by usage frequency first, then exact prefix matches, then word boundaries, then substrings
- **Usage indicators**: Shows usage count in suggestions (e.g., "Tag/Category (used 7 times)")
- Learns from existing tags in transaction and posting comments
- Automatically adds `:` for tag:value format
- Full Unicode support including Cyrillic characters

**Commodity/Currency Completion**:

- **Advanced fuzzy matching** with substring support for intelligent commodity suggestions
- **Frequency-based prioritization**: Most frequently used commodities appear first
- **Smart query strategies**:
  - Short queries (1-2 chars): Fast substring matching with prefix priority
  - Longer queries (3+ chars): Full fuzzy matching with advanced scoring
- **Intelligent scoring**: Prioritizes by usage frequency first, then exact prefix matches, then word boundaries, then substrings
- **Usage indicators**: Shows usage count in suggestions (e.g., "Configured commodity (used 15 times)")
- Triggers after amount values in postings
- Includes configured commodities from `commodity` directives
- Default commodities: USD, EUR, GBP, CAD, AUD, JPY, CHF, RUB, BTC, ETH
- Supports both prefix ($ 100) and suffix (100 USD) formats

**Directive/Keyword Completion**:

- **Advanced fuzzy matching** with substring support for hledger directive suggestions
- **Smart query strategies**:
  - Short queries (1-2 chars): Fast substring matching with prefix priority
  - Longer queries (3+ chars): Full fuzzy matching with advanced scoring
- **Intelligent scoring**: Prioritizes exact prefix matches, then word boundaries, then substrings
- Complete list of hledger directives: account, commodity, include, alias, apply, end, year, etc.
- Triggers at the beginning of lines for directive completion

**Smart Indentation**:

- Automatic indentation after transaction dates
- Proper posting alignment within transactions
- Maintains indentation context

### Project-Based Caching System

The extension features an advanced caching system that:

- **Persistent Caching**: Maintains cache across VS Code sessions for optimal performance
- **Project-Based**: Separate caches for different projects/workspaces
- **Frequency Tracking**: Automatically tracks usage frequency of accounts, payees, tags, and commodities
- **Intelligent Scanning**: Automatically discovers hledger files in your workspace
- **Multi-File Support**: Handles `include` directives and scans multiple journal files
- **Performance Optimized**: No automatic cache invalidation - caches persist until extension deactivation
- **Usage Statistics**: Preserves usage counters across sessions for consistent prioritization

### Auto-Completion Configuration

You can control auto-completion behavior:

- **Setting**: `hledger.autoCompletion.enabled` (default: `true`)
- **When enabled**: Auto-completion triggers automatically while typing
- **When disabled**: Use Ctrl+Space to manually trigger completion
- **Trigger characters**: `[' ', ':', '/', '-', '.', ';']` plus all letters and numbers for auto-completion

### Color Customization

You can customize syntax highlighting colors through VS Code settings. The extension provides the following color settings with high contrast and readability:

- `hledger.colors.date` - Color for dates in transactions (default: `#2563EB` - Blue)
- `hledger.colors.account` - Color for account names (default: `#059669` - Green)
- `hledger.colors.amount` - Color for numeric amounts (default: `#DC2626` - Red)
- `hledger.colors.commodity` - Color for currency/commodity symbols (default: `#7C3AED` - Purple)
- `hledger.colors.payee` - Color for payee/description (default: `#EA580C` - Orange)
- `hledger.colors.comment` - Color for comments (default: `#6B7280` - Gray)
- `hledger.colors.tag` - Color for tags in comments (default: `#DB2777` - Pink)
- `hledger.colors.directive` - Color for hledger directives (default: `#059669` - Green)
- `hledger.colors.accountDefined` - Color for explicitly defined accounts (default: `#0891B2` - Cyan)
- `hledger.colors.accountVirtual` - Color for virtual accounts (default: `#6B7280` - Gray)

**Example**: To change the date color to red, add this to your VS Code settings:
```json
{
    "hledger.colors.date": "#FF0000"
}
```

Colors update immediately when changed in settings. The new color scheme provides excellent contrast and readability while maintaining visual hierarchy.

### Smart Indentation

Smart indentation helps format transactions correctly:

- **Setting**: `hledger.smartIndent.enabled` (default: `true`)
- **Auto-indent**: Pressing Enter after a transaction date automatically indents for posting entries
- **Preserve indent**: Maintains proper indentation when continuing posting entries
- **Context-aware**: Handles different line types (dates, postings, comments) appropriately

## Documentation

This extension follows the official [hledger manual (1.43)](https://hledger.org/1.43/hledger.html) specification. For complete hledger syntax and usage information, please refer to the official documentation.

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

When contributing, please ensure that any syntax additions or changes align with the official hledger documentation.

## Credits

The extension icon is taken from the official [hledger website](https://hledger.org).

## License

MIT
