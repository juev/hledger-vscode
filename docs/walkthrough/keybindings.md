# Keyboard Shortcuts

The extension provides keybindings for common editing tasks in hledger files.

## Status keybindings

Set or cycle the transaction/posting status marker (`*`, `!`, or none):

| Key (macOS) | Key (Win/Linux) | Action |
|-------------|-----------------|--------|
| `Cmd+K S` | `Ctrl+K S` | Cycle status (unmarked → pending → cleared) |
| `Cmd+K 0` | `Ctrl+K 0` | Set status to unmarked |
| `Cmd+K 1` | `Ctrl+K 1` | Set status to pending (`!`) |
| `Cmd+K 2` | `Ctrl+K 2` | Set status to cleared (`*`) |

Example:

```hledger
2025-01-15 * Grocery Store        ; ← cleared
    Expenses:Food:Groceries  $45.50
    Assets:Bank:Checking    -$45.50
```

## Tab: align amount

Press **Tab** after typing an account name to move the cursor to the amount column. Amounts are aligned automatically on save when `editor.formatOnType` is enabled.

| Setting | Default | Description |
|---------|---------|-------------|
| `hledger.keybindings.alignAmount` | `true` | Enable Tab to align amount |
| `hledger.formatting.alignAmounts` | `true` | Auto-align amounts on format |

## Enter: inline suggestion

Press **Enter** after a payee name to accept the ghost text suggestion and insert a full transaction template.

| Setting | Default | Description |
|---------|---------|-------------|
| `hledger.keybindings.enterAndSuggest` | `true` | Enable Enter to accept inline suggestion |

## Status bar hints

When editing an hledger file, the status bar shows a quick reference:

```
⌘K S: status · Tab: align · Enter: suggest
```

---

For full details see the [User Guide](../user-guide.md).
