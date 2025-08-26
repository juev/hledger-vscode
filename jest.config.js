module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      // Use test-specific TypeScript configuration
      tsconfig: 'tsconfig.test.json'
    }],
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
  ],
  moduleNameMapper: {
    '^vscode$': '<rootDir>/src/__mocks__/vscode'
  },
  testTimeout: 10000,
  // Ensure Jest can find type definitions
  setupFilesAfterEnv: [],
  // Clear mocks between tests for consistency
  clearMocks: true,
  // Restore mocks after each test
  restoreMocks: true
};