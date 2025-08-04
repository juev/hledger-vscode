import * as fs from 'fs';
import * as path from 'path';
import { IFileScanner } from './interfaces';
import { FilePath, WorkspacePath, createFilePath, createWorkspacePath } from './BrandedTypes';

/**
 * File system scanner for finding HLedger files
 * Responsible for discovering hledger files in directories and workspaces
 */
export class FileScanner implements IFileScanner {
    private readonly hledgerExtensions = ['.journal', '.hledger', '.ledger'];
    
    /**
     * Find hledger files in a directory
     * @param dir - Directory to search
     * @param recursive - Whether to search recursively (default: true)
     * @returns Array of file paths
     */
    findHLedgerFiles(dir: FilePath, recursive: boolean = true): FilePath[] {
        const results: FilePath[] = [];
        
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                
                if (entry.isFile()) {
                    if (this.isHLedgerFile(entry.name)) {
                        results.push(createFilePath(fullPath));
                    }
                } else if (entry.isDirectory() && recursive && this.shouldScanDirectory(entry.name)) {
                    results.push(...this.findHLedgerFiles(createFilePath(fullPath), true));
                }
            }
        } catch (error) {
            // Only log errors in non-test environment
            if (process.env.NODE_ENV !== 'test') {
                console.error('Error reading directory:', dir, error);
            }
        }
        
        return results;
    }
    
    /**
     * Scan workspace for hledger files
     * @param workspacePath - Workspace root path
     * @returns Array of file paths
     */
    scanWorkspace(workspacePath: WorkspacePath): FilePath[] {
        try {
            if (process.env.NODE_ENV !== 'test') {
                console.log('Scanning workspace:', workspacePath);
            }
            
            const files = this.findHLedgerFiles(createFilePath(workspacePath), true);
            
            if (process.env.NODE_ENV !== 'test') {
                console.log('Found hledger files:', files);
            }
            
            return files;
        } catch (error) {
            console.error('Error scanning workspace:', error);
            return [];
        }
    }
    
    /**
     * Check if a file is an hledger file based on name
     */
    private isHLedgerFile(fileName: string): boolean {
        const ext = path.extname(fileName).toLowerCase();
        return this.hledgerExtensions.includes(ext) || fileName === 'journal';
    }
    
    /**
     * Check if a directory should be scanned recursively
     */
    private shouldScanDirectory(dirName: string): boolean {
        // Skip common directories that should not contain hledger files
        const skipDirs = [
            'node_modules',
            '.git',
            '.vscode',
            '.idea',
            'build',
            'dist',
            'target',
            'bin',
            'obj',
            '__pycache__',
            '.next',
            '.nuxt',
            'coverage'
        ];
        
        // Skip hidden directories (starting with .)
        if (dirName.startsWith('.') && !['..', '.'].includes(dirName)) {
            return false;
        }
        
        return !skipDirs.includes(dirName);
    }
    
    /**
     * Check if a path exists and is a directory
     */
    isDirectory(dirPath: string): boolean {
        try {
            const stats = fs.statSync(dirPath);
            return stats.isDirectory();
        } catch {
            return false;
        }
    }
    
    /**
     * Check if a file exists
     */
    fileExists(filePath: string): boolean {
        try {
            const stats = fs.statSync(filePath);
            return stats.isFile();
        } catch {
            return false;
        }
    }
    
    /**
     * Get the directory containing hledger files closest to a given file path
     * Useful for finding project roots
     */
    findProjectRoot(filePath: string): string | null {
        let currentDir = path.dirname(filePath);
        const root = path.parse(currentDir).root;
        
        while (currentDir !== root) {
            // Look for hledger files in this directory (non-recursive)
            const hledgerFiles = this.findHLedgerFiles(createFilePath(currentDir), false);
            if (hledgerFiles.length > 0) {
                return currentDir;
            }
            
            // Move up one directory
            const parentDir = path.dirname(currentDir);
            if (parentDir === currentDir) {
                break; // Reached root
            }
            currentDir = parentDir;
        }
        
        return null;
    }
    
    /**
     * Get relative path from base to target
     */
    getRelativePath(basePath: string, targetPath: string): string {
        return path.relative(basePath, targetPath);
    }
    
    /**
     * Resolve a path relative to a base path
     */
    resolvePath(basePath: string, relativePath: string): string {
        return path.resolve(basePath, relativePath);
    }
}