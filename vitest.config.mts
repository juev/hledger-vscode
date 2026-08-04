import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const mock = (relativePath: string): string =>
  fileURLToPath(new URL(relativePath, import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 10000,
    clearMocks: true,
    restoreMocks: true,
    alias: {
      vscode: mock('./src/__mocks__/vscode.ts'),
      'vscode-languageclient/node': mock('./src/__mocks__/vscode-languageclient/node.ts'),
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/**/__tests__/**', 'src/__mocks__/**'],
      // A ratchet, not a target: these sit just under what the suite currently
      // produces, so coverage cannot slide without someone noticing. Raise them
      // when real coverage rises.
      //
      // Statements, functions and lines are now reproducible to the digit --
      // 81.91 / 81.30 / 82.18 on every run, with or without hledger installed
      // and on both macOS and the Linux runner -- so their margin is thin on
      // purpose. A drop there means coverage actually fell.
      //
      // Branches still move with the platform: HLedgerImportCommands reports
      // 44% locally and 42.66% on CI, because a filesystem error path is taken
      // differently, which shifts the total between 76.62 and 76.70. That one
      // keeps a wider margin until the branch itself is pinned down.
      thresholds: {
        statements: 81.5,
        branches: 76,
        functions: 81,
        lines: 82,
      },
    },
  },
});
