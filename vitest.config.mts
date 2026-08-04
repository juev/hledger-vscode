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
    },
  },
});
