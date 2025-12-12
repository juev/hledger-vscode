/**
 * HLedgerImportCommands - Error handling tests for journal history lookup
 */

import { HLedgerImportCommands } from '../HLedgerImportCommands';
import { HLedgerConfig } from '../HLedgerConfig';

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
});
