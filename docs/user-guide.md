# hledger for VS Code - User Guide

Complete documentation for the hledger VS Code extension.

**Quick Links:**
- [Installation](#installation)
- [Getting Started](#getting-started)
- [Auto-Completion](#auto-completion)
- [Inline Completion (Ghost Text)](#inline-completion-ghost-text)
- [Smart Editing](#smart-editing)
- [Formatting](#formatting)
- [Syntax Highlighting](#syntax-highlighting)
- [Diagnostics & Validation](#diagnostics--validation)
- [CLI Integration](#cli-integration)
- [Context Menu](#context-menu)
- [CSV/TSV Import](#csvtsv-import)
- [Language Server (LSP)](#language-server-lsp)
- [Configuration Reference](#configuration-reference)
- [Commands Reference](#commands-reference)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Performance Tips](#performance-tips)
- [Troubleshooting](../TROUBLESHOOTING.md)

---

## Introduction

The hledger VS Code extension provides full IDE support for [hledger](https://hledger.org) plain text accounting files. It transforms your journal editing experience with intelligent auto-completion, automatic formatting, syntax highlighting, and integration with the hledger command-line tool.

### Supported File Types

The extension activates for files with these extensions:
- `.journal`
- `.hledger`
- `.ledger`
- Files named `journal` or `.journal` (without extension)

---

## Installation

### VS Code Marketplace (Recommended)

1. Open VS Code
2. Press `Ctrl+Shift+X` (or `Cmd+Shift+X` on macOS) to open Extensions
3. Search for **"hledger"**
4. Click **Install**

### Alternative Sources

- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=evsyukov.hledger)
- [Open VSX Registry](https://open-vsx.org/extension/evsyukov/hledger) - For VS Code forks like VSCodium

### File Associations

The extension automatically associates with `.journal`, `.hledger`, and `.ledger` files. If files aren't recognized:

1. Click the language indicator in the bottom-right corner of VS Code
2. Select "hledger" from the list

Or add to your `settings.json`:

```json
{
  "files.associations": {
    "*.journal": "hledger",
    "*.hledger": "hledger",
    "*.ledger": "hledger"
  }
}
```

---

## Getting Started

### Basic Workflow

1. **Create or open** a `.journal` file
2. **Start typing** - auto-completion activates automatically
3. **Press Enter** after transaction dates - LSP adds posting indent (requires `editor.formatOnType: true`)
4. **Press Tab** after account names - LSP positions cursor at amount column
5. **Save file** - automatic formatting aligns amounts

### Example Transaction

```hledger
2025-01-15 * Grocery Store
    Expenses:Food:Groceries        $45.50
    Assets:Bank:Checking          -$45.50
```

### Completion Workflow

1. Type `2025` at line start → Date completions appear
2. After date, type `Gro` → Payee completions (based on history)
3. Press Enter → Cursor indents for posting
4. Type `Exp` → Account completions
5. Press Tab → Cursor moves to amount column
6. Type `$45.50` → Amount entered
7. Press Enter → New posting line with indent

---

## Auto-Completion

The extension provides context-aware completions that activate automatically as you type. No keyboard shortcuts needed - just start typing.

### Account Completion

**Trigger**: Type on an indented line (posting context) or type `:` anywhere

**Features**:
- **Frequency-based sorting**: Most-used accounts appear first
- **Hierarchical navigation**: Type `:` to drill into sub-accounts
- **Abbreviation matching**: Type initials to find accounts
  - `ef` matches `Expenses:Food`
  - `abc` matches `Assets:Bank:Checking`
- **Fuzzy matching**: Partial matches work too
- **Usage count display**: Shows how often each account is used

**Example**:
```
Typing "exp:foo" shows:
  Expenses:Food (used 150 times)
  Expenses:Food:Groceries (used 89 times)
  Expenses:Food:Restaurants (used 45 times)
```

### Payee Completion

**Trigger**: After date and optional status on transaction line

**Features**:
- Sorted by usage frequency
- Fuzzy matching supported
- Multi-language support (Cyrillic, Asian characters, etc.)

**Example**:
```hledger
2025-01-15 Amaz    ; typing "Amaz" suggests "Amazon", "Amazon Prime", etc.
```

### Date Completion

**Trigger**: Type a digit (0-9) at line start

**Suggestions**:
| Suggestion | Description |
|------------|-------------|
| Today | Current date |
| Yesterday | Previous day |
| Last week | 7 days ago |
| Month start | First of current month |
| Last month | First of previous month |
| Last used | Most recent date in journal |

**Format**: Dates use `YYYY-MM-DD` format by default.

### Commodity Completion

**Trigger**: Type `@` after an amount, or in amount context

**Features**:
- Common currency symbols: `$`, `€`, `£`, `¥`, `₽`
- Currency codes: `USD`, `EUR`, `GBP`
- Custom commodities from your journal
- Marks default commodity if set

### Tag Completion

**Trigger**: Type `;` to start a comment, then type tag content

**Two modes**:

1. **Tag name completion**: Suggests existing tag names
   ```hledger
   ; project:    ; typing suggests: project, category, etc.
   ```

2. **Tag value completion**: After tag name and `:`, suggests values
   ```hledger
   ; project:home    ; typing after : suggests values used with "project" tag
   ```

### Transaction Template Completion

**Trigger**: When typing payee name (if enabled)

**Features**:
- Suggests complete transaction structures based on history
- Shows accounts and amounts from similar past transactions
- Snippet support for cursor positioning
- Prioritizes recent transaction patterns

**Example**: When you type "Amazon", you might see:
```
Amazon → Template:
    Expenses:Shopping    $XX.XX
    Assets:Credit Card
```

---

## Inline Completion (Ghost Text)

Inline completions show suggestions as "ghost text" - semi-transparent text that appears ahead of your cursor.

### How It Works

1. Start typing a payee name on a new transaction line
2. After typing minimum characters (default: 2), ghost text appears
3. Press **Enter** to accept the suggestion
4. Press **Escape** or continue typing to dismiss

### Payee Inline Completion

Shows the remainder of matching payee names:

```hledger
2025-01-15 Amaz|on Prime     ; "on Prime" shown as ghost text
```

### Template Inline Completion

Shows complete posting structure as ghost text:

```hledger
2025-01-15 Amazon Prime|
    Expenses:Shopping    $12.99    ; shown as ghost text
    Assets:Credit Card
```

### Configuration

| Setting | Description | Default |
|---------|-------------|---------|
| `hledger.inlineCompletion.enabled` | Enable/disable inline completions | `true` |
| `hledger.inlineCompletion.minPayeeChars` | Minimum characters before showing | `2` |

### LSP Dependency

Inline completions require the Language Server (LSP) to be running. The Language Server is automatically installed on first activation. When the LSP is unavailable:
- Ghost text suggestions will not appear
- No error is shown - the feature silently waits for LSP availability
- Once LSP starts, inline completions work automatically

---

## Smart Editing

### On-Type Formatting (LSP)

When the Language Server is running and `editor.formatOnType` is enabled in VS Code settings, the LSP handles formatting as you type:

| Trigger | Behavior |
|---------|----------|
| `Enter` after transaction date line | Adds posting indent |
| `Enter` after posting line | Preserves indent for next posting |
| `Enter` on empty indented line | Removes indent (outdents) |
| `Tab` after account name | Positions cursor at amount alignment column |

To enable, add to your `settings.json`:

```json
{
  "editor.formatOnType": true
}
```

**Fallback:** When the LSP is not running, `onEnterRules` from the language configuration provide basic indentation behavior.

### Completion Triggers

| Character | Triggers |
|-----------|----------|
| `0-9` | Date completion (at line start) |
| `:` | Account hierarchy navigation |
| `@` | Commodity completion |
| `;` | Tag/comment completion |
| Space | Context-aware completion |

---

## Formatting

The extension provides automatic formatting to keep your journals clean and readable.

### Enable Format on Save

Add to your `settings.json`:

```json
{
  "editor.formatOnSave": true
}
```

### What Gets Formatted

| Element | Formatting Applied |
|---------|-------------------|
| Amounts | Right-aligned at consistent column |
| Comments | Right-aligned |
| Posting indentation | Normalized to 4 spaces |
| Account-amount spacing | Standardized using 2+ spaces |

### Preserved Elements

The formatter preserves:
- Balance assertions (`= $100`)
- Balance assignments (`:= $100`)
- Virtual postings (parentheses and brackets)
- Commodity format (prefix `$100` vs postfix `100 USD`)
- Sign placement (`-$100`, `$-100`, `-100 USD`)
- Metadata and tags
- Empty lines and structure

### Multi-Currency Support

The formatter handles multiple currencies intelligently:

```hledger
2025-01-15 International Purchase
    Expenses:Shopping            $45.00
    Expenses:Travel             €120.00
    Assets:Bank:USD             -$45.00
    Assets:Bank:EUR            -€120.00
```

### Amount Formatting by Commodity

When you have `commodity` directives in your journal, amounts are automatically formatted according to their format specification on save.

**Automatic Formatting**: Enable `editor.formatOnSave` in VS Code settings to format amounts automatically when saving the file.

```hledger
; Commodity directives define the format
commodity RUB 1 000,00  ; space as group separator, comma as decimal
commodity $1,000.00     ; comma as group separator, period as decimal

; Default commodity for postings without explicit currency
D RUB 1 000,00

2025-01-15 Supermarket
    ; Before save: "1000 RUB" → After save: "1 000,00 RUB"
    Expenses:Food                          1 000,00 RUB
    ; Before save: "1000" (no commodity) → After save: "1 000,00" (uses D directive)
    Assets:Cash                           -1 000,00
```

**Behavior**:
- With explicit commodity: formats number and keeps symbol (e.g., `1000 RUB` → `1 000,00 RUB`)
- Without commodity: uses `D` directive format, formats only the number (e.g., `1000` → `1 000,00`)
- All amounts in a posting are formatted: main amount, cost notation (`@ 95.50 USD`), balance assertion (`= 5000 RUB`)
- Virtual postings (`()`, `[]`) are fully supported
- No format defined: amount is not modified
- Amounts are aligned to `hledger.formatting.amountAlignmentColumn` (default: 40)

### Manual Formatting

- **Format Document**: `Ctrl+Shift+I` (or `Cmd+Shift+I` on macOS)
- **Format Selection**: Select text, then use same command

---

## Syntax Highlighting

The extension provides two levels of syntax highlighting:

1. **TextMate Grammar** (always available): Basic syntax highlighting using VS Code's built-in TextMate engine. Works without the Language Server.
2. **Semantic Tokens** (requires LSP): Rich, context-aware highlighting provided by the Language Server. Offers more accurate and detailed highlighting.

**Automatic Fallback:** When the Language Server is not running or semantic tokens are disabled, VS Code automatically uses TextMate grammar highlighting. Basic syntax highlighting is always available.

**Recommended Setup:**
- Language Server running + Semantic tokens enabled (default) = Best experience

### Enable/Disable Semantic Highlighting

Semantic highlighting is enabled by default:

```json
{
  "hledger.features.semanticTokens": true
}
```

### Semantic Token Types

| Token | VS Code Type | TextMate Scope | Dark+ Color | Description |
|-------|--------------|----------------|-------------|-------------|
| `account` | `namespace` | `entity.name.namespace` | Cyan (#4EC9B0) | Account names |
| `accountVirtual` | `namespace` | `entity.name.namespace` | Cyan (#4EC9B0) | Virtual accounts in `()` or `[]` |
| `amount` | `number` | `constant.numeric` | Green (#B5CEA8) | Numeric amounts |
| `date` | `number` | `constant.numeric` | Green (#B5CEA8) | Transaction dates |
| `time` | `number` | `constant.numeric` | Green (#B5CEA8) | Time values |
| `commodity` | `type` | `entity.name.type` | Cyan (#4EC9B0) | Currency/commodity codes |
| `payee` | `function` | `entity.name.function` | Yellow (#DCDCAA) | Payee names |
| `note` | `comment` | `comment.block` | Green (#6A9955) | Metadata notes |
| `tag` | `decorator` | `entity.name.tag` | Blue (#569CD6) | Tag names |
| `tagValue` | `string` | `string` | Orange (#CE9178) | Tag values |
| `directive` | `keyword` | `keyword.control` | Purple (#C586C0) | Directives (include, account, etc.) |
| `code` | `string` | `string.quoted` | Orange (#CE9178) | Transaction codes |
| `status` | `operator` | `keyword.operator` | Light (#D4D4D4) | Status markers (`*`, `!`) |
| `link` | `label` | `markup.underline.link` | Blue (underlined) | Inter-transaction links |

Additionally, `comment` and `operator` have scope mappings in `semanticTokenScopes` (for `comment.line` and `keyword.operator` respectively) but are not registered as formal semantic token types.

**How highlighting works:**
1. **TextMate Scopes** (highest priority) - Standard scopes like `entity.name.namespace`, `constant.numeric` that themes understand
2. **VS Code Type** (fallback) - Semantic token type used when theme doesn't customize the scope
3. **Theme defaults** (lowest priority) - Built-in theme colors

The extension uses standard TextMate scopes that are recognized by all VS Code themes, ensuring consistent highlighting without custom theme configuration.

### Color Customization

You can customize colors in two ways:

#### Option 1: Per Semantic Token Type (Recommended)

Override colors specifically for hledger tokens. This works with any theme and doesn't affect other languages:

```json
{
  "editor.semanticTokenColorCustomizations": {
    "rules": {
      "account:hledger": "#0EA5E9",
      "payee:hledger": "#EF4444",
      "date:hledger": "#22C55E",
      "amount:hledger": "#F59E0B",
      "commodity:hledger": "#A855F7",
      "tag:hledger": "#EC4899"
    }
  }
}
```

#### Option 2: Per TextMate Scope (Global)

Customize the underlying TextMate scopes. This affects ALL languages that use these scopes:

```json
{
  "editor.tokenColorCustomizations": {
    "textMateRules": [
      {
        "scope": "entity.name.function",
        "settings": { "foreground": "#DCDCAA" }
      },
      {
        "scope": "constant.numeric",
        "settings": { "foreground": "#B5CEA8" }
      },
      {
        "scope": "entity.name.namespace",
        "settings": { "foreground": "#4EC9B0" }
      }
    ]
  }
}
```

⚠️ **Warning:** TextMate scope customization applies to all languages, not just hledger.

### Default Theme Colors

The extension uses standard TextMate scopes that are automatically styled by VS Code themes:
- **Dark+**: Accounts (cyan), payees (yellow), amounts/dates (green), directives (purple)
- **Light+**: Similar semantic colors with adjusted brightness for light backgrounds

No additional configuration is needed for standard themes to work correctly.

---

## Diagnostics & Validation

The extension validates your journal files and shows warnings/errors.

### What Gets Validated

| Type | Description |
|------|-------------|
| Account validation | Checks for undefined accounts |
| Commodity validation | Checks for undeclared commodities (when `commodity` directives exist) |
| Amount format | Validates complex amount patterns |
| Tag format | Validates tag syntax |
| Transaction balance | Checks that transactions balance to zero |

### Transaction Balance Validation

The extension checks that all transactions balance correctly:

- **Each commodity balances separately** - All postings with the same commodity must sum to zero
- **One inferred amount allowed** - At most one posting can omit its amount
- **Virtual postings handled**:
  - `(account)` - Unbalanced virtual postings are ignored
  - `[account]` - Balanced virtual postings must balance among themselves
- **Cost notation supported** - `@` and `@@` price conversions are properly handled
- **Balance assertions** - `= $500`, `== $500`, `:= $500` are recognized

When a transaction doesn't balance, the error appears on the transaction date line with details about the imbalance (e.g., "Transaction is unbalanced in USD; difference is 10.50").

#### Troubleshooting Balance Errors

**"Transaction has N postings without amounts"**
- hledger allows only one posting to omit its amount (inferred from others)
- Solution: Add explicit amounts to all but one posting

**"Transaction is unbalanced in X; difference is Y"**
- The sum of all postings for commodity X doesn't equal zero
- Common causes:
  - Typo in amount
  - Missing posting
  - Incorrect cost notation (`@` vs `@@`)
- For small differences (e.g., `$0.01`), check decimal precision in your amounts

**Cost notation (`@` vs `@@`)**
- `@` = unit price: `10 AAPL @ $150` means each unit costs $150 (total: $1500)
- `@@` = total price: `10 AAPL @@ $1500` means all units together cost $1500

**Disable balance checking**
If you prefer to use hledger CLI for validation, you can disable balance checking:

```json
{
  "hledger.diagnostics.checkBalance": false
}
```

**Tolerance configuration**
For cryptocurrencies with 8+ decimal places, increase tolerance to avoid false positives:

```json
{
  "hledger.diagnostics.balanceTolerance": 1e-8
}
```

### Validated Amount Patterns

The extension recognizes all valid hledger amount formats:

- Basic: `-$10.00`, `$-10.00`, `$10.00`
- Unicode currencies: `₽100.00`, `€50.00`, `£25.00`
- Grouped numbers: `1,000.00`, `1.000,00`, `1 000.00`
- Scientific notation: `1E-6`, `1E3`
- Quoted commodities: `3 "green apples"`
- Balance assertions: `= $500`, `== $500`
- Balance assignment: `:= $500`
- Amount with assertion: `$100 = $500`
- Amount with cost: `10 AAPL @ $150`

### Disable Validation

If diagnostics are not needed:

```json
{
  "hledger.diagnostics.enabled": false
}
```

---

## CLI Integration

Run hledger commands directly from VS Code and insert results into your journal.

### Prerequisites

- hledger must be installed and in your PATH
- Or configure explicit path in settings

### Available Commands

Access via Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`):

| Command | Description | hledger command |
|---------|-------------|-----------------|
| HLedger: Insert Balance Report | Balance sheet with assets/liabilities | `hledger bs` |
| HLedger: Insert Income Statement | Revenue and expense summary | `hledger incomestatement` |
| HLedger: Insert Statistics Report | File statistics and metrics | `hledger stats` |

### Example Output

```hledger
; hledger bs - 2025-01-15
; ==================================================
; Balance Sheet 2025-01-15
;              ||  2025-01-15
; =============++=============
;  Assets      ||
; -------------++-------------
;  Assets:Bank || 2450.00 USD
; -------------++-------------
;              || 2450.00 USD
; ==================================================
```

### Journal File Resolution

The extension determines which journal file to use in this priority:

1. **`LEDGER_FILE` environment variable** - If set and valid
2. **`hledger.cli.journalFile` setting** - If configured
3. **Current open file** - As fallback

### Security

Paths from environment variables and settings are validated to prevent command injection:
- Shell metacharacters (`;`, `&`, `|`, `` ` ``, `$`, etc.) are rejected
- Inaccessible paths show error messages
- Current file paths (from VS Code) are trusted

### Configuration

| Setting | Description | Default |
|---------|-------------|---------|
| `hledger.cli.path` | Path to hledger executable | Auto-detected |
| `hledger.cli.journalFile` | Main journal file path | Uses env or current file |

---

## Context Menu

Right-click in the editor to access the HLedger submenu with quick access to CLI reports.

### Available Commands

| Command | Description |
|---------|-------------|
| **Insert Balance Report** | Insert `hledger bs` output as comment |
| **Insert Income Statement** | Insert `hledger is` output as comment |
| **Insert Statistics** | Insert `hledger stats` output as comment |

### Usage

1. Open a `.journal`, `.hledger`, or `.ledger` file
2. Right-click in the editor
3. Select **HLedger** from the context menu
4. Choose the desired report

The context menu only appears for hledger files and provides the same functionality as the Command Palette commands, but with faster access.

Navigation commands (Go to Definition, Go to References, Rename Symbol) are available through VS Code's standard context menu when the Language Server is active.

---

## CSV/TSV Import

Import bank statements and transaction data from tabular files.

### Commands

| Command | Description |
|---------|-------------|
| HLedger: Import Selected Tabular Data | Import selected text as CSV/TSV |
| HLedger: Import Tabular Data from File | Import entire active file |

### Supported Delimiters

The extension auto-detects:
- Tab-separated (TSV)
- Comma-separated (CSV)
- Semicolon-separated
- Pipe-separated (`|`)

### Column Detection

The extension recognizes columns by header names (English and Russian):

| Column Type | Recognized Headers |
|-------------|-------------------|
| Date | Date, Дата |
| Description/Payee | Description, Payee, Merchant, Описание |
| Amount | Amount, Sum, Сумма |
| Debit | Debit, Expense |
| Credit | Credit, Income |
| Category | Category, Категория |
| Account | Account |
| Memo | Memo, Note |
| Reference | Reference, ID |
| Balance | Balance |
| Currency | Currency |

### Account Resolution

The import feature tries to match payees to accounts using multiple strategies:

| Priority | Strategy | Confidence | Description |
|----------|----------|------------|-------------|
| 1 | Journal history (exact) | 95% | Exact payee match from existing transactions |
| 2 | Journal history (fuzzy) | 85% | Similar payee names |
| 3 | Category (exact) | 80% | Direct category column match |
| 4 | Category (partial) | 75% | Partial category match (contains/contained by) |
| 5 | Merchant pattern | 70% | Regex patterns for common merchants |
| 6 | Amount sign | 50% | Positive=income, negative=expense |
| 7 | Default accounts | 0% | Configured defaults |

### Date Format Handling

| Setting Value | Format |
|---------------|--------|
| `auto` | Auto-detect (default) |
| `YYYY-MM-DD` | 2025-01-15 |
| `YYYY/MM/DD` | 2025/01/15 |
| `DD/MM/YYYY` | 15/01/2025 |
| `MM/DD/YYYY` | 01/15/2025 |
| `DD.MM.YYYY` | 15.01.2025 |
| `DD-MM-YYYY` | 15-01-2025 |

### Import Settings

| Setting | Description | Default |
|---------|-------------|---------|
| `hledger.import.dateFormat` | Expected date format | `auto` |
| `hledger.import.defaultDebitAccount` | Account for expenses | `expenses:unknown` |
| `hledger.import.defaultCreditAccount` | Account for income | `income:unknown` |
| `hledger.import.defaultBalancingAccount` | Balancing posting account | `TODO:account` |
| `hledger.import.invertAmounts` | Invert amount signs | `false` |
| `hledger.import.useJournalHistory` | Learn from existing transactions | `true` |

---

## Language Server (LSP)

The extension uses a Language Server Protocol (LSP) backend for most features. The LSP server provides completions, real-time diagnostics, formatting, semantic highlighting, and other capabilities.

### Without Language Server

The Language Server is required and auto-installed on first activation. If the LSP is unavailable (e.g., auto-install was declined or binary was removed), the following fallback features remain:

- **Syntax highlighting**: Basic TextMate grammar highlighting (automatic fallback)
- **Basic indentation**: `onEnterRules` from language configuration provide basic Enter key indentation
- **CLI integration**: balance, stats, income statement commands (works locally)
- **CSV/TSV import**: Import functionality (works locally)

**Features unavailable without LSP:**
- On-type formatting (smart Enter/Tab with `editor.formatOnType`)
- Inline completions (ghost text)
- Auto-completion (accounts, payees, dates, etc.)
- Diagnostics and validation
- Document formatting
- Code navigation (Go to Definition, Find References)
- Hover information
- Folding ranges
- Workspace symbols
- CodeLens balance indicators

### Installation

The Language Server is automatically installed on first activation. If prompted, accept the installation to enable all features. The binary is stored in VS Code's global storage directory.

A **Get Started** walkthrough is available on first install (Command Palette → "Get Started: HLedger") that guides you through Language Server installation, opening a journal file, and importing from CSV.

To manually reinstall or update:

1. Open Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`)
2. Run **HLedger: Install/Update Language Server**
3. Wait for the download to complete

### Status Bar

The extension shows an LSP status indicator in the VS Code status bar (bottom-right). The indicator reflects the current state of the Language Server:

| Icon | State | Description |
|------|-------|-------------|
| `$(server)` | Running | LSP is active and providing features |
| `$(sync~spin)` | Starting / Downloading | LSP is starting up or being downloaded |
| `$(warning)` | Error | LSP encountered an error (click to restart) |
| `$(cloud-download)` | Not Installed | LSP binary not found |
| `$(debug-stop)` | Stopped | LSP is stopped |

Click the status bar item to restart the Language Server.

### Output Channel

Extension logs are available in the Output panel under **HLedger** channel (`View → Output → HLedger`). When `hledger.lsp.debug` is enabled, additional debug-level messages are logged. This is useful for diagnosing issues without opening Developer Tools.

### LSP Commands

| Command | Description |
|---------|-------------|
| `hledger.lsp.update` | Install or update the language server binary |
| `hledger.lsp.showVersion` | Show installed version and status |
| `hledger.lsp.restart` | Restart the language server |

> **Note:** CLI commands (`hledger.cli.balance`, `hledger.cli.stats`, `hledger.cli.incomestatement`) and `hledger.editor.alignAmount` only appear in the Command Palette when a `.journal`/`.hledger`/`.ledger` file is active. Import and LSP commands are always available.

### LSP Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `hledger.lsp.path` | string | `""` | Custom path to hledger-lsp binary. If empty, uses auto-downloaded binary |
| `hledger.lsp.debug` | boolean | `false` | Enable debug logging for the LSP server (output visible in HLedger output channel) |
| `hledger.lsp.checkForUpdates` | boolean | `true` | Check for Language Server updates on extension activation |

### LSP Feature Settings

Control which Language Server features are enabled:

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `hledger.features.hover` | boolean | `true` | Enable hover information |
| `hledger.features.completion` | boolean | `true` | Enable autocompletion |
| `hledger.features.formatting` | boolean | `true` | Enable document formatting |
| `hledger.features.diagnostics` | boolean | `true` | Enable diagnostics |
| `hledger.features.semanticTokens` | boolean | `true` | Enable semantic tokens |
| `hledger.features.codeActions` | boolean | `true` | Enable code actions |
| `hledger.features.foldingRanges` | boolean | `true` | Enable transaction folding |
| `hledger.features.documentLinks` | boolean | `true` | Enable links for include directives |
| `hledger.features.workspaceSymbol` | boolean | `true` | Enable workspace symbol search |
| `hledger.features.inlineCompletion` | boolean | `true` | Enable inline ghost text completions |
| `hledger.features.codeLens` | boolean | `false` | Enable balance check indicators on transactions |

### LSP Completion Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `hledger.completion.snippets` | boolean | `true` | Enable snippet completions for payees |
| `hledger.completion.fuzzyMatching` | boolean | `true` | Enable fuzzy matching |
| `hledger.completion.showCounts` | boolean | `true` | Show usage counts in completions |
| `hledger.completion.maxResults` | number | `50` | Maximum number of completion items (5-200) |
| `hledger.completion.includeNotes` | boolean | `true` | Include notes in payee completions |

### LSP Diagnostics Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `hledger.diagnostics.undeclaredAccounts` | boolean | `true` | Report undeclared accounts |
| `hledger.diagnostics.undeclaredCommodities` | boolean | `true` | Report undeclared commodities |
| `hledger.diagnostics.unbalancedTransactions` | boolean | `true` | Report unbalanced transactions |

### LSP Formatting Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `hledger.formatting.indentSize` | number | `4` | Number of spaces for posting indentation (2-8) |
| `hledger.formatting.alignAmounts` | boolean | `true` | Align amounts in postings |

### CLI Integration Settings (LSP)

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `hledger.cli.enabled` | boolean | `true` | Enable CLI integration |
| `hledger.cli.timeout` | number | `30000` | Timeout for commands in milliseconds (1000-300000) |

### Limits Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `hledger.limits.maxFileSizeBytes` | number | `10485760` | Maximum file size (1MB-100MB, default: 10MB) |
| `hledger.limits.maxIncludeDepth` | number | `50` | Maximum include directive depth (1-100) |

### Backward Compatibility

The new settings maintain backward compatibility with existing settings:

| Old Setting | New Setting | Notes |
|-------------|-------------|-------|
| `autoCompletion.enabled` | `features.completion` | New takes precedence if both set |
| `diagnostics.enabled` | `features.diagnostics` | New takes precedence if both set |
| `diagnostics.checkBalance` | `diagnostics.unbalancedTransactions` | New takes precedence if both set |

### Using Custom Binary

If you prefer to use your own hledger-lsp binary:

1. Install hledger-lsp manually
2. Configure the path in settings:
   ```json
   {
     "hledger.lsp.path": "/path/to/hledger-lsp"
   }
   ```

### Supported Platforms

Auto-download supports:
- macOS (Intel and Apple Silicon)
- Linux (x64 and ARM64)
- Windows (x64)

---

## Configuration Reference

### Auto-Completion Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `hledger.autoCompletion.enabled` | boolean | `true` | Enable automatic completion |
| `hledger.autoCompletion.maxResults` | number | `25` | Maximum completion items (5-50) |
| `hledger.autoCompletion.maxAccountResults` | number | `30` | Maximum account items (5-50) |
| `hledger.autoCompletion.transactionTemplates.enabled` | boolean | `true` | Enable transaction template suggestions |

### Inline Completion Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `hledger.inlineCompletion.enabled` | boolean | `true` | Enable ghost text completions |
| `hledger.inlineCompletion.minPayeeChars` | number | `2` | Minimum chars before showing (1-10) |

### CLI Integration Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `hledger.cli.path` | string | `""` | Path to hledger (auto-detected if empty) |
| `hledger.cli.journalFile` | string | `""` | Main journal file path |

### Diagnostics Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `hledger.diagnostics.enabled` | boolean | `true` | Enable validation diagnostics |
| `hledger.diagnostics.checkBalance` | boolean | `true` | Check that transactions balance correctly |
| `hledger.diagnostics.balanceTolerance` | number | `1e-10` | Tolerance for balance validation. Useful for high-precision accounting with cryptocurrencies |

### Formatting Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `hledger.formatting.amountAlignmentColumn` | number | `40` | Minimum column for amount alignment (20-120) |

**Note:** The `amountAlignmentColumn` setting specifies the minimum column position. Amounts are aligned at least at this column, but may shift further right when account names are long enough to require additional space.

### Import Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `hledger.import.dateFormat` | enum | `auto` | Expected date format in imports |
| `hledger.import.defaultDebitAccount` | string | `expenses:unknown` | Default expense account |
| `hledger.import.defaultCreditAccount` | string | `income:unknown` | Default income account |
| `hledger.import.defaultBalancingAccount` | string | `TODO:account` | Default balancing account |
| `hledger.import.invertAmounts` | boolean | `false` | Invert amount signs |
| `hledger.import.useJournalHistory` | boolean | `true` | Use journal history for account matching |

### Language Server Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `hledger.lsp.path` | string | `""` | Custom path to hledger-lsp binary |
| `hledger.lsp.debug` | boolean | `false` | Enable debug logging for LSP |
| `hledger.lsp.checkForUpdates` | boolean | `true` | Check for LSP updates on activation |

### LSP Feature Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `hledger.features.hover` | boolean | `true` | Enable hover information |
| `hledger.features.completion` | boolean | `true` | Enable autocompletion |
| `hledger.features.formatting` | boolean | `true` | Enable document formatting |
| `hledger.features.diagnostics` | boolean | `true` | Enable diagnostics |
| `hledger.features.semanticTokens` | boolean | `true` | Enable semantic tokens |
| `hledger.features.codeActions` | boolean | `true` | Enable code actions |
| `hledger.features.foldingRanges` | boolean | `true` | Enable transaction folding |
| `hledger.features.documentLinks` | boolean | `true` | Enable links for include directives |
| `hledger.features.workspaceSymbol` | boolean | `true` | Enable workspace symbol search |
| `hledger.features.inlineCompletion` | boolean | `true` | Enable inline ghost text completions |
| `hledger.features.codeLens` | boolean | `false` | Enable balance check indicators on transactions |

### LSP Completion Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `hledger.completion.snippets` | boolean | `true` | Enable snippet completions for payees |
| `hledger.completion.fuzzyMatching` | boolean | `true` | Enable fuzzy matching |
| `hledger.completion.showCounts` | boolean | `true` | Show usage counts in completions |
| `hledger.completion.maxResults` | number | `50` | Maximum number of completion items (5-200) |
| `hledger.completion.includeNotes` | boolean | `true` | Include notes in payee completions |

### LSP Diagnostics Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `hledger.diagnostics.undeclaredAccounts` | boolean | `true` | Report undeclared accounts |
| `hledger.diagnostics.undeclaredCommodities` | boolean | `true` | Report undeclared commodities |
| `hledger.diagnostics.unbalancedTransactions` | boolean | `true` | Report unbalanced transactions |

### LSP Formatting Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `hledger.formatting.indentSize` | number | `4` | Posting indentation (2-8 spaces) |
| `hledger.formatting.alignAmounts` | boolean | `true` | Align amounts in postings |

### CLI Settings (Extended)

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `hledger.cli.enabled` | boolean | `true` | Enable CLI integration |
| `hledger.cli.timeout` | number | `30000` | Command timeout in milliseconds |

### Limits Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `hledger.limits.maxFileSizeBytes` | number | `10485760` | Maximum file size (default: 10MB) |
| `hledger.limits.maxIncludeDepth` | number | `50` | Maximum include directive depth |

---

## Commands Reference

All commands accessible via Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`):

| Command | Title | Description |
|---------|-------|-------------|
| `hledger.cli.balance` | HLedger: Insert Balance Report | Insert balance sheet as comment |
| `hledger.cli.stats` | HLedger: Insert Statistics Report | Insert file statistics as comment |
| `hledger.cli.incomestatement` | HLedger: Insert Income Statement | Insert income statement as comment |
| `hledger.import.fromSelection` | HLedger: Import Selected Tabular Data | Import selected CSV/TSV |
| `hledger.import.fromFile` | HLedger: Import Tabular Data from File | Import active file as CSV/TSV |
| `hledger.lsp.update` | HLedger: Install/Update Language Server | Install or update LSP binary |
| `hledger.lsp.showVersion` | HLedger: Show Language Server Version | Show LSP version info |
| `hledger.lsp.restart` | HLedger: Restart Language Server | Restart the LSP server |
| `hledger.editor.alignAmount` | HLedger: Align Amount to Column | Align amount at cursor via LSP |

---

## Keyboard Shortcuts

### Default Keybindings

| Key | Action | Condition |
|-----|--------|-----------|
| `Enter` | Accept completion | When completion widget is visible |
| `Enter` | Accept inline suggestion | When ghost text is visible |
| `Tab` | Align amount to column | When no suggestions/snippets active |
| `Ctrl+Space` | Manual completion trigger | Always |

**On-type formatting** (Enter/Tab) is handled by the Language Server when `editor.formatOnType` is enabled.

### Completion Trigger Characters

These characters automatically trigger completions:

| Character | Triggers | Context |
|-----------|----------|---------|
| `0-9` | Date completion | At line start |
| `:` | Account hierarchy | After account name segment |
| `@` | Commodity completion | After amount |
| `;` | Tag completion | Anywhere (starts comment) |

---

## Performance Tips

### Large Files

For journals with thousands of transactions:

1. **Split into multiple files** using `include`:
   ```hledger
   include 2024-01.journal
   include 2024-02.journal
   include 2025-01.journal
   ```

2. **Project-based caching** handles large files efficiently:
   - Files are parsed incrementally
   - Only changed files are reparsed
   - Cache validates using file modification times

### Include Directives

Best practices:
- Organize by year or month
- Keep active/current transactions in main file
- Archive old transactions in included files
- Maximum nesting depth: 50 levels (configurable up to 100 via `hledger.limits.maxIncludeDepth`)

### Cache Behavior

The extension caches:
- Parsed accounts, payees, tags, commodities
- Usage frequency counts
- File modification times

Cache invalidation:
- Automatic on file save
- Automatic on file changes (filesystem watcher)
- Manual: Reload VS Code window

### Disable Features for Performance

If experiencing slowness:

```json
{
  "hledger.features.semanticTokens": false,
  "hledger.features.diagnostics": false,
  "hledger.diagnostics.checkBalance": false,
  "hledger.autoCompletion.transactionTemplates.enabled": false
}
```

---

## Additional Resources

- [Troubleshooting Guide](../TROUBLESHOOTING.md) - Common issues and solutions
- [hledger Official Documentation](https://hledger.org/hledger.html) - Complete hledger reference
- [hledger Tutorial](https://hledger.org/quickstart.html) - Getting started with hledger
- [Plain Text Accounting](https://plaintextaccounting.org) - Community resources
- [GitHub Issues](https://github.com/juev/hledger-vscode/issues) - Report bugs or request features

---

*This documentation is for hledger VS Code extension. For the most up-to-date version, see the [GitHub repository](https://github.com/juev/hledger-vscode).*
