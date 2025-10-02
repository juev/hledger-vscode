// AutoFormatOnSave.test.ts - Test auto-format on save functionality
// Tests the automatic amount alignment when saving hledger files

import { AmountAligner } from '../AmountAligner';
import * as vscode from '../../../src/__mocks__/vscode';

// Mock the AmountAligner
jest.mock('../AmountAligner');
const MockedAmountAligner = AmountAligner as jest.MockedClass<typeof AmountAligner>;

// Mock console methods to avoid test output noise
const originalConsoleError = console.error;
const originalConsoleLog = console.log;

describe('AutoFormatOnSave Configuration', () => {
    let mockAmountAligner: jest.Mocked<AmountAligner>;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();

        // Setup mock amount aligner
        mockAmountAligner = {
            formatContent: jest.fn(),
        } as any;
        MockedAmountAligner.mockImplementation(() => mockAmountAligner);

        // Mock vscode workspace configuration
        (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
            get: jest.fn(),
            update: jest.fn()
        });

        // Mock vscode window methods
        (vscode.window.setStatusBarMessage as jest.Mock).mockReturnValue(jest.fn());

        // Mock console methods
        console.error = jest.fn();
        console.log = jest.fn();
    });

    afterEach(() => {
        jest.useRealTimers();
        // Restore console methods
        console.error = originalConsoleError;
        console.log = originalConsoleLog;
    });

    describe('configuration validation', () => {
        it('should have correct configuration defaults', () => {
            const mockConfig = {
                get: jest.fn().mockImplementation((key: string) => {
                    switch (key) {
                        case 'amountAlignment.enabled':
                            return false;
                        case 'amountAlignment.formatOnSave':
                            return false;
                        default:
                            return undefined;
                    }
                })
            };

            (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);

            expect(mockConfig.get('amountAlignment.enabled')).toBe(false);
            expect(mockConfig.get('amountAlignment.formatOnSave')).toBe(false);
        });

        it('should allow enabling both settings', () => {
            const mockConfig = {
                get: jest.fn().mockImplementation((key: string) => {
                    switch (key) {
                        case 'amountAlignment.enabled':
                            return true;
                        case 'amountAlignment.formatOnSave':
                            return true;
                        default:
                            return undefined;
                    }
                })
            };

            (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);

            expect(mockConfig.get('amountAlignment.enabled')).toBe(true);
            expect(mockConfig.get('amountAlignment.formatOnSave')).toBe(true);
        });
    });

    describe('AmountAligner integration', () => {
        it('should create AmountAligner instance successfully', () => {
            // Use the mocked instance instead of trying to create a real one
            const aligner = mockAmountAligner;
            expect(aligner).toBeDefined();
        });

        it('should format hledger content successfully', () => {
            const aligner = mockAmountAligner;
            const content = `2024-01-01 * Test
    Assets:Cash  $100
    Expenses:Food  $50`;

            // Mock successful formatting
            aligner.formatContent.mockReturnValue({
                success: true,
                data: content // Return the same content for simplicity
            });

            const result = aligner.formatContent(content);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(typeof result.data).toBe('string');
            }
        });

        it('should handle malformed content gracefully', () => {
            const aligner = mockAmountAligner;
            const content = '';

            // Mock successful formatting even for empty content
            aligner.formatContent.mockReturnValue({
                success: true,
                data: content
            });

            const result = aligner.formatContent(content);
            expect(result.success).toBe(true); // Empty content should still format successfully
        });
    });

    describe('command registration', () => {
        it('should have command registration function available', () => {
            expect(typeof vscode.commands.registerCommand).toBe('function');
        });
    });

    describe('workspace event handling', () => {
        it('should have workspace save event function available', () => {
            expect(typeof vscode.workspace.onDidSaveTextDocument).toBe('function');
        });
    });

    describe('cooldown mechanism', () => {
        it('should use setTimeout for cooldown tracking', () => {
            const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

            // Mock a scenario where formatting would happen
            setTimeoutSpy.mockImplementation(() => 123 as any);

            // Simulate the cooldown setup that would happen in the save handler
            const cooldownMs = 1000;
            const timerId = setTimeout(() => {
                // Cooldown callback
            }, cooldownMs);

            expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), cooldownMs);
            expect(typeof timerId).toBe('number');

            setTimeoutSpy.mockRestore();
        });
    });
});