// HLedgerCliService.timeout.test.ts - Tests for CLI timeout protection

import * as child_process from 'child_process';
import { promisify } from 'util';

// Mock the exec function to verify timeout option is passed
jest.mock('child_process');

const mockExec = child_process.exec as jest.MockedFunction<typeof child_process.exec>;

describe('HLedgerCliService - Timeout Protection', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('resolveHledgerPath', () => {
        it('should apply timeout to PATH resolution exec call', async () => {
            const { HLedgerCliService } = await import('../HLedgerCliService');

            mockExec.mockImplementation(((command: string, options: child_process.ExecOptions | null | undefined, callback?: ((error: child_process.ExecException | null, stdout: string | Buffer, stderr: string | Buffer) => void)) => {
                if (callback) {
                    callback(null, '/usr/bin/hledger\n', '');
                }
                return {} as any;
            }) as any);

            const service = new HLedgerCliService();

            // Wait for initialization to complete
            await new Promise(resolve => setTimeout(resolve, 100));

            // Verify exec was called with timeout option
            expect(mockExec).toHaveBeenCalled();

            const execCalls = mockExec.mock.calls;
            const pathResolutionCall = execCalls.find(call => {
                const command = call[0];
                return command === 'which hledger' || command === 'where hledger';
            });

            expect(pathResolutionCall).toBeDefined();

            if (pathResolutionCall) {
                const options = pathResolutionCall[1];
                expect(options).toBeDefined();
                expect(options?.timeout).toBe(5000);
            }

            service.dispose();
        });

        it('should have 5 second timeout to prevent hanging on slow file systems', async () => {
            const { HLedgerCliService } = await import('../HLedgerCliService');

            const timeoutValues: number[] = [];

            mockExec.mockImplementation(((command: string, options: child_process.ExecOptions | null | undefined, callback?: ((error: child_process.ExecException | null, stdout: string | Buffer, stderr: string | Buffer) => void)) => {
                if (options && typeof options.timeout === 'number') {
                    timeoutValues.push(options.timeout);
                }
                if (callback) {
                    callback(null, '/usr/bin/hledger\n', '');
                }
                return {} as any;
            }) as any);

            const service = new HLedgerCliService();

            // Wait for initialization
            await new Promise(resolve => setTimeout(resolve, 100));

            // Verify timeout is exactly 5000ms
            expect(timeoutValues).toContain(5000);

            service.dispose();
        });
    });
});
