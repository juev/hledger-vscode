# hledger for Visual Studio Code

Visual Studio Code extension providing syntax highlighting, intelligent code completion, and smart indentation for [hledger](https://hledger.org) journal files.

[![Version](https://img.shields.io/visual-studio-marketplace/v/evsyukov.hledger)](https://marketplace.visualstudio.com/items?itemName=evsyukov.hledger&ssr=false#overview)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/evsyukov.hledger)](https://marketplace.visualstudio.com/items?itemName=evsyukov.hledger&ssr=false#overview)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/evsyukov.hledger)](https://marketplace.visualstudio.com/items?itemName=evsyukov.hledger&ssr=false#overview)

[![Open VSX Version](https://img.shields.io/open-vsx/v/evsyukov/hledger)](https://open-vsx.org/extension/evsyukov/hledger)
[![Open VSX Downloads](https://img.shields.io/open-vsx/d/evsyukov/hledger)](https://open-vsx.org/extension/evsyukov/hledger)
[![Open VSX Rating](https://img.shields.io/open-vsx/rating/evsyukov/hledger)](https://open-vsx.org/extension/evsyukov/hledger)

## Features

- **Syntax Highlighting**: Advanced highlighting for dates, accounts, amounts, commodities, payees, comments, tags, and directives
- **Intelligent Auto-completion**:
  - **Date Completion**: Smart date suggestions at line start with support for partial typing
  - **Account Completion**: Hierarchical account suggestions with frequency-based prioritization
  - **Commodity Completion**: Currency and commodity suggestions after amounts in posting lines
  - **Payee Completion**: Payee suggestions after transaction dates
  - **Tag Completion**: Tag suggestions in comments
  - **Directive Completion**: hledger directive suggestions
- **Smart Indentation**: Automatic indentation for transactions and postings with Enter key
- **Amount Alignment**: Automatic alignment of amounts in transaction postings for better readability
- **Context-Aware Completion**: Strict position analysis for accurate suggestions
- **Multi-language Support**: Full Unicode support including Cyrillic characters
- **Project-Based Caching**: Efficient workspace parsing and caching

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

### Amount Alignment

The extension provides automatic alignment of amounts in transaction postings to improve readability:

- **Manual Formatting**: Use keyboard shortcuts to align amounts in the current document
- **Format on Save**: Automatically align amounts when saving files
- **Smart Detection**: Only aligns amounts within transaction postings, preserving comments and other content
- **Multi-Currency Support**: Handles different commodity symbols and currencies seamlessly
- **International Formats**: Supports both period (.) and comma (,) decimal formats
- **Balance Assertions**: Properly aligns balance assertions (= and ==)
- **Virtual Postings**: Correctly handles virtual postings (enclosed in parentheses)
- **Price Assignments**: Aligns amounts with price assignments (@ and @@)
- **Preservation**: Maintains the integrity of comments, directives, and other non-transaction content

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

#### Keyboard Shortcuts

- **Ctrl+Shift+A** (or **Cmd+Shift+A** on Mac): Align amounts in current document
- **Ctrl+Shift+F** (or **Cmd+Shift+F** on Mac): Alternative shortcut for formatting
- **Command Palette**: Access "Align Amounts" and "Toggle Format on Save" commands

#### Commands

- **HLedger: Align Amounts**: Manually align amounts in the current document
- **HLedger: Toggle Format on Save**: Enable/disable automatic formatting on save

#### Advanced Usage Tips

- **Select Specific Transactions**: You can select multiple transactions and use the align command to format only the selected content
- **Large Files**: The amount alignment works efficiently with large journal files, processing line by line
- **Mixed Content**: Non-transaction lines (comments, directives, metadata) are preserved and not affected by alignment
- **Undo Support**: All formatting operations can be undone using VS Code's standard undo functionality
- **Automatic Detection**: The extension automatically detects transaction boundaries and aligns amounts within each transaction independently

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

### Amount Alignment Settings

```json
{
    "hledger.amountAlignment.enabled": true,
    "hledger.amountAlignment.formatOnSave": false
}
```

- **`hledger.amountAlignment.enabled`**: Enable/disable automatic alignment of amounts in transaction postings (default: `false`)
- **`hledger.amountAlignment.formatOnSave`**: Automatically align amounts when saving hledger files (default: `false`, requires amount alignment to be enabled)

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

### Amount Alignment Issues

1. **Feature Not Working**: Ensure `hledger.amountAlignment.enabled` is set to `true` in settings
2. **Keyboard Shortcuts Not Working**: Check that you're editing an hledger file and the feature is enabled
3. **Format on Save Not Working**: Ensure both `hledger.amountAlignment.enabled` and `hledger.amountAlignment.formatOnSave` are set to `true`
4. **Unexpected Formatting**: The alignment only affects transaction postings with amounts. Comments, directives, and other content are preserved
5. **Mixed Currencies**: The extension handles different commodity symbols and currencies, aligning based on the position of amounts
6. **Virtual Postings**: Virtual postings (enclosed in parentheses) are also aligned properly
7. **Performance with Large Files**: If formatting is slow on very large files, consider using manual formatting instead of format on save
8. **Non-standard Formats**: Very unusual amount formats may not be recognized. Use standard hledger amount syntax for best results
9. **Selection Issues**: When formatting selections, ensure you include complete transactions for proper alignment
10. **Undo Issues**: If formatting cannot be undone, check if other VS Code extensions are interfering with document editing

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
