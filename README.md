# hledger for Visual Studio Code

Visual Studio Code extension providing syntax highlighting, intelligent code completion, and smart indentation for [hledger](https://hledger.org) journal files.

[![Version](https://img.shields.io/visual-studio-marketplace/v/evsyukov.hledger)](https://marketplace.visualstudio.com/items?itemName=evsyukov.hledger&ssr=false#overview)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/evsyukov.hledger)](https://marketplace.visualstudio.com/items?itemName=evsyukov.hledger&ssr=false#overview)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/evsyukov.hledger)](https://marketplace.visualstudio.com/items?itemName=evsyukov.hledger&ssr=false#overview)

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

**Or install directly from [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=evsyukov.hledger&ssr=false#overview)**

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

## Contributing

Contributions are welcome! Please submit issues and pull requests.

## License

MIT
