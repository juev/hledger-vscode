<div align="center">

# 📊 hledger for VS Code

**Full-featured VS Code extension for [hledger](https://hledger.org) plain text accounting**

[![Version](https://img.shields.io/visual-studio-marketplace/v/evsyukov.hledger?style=flat-square&logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=evsyukov.hledger)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/evsyukov.hledger?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=evsyukov.hledger)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/evsyukov.hledger?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=evsyukov.hledger)
[![Open VSX](https://img.shields.io/open-vsx/v/evsyukov/hledger?style=flat-square&label=Open%20VSX)](https://open-vsx.org/extension/evsyukov/hledger)

[Features](#-features) • [Installation](#-installation) • [Quick Start](#-quick-start) • [Configuration](#%EF%B8%8F-configuration) • [CLI Integration](#-cli-integration)

</div>

---

## ✨ Features

Transform your plain text accounting experience with powerful IDE capabilities:

### 🎯 **Smart Auto-completion**

- **Context-aware** suggestions based on cursor position
- **Frequency-based** prioritization for accounts and payees
- **Transaction templates** - type a payee name to insert complete transactions with accounts and amounts based on history
- **Inline ghost text** - see suggestions as you type, press Enter to accept
- Complete support for dates, accounts, payees, commodities, tags, and directives
- Works as you type - no keyboard shortcuts needed

### 🎨 **Beautiful Syntax Highlighting**

- **Dual-layer highlighting**: Fast TextMate grammar + optional semantic tokens
- **Theme integration**: Adapts to your VS Code theme automatically
- **Customizable colors** for all hledger elements

### ⚡ **Automatic Formatting**

- **Smart alignment** for amounts and comments
- **Format on save** - keep your journals tidy automatically
- **Multi-currency support** with international number formats
- Preserves balance assertions, virtual postings, and metadata

### 🔧 **Smart Editing**

- **Auto-indent** for transactions and postings
- **Smart Tab** key positions cursor at amount column
- **Multi-language** Unicode support (Cyrillic, Asian languages, etc.)

### 📊 **CLI Integration**

- Insert **balance sheets**, **income statements**, and **statistics** directly into journals
- Automatic journal file detection
- Results formatted as comments

### 🚀 **Performance**

- **Project-based caching** for large journal files
- **Incremental updates** - only reparse changed files
- Efficient workspace parsing

---

## 📦 Installation

**Option 1: VS Code Marketplace** (Recommended)

1. Open VS Code
2. Press `Ctrl+Shift+X` (Extensions)
3. Search for **"hledger"**
4. Click **Install**

**Option 2: Quick Install**

- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=evsyukov.hledger)
- [Open VSX Registry](https://open-vsx.org/extension/evsyukov/hledger)

**Supported files:** `.journal`, `.hledger`, `.ledger`

---

## 🚀 Quick Start

1. **Create or open** a `.journal`, `.hledger`, or `.ledger` file
2. **Start typing** - auto-completion activates automatically
3. **Press Enter** after transaction dates - smart indentation kicks in
4. **Press Tab** after account names - cursor jumps to amount column
5. **Save file** - automatic formatting aligns everything beautifully

### Example Workflow

```hledger
2025-01-15 * Coffee shop
    Expenses:Food:Coffee        $4.50
    Assets:Cash                -4.50
```

**Type and get instant suggestions:**

- Start line with `2025` → Date completions
- After date, type `Cof` → Payee completions
- Indent and type `Exp` → Account completions
- Type `$` after account → Commodity completions
- Add `;` and type `#` → Tag completions

---

## 📊 CLI Integration

Insert hledger reports directly into your journals as formatted comments.

**Available Commands** (via Command Palette `Ctrl+Shift+P`):

- `HLedger: Insert Balance Report` - Balance sheet with assets/liabilities
- `HLedger: Insert Income Statement` - Revenue and expense summary
- `HLedger: Insert Statistics Report` - File stats and metrics

**Example output:**

```hledger
; hledger bs - 2025-11-08
; ==================================================
; Balance Sheet 2025-01-04
;              ||  2025-01-04
; =============++=============
;  Assets      ||
; -------------++-------------
;  Assets:Bank || 2450.00 USD
; -------------++-------------
;              || 2450.00 USD
; =============++=============
;  Liabilities ||
; -------------++-------------
; -------------++-------------
;              ||           0
; =============++=============
;  Net:        || 2450.00 USD
; ==================================================
```

**Journal file resolution** (priority order):

1. `LEDGER_FILE` environment variable (validated for security)
2. `hledger.cli.journalFile` setting (validated for security)
3. Current open file (trusted from VS Code)

> **Security Note:** Paths from environment variables and configuration settings are validated to prevent command injection attacks. Shell metacharacters and inaccessible paths are rejected.

---

## 📥 CSV/TSV Import

Import bank statements and transaction data from CSV/TSV files.

**Available Commands** (via Command Palette `Ctrl+Shift+P`):

- `HLedger: Import from CSV/TSV` - Import tabular data to hledger format

**Features:**

- **Auto-detection** of delimiters (comma, tab, semicolon, pipe)
- **Smart column detection** with multi-language headers (English/Russian)
- **Account resolution** via journal history, category mapping, and merchant patterns
- **Date format detection** supports multiple formats (YYYY-MM-DD, DD.MM.YYYY, etc.)

**Account Resolution Priority:**

1. **Journal history** - Uses your existing transactions to match payees to accounts
2. **Category mapping** - Maps CSV category column to hledger accounts
3. **Merchant patterns** - Regex patterns for common merchants
4. **Amount sign** - Fallback heuristic (positive=income, negative=expense)

**Configuration:**

```jsonc
{
  "hledger.import.useJournalHistory": true,  // Learn from existing transactions
  "hledger.import.defaultDebitAccount": "expenses:unknown",
  "hledger.import.defaultCreditAccount": "income:unknown"
}
```

---

## ⚙️ Configuration

### Essential Settings

```jsonc
{
  // Auto-completion
  "hledger.autoCompletion.enabled": true,
  "hledger.autoCompletion.maxResults": 25,
  "hledger.autoCompletion.transactionTemplates.enabled": true,  // Suggest full transactions based on history

  // Inline completions (ghost text)
  "hledger.inlineCompletion.enabled": true,
  "hledger.inlineCompletion.minPayeeChars": 2,  // Min chars before showing suggestions

  // Smart features
  "hledger.smartIndent.enabled": true,
  "editor.formatOnSave": true,  // Enable auto-formatting

  // CLI integration
  "hledger.cli.path": "",  // Auto-detected if empty
  "hledger.cli.journalFile": "",  // Uses LEDGER_FILE if empty

  // Optional: Enhanced syntax highlighting
  "hledger.semanticHighlighting.enabled": false,  // Enable for more precision

  // Validation diagnostics
  "hledger.diagnostics.enabled": true,  // Disable to turn off validation warnings

  // Formatting
  "hledger.formatting.amountAlignmentColumn": 40  // Column for amount alignment (20-120)
}
```

### Customizing Colors

Customize syntax colors for any theme:

```jsonc
{
  "editor.semanticTokenColorCustomizations": {
    "rules": {
      "account:hledger": "#0EA5E9",
      "amount:hledger": "#F59E0B",
      "payee:hledger": "#EF4444",
      "tag:hledger": "#EC4899",
      "commodity:hledger": "#A855F7"
    }
  }
}
```

**Available tokens:** `account`, `amount`, `comment`, `date`, `commodity`, `payee`, `tag`, `directive`, `operator`, `code`, `link`

---

## 💡 Tips & Tricks

- **Large files?** Project-based caching handles them efficiently
- **Format not working?** Ensure `editor.formatOnSave` is enabled
- **Custom hledger path?** Set `hledger.cli.path` in settings
- **Want more precision?** Enable semantic highlighting for enhanced token identification
- **Multiple currencies?** The formatter handles them automatically

---

## 🔧 Troubleshooting

Having issues? Check our comprehensive [**Troubleshooting Guide**](./TROUBLESHOOTING.md):

- 🚫 [Completions not working](./TROUBLESHOOTING.md#completions-not-appearing)
- 🐌 [Performance with large files](./TROUBLESHOOTING.md#slow-performance-with-large-files)
- ⏱️ [CLI timeouts](./TROUBLESHOOTING.md#commands-timing-out)
- 🎨 [Syntax highlighting issues](./TROUBLESHOOTING.md#no-colors--plain-text)

**Quick fixes:**

- Reload window: `Ctrl+Shift+P` → "Reload Window"
- Manual completion: `Ctrl+Space`
- Verify file extension: `.journal`, `.hledger`, or `.ledger`

[**→ Full Troubleshooting Guide**](./TROUBLESHOOTING.md)

---

## 📚 Learning Resources

New to hledger?

- [Official Tutorial](https://hledger.org/quickstart.html)
- [Example Files](https://hledger.org/examples.html)
- [Accounting Concepts](https://hledger.org/accounting.html)
- [CLI Reference](https://hledger.org/hledger.html)

---

## 📖 Full Documentation

For complete documentation including all configuration options, keyboard shortcuts, and advanced features, see the **[User Guide](./docs/user-guide.md)**.

---

## 🤝 Contributing

Contributions are welcome! Feel free to:

- Report bugs and request features via [GitHub Issues](https://github.com/juev/hledger-vscode/issues)
- Submit pull requests
- Improve documentation

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

## 🔗 Links

- [hledger Official Site](https://hledger.org)
- [Plain Text Accounting](https://plaintextaccounting.org)
- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=evsyukov.hledger)
- [GitHub Repository](https://github.com/juev/hledger-vscode)

---

<div align="center">

**Made with ❤️ for the plain text accounting community**

*Star the repo if you find it useful!* ⭐

</div>
