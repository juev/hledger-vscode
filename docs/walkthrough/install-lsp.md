# Language Server

You will be **prompted to install** the **hledger Language Server** when you first open a journal file. Click "Install" to proceed.

Use the "Install/Update Language Server" button in the walkthrough panel to manually reinstall or update.

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

| Indicator | State |
|-----------|-------|
| Server icon | Running |
| Spinning icon | Starting / Downloading |
| Warning icon | Error (click to restart) |
| Download icon | Not installed |

Click the status bar item to restart the Language Server.

---

For full details see the [User Guide](../user-guide.md).
