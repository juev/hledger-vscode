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
      // The margin is small on purpose. Coverage used to swing between runs and
      // between machines, so the first version of these numbers had to absorb
      // almost a point of noise. It no longer does: the suite reports
      // 81.91 / 76.70 / 81.30 / 82.18 on every run, with or without hledger
      // installed. A drop now means coverage actually fell.
      thresholds: {
        statements: 81.5,
        branches: 76.5,
        functions: 81,
        lines: 82,
      },
    },
  },
});
