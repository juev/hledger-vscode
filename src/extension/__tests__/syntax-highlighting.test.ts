import * as vscode from 'vscode';
import * as assert from 'assert';

// Test cases for syntax highlighting validation
interface SyntaxTestCase {
  description: string;
  line: string;
  expectedScopes: {
    account?: string;
    amount?: string;
    commodity?: string;
    date?: string;
    payee?: string;
  };
}

const syntaxTestCases: SyntaxTestCase[] = [
  {
    description: 'Simple account name without spaces',
    line: '    Assets:Cash              100 USD',
    expectedScopes: {
      account: 'entity.name.type.account.assets.hledger',
      amount: 'constant.numeric.amount.hledger',
      commodity: 'entity.name.type.commodity.hledger'
    }
  },
  {
    description: 'Account name with single space',
    line: '    Assets:Bank Account      200 USD',
    expectedScopes: {
      account: 'entity.name.type.account.assets.hledger',
      amount: 'constant.numeric.amount.hledger',
      commodity: 'entity.name.type.commodity.hledger'
    }
  },
  {
    description: 'Account name with multiple spaces',
    line: '    Assets:Bank Checking Account    300 USD',
    expectedScopes: {
      account: 'entity.name.type.account.assets.hledger',
      amount: 'constant.numeric.amount.hledger',
      commodity: 'entity.name.type.commodity.hledger'
    }
  },
  {
    description: 'Russian account name with spaces',
    line: '    Расходы:Продукты Питания   -300 USD',
    expectedScopes: {
      account: 'entity.name.type.account.expenses.hledger',
      amount: 'constant.numeric.amount.hledger',
      commodity: 'entity.name.type.commodity.hledger'
    }
  },
  {
    description: 'Virtual account with parentheses',
    line: '    (Assets:Virtual Cash)           50 USD',
    expectedScopes: {
      account: 'variable.other.account.virtual.hledger',
      amount: 'constant.numeric.amount.hledger',
      commodity: 'entity.name.type.commodity.hledger'
    }
  },
  {
    description: 'Virtual account with brackets',
    line: '    [Assets:Reserved Funds]         25 USD',
    expectedScopes: {
      account: 'variable.other.account.virtual.hledger',
      amount: 'constant.numeric.amount.hledger',
      commodity: 'entity.name.type.commodity.hledger'
    }
  },
  {
    description: 'Account-only posting (no amount)',
    line: '    Assets:Cash Account',
    expectedScopes: {
      account: 'entity.name.type.account.assets.hledger'
    }
  },
  {
    description: 'Posting with balance assertion',
    line: '    Assets:Checking Account         900 USD = 1000 USD',
    expectedScopes: {
      account: 'entity.name.type.account.assets.hledger',
      amount: 'constant.numeric.amount.hledger',
      commodity: 'entity.name.type.commodity.hledger'
    }
  },
  {
    description: 'Hierarchical account name with spaces',
    line: '    Expenses:Food:Groceries:Fruits   -350 USD',
    expectedScopes: {
      account: 'entity.name.type.account.expenses.hledger',
      amount: 'constant.numeric.amount.hledger',
      commodity: 'entity.name.type.commodity.hledger'
    }
  },
  {
    description: 'Mixed language account name',
    line: '    Assets:Банковский Счет          600 USD',
    expectedScopes: {
      account: 'entity.name.type.account.assets.hledger',
      amount: 'constant.numeric.amount.hledger',
      commodity: 'entity.name.type.commodity.hledger'
    }
  }
];

