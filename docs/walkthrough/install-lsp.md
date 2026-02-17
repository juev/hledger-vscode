# Language Server

The **hledger Language Server** is automatically installed when you first open a journal file. No manual setup required.

The button below is for manual reinstallation or updating to a newer version.

## What the Language Server provides

| Feature | Description |
|---------|-------------|
| **Completion** | Context-aware suggestions for accounts, payees, dates, commodities, tags |
| **Diagnostics** | Real-time validation of transactions, balances, and syntax |
| **Formatting** | Automatic amount alignment and posting indentation |
| **Semantic Highlighting** | Rich, context-aware syntax coloring (16 token types) |
| **Navigation** | Go to Definition, Find References, Workspace Symbols |
| **Hover** | Documentation and information on hover |
| **Code Actions** | Quick fixes for common issues |
| **Folding** | Transaction and directive folding ranges |
| **Document Links** | Clickable `include` directives |

## What works without Language Server

- Basic syntax highlighting (TextMate grammar)
- CLI integration (balance, stats, income statement)
- CSV/TSV import

## Status Bar indicator

The status bar (bottom-right) shows the Language Server state:

| Icon | State |
|------|-------|
| `$(server)` | Running |
| `$(sync~spin)` | Starting / Downloading |
| `$(warning)` | Error (click to restart) |
| `$(cloud-download)` | Not installed |

Click the status bar item to restart the Language Server.

---

For full details see the [User Guide](../user-guide.md).
