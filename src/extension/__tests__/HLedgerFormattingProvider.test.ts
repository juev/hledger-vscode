// HLedgerFormattingProvider.test.ts - Test VS Code formatting provider
// Tests the integration with VS Code's standard formatting API

import { HLedgerFormattingProvider } from '../HLedgerFormattingProvider';

// Mock vscode module
jest.mock('vscode', () => ({
    languages: {
        registerDocumentFormattingEditProvider: jest.fn(),
        registerDocumentRangeFormattingEditProvider: jest.fn(),
    },
    workspace: {
        getConfiguration: jest.fn(),
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
    let mockGetConfiguration: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();

        // Setup mock workspace configuration
        mockGetConfiguration = jest.fn().mockReturnValue({
            get: jest.fn().mockReturnValue(true), // formatting.enabled = true by default
        });

        // Mock vscode workspace
        const vscode = require('vscode');
        vscode.workspace.getConfiguration = mockGetConfiguration;

        provider = new HLedgerFormattingProvider();
    });

    describe('provider functionality', () => {
        it('should create provider instance successfully', () => {
            expect(provider).toBeDefined();
        });

        it('should have provideDocumentFormattingEdits method', () => {
            expect(typeof provider.provideDocumentFormattingEdits).toBe('function');
        });

        it('should check configuration before formatting', async () => {
            const mockDocument = {
                getText: jest.fn().mockReturnValue('2024-01-01 * Test'),
                positionAt: jest.fn().mockReturnValue({}),
            };
            const mockOptions = { insertSpaces: true, tabSize: 4 };
            const mockToken = { isCancellationRequested: false };

            await provider.provideDocumentFormattingEdits(
                mockDocument as any,
                mockOptions,
                mockToken as any
            );

            expect(mockGetConfiguration).toHaveBeenCalledWith('hledger');
        });

        it('should return empty edits when formatting is disabled', async () => {
            // Mock disabled configuration
            mockGetConfiguration.mockReturnValue({
                get: jest.fn().mockReturnValue(false), // formatting.enabled = false
            });

            const mockDocument = {
                getText: jest.fn().mockReturnValue('2024-01-01 * Test'),
                positionAt: jest.fn().mockReturnValue({}),
            };
            const mockOptions = { insertSpaces: true, tabSize: 4 };
            const mockToken = { isCancellationRequested: false };

            const edits = await provider.provideDocumentFormattingEdits(
                mockDocument as any,
                mockOptions,
                mockToken as any
            );

            expect(edits).toEqual([]);
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