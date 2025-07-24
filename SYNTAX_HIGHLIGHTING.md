# Syntax Highlighting Improvements

This document describes improvements in syntax highlighting for hledger files.

## Enhanced Syntax Categories

### 1. Commodities and Currencies

- **Scope**: `entity.name.type.commodity`
- **Usage**: Highlighting currencies (USD, RUB, EUR) and commodities in amounts
- **Examples**: `100 USD`, `1000.00 RUB`, `AAPL`
- **Color**: Can be customized to maroon (#800000) for better visibility

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

- **Hashtags**: `entity.name.tag` (e.g.: `#food`)
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

The syntax highlighting uses standard TextMate scopes that are supported by most VS Code themes:

- `entity.name.type.commodity` - currencies and commodities (can be customized to maroon color)
- `support.class.*` - account types will use class colors  
- `entity.name.function` - payees and accounts use function color
- `entity.name.tag` - hashtags use tag color
- `variable.other` - tag keys use variable color
- `constant.numeric` - dates and numbers use numeric color
- `keyword.operator` - operators use keyword color
- `string.unquoted` - notes and tag values use string color

No additional theme configuration is needed - existing themes will automatically provide appropriate colors for these standard scopes.

### Customizing Currency Colors

To make currencies more visible with maroon color, add this to your VS Code `settings.json`:

```json
{
  "editor.tokenColorCustomizations": {
    "textMateRules": [
      {
        "scope": "entity.name.type.commodity",
        "settings": {
          "foreground": "#800000",
          "fontStyle": "bold"
        }
      }
    ]
  }
}
```

This will display all currencies (USD, RUB, EUR, BTC, etc.) in maroon color (#800000) with bold formatting for better visibility.
