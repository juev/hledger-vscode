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
- [CSV/TSV Import](#csvtsv-import)
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
3. **Press Enter** after transaction dates - smart indentation adds posting indent
4. **Press Tab** after account names - cursor jumps to amount column
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

---

## Smart Editing

### Smart Enter

When `hledger.smartIndent.enabled` is `true` (default):

| Context | Behavior |
|---------|----------|
| After transaction date line | Adds 4-space indent for posting |
| After posting line | Formats amount by commodity, preserves indent for next posting |
| Empty line with only spaces | Removes indent (outdents) |
| Empty line | Normal new line |

**Amount Formatting on Enter**: When you press Enter on a posting line with an amount, the amount is automatically formatted according to the commodity directive (if defined) and aligned to the configured column.

### Smart Tab

Press **Tab** after an account name to position cursor at the optimal amount column:

```hledger
    Expenses:Food|             ; press Tab here
    Expenses:Food              |$XX.XX  ; cursor moves to amount position
```

The amount column is calculated based on:
- Configured minimum column (`hledger.formatting.amountAlignmentColumn`, default 40)
- Maximum account name length in the transaction block
- Multi-currency alignment requirements
- Balance assertion space requirements

The configured value is the **minimum** position. If accounts are longer than the configured column allows, alignment shifts further right to maintain the required 2-space gap.

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

When you have `commodity` directives in your journal, amounts are automatically formatted according to their format specification.

**Automatic Formatting Triggers**:
- **On Enter Key**: When you press Enter after typing a posting line, the amount is formatted and aligned
- **On Cursor Leave**: When you move the cursor away from a posting line (e.g., after filling in a template), the amount is formatted and aligned

**Format Amounts Command**: Use `HLedger: Format Amounts by Commodity` from Command Palette to reformat all amounts in the document.

```hledger
; Commodity directives define the format
commodity RUB 1 000,00  ; space as group separator, comma as decimal
commodity $1,000.00     ; comma as group separator, period as decimal

; Default commodity for postings without explicit currency
D RUB 1 000,00

2025-01-15 Supermarket
    ; Type "1000 RUB" and press Enter → "1 000,00 RUB" (aligned to column 40)
    Expenses:Food                          1 000,00 RUB
    ; Type "1000" (no commodity) and press Enter → "1 000,00" (uses D directive format)
    Assets:Cash                           -1 000,00
```

**Behavior**:
- With explicit commodity: formats number and keeps symbol (e.g., `1000 RUB` → `1 000,00 RUB`)
- Without commodity: uses `D` directive format, formats only the number (e.g., `1000` → `1 000,00`)
- No format defined: amount is not modified
- Amounts are aligned to `hledger.formatting.amountAlignmentColumn` (default: 40)

### Manual Formatting

- **Format Document**: `Ctrl+Shift+I` (or `Cmd+Shift+I` on macOS)
- **Format Selection**: Select text, then use same command

---

## Syntax Highlighting

### Dual-Layer System

The extension uses two highlighting systems:

1. **TextMate Grammar** - Always active, fast, handles most syntax
2. **Semantic Tokens** - Optional, more precise, 14 token types

### Enable Semantic Highlighting

```json
{
  "hledger.semanticHighlighting.enabled": true
}
```

### Semantic Token Types

| Token | Description |
|-------|-------------|
| `account` | Account names |
| `accountVirtual` | Virtual accounts in `()` or `[]` |
| `amount` | Numeric amounts |
| `comment` | Comment text |
| `date` | Transaction dates |
| `time` | Time values |
| `commodity` | Currency/commodity codes |
| `payee` | Payee names |
| `note` | Metadata notes |
| `tag` | Tag names and values |
| `directive` | Directives (include, account, etc.) |
| `operator` | Operators (`=`, `:=`, `@`, `@@`) |
| `code` | Transaction codes |
| `link` | Inter-transaction links |

### Color Customization

Customize colors for any theme:

```json
{
  "editor.semanticTokenColorCustomizations": {
    "rules": {
      "account:hledger": "#0EA5E9",
      "amount:hledger": "#F59E0B",
      "payee:hledger": "#EF4444",
      "tag:hledger": "#EC4899",
      "commodity:hledger": "#A855F7",
      "date:hledger": "#2563EB",
      "comment:hledger": "#9CA3AF"
    }
  }
}
```

### Theme-Specific Colors

The extension provides default colors for:
- **Default Dark+**: Optimized for dark themes
- **Default Light+**: Optimized for light themes

These are applied automatically based on your active theme.

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
| 3 | Category mapping | 80% | Configured category-to-account mapping |
| 4 | Merchant patterns | 70% | Regex patterns for merchants |
| 5 | Amount sign | 50% | Positive=income, negative=expense |
| 6 | Default accounts | - | Configured defaults |

### Merchant Patterns Configuration

Define regex patterns to match merchants:

```json
{
  "hledger.import.merchantPatterns": {
    "AMAZON|AMZN": "expenses:shopping",
    "UBER|LYFT": "expenses:transport",
    "NETFLIX|SPOTIFY": "expenses:subscriptions"
  }
}
```

### Category Mapping Configuration

Map CSV category values to hledger accounts:

```json
{
  "hledger.import.categoryMapping": {
    "Groceries": "expenses:food:groceries",
    "Restaurants": "expenses:food:dining",
    "Transportation": "expenses:transport"
  }
}
```

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
| `hledger.import.merchantPatterns` | Regex patterns for merchants | `{}` |
| `hledger.import.categoryMapping` | Category to account mapping | `{}` |

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

### Smart Editing Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `hledger.smartIndent.enabled` | boolean | `true` | Enable smart Enter key indentation |

### CLI Integration Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `hledger.cli.path` | string | `""` | Path to hledger (auto-detected if empty) |
| `hledger.cli.journalFile` | string | `""` | Main journal file path |

### Diagnostics Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `hledger.diagnostics.enabled` | boolean | `true` | Enable validation diagnostics |

### Formatting Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `hledger.formatting.amountAlignmentColumn` | number | `40` | Minimum column for amount alignment (20-120) |

**Note:** The `amountAlignmentColumn` setting specifies the minimum column position. Amounts are aligned at least at this column, but may shift further right when account names are long enough to require additional space.

### Syntax Highlighting Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `hledger.semanticHighlighting.enabled` | boolean | `false` | Enable semantic token highlighting |

### Import Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `hledger.import.dateFormat` | enum | `auto` | Expected date format in imports |
| `hledger.import.defaultDebitAccount` | string | `expenses:unknown` | Default expense account |
| `hledger.import.defaultCreditAccount` | string | `income:unknown` | Default income account |
| `hledger.import.defaultBalancingAccount` | string | `TODO:account` | Default balancing account |
| `hledger.import.invertAmounts` | boolean | `false` | Invert amount signs |
| `hledger.import.useJournalHistory` | boolean | `true` | Use journal history for account matching |
| `hledger.import.merchantPatterns` | object | `{}` | Regex patterns for merchant detection |
| `hledger.import.categoryMapping` | object | `{}` | Category to account mapping |

---

## Commands Reference

All commands accessible via Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`):

| Command | Title | Description |
|---------|-------|-------------|
| `hledger.onEnter` | HLedger: Smart Enter | Smart indentation on Enter key |
| `hledger.onTab` | HLedger: Smart Tab for Amount Alignment | Position cursor at amount column |
| `hledger.cli.balance` | HLedger: Insert Balance Report | Insert balance sheet as comment |
| `hledger.cli.stats` | HLedger: Insert Statistics Report | Insert file statistics as comment |
| `hledger.cli.incomestatement` | HLedger: Insert Income Statement | Insert income statement as comment |
| `hledger.import.fromSelection` | HLedger: Import Selected Tabular Data | Import selected CSV/TSV |
| `hledger.import.fromFile` | HLedger: Import Tabular Data from File | Import active file as CSV/TSV |
| `hledger.formatAmounts` | HLedger: Format Amounts by Commodity | Format all amounts using commodity directives |

---

## Keyboard Shortcuts

### Default Keybindings

| Key | Action | Condition |
|-----|--------|-----------|
| `Enter` | Accept completion | When completion widget is visible |
| `Enter` | Accept inline suggestion | When ghost text is visible |
| `Enter` | Smart indentation | When smart indent enabled, no widget visible |
| `Tab` | Amount alignment | When no completion widget visible |
| `Ctrl+Space` | Manual completion trigger | Always |

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
- Maximum nesting depth: 10 levels

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
  "hledger.semanticHighlighting.enabled": false,
  "hledger.diagnostics.enabled": false,
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
