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
      // A ratchet, not a target: these sit just under the lowest figure the
      // suite currently produces, so coverage cannot slide without someone
      // noticing. Raise them when real coverage rises.
      //
      // The headroom is not decorative. Coverage is not deterministic here:
      // HLedgerCliService swings between 32% and 39% depending on whether its
      // fire-and-forget constructor init finishes inside the 100 ms sleep the
      // timeout test waits on, which moves the total by up to 0.9 points. The
      // observed floor is 81.77 / 76.62 / 81.01 / 82.03.
      thresholds: {
        statements: 81,
        branches: 76,
        functions: 80,
        lines: 81,
      },
    },
  },
});
