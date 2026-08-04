// HLedgerCliService.timeout.test.ts - Tests for CLI timeout protection

import type { MockedFunction } from "vitest";
import * as child_process from 'child_process';

// Mock the exec function to verify timeout option is passed.
// HLedgerCliService only promisifies exec and execFile, so the factory covers both.
vi.mock('child_process', () => ({
    exec: vi.fn(),
    execFile: vi.fn(),
}));

const mockExec = child_process.exec as MockedFunction<typeof child_process.exec>;
const mockExecFile = child_process.execFile as MockedFunction<typeof child_process.execFile>;

/**
 * Path resolution runs `which hledger` and then validates the candidate with
 * `<path> --version`. Both go through promisify, so a mock that never invokes
 * its callback leaves the promise pending forever and initialization never
 * finishes. Give execFile a callback so awaiting the service actually resolves.
 */
function stubExecFileSuccess(): void {
    mockExecFile.mockImplementation(((...args: unknown[]) => {
        const callback = args[args.length - 1];
        if (typeof callback === 'function') {
            (callback as (e: null, stdout: string, stderr: string) => void)(null, 'hledger 1.52.1\n', '');
        }
        return {} as never;
    }) as never);
}

describe('HLedgerCliService - Timeout Protection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
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

            stubExecFileSuccess();

            const service = new HLedgerCliService();

            // Await the initialization the constructor kicked off. getHledgerPath
            // goes through the same ensureInitialized promise, so this is exact
            // where a fixed sleep was a race.
            await service.getHledgerPath();

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

            stubExecFileSuccess();

            const service = new HLedgerCliService();

            await service.getHledgerPath();

            // Verify timeout is exactly 5000ms
            expect(timeoutValues).toContain(5000);

            service.dispose();
        });
    });
});
