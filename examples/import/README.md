# Import Examples

Sample CSV/TSV files for testing the hledger import feature.

## Files

- `bank-statement.csv` - US format bank export (comma delimiter, YYYY-MM-DD dates, period decimals)
- `credit-card-eu.csv` - EU format (semicolon delimiter, DD.MM.YYYY dates, comma decimals)

## Usage

1. Open a CSV file or select CSV text in any editor
2. Run command: `HLedger: Import Tabular Data from File` or `HLedger: Import Selected Tabular Data`
3. Review generated hledger transactions

## Configuration

See `hledger.import.*` settings in VS Code for customization options:

- `hledger.import.defaultDebitAccount` - Default expense account (default: `expenses:unknown`)
- `hledger.import.defaultCreditAccount` - Default income account (default: `income:unknown`)
- `hledger.import.defaultBalancingAccount` - Balancing account (default: `TODO:account`)
- `hledger.import.dateFormat` - Expected date format (`auto`, `YYYY-MM-DD`, `DD.MM.YYYY`, etc.)
- `hledger.import.invertAmounts` - Invert amount signs
- `hledger.import.merchantPatterns` - Custom regex patterns for merchant detection
- `hledger.import.categoryMapping` - Map CSV categories to hledger accounts