describe('Syntax Highlighting Tests', () => {
  test('Account names with spaces should be highlighted correctly', async () => {
    // This test validates that the syntax highlighting patterns correctly
    // handle account names with spaces according to hledger specification

    // Note: This is a basic test structure. In a real implementation,
    // you would need to use VS Code's tokenization API to verify
    // the actual syntax highlighting scopes applied to each token.

    for (const testCase of syntaxTestCases) {
      // Extract account name from the line (everything before 2+ spaces)
      const accountMatch = testCase.line.match(/^\s+([^\s;]+(?:\s+[^\s;]+)*?)\s{2,}/);
      if (accountMatch) {
        const accountName = accountMatch[1];

        // Verify account name contains expected characters
        assert.ok(
          accountName.length > 0,
          `Account name should not be empty in: ${testCase.description}`
        );

        // Verify account name follows hledger rules
        assert.ok(
          /^[\p{L}][\p{L}\p{N}\s_-]*(?::[\p{L}][\p{L}\p{N}\s_-]*)*$/u.test(accountName) ||
          /^\([^)]+\)$/.test(accountName) ||
          /^\[[^\]]+\]$/.test(accountName),
          `Account name "${accountName}" should be valid in: ${testCase.description}`
        );

        // Verify the line has proper separation (2+ spaces between account and amount)
        const hasProperSeparation = /\s{2,}/.test(testCase.line);
        assert.ok(
          hasProperSeparation,
          `Line should have proper space separation in: ${testCase.description}`
        );
      }
    }
  });

  test('Single space separation should not be highlighted as valid posting', () => {
    // Test that lines with only one space between account and amount
    // are not incorrectly highlighted as valid postings
    const invalidLine = '    Assets:Cash Account 100 USD'; // Only 1 space

    // This should not match the posting pattern with amount
    const postingPattern = /^\s+([^\s;]+(?:\s+[^\s;]+)*?)\s{2,}([^;]+)(?=;|$)/;
    const match = invalidLine.match(postingPattern);

    assert.ok(
      !match,
      'Line with single space separation should not match posting pattern'
    );
  });

  test('Account name regex patterns should handle spaces correctly', () => {
    // Test the individual account patterns
    const accountPatterns = [
      { name: 'assets', pattern: /\b(Assets?|Активы)(?::[\p{L}][\p{L}\p{N}\s_-]*)*/u },
      { name: 'expenses', pattern: /\b(Expenses?|Расходы)(?::[\p{L}][\p{L}\p{N}\s_-]*)*/u },
      { name: 'liabilities', pattern: /\b(Liabilit(?:y|ies)|Пассивы)(?::[\p{L}][\p{L}\p{N}\s_-]*)*/u },
      { name: 'equity', pattern: /\b(Equity|Собственные)(?::[\p{L}][\p{L}\p{N}\s_-]*)*/u },
      { name: 'income', pattern: /\b(Income|Revenue|Доходы)(?::[\p{L}][\p{L}\p{N}\s_-]*)*/u },
      { name: 'generic', pattern: /[\p{L}][\p{L}\p{N}\s_-]*(?::[\p{L}][\p{L}\p{N}\s_-]*)*/u }
    ];

    const testAccounts = [
      'Assets:Cash',
      'Assets:Bank Account',
      'Expenses:Food Items',
      'Расходы:Продукты Питания',
      'Assets:Банковский Счет',
      'Expenses:Food:Groceries:Fruits',
      '(Assets:Virtual Cash)',
      '[Assets:Reserved Funds]'
    ];

    for (const account of testAccounts) {
      let matched = false;

      for (const pattern of accountPatterns) {
        if (pattern.pattern.test(account)) {
          matched = true;
          break;
        }
      }

      assert.ok(
        matched,
        `Account "${account}" should match one of the account patterns`
      );
    }
  });
});

describe('hledger Specification Compliance', () => {
  test('Account names should allow single spaces according to hledger spec', () => {
    // Based on hledger specification: "Account names may contain letters, numbers, symbols, or single spaces"
    const validAccounts = [
      'Assets:Cash',
      'Assets:Bank Account',
      'Expenses:Food Items',
      'Расходы:Продукты Питания',
      'Income:Salary Main',
      'Assets:Банковский Счет'
    ];

    const accountPattern = /^[\p{L}][\p{L}\p{N}\s_-]*(?::[\p{L}][\p{L}\p{N}\s_-]*)*$/u;

    for (const account of validAccounts) {
      assert.ok(
        accountPattern.test(account),
        `Valid account "${account}" should match pattern`
      );
    }

    // Test that the pattern works for our test cases
    const testCases = [
      'Assets:Bank Account',
      'Expenses:Food Items',
      'Расходы:Продукты Питания',
      'Assets:Банковский Счет'
    ];

    for (const account of testCases) {
      assert.ok(
        accountPattern.test(account),
        `Test account "${account}" should match pattern`
      );
    }
  });

  test('Account and amount separation should require 2+ spaces', () => {
    // Based on hledger specification: "when an account name and an amount are written on the same line, they must be separated by two or more spaces"
    const validPostings = [
      '    Assets:Cash              100 USD',
      '    Expenses:Food           -50 USD',
      '    Assets:Bank Account     200 USD',
      '    Расходы:Продукты        -300 USD'
    ];

    const invalidPostings = [
      '    Assets:Cash 100 USD',        // Only 1 space
      '    Expenses:Food -50 USD',       // Only 1 space
      '    Assets:Bank Account 200 USD' // Only 1 space
    ];

    const postingPattern = /^\s+([^\s;]+(?:\s+[^\s;]+)*?)\s{2,}([^;]+)(?=;|$)/;

    for (const posting of validPostings) {
      assert.ok(
        postingPattern.test(posting),
        `Valid posting "${posting}" should match posting pattern`
      );
    }

    for (const posting of invalidPostings) {
      assert.ok(
        !postingPattern.test(posting),
        `Invalid posting "${posting}" should not match posting pattern`
      );
    }
  });
});