import js from '@eslint/js';
import ts from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

const sharedRules = {
  'no-undef': 'off',
  'no-unused-vars': 'off',
  // The vscode mock merges an interface and a value under one name (Uri,
  // Disposable). The base rule does not model TypeScript declaration merging
  // and reports those as redeclarations; the TS-aware rule does.
  'no-redeclare': 'off',
  '@typescript-eslint/no-redeclare': 'error',
  '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
  '@typescript-eslint/prefer-nullish-coalescing': 'warn',
  '@typescript-eslint/prefer-optional-chain': 'warn',
  '@typescript-eslint/no-floating-promises': 'error',
  '@typescript-eslint/await-thenable': 'error',
  'no-useless-escape': 'warn',
};

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.ts'],
    ignores: ['src/**/*.test.ts', 'src/__mocks__/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        project: './tsconfig.json',
      },
      globals: {
        console: 'readonly',
        process: 'readonly',
        setTimeout: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': ts,
    },
    rules: {
      ...sharedRules,
      '@typescript-eslint/explicit-function-return-type': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    // Tests and the hand-written vscode mock. Same rules as source, except the
    // two that fight the job these files do: they cast deliberately to stand in
    // for the VS Code API, and inline callbacks read better without an explicit
    // return type. no-floating-promises and await-thenable stay on — those catch
    // the un-awaited assertion that silently passes.
    files: ['src/**/*.test.ts', 'src/__mocks__/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: './tsconfig.test.json',
      },
      globals: {
        console: 'readonly',
        process: 'readonly',
        setTimeout: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': ts,
    },
    rules: {
      ...sharedRules,
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    // The mock defaults with `||` in about forty places, imitating how the real
    // API fills in optional arguments. Switching them to `??` is not a
    // refactor-in-place: it changes what happens for 0 and "". SnippetString
    // is the clearest case — `placeholder(0)` currently renders as tabstop 1,
    // and `??` would silently change that. Whether the mock should behave that
    // way is a real question, but it is a behaviour question, not a lint one.
    files: ['src/__mocks__/**/*.ts'],
    rules: {
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
    },
  },
  {
    ignores: ['out/**/*', '*.js', 'node_modules/**/*'],
  },
];
