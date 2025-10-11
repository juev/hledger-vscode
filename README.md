# hledger for Visual Studio Code

Visual Studio Code extension providing syntax highlighting, intelligent code completion, and smart indentation for [hledger](https://hledger.org) journal files.

[![Version](https://img.shields.io/visual-studio-marketplace/v/evsyukov.hledger)](https://marketplace.visualstudio.com/items?itemName=evsyukov.hledger&ssr=false#overview)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/evsyukov.hledger)](https://marketplace.visualstudio.com/items?itemName=evsyukov.hledger&ssr=false#overview)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/evsyukov.hledger)](https://marketplace.visualstudio.com/items?itemName=evsyukov.hledger&ssr=false#overview)

[![Open VSX Version](https://img.shields.io/open-vsx/v/evsyukov/hledger)](https://open-vsx.org/extension/evsyukov/hledger)
[![Open VSX Rating](https://img.shields.io/open-vsx/rating/evsyukov/hledger)](https://open-vsx.org/extension/evsyukov/hledger)

## Features

- **Syntax Highlighting**: Dual-layer syntax highlighting with TextMate grammar (always enabled) and optional semantic tokens for enhanced precision. TextMate grammar provides reliable baseline coloring through scope hierarchies, while semantic highlighting (disabled by default) offers more accurate token identification and customizable colors through VS Code's standard semantic token system
- **Intelligent Auto-completion**:
  - **Date Completion**: Smart date suggestions at line start with support for partial typing
  - **Account Completion**: Hierarchical account suggestions with frequency-based prioritization
  - **Commodity Completion**: Currency and commodity suggestions after amounts in posting lines
  - **Payee Completion**: Payee suggestions after transaction dates
  - **Tag Completion**: Tag suggestions in comments
  - **Directive Completion**: hledger directive suggestions
- **Smart Indentation**: Automatic indentation for transactions and postings with Enter key
- **Document Formatting**: Comprehensive formatting on save including amount alignment, comment alignment, and proper indentation
- **Context-Aware Completion**: Strict position analysis for accurate suggestions
- **Multi-language Support**: Full Unicode support including Cyrillic characters
- **Project-Based Caching**: Efficient workspace parsing and caching
- **Theme Integration**: Automatic adaptation to VS Code themes with semantic token color customization

## Supported File Extensions

- `.journal`
- `.hledger`
- `.ledger`

## Requirements

- Visual Studio Code 1.75.0 or higher
- Node.js 16.x or higher

## Installation

1. Open Visual Studio Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "hledger" or "evsyukov.hledger"
4. Click Install
5. Restart VS Code

**Or install directly from [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=evsyukov.hledger&ssr=false#overview) or [Open VSX](https://open-vsx.org/extension/evsyukov/hledger)**

## Usage

The extension automatically activates when you open a file with a supported extension.

### Auto-completion

The extension provides context-aware completion based on your cursor position:

- **Date Completion**: Type at the beginning of lines to get date suggestions
- **Account Completion**: Type in posting lines (indented) to see account suggestions
- **Payee Completion**: Type after transaction dates to get payee suggestions
- **Commodity Completion**: Type after amounts in posting lines for currency suggestions
- **Tag Completion**: Type in comments for tag suggestions
- **Directive Completion**: Type at line start for hledger directive suggestions

### Smart Indentation

- **Automatic Indent**: Pressing Enter after a transaction date automatically indents for posting entries
- **Preserve Indent**: Maintains proper indentation when continuing posting entries
- **Smart Context**: Handles different line types appropriately

### Document Formatting

The extension provides comprehensive document formatting for hledger files to improve readability and consistency:

- **Amount Alignment**: Automatic alignment of amounts in transaction postings
- **Comment Alignment**: Aligns inline comments within transactions for better readability
- **Proper Indentation**: Applies consistent 4-space indentation for posting lines
- **Format on Save**: Automatically formats documents when saving files (when enabled) - the only available formatting mode
- **Smart Detection**: Only formats transaction postings, preserving directives and start-of-line comments
- **Multi-Currency Support**: Handles different commodity symbols and currencies seamlessly
- **International Formats**: Supports both period (.) and comma (,) decimal formats
- **Balance Assertions**: Properly aligns balance assertions (= and ==)
- **Virtual Postings**: Correctly handles virtual postings (enclosed in parentheses)
- **Price Assignments**: Aligns amounts with price assignments (@ and @@)
- **Account Names with Spaces**: Correctly preserves and aligns account names containing spaces
- **Preservation**: Maintains the integrity of directives, metadata, and other non-transaction content

#### Before/After Examples

**Simple transaction:**

*Before formatting:*

```
2025-01-15 * Coffee shop
  Expenses:Food:Coffee    $4.50
  Assets:Cash  -4.50

2025-01-16 * Grocery shopping
  Expenses:Food:Groceries    $125.75
  Assets:Checking  -125.75
```

*After formatting:*

```
2025-01-15 * Coffee shop
  Expenses:Food:Coffee        $4.50
  Assets:Cash               -4.50

2025-01-16 * Grocery shopping
  Expenses:Food:Groceries  $125.75
  Assets:Checking         -125.75
```

**Multi-currency transaction:**

*Before formatting:*

```
2025-01-20 * Currency Exchange
    Assets:USD              100 USD @ 95.50 RUB
    Assets:RUB              -9550 RUB
```

*After formatting:*

```
2025-01-20 * Currency Exchange
    Assets:USD          100 USD @ 95.50 RUB
    Assets:RUB         -9550 RUB
```

**International number formats:**

*Before formatting:*

```
2024-01-17 Mixed Format Transaction
    Assets:Checking       1 234,56 EUR
    Assets:Savings          987.65 USD
    Expenses:Shopping    -2 222,21 EUR
```

*After formatting:*

```
2024-01-17 Mixed Format Transaction
    Assets:Checking     1 234,56 EUR
    Assets:Savings        987.65 USD
    Expenses:Shopping  -2 222,21 EUR
```

**Balance assertions:**

*Before formatting:*

```
2025-01-21 Balance Check
    Assets:Checking         = 2500.00 RUB
    Assets:Savings          == 10000.00 RUB
```

*After formatting:*

```
2025-01-21 Balance Check
    Assets:Checking      = 2500.00 RUB
    Assets:Savings      == 10000.00 RUB
```

**Account names with spaces and comment alignment:**

*Before formatting:*

```
2025-01-22 Shopping with various accounts
  Assets:My Bank Account    100 USD    ; Initial balance
  Expenses:Food:Groceries Store    -50 USD  ; Weekly shopping
  Expenses:Transport:Gas Station   -25 USD ; Car fuel
  Assets:Savings Account    -25 USD     ; Transfer to savings
```

*After formatting:*

```
2025-01-22 Shopping with various accounts
    Assets:My Bank Account                100 USD  ; Initial balance
    Expenses:Food:Groceries Store        -50 USD  ; Weekly shopping
    Expenses:Transport:Gas Station       -25 USD  ; Car fuel
    Assets:Savings Account               -25 USD  ; Transfer to savings
```

#### Commands

**Note**: The extension uses VS Code's standard document formatting. No custom formatting commands are provided. Use VS Code's built-in formatting features like Format Document (Shift+Alt+F) or configure `editor.formatOnSave` for automatic formatting.

#### Advanced Usage Tips

- **Large Files**: The formatting works efficiently with large journal files, processing line by line during save
- **Mixed Content**: Non-transaction lines (comments, directives, metadata) are preserved and not affected by formatting
- **Undo Support**: All formatting operations can be undone using VS Code's standard undo functionality after save
- **Automatic Detection**: The extension automatically detects transaction boundaries and formats amounts within each transaction independently
- **Performance**: Since formatting only occurs on save, there's no performance impact during normal editing

## Configuration

### Auto-completion Settings

```json
{
    "hledger.autoCompletion.enabled": true,
    "hledger.autoCompletion.maxResults": 25,
    "hledger.autoCompletion.maxAccountResults": 30
}
```

### Smart Indentation Settings

```json
{
    "hledger.smartIndent.enabled": true
}
```

### Document Formatting Settings

Document formatting is controlled by VS Code's global editor settings:

```json
{
    "editor.formatOnSave": true
}
```

- **`editor.formatOnSave`**: Enable automatic formatting when saving any supported file type, including hledger files

Note: This setting must be enabled at the editor level for hledger files to be formatted on save.

### Syntax Highlighting Colors

The extension provides two layers of syntax highlighting:

1. **TextMate Grammar (Always Active)**: Base syntax highlighting using scope hierarchies that work with all VS Code themes. Elements like numbers, keywords, and comments are automatically colored through standard TextMate scopes.

2. **Semantic Tokens (Optional)**: Enhanced highlighting for precise token identification, especially useful for hledger-specific elements like tags in comments. Disabled by default for better performance.

#### Enabling Semantic Highlighting

To enable the more precise semantic token highlighting:

**Via Settings UI:**

1. Open VS Code Settings (Ctrl+,)
2. Search for "hledger semantic"
3. Enable **HLedger: Semantic Highlighting Enabled**

**Via settings.json:**

```json
{
    "hledger.semanticHighlighting.enabled": true
}
```

**Benefits of enabling semantic highlighting:**

- More precise identification of hledger elements
- Tags are correctly identified only in comments (not in account names)
- Custom color mappings for hledger-specific tokens
- Better differentiation between similar elements

**Why it's disabled by default:**

- TextMate grammar already provides good baseline coloring
- Semantic tokens require asynchronous processing (minimal delay)
- Most users won't notice the difference for basic syntax
- Can be enabled when needed for advanced features

#### Customizing Colors

You can customize the syntax highlighting colors through VS Code's settings:

**Via Settings UI:**

1. Open VS Code Settings (Ctrl+,)
2. Navigate to **Text Editor** → **Semantic Token Color**
3. Look for hledger-specific tokens (account:hledger, amount:hledger, etc.)
4. Customize colors for each token type

**Via settings.json:**

```json
{
  "editor.semanticTokenColorCustomizations": {
    "[Default Dark+]": {
      "rules": {
        "account:hledger": "#0EA5E9",
        "amount:hledger": "#F59E0B",
        "comment:hledger": "#9CA3AF",
        "date:hledger": "#2563EB",
        "commodity:hledger": "#A855F7",
        "payee:hledger": "#EF4444",
        "tag:hledger": "#EC4899",
        "directive:hledger": "#0EA5E9"
      }
    },
    "[Default Light+]": {
      "rules": {
        "account:hledger": "#0369A1",
        "amount:hledger": "#D97706",
        "comment:hledger": "#6B7280",
        "date:hledger": "#1D4ED8",
        "commodity:hledger": "#7C3AED",
        "payee:hledger": "#DC2626",
        "tag:hledger": "#DB2777",
        "directive:hledger": "#0369A1"
      }
    }
  }
}
```

#### Available Semantic Tokens

The extension defines the following semantic tokens that can be customized:

- **account:hledger** - Account names
- **accountVirtual:hledger** - Virtual account names (in parentheses/brackets)
- **amount:hledger** - Monetary amounts
- **comment:hledger** - Comments (lines starting with ; or #)
- **date:hledger** - Transaction dates
- **time:hledger** - Time values
- **commodity:hledger** - Currency/commodity symbols
- **payee:hledger** - Transaction payees
- **note:hledger** - Transaction notes (after |)
- **tag:hledger** - Tags (prefixed with #)
- **directive:hledger** - hledger directives (account, commodity, etc.)
- **operator:hledger** - Operators (=, ==, @, @@, *, !)
- **code:hledger** - Transaction codes (in parentheses)
- **link:hledger** - URLs and links

#### Advanced Customization

**Wildcard patterns:**

```json
{
  "editor.semanticTokenColorCustomizations": {
    "rules": {
      "*.hledger": { "bold": true },  // Apply to all hledger tokens
      "account*.hledger": { "italic": true }  // Apply to account tokens
    }
  }
}
```

**Style modifiers:**

```json
{
  "editor.semanticTokenColorCustomizations": {
    "rules": {
      "account:hledger": {
        "foreground": "#0EA5E9",
        "bold": true,
        "italic": false
      }
    }
  }
}
```

## Architecture

The extension uses a **strict completion architecture** that provides:

- **Position Analysis**: Analyzes cursor position to determine completion context
- **Context Validation**: Ensures completions are appropriate for the current position
- **Single Type Completion**: Only one completion type per position for accuracy
- **Efficient Caching**: Project-based caching with smart invalidation

## Troubleshooting

### Completion Not Working

1. **Check File Association**: Ensure your file has `.journal`, `.hledger`, or `.ledger` extension
2. **Verify Language Mode**: Check that VS Code recognizes the file as "hledger"
3. **Check Position**: Completions are context-aware - ensure you're in the right position

### Indentation Issues

1. **Enable Smart Indent**: Set `hledger.smartIndent.enabled: true`
2. **Check File Type**: Smart indentation only works with hledger files
3. **Restart VS Code**: After changing settings

### Performance Issues

1. **Large Files**: The extension handles large files efficiently with project-based caching
2. **Clear Cache**: Use Command Palette → "Developer: Reload Window" if needed

### Document Formatting Issues

1. **Feature Not Working**: Ensure `editor.formatOnSave` is set to `true` in VS Code settings
2. **Format on Save Not Working**: Check that you're editing an hledger file and VS Code's `editor.formatOnSave` setting is enabled
3. **Unexpected Formatting**: The formatter affects transaction postings, comments, and indentation while preserving directives and other content
4. **Mixed Currencies**: The extension handles different commodity symbols and currencies, aligning based on the position of amounts
5. **Virtual Postings**: Virtual postings (enclosed in parentheses) are also aligned properly
6. **Performance with Large Files**: If formatting is slow on very large files when saving, you can temporarily disable format on save
7. **Non-standard Formats**: Very unusual amount formats may not be recognized. Use standard hledger amount syntax for best results
8. **Undo Issues**: If formatting cannot be undone, check if other VS Code extensions are interfering with document editing
9. **Account Names with Spaces**: The formatter correctly preserves account names containing spaces in the account name part
10. **Format Not Applied**: Check that the file actually changed during save - if no formatting was needed, no changes will be applied

## Compatibility

### Supported Transaction Types

- **Standard Transactions**: Regular hledger transactions with dates and postings
- **Pending Transactions**: Transactions marked with `!` status
- **Balanced Transactions**: Transactions with balance assertions (`=` and `==`)
- **Virtual Postings**: Postings enclosed in parentheses `()` and brackets `[]`
- **Price Assignments**: Transactions with unit prices (`@`) and total prices (`@@`)
- **Multi-currency**: Transactions involving different commodities and currencies

### Supported Amount Formats

- **Standard Decimals**: `123.45`, `0.50`
- **International Decimals**: `123,45`, `0,50` (comma as decimal separator)
- **Thousands Separators**: `1,234.56`, `1 234,56` (space or comma as thousands separator)
- **Whole Numbers**: `100`, `50`
- **Commodity Symbols**: `$100`, `100 EUR`, `100.50 USD`
- **Negative Amounts**: `-100.50`, `-1 234,56`

### File Content Preservation

The amount alignment feature preserves and does not modify:

- Comments and metadata
- hledger directives (`account`, `commodity`, `payee`, etc.)
- Transaction descriptions and payees
- Tags and tag values
- URLs and links in comments
- Blank lines and spacing between transactions
- File encoding and special characters

## Contributing

Contributions are welcome! Please submit issues and pull requests.

## License

MIT
