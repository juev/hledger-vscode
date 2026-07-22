# Generate Reports

Run hledger commands directly from VS Code and insert results as comments in your journal.

## Available commands

Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and search for "HLedger":

| Command | Description | hledger command |
|---------|-------------|-----------------|
| **HLedger: Insert Balance Sheet** | Assets and liabilities overview | `hledger bs` |
| **HLedger: Insert Income Statement** | Revenue and expense summary | `hledger incomestatement` |
| **HLedger: Insert Statistics Report** | File statistics and metrics | `hledger stats` |

## Example output

Reports are inserted as comments at the cursor position:

```hledger
; hledger bs - 2025-01-15
; ==================================================
; Balance Sheet 2025-01-15
;              ||  2025-01-15
; =============++=============
;  Assets      ||
; -------------++-------------
;  Assets:Bank || 2450.00 USD
; ==================================================
```

## Journal file resolution

The extension determines which journal file to use:

1. **`LEDGER_FILE` environment variable** — if set and valid
2. **`hledger.cli.journalFile` setting** — if configured
3. **Current open file** — as fallback

## Prerequisites

- hledger must be installed and in your PATH
- Or set an explicit path via `hledger.cli.path`

## Settings

| Setting | Description | Default |
|---------|-------------|---------|
| `hledger.cli.enabled` | Enable CLI integration | `true` |
| `hledger.cli.path` | Path to hledger executable | Auto-detected |
| `hledger.cli.journalFile` | Main journal file path | Uses env or current file |
| `hledger.cli.timeout` | Command timeout (ms) | `30000` |

---

For full details see the [User Guide](../user-guide.md).
