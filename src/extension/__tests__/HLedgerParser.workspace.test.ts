import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { HLedgerParser } from '../HLedgerParser';
import { SimpleProjectCache } from '../SimpleProjectCache';

describe('HLedgerParser.parseWorkspace() - Cache Integration', () => {
  let parser: HLedgerParser;
  let cache: SimpleProjectCache;
  let tempDir: string;
  let file1Path: string;
  let file2Path: string;
  let file3Path: string;

  beforeEach(() => {
    parser = new HLedgerParser();
    cache = new SimpleProjectCache();

    // Create temporary directory for test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hledger-workspace-test-'));
    file1Path = path.join(tempDir, 'main.journal');
    file2Path = path.join(tempDir, 'accounts.journal');
    file3Path = path.join(tempDir, 'transactions.journal');
  });

  afterEach(() => {
    // Clean up temporary files
    try {
      if (fs.existsSync(file1Path)) fs.unlinkSync(file1Path);
      if (fs.existsSync(file2Path)) fs.unlinkSync(file2Path);
      if (fs.existsSync(file3Path)) fs.unlinkSync(file3Path);
      if (fs.existsSync(tempDir)) fs.rmdirSync(tempDir);
    } catch (err) {
      // Ignore cleanup errors
    }
  });

  it('should use cached data for unchanged files', () => {
    // Create test files
    fs.writeFileSync(file1Path, '2025-01-15 Store\n  Assets:Cash  -100\n  Expenses:Food  100\n');
    fs.writeFileSync(file2Path, '2025-01-16 Gas\n  Assets:Cash  -50\n  Expenses:Transport  50\n');
    fs.writeFileSync(
      file3Path,
      '2025-01-17 Rent\n  Assets:Bank  -1000\n  Expenses:Housing  1000\n'
    );

    // First parse - all files should be parsed
    const result1 = parser.parseWorkspace(tempDir, cache);
    expect(result1.accounts.size).toBeGreaterThan(0);
    expect(cache.size()).toBe(3); // All 3 files cached

    // Verify cached data exists
    expect(cache.has(file1Path)).toBe(true);
    expect(cache.has(file2Path)).toBe(true);
    expect(cache.has(file3Path)).toBe(true);

    // Second parse - should use cached data (no file modifications)
    const result2 = parser.parseWorkspace(tempDir, cache);

    // Results should be the same
    expect(result2.accounts.size).toBe(result1.accounts.size);
    expect(Array.from(result2.accounts)).toEqual(
      expect.arrayContaining(Array.from(result1.accounts))
    );
  });

  it('should reparse only modified files', (done) => {
    // Create test files
    fs.writeFileSync(file1Path, '2025-01-15 Store\n  Assets:Cash  -100\n  Expenses:Food  100\n');
    fs.writeFileSync(file2Path, '2025-01-16 Gas\n  Assets:Cash  -50\n  Expenses:Transport  50\n');
    fs.writeFileSync(
      file3Path,
      '2025-01-17 Rent\n  Assets:Bank  -1000\n  Expenses:Housing  1000\n'
    );

    // First parse
    const result1 = parser.parseWorkspace(tempDir, cache);

    // Wait a bit, then modify only file2
    setTimeout(() => {
      fs.appendFileSync(
        file2Path,
        '\n2025-01-18 NewTransaction\n  Assets:Cash  -25\n  Expenses:Entertainment  25\n'
      );

      // Second parse - should reparse file2, use cache for file1 and file3
      const result2 = parser.parseWorkspace(tempDir, cache);

      // Should have new account from modified file
      expect(result2.accounts.has('Expenses:Entertainment')).toBe(true);

      // Should still have accounts from cached files
      expect(result2.accounts.has('Expenses:Food')).toBe(true);
      expect(result2.accounts.has('Expenses:Housing')).toBe(true);

      done();
    }, 100);
  });

  it('should work without cache (backward compatibility)', () => {
    // Create test files
    fs.writeFileSync(file1Path, '2025-01-15 Test1\n  Assets:Cash  100\n');
    fs.writeFileSync(file2Path, '2025-01-16 Test2\n  Assets:Bank  200\n');

    // Parse without cache - should still work
    const result = parser.parseWorkspace(tempDir);

    expect(result.accounts.size).toBeGreaterThan(0);
    expect(result.accounts.has('Assets:Cash')).toBe(true);
    expect(result.accounts.has('Assets:Bank')).toBe(true);
  });

  it('should merge data from multiple files correctly', () => {
    // Create test files with different data
    fs.writeFileSync(
      file1Path,
      `
2025-01-15 Store
  Assets:Cash  -100 USD
  Expenses:Food  100 USD
; category:groceries
`
    );

    fs.writeFileSync(
      file2Path,
      `
2025-01-16 Transport
  Assets:Cash  -50 EUR
  Expenses:Transport  50 EUR
; type:gas
`
    );

    fs.writeFileSync(
      file3Path,
      `
2025-01-17 Housing
  Assets:Bank  -1000 RUB
  Expenses:Housing  1000 RUB
; priority:high
`
    );

    // Parse all files
    const result = parser.parseWorkspace(tempDir, cache);

    // Verify merged accounts
    expect(result.accounts.has('Assets:Cash')).toBe(true);
    expect(result.accounts.has('Assets:Bank')).toBe(true);
    expect(result.accounts.has('Expenses:Food')).toBe(true);
    expect(result.accounts.has('Expenses:Transport')).toBe(true);
    expect(result.accounts.has('Expenses:Housing')).toBe(true);

    // Verify merged payees
    expect(result.payees.has('Store')).toBe(true);
    expect(result.payees.has('Transport')).toBe(true);
    expect(result.payees.has('Housing')).toBe(true);

    // Verify merged commodities
    expect(result.commodities.has('USD')).toBe(true);
    expect(result.commodities.has('EUR')).toBe(true);
    expect(result.commodities.has('RUB')).toBe(true);

    // Verify merged tags
    expect(result.tags.has('category')).toBe(true);
    expect(result.tags.has('type')).toBe(true);
    expect(result.tags.has('priority')).toBe(true);
  });

  it('should handle cache invalidation on file deletion', (done) => {
    // Create test files
    fs.writeFileSync(file1Path, '2025-01-15 Test1\n  Assets:Cash  100\n');
    fs.writeFileSync(file2Path, '2025-01-16 Test2\n  Assets:Bank  200\n');

    // First parse
    const result1 = parser.parseWorkspace(tempDir, cache);
    expect(result1.accounts.has('Assets:Cash')).toBe(true);
    expect(result1.accounts.has('Assets:Bank')).toBe(true);
    expect(cache.size()).toBe(2);

    // Wait a bit, then delete file2
    setTimeout(() => {
      fs.unlinkSync(file2Path);

      // Second parse - file2 will fail to read, but should not crash
      const result2 = parser.parseWorkspace(tempDir, cache);

      // Should still have data from file1
      expect(result2.accounts.has('Assets:Cash')).toBe(true);

      done();
    }, 100);
  });
});
