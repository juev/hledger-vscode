// HLedgerFileProcessor.include.test.ts - Tests for include directive handling with commodities
// Verifies that commodities and their formats are correctly merged from included files

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { HLedgerFileProcessor } from '../HLedgerFileProcessor';
import { CommodityCode } from '../../types';

describe('HLedgerFileProcessor Include Commodity Tests', () => {
    let testDir: string;
    let processor: HLedgerFileProcessor;

    beforeEach(() => {
        testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hledger-include-test-'));
        processor = new HLedgerFileProcessor();
    });

    afterEach(() => {
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
    });

    describe('commodity merging from includes', () => {
        it('should merge simple commodity directive from included file', async () => {
            // Note: Simple commodity directives (without format template) are supported
            const commoditiesFile = path.join(testDir, 'commodities.journal');
            fs.writeFileSync(commoditiesFile, 'commodity EUR\n');

            const mainFile = path.join(testDir, 'main.journal');
            fs.writeFileSync(mainFile, 'include commodities.journal\n');

            const result = await processor.processFile(mainFile);

            expect(result.data.commodities.has('EUR' as CommodityCode)).toBe(true);
        });

        it('should merge commodities from nested includes with simple directives', async () => {
            // more-commodities.journal
            const moreFile = path.join(testDir, 'more-commodities.journal');
            fs.writeFileSync(moreFile, 'commodity USD\n');

            // commodities.journal includes more-commodities.journal
            const commoditiesFile = path.join(testDir, 'commodities.journal');
            fs.writeFileSync(commoditiesFile, 'include more-commodities.journal\ncommodity EUR\n');

            // main.journal includes commodities.journal
            const mainFile = path.join(testDir, 'main.journal');
            fs.writeFileSync(mainFile, 'include commodities.journal\n');

            const result = await processor.processFile(mainFile);

            expect(result.data.commodities.has('EUR' as CommodityCode)).toBe(true);
            expect(result.data.commodities.has('USD' as CommodityCode)).toBe(true);
        });

        it('should track all processed files including nested includes', async () => {
            const moreFile = path.join(testDir, 'more-commodities.journal');
            fs.writeFileSync(moreFile, 'commodity USD\n');

            const commoditiesFile = path.join(testDir, 'commodities.journal');
            fs.writeFileSync(commoditiesFile, 'include more-commodities.journal\ncommodity EUR\n');

            const mainFile = path.join(testDir, 'main.journal');
            fs.writeFileSync(mainFile, 'include commodities.journal\n');

            const result = await processor.processFile(mainFile);

            expect(result.filesProcessed).toContain(mainFile);
            expect(result.filesProcessed).toContain(commoditiesFile);
            expect(result.filesProcessed).toContain(moreFile);
        });

        it('should merge commodity usage counts from included files', async () => {
            const commoditiesFile = path.join(testDir, 'commodities.journal');
            fs.writeFileSync(commoditiesFile, `
commodity EUR
2024-01-01 Transaction 1
    Assets:Bank  100 EUR
    Income:Salary

2024-01-02 Transaction 2
    Assets:Bank  200 EUR
    Income:Salary
`);

            const mainFile = path.join(testDir, 'main.journal');
            fs.writeFileSync(mainFile, `
include commodities.journal

2024-01-03 Transaction 3
    Assets:Bank  300 EUR
    Expenses:Food
`);

            const result = await processor.processFile(mainFile);

            const eurUsage = result.data.commodityUsage.get('EUR' as CommodityCode);
            expect(eurUsage).toBeGreaterThanOrEqual(3);
        });

        it('should handle multiple commodity declarations across files', async () => {
            const file1 = path.join(testDir, 'currencies1.journal');
            fs.writeFileSync(file1, 'commodity USD\ncommodity EUR\n');

            const file2 = path.join(testDir, 'currencies2.journal');
            fs.writeFileSync(file2, 'commodity GBP\ncommodity JPY\n');

            const mainFile = path.join(testDir, 'main.journal');
            fs.writeFileSync(mainFile, 'include currencies1.journal\ninclude currencies2.journal\n');

            const result = await processor.processFile(mainFile);

            expect(result.data.commodities.has('USD' as CommodityCode)).toBe(true);
            expect(result.data.commodities.has('EUR' as CommodityCode)).toBe(true);
            expect(result.data.commodities.has('GBP' as CommodityCode)).toBe(true);
            expect(result.data.commodities.has('JPY' as CommodityCode)).toBe(true);
        });

        it('should handle prefix commodity symbol from included file', async () => {
            // Prefix symbols like $ are extracted by the lexer
            const commoditiesFile = path.join(testDir, 'commodities.journal');
            fs.writeFileSync(commoditiesFile, 'commodity $\n');

            const mainFile = path.join(testDir, 'main.journal');
            fs.writeFileSync(mainFile, 'include commodities.journal\n');

            const result = await processor.processFile(mainFile);

            expect(result.data.commodities.has('$' as CommodityCode)).toBe(true);
        });

        it('should extract commodities from transactions in included files', async () => {
            // Commodities are also extracted from transaction amounts
            const transactionsFile = path.join(testDir, 'transactions.journal');
            fs.writeFileSync(transactionsFile, `
2024-01-01 Test Transaction
    Assets:Bank  100 EUR
    Income:Salary
`);

            const mainFile = path.join(testDir, 'main.journal');
            fs.writeFileSync(mainFile, 'include transactions.journal\n');

            const result = await processor.processFile(mainFile);

            // EUR should be extracted from the posting amount
            expect(result.data.commodities.has('EUR' as CommodityCode)).toBe(true);
        });
    });

    describe('commodity format priority', () => {
        it('should use format from first definition when commodity defined in multiple files', async () => {
            // Main file defines USD with 2 decimal places
            const mainFile = path.join(testDir, 'main.journal');
            fs.writeFileSync(mainFile, `
commodity 1.00 USD
include commodities.journal
`);

            // Included file defines USD with 3 decimal places
            const commoditiesFile = path.join(testDir, 'commodities.journal');
            fs.writeFileSync(commoditiesFile, 'commodity 1.000 USD\n');

            const result = await processor.processFile(mainFile);
            const format = result.data.commodityFormats.get('USD' as CommodityCode);

            // First definition (main file) should take precedence
            expect(format?.format.decimalPlaces).toBe(2);
        });

        it('should use format from included file when main file has no format', async () => {
            const commoditiesFile = path.join(testDir, 'commodities.journal');
            fs.writeFileSync(commoditiesFile, 'commodity 1.000,00 EUR\n');

            const mainFile = path.join(testDir, 'main.journal');
            fs.writeFileSync(mainFile, `
include commodities.journal

2024-01-01 Test
    Assets:Bank  100 EUR
    Income:Salary
`);

            const result = await processor.processFile(mainFile);
            const format = result.data.commodityFormats.get('EUR' as CommodityCode);

            expect(format?.format.decimalPlaces).toBe(2);
            expect(format?.format.decimalMark).toBe(',');
        });
    });

    describe('edge cases', () => {
        it('should handle empty commodity file', async () => {
            const commoditiesFile = path.join(testDir, 'commodities.journal');
            fs.writeFileSync(commoditiesFile, '; Empty file with just a comment\n');

            const mainFile = path.join(testDir, 'main.journal');
            fs.writeFileSync(mainFile, 'include commodities.journal\n');

            const result = await processor.processFile(mainFile);

            expect(result.errors).toHaveLength(0);
            expect(result.filesProcessed).toContain(commoditiesFile);
        });

        it('should handle circular includes without infinite loop', async () => {
            const file1 = path.join(testDir, 'file1.journal');
            const file2 = path.join(testDir, 'file2.journal');

            fs.writeFileSync(file1, 'include file2.journal\ncommodity USD\n');
            fs.writeFileSync(file2, 'include file1.journal\ncommodity EUR\n');

            const result = await processor.processFile(file1);

            // Should complete without infinite loop
            expect(result.data.commodities.has('USD' as CommodityCode)).toBe(true);
            expect(result.data.commodities.has('EUR' as CommodityCode)).toBe(true);
        });

        it('should handle missing included file gracefully', async () => {
            const mainFile = path.join(testDir, 'main.journal');
            fs.writeFileSync(mainFile, 'include nonexistent.journal\ncommodity USD\n');

            const result = await processor.processFile(mainFile);

            // Should still process main file commodities
            expect(result.data.commodities.has('USD' as CommodityCode)).toBe(true);
            // Should have error about missing file
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0]?.error).toContain('not found');
        });
    });
});
