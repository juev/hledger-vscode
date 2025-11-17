// HLedgerFileProcessor.security.test.ts - Security tests for path traversal protections
// Tests maxDepth, symlink cycle detection, and system directory skipping

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { HLedgerFileProcessor } from '../HLedgerFileProcessor';

describe('HLedgerFileProcessor Security Tests', () => {
    let testDir: string;
    let processor: HLedgerFileProcessor;

    beforeEach(() => {
        // Create a unique test directory in the system temp directory
        testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hledger-security-test-'));
        processor = new HLedgerFileProcessor();
    });

    afterEach(() => {
        // Clean up test directory
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
    });

    describe('maxDepth enforcement', () => {
        it('should stop traversal at maxDepth limit', () => {
            // Create a deeply nested directory structure
            let currentDir = testDir;
            const depth = 15;

            for (let i = 0; i < depth; i++) {
                currentDir = path.join(currentDir, `level${i}`);
                fs.mkdirSync(currentDir, { recursive: true });

                // Add a journal file at each level
                const journalFile = path.join(currentDir, `test${i}.journal`);
                fs.writeFileSync(journalFile, `; Test file at level ${i}\n`);
            }

            // Search with maxDepth of 5
            const files = processor.findHLedgerFiles(testDir, 5);

            // Should only find files up to level 4 (0-indexed, so depth 5 means levels 0-4)
            expect(files.length).toBeLessThanOrEqual(5);

            // Verify none of the files are deeper than maxDepth
            files.forEach(file => {
                const relativePath = path.relative(testDir, file);
                const depthLevel = relativePath.split(path.sep).length - 1;
                expect(depthLevel).toBeLessThan(5);
            });
        });

        it('should use default maxDepth of 10', () => {
            // Create a structure with 12 levels
            let currentDir = testDir;
            const depth = 12;

            for (let i = 0; i < depth; i++) {
                currentDir = path.join(currentDir, `level${i}`);
                fs.mkdirSync(currentDir, { recursive: true });
                fs.writeFileSync(path.join(currentDir, `test${i}.journal`), `; Level ${i}\n`);
            }

            // Search without specifying maxDepth (should default to 10)
            const files = processor.findHLedgerFiles(testDir);

            // Should only find files up to level 9 (0-indexed)
            expect(files.length).toBeLessThanOrEqual(10);

            files.forEach(file => {
                const relativePath = path.relative(testDir, file);
                const depthLevel = relativePath.split(path.sep).length - 1;
                expect(depthLevel).toBeLessThan(10);
            });
        });

        it('should find all files within depth limit', () => {
            // Create structure with 3 levels
            const level1 = path.join(testDir, 'level1');
            const level2 = path.join(level1, 'level2');
            const level3 = path.join(level2, 'level3');

            fs.mkdirSync(level3, { recursive: true });

            const file1 = path.join(testDir, 'test1.journal');
            const file2 = path.join(level1, 'test2.journal');
            const file3 = path.join(level2, 'test3.journal');
            const file4 = path.join(level3, 'test4.journal');

            fs.writeFileSync(file1, '; Test 1\n');
            fs.writeFileSync(file2, '; Test 2\n');
            fs.writeFileSync(file3, '; Test 3\n');
            fs.writeFileSync(file4, '; Test 4\n');

            // Search with maxDepth of 5
            const files = processor.findHLedgerFiles(testDir, 5);

            // Should find all 4 files (depth is 3)
            expect(files.length).toBe(4);
            expect(files).toContain(file1);
            expect(files).toContain(file2);
            expect(files).toContain(file3);
            expect(files).toContain(file4);
        });
    });

    describe('symlink cycle detection', () => {
        it('should detect and prevent infinite loops from symlink cycles', () => {
            // Create directory structure with symlink cycle
            const dir1 = path.join(testDir, 'dir1');
            const dir2 = path.join(dir1, 'dir2');
            const dir3 = path.join(dir2, 'dir3');

            fs.mkdirSync(dir3, { recursive: true });

            // Create a journal file in dir3
            const journalFile = path.join(dir3, 'test.journal');
            fs.writeFileSync(journalFile, '; Test file\n');

            // Create symlink from dir3 back to dir1 (creates a cycle)
            const symlinkPath = path.join(dir3, 'cycle');
            try {
                fs.symlinkSync(dir1, symlinkPath, 'dir');
            } catch (error) {
                // Skip test if symlinks are not supported (e.g., Windows without admin)
                console.warn('Symlinks not supported, skipping cycle detection test');
                return;
            }

            // Search the directory
            const files = processor.findHLedgerFiles(testDir);

            // Should find the journal file once (not in infinite loop)
            expect(files.length).toBe(1);
            expect(files[0]).toBe(journalFile);
        });

        it('should handle multiple symlinks to the same directory', () => {
            // Create a target directory with a journal file
            const targetDir = path.join(testDir, 'target');
            fs.mkdirSync(targetDir);
            const journalFile = path.join(targetDir, 'test.journal');
            fs.writeFileSync(journalFile, '; Test file\n');

            // Create multiple symlinks to the same target
            const link1 = path.join(testDir, 'link1');
            const link2 = path.join(testDir, 'link2');

            try {
                fs.symlinkSync(targetDir, link1, 'dir');
                fs.symlinkSync(targetDir, link2, 'dir');
            } catch (error) {
                console.warn('Symlinks not supported, skipping test');
                return;
            }

            // Search the directory
            const files = processor.findHLedgerFiles(testDir);

            // Should find the journal file only once (deduplication via real path)
            expect(files.length).toBe(1);
            expect(files[0]).toBe(journalFile);
        });

        it('should handle nested symlink cycles', () => {
            // Create complex nested structure with multiple cycles
            const dir1 = path.join(testDir, 'dir1');
            const dir2 = path.join(dir1, 'dir2');
            const dir3 = path.join(testDir, 'dir3');

            fs.mkdirSync(dir2, { recursive: true });
            fs.mkdirSync(dir3);

            const file1 = path.join(dir1, 'test1.journal');
            const file2 = path.join(dir3, 'test2.journal');

            fs.writeFileSync(file1, '; Test 1\n');
            fs.writeFileSync(file2, '; Test 2\n');

            try {
                // Create cycle: dir2 -> dir1
                fs.symlinkSync(dir1, path.join(dir2, 'cycle1'), 'dir');
                // Create another link: dir3 -> dir1
                fs.symlinkSync(dir1, path.join(dir3, 'link'), 'dir');
            } catch (error) {
                console.warn('Symlinks not supported, skipping test');
                return;
            }

            // Search the directory
            const files = processor.findHLedgerFiles(testDir);

            // Should find both unique files without infinite loops
            expect(files.length).toBe(2);
            expect(files).toContain(file1);
            expect(files).toContain(file2);
        });
    });

    describe('system directory protection', () => {
        it('should skip node_modules directories', () => {
            // Create node_modules directory
            const nodeModules = path.join(testDir, 'node_modules');
            const subDir = path.join(nodeModules, 'some-package');

            fs.mkdirSync(subDir, { recursive: true });

            const normalFile = path.join(testDir, 'test.journal');
            const nodeModulesFile = path.join(subDir, 'test.journal');

            fs.writeFileSync(normalFile, '; Normal file\n');
            fs.writeFileSync(nodeModulesFile, '; Should be ignored\n');

            // Search the directory
            const files = processor.findHLedgerFiles(testDir);

            // Should only find the normal file
            expect(files.length).toBe(1);
            expect(files[0]).toBe(normalFile);
        });

        it('should skip .git directories', () => {
            // Create .git directory
            const gitDir = path.join(testDir, '.git');
            const subDir = path.join(gitDir, 'objects');

            fs.mkdirSync(subDir, { recursive: true });

            const normalFile = path.join(testDir, 'test.journal');
            const gitFile = path.join(gitDir, 'test.journal');

            fs.writeFileSync(normalFile, '; Normal file\n');
            fs.writeFileSync(gitFile, '; Should be ignored\n');

            // Search the directory
            const files = processor.findHLedgerFiles(testDir);

            // Should only find the normal file
            expect(files.length).toBe(1);
            expect(files[0]).toBe(normalFile);
        });

        it('should skip .vscode directories', () => {
            // Create .vscode directory
            const vscodeDir = path.join(testDir, '.vscode');
            fs.mkdirSync(vscodeDir);

            const normalFile = path.join(testDir, 'test.journal');
            const vscodeFile = path.join(vscodeDir, 'test.journal');

            fs.writeFileSync(normalFile, '; Normal file\n');
            fs.writeFileSync(vscodeFile, '; Should be ignored\n');

            // Search the directory
            const files = processor.findHLedgerFiles(testDir);

            // Should only find the normal file
            expect(files.length).toBe(1);
            expect(files[0]).toBe(normalFile);
        });

        it('should skip dist and build directories', () => {
            // Create dist and build directories
            const distDir = path.join(testDir, 'dist');
            const buildDir = path.join(testDir, 'build');

            fs.mkdirSync(distDir);
            fs.mkdirSync(buildDir);

            const normalFile = path.join(testDir, 'test.journal');
            const distFile = path.join(distDir, 'test.journal');
            const buildFile = path.join(buildDir, 'test.journal');

            fs.writeFileSync(normalFile, '; Normal file\n');
            fs.writeFileSync(distFile, '; Should be ignored\n');
            fs.writeFileSync(buildFile, '; Should be ignored\n');

            // Search the directory
            const files = processor.findHLedgerFiles(testDir);

            // Should only find the normal file
            expect(files.length).toBe(1);
            expect(files[0]).toBe(normalFile);
        });

        it('should skip Unix system directories', () => {
            // Test the isSystemDirectory method directly with mock paths
            const systemPaths = ['/proc', '/dev', '/sys', '/run', '/tmp'];

            systemPaths.forEach(sysPath => {
                // Access the private method for testing
                const isSystem = (processor as any).isSystemDirectory(sysPath);
                expect(isSystem).toBe(true);
            });
        });
    });

    describe('combined security protections', () => {
        it('should handle maxDepth with symlinks', () => {
            // Create structure with both depth and symlinks
            let currentDir = testDir;
            const depth = 8;

            for (let i = 0; i < depth; i++) {
                currentDir = path.join(currentDir, `level${i}`);
                fs.mkdirSync(currentDir, { recursive: true });
                fs.writeFileSync(path.join(currentDir, `test${i}.journal`), `; Level ${i}\n`);
            }

            // Add symlink at level 3 pointing to root
            try {
                fs.symlinkSync(testDir, path.join(testDir, 'level0', 'level1', 'level2', 'cycle'), 'dir');
            } catch (error) {
                console.warn('Symlinks not supported, skipping test');
                return;
            }

            // Search with maxDepth of 5
            const files = processor.findHLedgerFiles(testDir, 5);

            // Should find files up to depth 4 without infinite loops
            expect(files.length).toBeLessThanOrEqual(5);
        });

        it('should handle system directories within depth limit', () => {
            // Create structure with node_modules at different depths
            const level1 = path.join(testDir, 'level1');
            const level2 = path.join(level1, 'level2');
            const nodeModules = path.join(level2, 'node_modules');

            fs.mkdirSync(nodeModules, { recursive: true });

            const file1 = path.join(testDir, 'test1.journal');
            const file2 = path.join(level1, 'test2.journal');
            const file3 = path.join(level2, 'test3.journal');
            const file4 = path.join(nodeModules, 'test4.journal');

            fs.writeFileSync(file1, '; Test 1\n');
            fs.writeFileSync(file2, '; Test 2\n');
            fs.writeFileSync(file3, '; Test 3\n');
            fs.writeFileSync(file4, '; Should be ignored\n');

            // Search the directory
            const files = processor.findHLedgerFiles(testDir);

            // Should find 3 files, excluding the one in node_modules
            expect(files.length).toBe(3);
            expect(files).toContain(file1);
            expect(files).toContain(file2);
            expect(files).toContain(file3);
            expect(files).not.toContain(file4);
        });

        it('should maintain functionality for legitimate file discovery', () => {
            // Create a realistic project structure
            const src = path.join(testDir, 'src');
            const data = path.join(testDir, 'data');
            const reports = path.join(data, 'reports');
            const nodeModules = path.join(testDir, 'node_modules');

            fs.mkdirSync(src);
            fs.mkdirSync(reports, { recursive: true });
            fs.mkdirSync(nodeModules);

            const mainJournal = path.join(testDir, 'main.journal');
            const incomeJournal = path.join(src, 'income.journal');
            const expensesJournal = path.join(src, 'expenses.journal');
            const reportJournal = path.join(reports, '2024.journal');
            const ignoredJournal = path.join(nodeModules, 'ignored.journal');

            fs.writeFileSync(mainJournal, '; Main journal\n');
            fs.writeFileSync(incomeJournal, '; Income\n');
            fs.writeFileSync(expensesJournal, '; Expenses\n');
            fs.writeFileSync(reportJournal, '; 2024 Report\n');
            fs.writeFileSync(ignoredJournal, '; Should be ignored\n');

            // Search the directory
            const files = processor.findHLedgerFiles(testDir);

            // Should find all legitimate journal files
            expect(files.length).toBe(4);
            expect(files).toContain(mainJournal);
            expect(files).toContain(incomeJournal);
            expect(files).toContain(expensesJournal);
            expect(files).toContain(reportJournal);
            expect(files).not.toContain(ignoredJournal);

            // Verify sorted order
            expect(files).toEqual([...files].sort());
        });
    });

    describe('edge cases', () => {
        it('should handle empty directories', () => {
            const emptyDir = path.join(testDir, 'empty');
            fs.mkdirSync(emptyDir);

            const files = processor.findHLedgerFiles(emptyDir);
            expect(files).toEqual([]);
        });

        it('should handle non-existent directories', () => {
            const nonExistent = path.join(testDir, 'does-not-exist');
            const files = processor.findHLedgerFiles(nonExistent);
            expect(files).toEqual([]);
        });

        it('should handle single file in root', () => {
            const journalFile = path.join(testDir, 'test.journal');
            fs.writeFileSync(journalFile, '; Test\n');

            const files = processor.findHLedgerFiles(testDir);
            expect(files).toEqual([journalFile]);
        });

        it('should handle maxDepth of 0', () => {
            // Create structure with files at root and subdirectory
            const rootFile = path.join(testDir, 'root.journal');
            const subDir = path.join(testDir, 'sub');
            const subFile = path.join(subDir, 'sub.journal');

            fs.mkdirSync(subDir);
            fs.writeFileSync(rootFile, '; Root\n');
            fs.writeFileSync(subFile, '; Sub\n');

            const files = processor.findHLedgerFiles(testDir, 0);

            // With maxDepth 0, should find nothing (currentDepth starts at 0)
            expect(files).toEqual([]);
        });

        it('should handle maxDepth of 1', () => {
            // Create structure with files at root and subdirectory
            const rootFile = path.join(testDir, 'root.journal');
            const subDir = path.join(testDir, 'sub');
            const subFile = path.join(subDir, 'sub.journal');

            fs.mkdirSync(subDir);
            fs.writeFileSync(rootFile, '; Root\n');
            fs.writeFileSync(subFile, '; Sub\n');

            const files = processor.findHLedgerFiles(testDir, 1);

            // With maxDepth 1, should find only root file
            expect(files.length).toBe(1);
            expect(files[0]).toBe(rootFile);
        });
    });
});
