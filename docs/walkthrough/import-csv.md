# Import from CSV

## Commands

| Command | Description |
|---------|-------------|
| **HLedger: Import Selected Tabular Data** | Import selected text as CSV/TSV |
| **HLedger: Import Tabular Data from File** | Import the active file |

## Supported delimiters

The extension auto-detects the delimiter:
- Tab (TSV)
- Comma (CSV)
- Semicolon
- Pipe (`|`)

## Column detection

Columns are recognized by header names:

| Column | Recognized headers |
|--------|-------------------|
| Date | Date, Дата |
| Payee | Description, Payee, Merchant, Описание |
| Amount | Amount, Sum, Сумма |
| Debit / Credit | Debit, Credit, Expense, Income |
| Category | Category, Категория |

## Account resolution

The importer tries to match payees to accounts automatically:

1. **Journal history** — exact or fuzzy payee match from existing transactions
2. **Category mapping** — from the Category column in CSV
3. **Merchant patterns** — regex patterns for common merchants
4. **Amount sign** — positive = income, negative = expense
5. **Default accounts** — configured in settings

## Settings

| Setting | Default |
|---------|---------|
| `hledger.import.dateFormat` | `auto` |
| `hledger.import.defaultDebitAccount` | `expenses:unknown` |
| `hledger.import.defaultCreditAccount` | `income:unknown` |
| `hledger.import.defaultBalancingAccount` | `TODO:account` |
| `hledger.import.invertAmounts` | `false` |
| `hledger.import.useJournalHistory` | `true` |

---

For full details see the [User Guide](../user-guide.md).
