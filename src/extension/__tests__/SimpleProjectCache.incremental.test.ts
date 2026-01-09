import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SimpleProjectCache } from '../SimpleProjectCache';
import { ParsedHLedgerData } from '../HLedgerParser';
import { createAccountName, createPayeeName, createUsageCount } from '../types';

describe('SimpleProjectCache - Incremental Updates', () => {
    let cache: SimpleProjectCache;
    let tempDir: string;
    let testFile1: string;
    let testFile2: string;

    beforeEach(() => {
        cache = new SimpleProjectCache();
        // Create temporary directory for test files
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hledger-cache-test-'));
        testFile1 = path.join(tempDir, 'test1.journal');
        testFile2 = path.join(tempDir, 'test2.journal');
    });

    afterEach(() => {
        // Clean up temporary files
        try {
            if (fs.existsSync(testFile1)) fs.unlinkSync(testFile1);
            if (fs.existsSync(testFile2)) fs.unlinkSync(testFile2);
            if (fs.existsSync(tempDir)) fs.rmdirSync(tempDir);
        } catch (err) {
            // Ignore cleanup errors
        }
    });

    describe('mtimeMs validation', () => {
        it('should return cached data when file not modified', () => {
            // Create test file
            fs.writeFileSync(testFile1, '2025-01-15 Test\n  Assets:Cash  100\n');

            // Create mock parsed data
            const mockData: ParsedHLedgerData = {
                accounts: new Set([createAccountName('Assets:Cash')]),
                definedAccounts: new Set(),
                usedAccounts: new Set([createAccountName('Assets:Cash')]),
                payees: new Set([createPayeeName('Test')]),
                tags: new Set(),
                commodities: new Set(),
                definedCommodities: new Set(),
                aliases: new Map(),
                tagValues: new Map(),
                tagValueUsage: new Map(),
                accountUsage: new Map([[createAccountName('Assets:Cash'), createUsageCount(1)]]),
                payeeUsage: new Map([[createPayeeName('Test'), createUsageCount(1)]]),
                tagUsage: new Map(),
                commodityUsage: new Map(),
                payeeAccounts: new Map(),
                payeeAccountPairUsage: new Map(),
                commodityFormats: new Map(),
                decimalMark: null,
                defaultCommodity: null,
                transactionTemplates: new Map(),
                payeeRecentTemplates: new Map(),
                lastDate: '2025-01-15',
                formattingProfile: { amountAlignmentColumn: 40, maxAccountNameLength: 0, isDefaultAlignment: true }
            };

            // Cache the data
            cache.set(testFile1, mockData);

            // Get from cache - should return cached data (file not modified)
            const cached = cache.get(testFile1);
            expect(cached).toBeTruthy();
            expect(cached?.accounts.size).toBe(1);
            expect(Array.from(cached!.accounts)[0]).toBe('Assets:Cash');
        });

        it('should return cache when stored mtime is greater than current mtime (prevents clock skew issues)', () => {
            // Create test file
            fs.writeFileSync(testFile1, '2025-01-15 Test\n  Assets:Cash  100\n');

            // Create mock parsed data with a future timestamp (simulating clock skew or race condition)
            const mockData: ParsedHLedgerData = {
                accounts: new Set([createAccountName('Assets:Cash')]),
                definedAccounts: new Set(),
                usedAccounts: new Set([createAccountName('Assets:Cash')]),
                payees: new Set([createPayeeName('Test')]),
                tags: new Set(),
                commodities: new Set(),
                definedCommodities: new Set(),
                aliases: new Map(),
                tagValues: new Map(),
                tagValueUsage: new Map(),
                accountUsage: new Map(),
                payeeUsage: new Map(),
                tagUsage: new Map(),
                commodityUsage: new Map(),
                payeeAccounts: new Map(),
                payeeAccountPairUsage: new Map(),
                commodityFormats: new Map(),
                decimalMark: null,
                defaultCommodity: null,
                transactionTemplates: new Map(),
                payeeRecentTemplates: new Map(),
                lastDate: '2025-01-15',
                formattingProfile: { amountAlignmentColumn: 40, maxAccountNameLength: 0, isDefaultAlignment: true }
            };

            // Get the file's mtimeMs
            const stats = fs.statSync(testFile1);
            const currentMtime = stats.mtimeMs;

            // Store mtime in modTimes map with a value greater than current mtime
            cache.set(testFile1, mockData);
            const storedMtime = currentMtime + 1;
            (cache as any).modTimes.set(testFile1, storedMtime);

            // Request cached data - should return cached data because stored mtime >= current mtime
            // This is by design: if file hasn't changed (or was restored to older version), cache is valid
            const cached = cache.get(testFile1);
            expect(cached).not.toBeNull();
            expect(cached?.accounts.has(createAccountName('Assets:Cash'))).toBe(true);
        });

        it('should return null when file modified after caching', (done) => {
            // Create test file
            fs.writeFileSync(testFile1, '2025-01-15 Test\n  Assets:Cash  100\n');

            const mockData: ParsedHLedgerData = {
                accounts: new Set([createAccountName('Assets:Cash')]),
                definedAccounts: new Set(),
                usedAccounts: new Set([createAccountName('Assets:Cash')]),
                payees: new Set([createPayeeName('Test')]),
                tags: new Set(),
                commodities: new Set(),
                definedCommodities: new Set(),
                aliases: new Map(),
                tagValues: new Map(),
                tagValueUsage: new Map(),
                accountUsage: new Map(),
                payeeUsage: new Map(),
                tagUsage: new Map(),
                commodityUsage: new Map(),
                payeeAccounts: new Map(),
                payeeAccountPairUsage: new Map(),
                commodityFormats: new Map(),
                decimalMark: null,
                defaultCommodity: null,
                transactionTemplates: new Map(),
                payeeRecentTemplates: new Map(),
                lastDate: '2025-01-15',
                formattingProfile: { amountAlignmentColumn: 40, maxAccountNameLength: 0, isDefaultAlignment: true }
            };

            // Cache the data
            cache.set(testFile1, mockData);

            // Wait a bit, then modify file
            setTimeout(() => {
                fs.appendFileSync(testFile1, '\n2025-01-16 Modified\n  Assets:Bank  200\n');

                // Get from cache - should return null (file was modified)
                const cached = cache.get(testFile1);
                expect(cached).toBeNull();
                done();
            }, 100);
        });

        it('should handle multiple files independently', (done) => {
            // Create two test files
            fs.writeFileSync(testFile1, '2025-01-15 File1\n  Assets:Cash  100\n');
            fs.writeFileSync(testFile2, '2025-01-15 File2\n  Assets:Bank  200\n');

            const mockData1: ParsedHLedgerData = {
                accounts: new Set([createAccountName('Assets:Cash')]),
                definedAccounts: new Set(),
                usedAccounts: new Set([createAccountName('Assets:Cash')]),
                payees: new Set([createPayeeName('File1')]),
                tags: new Set(),
                commodities: new Set(),
                definedCommodities: new Set(),
                aliases: new Map(),
                tagValues: new Map(),
                tagValueUsage: new Map(),
                accountUsage: new Map(),
                payeeUsage: new Map(),
                tagUsage: new Map(),
                commodityUsage: new Map(),
                payeeAccounts: new Map(),
                payeeAccountPairUsage: new Map(),
                commodityFormats: new Map(),
                decimalMark: null,
                defaultCommodity: null,
                transactionTemplates: new Map(),
                payeeRecentTemplates: new Map(),
                lastDate: '2025-01-15',
                formattingProfile: { amountAlignmentColumn: 40, maxAccountNameLength: 0, isDefaultAlignment: true }
            };

            const mockData2: ParsedHLedgerData = {
                accounts: new Set([createAccountName('Assets:Bank')]),
                definedAccounts: new Set(),
                usedAccounts: new Set([createAccountName('Assets:Bank')]),
                payees: new Set([createPayeeName('File2')]),
                tags: new Set(),
                commodities: new Set(),
                definedCommodities: new Set(),
                aliases: new Map(),
                tagValues: new Map(),
                tagValueUsage: new Map(),
                accountUsage: new Map(),
                payeeUsage: new Map(),
                tagUsage: new Map(),
                commodityUsage: new Map(),
                payeeAccounts: new Map(),
                payeeAccountPairUsage: new Map(),
                commodityFormats: new Map(),
                decimalMark: null,
                defaultCommodity: null,
                transactionTemplates: new Map(),
                payeeRecentTemplates: new Map(),
                lastDate: '2025-01-15',
                formattingProfile: { amountAlignmentColumn: 40, maxAccountNameLength: 0, isDefaultAlignment: true }
            };

            // Cache both files
            cache.set(testFile1, mockData1);
            cache.set(testFile2, mockData2);

            // Wait a bit, then modify only file1
            setTimeout(() => {
                fs.appendFileSync(testFile1, '\n2025-01-16 Modified\n');

                // File1 should return null (modified)
                const cached1 = cache.get(testFile1);
                expect(cached1).toBeNull();

                // File2 should return cached data (not modified)
                const cached2 = cache.get(testFile2);
                expect(cached2).toBeTruthy();
                expect(Array.from(cached2!.accounts)[0]).toBe('Assets:Bank');

                done();
            }, 100);
        });
    });

    describe('cache operations', () => {
        it('should delete specific file from cache', () => {
            fs.writeFileSync(testFile1, '2025-01-15 Test\n');

            const mockData: ParsedHLedgerData = {
                accounts: new Set([createAccountName('Assets:Cash')]),
                definedAccounts: new Set(),
                usedAccounts: new Set(),
                payees: new Set(),
                tags: new Set(),
                commodities: new Set(),
                definedCommodities: new Set(),
                aliases: new Map(),
                tagValues: new Map(),
                tagValueUsage: new Map(),
                accountUsage: new Map(),
                payeeUsage: new Map(),
                tagUsage: new Map(),
                commodityUsage: new Map(),
                payeeAccounts: new Map(),
                payeeAccountPairUsage: new Map(),
                commodityFormats: new Map(),
                decimalMark: null,
                defaultCommodity: null,
                transactionTemplates: new Map(),
                payeeRecentTemplates: new Map(),
                lastDate: null,
                formattingProfile: { amountAlignmentColumn: 40, maxAccountNameLength: 0, isDefaultAlignment: true }
            };

            cache.set(testFile1, mockData);
            expect(cache.has(testFile1)).toBe(true);

            cache.delete(testFile1);
            expect(cache.has(testFile1)).toBe(false);
        });

        it('should clear all cache entries', () => {
            fs.writeFileSync(testFile1, '2025-01-15 Test1\n');
            fs.writeFileSync(testFile2, '2025-01-15 Test2\n');

            const mockData: ParsedHLedgerData = {
                accounts: new Set(),
                definedAccounts: new Set(),
                usedAccounts: new Set(),
                payees: new Set(),
                tags: new Set(),
                commodities: new Set(),
                definedCommodities: new Set(),
                aliases: new Map(),
                tagValues: new Map(),
                tagValueUsage: new Map(),
                accountUsage: new Map(),
                payeeUsage: new Map(),
                tagUsage: new Map(),
                commodityUsage: new Map(),
                payeeAccounts: new Map(),
                payeeAccountPairUsage: new Map(),
                commodityFormats: new Map(),
                decimalMark: null,
                defaultCommodity: null,
                transactionTemplates: new Map(),
                payeeRecentTemplates: new Map(),
                lastDate: null,
                formattingProfile: { amountAlignmentColumn: 40, maxAccountNameLength: 0, isDefaultAlignment: true }
            };

            cache.set(testFile1, mockData);
            cache.set(testFile2, mockData);
            expect(cache.size()).toBe(2);

            cache.clear();
            expect(cache.size()).toBe(0);
            expect(cache.has(testFile1)).toBe(false);
            expect(cache.has(testFile2)).toBe(false);
        });
    });
});
