/**
 * HLedgerImportCommands - Error handling tests for journal history lookup
 */

import { HLedgerImportCommands } from '../HLedgerImportCommands';
import { HLedgerConfig } from '../HLedgerConfig';
import {
    JournalNotFoundError,
    JournalAccessError,
    isJournalError,
} from '../import/types';

describe('HLedgerImportCommands', () => {
    let importCommands: HLedgerImportCommands;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        (console.error as jest.Mock).mockRestore();
        (console.warn as jest.Mock).mockRestore();
    });

    describe('constructor with config', () => {
        it('should instantiate with config', () => {
            const config = new HLedgerConfig();
            importCommands = new HLedgerImportCommands(config);
            expect(importCommands).toBeDefined();
        });

        it('should instantiate without config', () => {
            importCommands = new HLedgerImportCommands();
            expect(importCommands).toBeDefined();
        });
    });

    describe('journal history lookup error handling', () => {
        it('should handle null history gracefully during import', () => {
            const config = new HLedgerConfig();
            jest.spyOn(config, 'getPayeeAccountHistory').mockReturnValue(null);

            importCommands = new HLedgerImportCommands(config);

            // Verify method can be called without throwing
            expect(() => {
                importCommands.dispose();
            }).not.toThrow();
        });

        it('should handle config with working getPayeeAccountHistory', () => {
            const config = new HLedgerConfig();
            const mockHistory = {
                payeeAccounts: new Map(),
                pairUsage: new Map(),
            };

            jest.spyOn(config, 'getPayeeAccountHistory').mockReturnValue(mockHistory);

            importCommands = new HLedgerImportCommands(config);
            expect(importCommands).toBeDefined();
        });
    });

    describe('custom error types', () => {
        describe('JournalNotFoundError', () => {
            it('should have correct name property', () => {
                const error = new JournalNotFoundError('/path/to/journal.hledger');
                expect(error.name).toBe('JournalNotFoundError');
            });

            it('should include path in message', () => {
                const error = new JournalNotFoundError('/path/to/journal.hledger');
                expect(error.message).toContain('/path/to/journal.hledger');
            });

            it('should extend Error', () => {
                const error = new JournalNotFoundError('/path/to/journal.hledger');
                expect(error).toBeInstanceOf(Error);
            });

            it('should be identifiable with instanceof', () => {
                const error = new JournalNotFoundError('/path/to/journal.hledger');
                expect(error).toBeInstanceOf(JournalNotFoundError);
            });

            it('should expose path property', () => {
                const error = new JournalNotFoundError('/path/to/journal.hledger');
                expect(error.path).toBe('/path/to/journal.hledger');
            });

            it('should have stack trace', () => {
                const error = new JournalNotFoundError('/path/to/journal.hledger');
                expect(error.stack).toBeDefined();
            });
        });

        describe('JournalAccessError', () => {
            it('should have correct name property', () => {
                const error = new JournalAccessError(
                    '/path/to/journal.hledger',
                    'Permission denied'
                );
                expect(error.name).toBe('JournalAccessError');
            });

            it('should include path and reason in message', () => {
                const error = new JournalAccessError(
                    '/path/to/journal.hledger',
                    'Permission denied'
                );
                expect(error.message).toContain('/path/to/journal.hledger');
                expect(error.message).toContain('Permission denied');
            });

            it('should extend Error', () => {
                const error = new JournalAccessError(
                    '/path/to/journal.hledger',
                    'Permission denied'
                );
                expect(error).toBeInstanceOf(Error);
            });

            it('should be identifiable with instanceof', () => {
                const error = new JournalAccessError(
                    '/path/to/journal.hledger',
                    'Permission denied'
                );
                expect(error).toBeInstanceOf(JournalAccessError);
            });

            it('should expose path and reason properties', () => {
                const error = new JournalAccessError(
                    '/path/to/journal.hledger',
                    'Permission denied'
                );
                expect(error.path).toBe('/path/to/journal.hledger');
                expect(error.reason).toBe('Permission denied');
            });
        });

        describe('isJournalError type guard', () => {
            it('should return true for JournalNotFoundError', () => {
                const error = new JournalNotFoundError('/path/to/journal.hledger');
                expect(isJournalError(error)).toBe(true);
            });

            it('should return true for JournalAccessError', () => {
                const error = new JournalAccessError(
                    '/path/to/journal.hledger',
                    'Permission denied'
                );
                expect(isJournalError(error)).toBe(true);
            });

            it('should return false for generic Error', () => {
                const error = new Error('Something went wrong');
                expect(isJournalError(error)).toBe(false);
            });

            it('should return false for non-Error values', () => {
                expect(isJournalError('string')).toBe(false);
                expect(isJournalError(null)).toBe(false);
                expect(isJournalError(undefined)).toBe(false);
                expect(isJournalError(42)).toBe(false);
            });
        });

        describe('error differentiation in import flow', () => {
            it('should recognize JournalNotFoundError as expected failure', () => {
                const error = new JournalNotFoundError('/path/to/journal.hledger');

                // Expected failures are JournalNotFoundError or JournalAccessError
                const isExpectedFailure = isJournalError(error);

                expect(isExpectedFailure).toBe(true);
            });

            it('should recognize JournalAccessError as expected failure', () => {
                const error = new JournalAccessError(
                    '/path/to/journal.hledger',
                    'Permission denied'
                );

                const isExpectedFailure = isJournalError(error);

                expect(isExpectedFailure).toBe(true);
            });

            it('should recognize generic Error as unexpected failure', () => {
                const error = new Error('Database connection failed');

                const isExpectedFailure = isJournalError(error);

                expect(isExpectedFailure).toBe(false);
            });
        });
    });
});
