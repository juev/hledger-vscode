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

- **LSP-powered highlighting**: Semantic tokens from the Language Server for precise syntax coloring
- **Theme integration**: Adapts to your VS Code theme automatically
- **Customizable colors** for all hledger elements

### ⚡ **Automatic Formatting**

- **Smart alignment** for amounts and comments (right-edge or decimal/mantissa alignment)
- **Format on save** - keep your journals tidy automatically
- **Multi-currency support** with international number formats
- **Commodity-aware formatting** - amounts formatted according to `commodity` directives
- Preserves balance assertions, virtual postings, and metadata

### ✅ **Transaction Validation**

- **Real-time balance checking** - validates transactions on save
- **Multi-commodity support** - each currency balanced separately
- **Inferred amounts** - supports single posting without amount
- **Cost notation** - supports `@` (unit cost) and `@@` (total cost)
- **Balance assertions** - handles `=`, `==`, `=*` syntax

### 🔧 **Smart Editing**

- **On-type formatting** via LSP - auto-indent and amount alignment as you type
- **Transaction status toggle** - cycle through unmarked/pending/cleared with keyboard shortcuts
- **Multi-language** Unicode support (Cyrillic, Asian languages, etc.)

### 🧭 **Code Navigation**

- **Go to Definition** and **Find References** for accounts, payees, commodities
- **Rename Symbol** - rename accounts/payees across the entire journal
- **Document Highlight** - highlight all occurrences of a symbol
- **Smart Selection** - expand/shrink selection by semantic ranges

### 📊 **CLI Integration**

- Insert **balance sheets**, **income statements**, and **statistics** directly into journals
- Automatic journal file detection
- Results formatted as comments

### 🚀 **Performance**

- **Project-based caching** for large journal files
- **Incremental updates** - only reparse changed files
- Efficient workspace parsing

### 🔌 **Language Server Protocol (LSP)**

- **Required LSP backend**, auto-installed on first activation
- **Auto-download** of LSP binary from GitHub releases
- **Status bar indicator** showing LSP state (Running, Error, etc.)
- **Output channel** for diagnostics (`View → Output → HLedger`)
- **Guided walkthrough** for new users (Command Palette → "Get Started: HLedger")
- **CodeLens** balance check indicators on transactions (opt-in)
- Cross-platform support (macOS, Linux, Windows)

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

**Supported files:** `.journal`, `.hledger`, `.ledger`, `.rules`

---

## 🚀 Quick Start

1. **Create or open** a `.journal`, `.hledger`, or `.ledger` file
2. **Accept LSP installation** when prompted on first activation
3. **Start typing** - auto-completion activates automatically
4. **Press Enter** after transaction dates - LSP handles indentation
5. **Save file** - automatic formatting aligns everything

### Example Workflow

```hledger
2025-01-15 * Coffee shop
    Expenses:Food:Coffee        $4.50
    Assets:Cash                -$4.50
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

- `HLedger: Import Selected Tabular Data` - Import selected text as CSV/TSV
- `HLedger: Import Tabular Data from File` - Import active file as CSV/TSV

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
  "hledger.features.inlineCompletion": true,

  // Formatting
  "editor.formatOnType": true,   // Enable on-type formatting (Enter/Tab via LSP)
  "editor.formatOnSave": true,   // Enable auto-formatting on save

  // CLI integration
  "hledger.cli.path": "",  // Auto-detected if empty
  "hledger.cli.journalFile": "",  // Uses LEDGER_FILE if empty

  // Optional: Disable semantic highlighting to use only TextMate grammar
  "hledger.features.semanticTokens": true,  // Enabled by default

  // Validation diagnostics
  "hledger.diagnostics.enabled": true,  // Disable to turn off validation warnings

  // Formatting
  "hledger.formatting.amountAlignmentColumn": 0,  // Minimum alignment column (0 = auto, preserves hand-formatted layout)
  "hledger.formatting.alignAmounts": true,  // Align amounts in postings
  "hledger.formatting.amountAlignmentMode": "right"  // "right" (right edge) or "decimal" (mantissa)
}
```

### Customizing Colors

Customize syntax colors for any theme:

```jsonc
{
  "editor.semanticTokenColorCustomizations": {
    "rules": {
      "namespace:hledger": "#0EA5E9",
      "number:hledger": "#F59E0B",
      "function:hledger": "#EF4444",
      "decorator:hledger": "#EC4899",
      "type:hledger": "#A855F7"
    }
  }
}
```

**Available tokens:** `namespace`, `type`, `function`, `number`, `decorator`, `keyword`, `string`, `operator`, `comment` (plus `regexp` and `parameter` for `.rules` files — see [User Guide](docs/user-guide.md) for details)

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

- [Official Tutorial](https://hledger.org/5-minute-quick-start.html)
- [Common Journal Entries](https://hledger.org/common-journal-entries.html)
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
