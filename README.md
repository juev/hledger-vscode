# hledger for Visual Studio Code

Language support for [hledger](https://hledger.org) journal files in Visual Studio Code.

## Features

- **Syntax Highlighting**: Full syntax highlighting for hledger journal files
- **Color Themes**: Dedicated dark and light themes optimized for hledger
- **Auto-completion**: 
  - Directives (account, commodity, include, etc.)
  - Account names (based on existing accounts in the file)
  - Common commodities and currencies
  - Today's date
- **Smart Indentation**: Automatic indentation for transactions and directives
- **Language Configuration**: 
  - Comment support (`;`, `#`, `*`)
  - Bracket matching
  - Auto-closing pairs
  - Folding support for comment blocks

## Supported File Extensions

- `.journal`
- `.hledger`
- `.ledger`

## Requirements

- Visual Studio Code 1.74.0 or higher
- hledger binary should be installed and available in PATH (for external commands)

## Installation

1. Open Visual Studio Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "hledger"
4. Click Install

## Usage

The extension automatically activates when you open a file with a supported extension. Features include:

### Syntax Highlighting

All hledger syntax elements are highlighted:
- Dates and transactions
- Account names
- Amounts and commodities
- Comments
- Directives

### Auto-completion

- Start typing on a new line to see directive suggestions
- Type an account name to see existing accounts from your file
- After entering an amount, get commodity suggestions

### Indentation

The extension automatically handles indentation for:
- Postings within transactions
- Multi-line directives
- Comment blocks

## Configuration

The extension works out of the box, but you can customize colors by selecting:
- **hledger Dark**: Optimized dark theme for hledger files
- **hledger Light**: Optimized light theme for hledger files

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## License

MIT