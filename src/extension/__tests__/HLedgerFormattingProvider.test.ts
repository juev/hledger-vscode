// HLedgerFormattingProvider.test.ts - Test VS Code formatting provider
// Tests the integration with VS Code's standard formatting API

import { HLedgerFormattingProvider } from '../HLedgerFormattingProvider';

// Mock vscode module
jest.mock('vscode', () => ({
  languages: {
    registerDocumentFormattingEditProvider: jest.fn(),
    registerDocumentRangeFormattingEditProvider: jest.fn(),
  },
  Range: jest.fn(),
  Position: jest.fn(),
  TextEdit: {
    replace: jest.fn(),
  },
  CancellationTokenSource: jest.fn().mockImplementation(() => ({
    token: { isCancellationRequested: false },
    cancel: jest.fn(),
  })),
}));

describe('HLedgerFormattingProvider', () => {
  let provider: HLedgerFormattingProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new HLedgerFormattingProvider();
  });

  describe('provider functionality', () => {
    it('should create provider instance successfully', () => {
      expect(provider).toBeDefined();
    });

    it('should have provideDocumentFormattingEdits method', () => {
      expect(typeof provider.provideDocumentFormattingEdits).toBe('function');
    });

    it('should attempt formatting for any hledger document', async () => {
      const mockDocument = {
        getText: jest.fn().mockReturnValue('2024-01-01 * Test'),
        positionAt: jest.fn().mockReturnValue({}),
      };
      const mockOptions = { insertSpaces: true, tabSize: 4 };
      const mockToken = { isCancellationRequested: false };

      // The provider should attempt formatting (controlled by VS Code's global settings)
      await provider.provideDocumentFormattingEdits(
        mockDocument as any,
        mockOptions,
        mockToken as any
      );

      expect(mockDocument.getText).toHaveBeenCalled();
    });

    it('should return empty edits when operation is cancelled', async () => {
      const mockDocument = {
        getText: jest.fn().mockReturnValue('2024-01-01 * Test'),
        positionAt: jest.fn().mockReturnValue({}),
      };
      const mockOptions = { insertSpaces: true, tabSize: 4 };
      const mockToken = { isCancellationRequested: true }; // Cancelled

      const edits = await provider.provideDocumentFormattingEdits(
        mockDocument as any,
        mockOptions,
        mockToken as any
      );

      expect(edits).toEqual([]);
    });
  });
});
