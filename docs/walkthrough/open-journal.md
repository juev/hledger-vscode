# Open a Journal File

## Supported file extensions

The extension activates for files with these extensions:
- `.journal`
- `.hledger`
- `.ledger`

## Basic workflow

1. Create or open a journal file (e.g. `2025.journal`)
2. Start typing a date — completion suggestions appear
3. Type a payee name — history-based suggestions
4. Press **Enter** — cursor indents for a posting line
5. Type an account name — account completion with hierarchy
6. Press **Tab** — cursor moves to the amount column
7. Save — amounts are automatically aligned

## Example transaction

```hledger
2025-01-15 * Grocery Store
    Expenses:Food:Groceries        $45.50
    Assets:Bank:Checking          -$45.50
```

## Enter and Tab behavior

With `editor.formatOnType` enabled (default for hledger files) and Language Server running:

| Key | Context | Result |
|-----|---------|--------|
| **Enter** | After date line | Adds posting indent |
| **Enter** | After posting | Preserves indent for next posting |
| **Enter** | Empty indented line | Removes indent |
| **Tab** | After account name | Positions cursor at amount column |

## Inline ghost text

After typing 2+ characters of a payee name, a ghost text suggestion appears. Press **Enter** to accept the full transaction template.

---

For full details see the [User Guide](../user-guide.md).
