# Syntax Highlighting Improvements

This document describes improvements in syntax highlighting for hledger files.

## Enhanced Syntax Categories

### 1. Commodities and Currencies

- **Scope**: `entity.name.type.commodity`
- **Usage**: Highlighting currencies (USD, RUB, EUR) and commodities in amounts
- **Examples**: `100 USD`, `1000.00 RUB`, `AAPL`
- **Highlighting**: Uses standard TextMate scope `entity.name.type.commodity`

### 2. Account Types

Different highlighting for different account types:

- **Assets**: `support.class.asset`
- **Liabilities**: `support.class.liability`
- **Equity**: `support.class.equity`
- **Income**: `support.class.income`
- **Expenses**: `support.class.expense`
- **General accounts**: `entity.name.function`

### 3. Dates

- **Transaction dates**: `constant.numeric`
- **Date values**: `constant.numeric`

### 4. Payee/Note Format

- **Payee**: `entity.name.function`
- **Note**: `string.unquoted`
- **Example**: `Store Name|Purchase details`

### 5. Tags and Categories in Comments

- **Tag keys**: `variable.other` (e.g.: `category:`)
- **Tag values**: `string.unquoted` (e.g.: `:groceries`)

### 6. Transaction Status and Codes

- **Status**: `keyword.operator` (symbols `*` and `!`)
- **Transaction codes**: `entity.name.tag` (e.g.: `(REF123)`)

### 7. Cost/Price Notation

- **Unit cost**: `keyword.operator` for `@`
- **Total cost**: `keyword.operator` for `@@`

### 8. Balance Assertions

- **Operators**: `keyword.operator` for `=` and `==`
- **Amounts in assertions**: inherit styles from amounts

## Supported Languages

The scheme supports multiple languages:

- **English**: Assets, Liabilities, Equity, Income, Expenses
- **Russian**: Активы, Пассивы, Собственные, Доходы, Расходы
- **Unicode**: Full Cyrillic support in tags and comments

## Usage Examples

```hledger
; Directives with commodity highlighting
commodity USD
D 1000.00 RUB

; Transaction with payee|note format and tags
2025-01-15 * Store Name|Purchase details ; category:food, #groceries
    Assets:Cash         -100.50 USD @ 95.50 RUB
    Expenses:Food        9599.25 RUB = 10000.00 RUB ; date:2025-01-16

; Different account types
account Assets:Bank         ; assets
account Expenses:Food       ; expenses  
account Income:Salary       ; income
```

## VS Code Integration

The syntax highlighting uses custom hledger-specific scopes that provide consistent and readable colors across all VS Code themes:

- `hledger.date` - dates in transactions (blue)
- `hledger.account` - account names (green)
- `hledger.amount` - numeric amounts (red)
- `hledger.commodity` - currency and commodity symbols (purple)
- `hledger.payee` - payee/description (orange)
- `hledger.comment` - comments (gray)
- `hledger.tag` - tags in comments (pink)
- `hledger.directive` - hledger directives (green)
- `hledger.account.defined` - explicitly defined accounts (cyan)
- `hledger.account.virtual` - virtual accounts (gray)

The extension provides a high-contrast color scheme that ensures excellent readability while maintaining clear visual hierarchy between different syntax elements.
