/**
 * Enhanced cache implementations with backward compatibility
 * 
 * This module provides enhanced versions of existing ProjectCache and WorkspaceCache
 * that integrate with the new invalidation system while maintaining 100% backward compatibility.
 */

import * as path from 'path';
import * as vscode from 'vscode';
import { IConfigManager as IHLedgerConfig, ConfigManager } from '../core';
import { 
    IProjectCache, 
    IWorkspaceCache 
} from '../types';
import {
    IEnhancedProjectCache,
    IEnhancedWorkspaceCache,
    ISmartCache,
    ICacheInvalidationManager,
    ProjectPath,
    WorkspacePath,
    FilePath,
    CacheKey,
    createProjectPath,
    createWorkspacePath,
    createFilePath,
    createCacheKey,
    CacheableData,
    InvalidationEventType,
    InvalidationStrategy
} from './interfaces';
import { createSmartCache } from './SmartCache';
import { createCacheInvalidationManager } from './CacheInvalidationManager';

/**
 * Project configuration data structure for caching
 */
interface ProjectConfigData {
    readonly config: IHLedgerConfig;
    readonly scanTime: number;
    readonly fileCount: number;
    readonly accountCount: number;
    readonly payeeCount: number;
    readonly tagCount: number;
    readonly commodityCount: number;
}

/**
 * Workspace configuration data structure for caching
 */
interface WorkspaceConfigData {
    readonly config: IHLedgerConfig;
    readonly workspacePath: string;
    readonly scanTime: number;
    readonly lastUpdate: number;
}

/**
 * Enhanced Project Cache with smart invalidation
 */
export class EnhancedProjectCache implements IEnhancedProjectCache {
    private readonly smartCache: ISmartCache<ProjectConfigData>;
    private readonly invalidationManager: ICacheInvalidationManager;
    private readonly legacyProjects: Map<string, IHLedgerConfig> = new Map();
    
    constructor(
        invalidationManager?: ICacheInvalidationManager
    ) {
        this.smartCache = createSmartCache<ProjectConfigData>('project-cache', {
            maxSize: 50,
            maxAge: 600000, // 10 minutes
            enableCompression: false,
            enablePersistence: false
        });
        
        this.invalidationManager = invalidationManager || createCacheInvalidationManager();
        this.invalidationManager.registerCache(this.smartCache);
    }
    
    // === ENHANCED INTERFACE IMPLEMENTATION ===
    
    async get(key: CacheKey): Promise<ProjectConfigData | null> {
        return await this.smartCache.get(key);
    }
    
    async set(
        key: CacheKey, 
        data: ProjectConfigData, 
        dependencies?: readonly FilePath[], 
        tags?: readonly string[]
    ): Promise<void> {
        await this.smartCache.set(key, data, dependencies, tags);
    }
    
    async has(key: CacheKey): Promise<boolean> {
        return await this.smartCache.has(key);
    }
    
    async delete(key: CacheKey): Promise<boolean> {
        return await this.smartCache.delete(key);
    }
    
    async clear(): Promise<void> {
        await this.smartCache.clear();
        this.legacyProjects.clear();
    }
    
    async invalidateByDependencies(files: readonly FilePath[]): Promise<readonly CacheKey[]> {
        return await this.smartCache.invalidateByDependencies(files);
    }
    
    async invalidateByTags(tags: readonly string[]): Promise<readonly CacheKey[]> {
        return await this.smartCache.invalidateByTags(tags);
    }
    
    getMetrics() {
        return this.smartCache.getMetrics();
    }
    
    async getKeys(): Promise<readonly CacheKey[]> {
        return await this.smartCache.getKeys();
    }
    
    async validate() {
        return await this.smartCache.validate();
    }
    
    get name(): string {
        return this.smartCache.name;
    }
    
    get config() {
        return this.smartCache.config;
    }
    
    // === ENHANCED PROJECT CACHE INTERFACE ===
    
    async getConfig(projectPath: ProjectPath): Promise<IHLedgerConfig | null> {
        const key = createCacheKey(`project:${projectPath}`);
        const cachedData = await this.smartCache.get(key);
        
        if (cachedData) {
            return cachedData.config;
        }
        
        // Fallback to legacy cache
        return this.legacyProjects.get(projectPath) || null;
    }
    
    async initialize(projectPath: ProjectPath): Promise<IHLedgerConfig> {
        try {
            if (process.env.NODE_ENV !== 'test') {
                console.log('Enhanced ProjectCache: Initializing project:', projectPath);
            }
            
            const config = new ConfigManager();
            const startTime = Date.now();
            
            // Scan the project
            config.scanWorkspace(projectPath);
            
            const scanTime = Date.now() - startTime;
            
            // Create cache data
            const cacheData: ProjectConfigData = {
                config,
                scanTime,
                fileCount: 0, // Would be populated by file scanner
                accountCount: config.getAccounts().length,
                payeeCount: config.getPayees().length,
                tagCount: config.getTags().length,
                commodityCount: config.getCommodities().length
            };
            
            // Find HLedger files for dependencies
            const dependencies = await this.findProjectFiles(projectPath);
            const tags = ['hledger-project', path.basename(projectPath)];
            
            // Cache with smart cache
            const key = createCacheKey(`project:${projectPath}`);
            await this.smartCache.set(key, cacheData, dependencies, tags);
            
            // Maintain legacy cache for backward compatibility
            this.legacyProjects.set(projectPath, config);
            
            if (process.env.NODE_ENV !== 'test') {
                console.log(`Enhanced ProjectCache: Initialized project with ${cacheData.accountCount} accounts, ${cacheData.payeeCount} payees, ${cacheData.tagCount} tags`);
            }
            
            return config;
        } catch (error) {
            console.error('Enhanced ProjectCache: Error initializing project:', error);
            throw error;
        }
    }
    
    async hasProject(projectPath: ProjectPath): Promise<boolean> {
        const key = createCacheKey(`project:${projectPath}`);
        const hasInSmartCache = await this.smartCache.has(key);
        const hasInLegacy = this.legacyProjects.has(projectPath);
        
        return hasInSmartCache || hasInLegacy;
    }
    
    async findProjectForFile(filePath: FilePath): Promise<ProjectPath | null> {
        const fileDir = path.dirname(filePath);
        
        // Check all cached projects
        const keys = await this.smartCache.getKeys();
        
        for (const key of keys) {
            if (key.startsWith('project:')) {
                const projectPath = key.substring('project:'.length);
                
                if (filePath.startsWith(projectPath + path.sep) || filePath === projectPath) {
                    return createProjectPath(projectPath);
                }
            }
        }
        
        // Fallback to legacy logic
        for (const [projectPath] of this.legacyProjects) {
            if (filePath.startsWith(projectPath + path.sep) || filePath === projectPath) {
                return createProjectPath(projectPath);
            }
        }
        
        // Try to find project by scanning upwards
        let currentDir = fileDir;
        while (currentDir !== path.dirname(currentDir)) {
            const hledgerFiles = await this.findHLedgerFiles(currentDir, false);
            if (hledgerFiles.length > 0) {
                return createProjectPath(currentDir);
            }
            currentDir = path.dirname(currentDir);
        }
        
        return null;
    }
    
    async getProjects(): Promise<readonly ProjectPath[]> {
        const projects = new Set<string>();
        
        // Get from smart cache
        const keys = await this.smartCache.getKeys();
        for (const key of keys) {
            if (key.startsWith('project:')) {
                projects.add(key.substring('project:'.length));
            }
        }
        
        // Get from legacy cache
        for (const projectPath of this.legacyProjects.keys()) {
            projects.add(projectPath);
        }
        
        return Array.from(projects).map(createProjectPath);
    }
    
    // === LEGACY INTERFACE COMPATIBILITY ===
    
    getLegacyConfig(projectPath: string): IHLedgerConfig | null {
        // Legacy synchronous method - check legacy cache only
        return this.legacyProjects.get(projectPath) || null;
    }
    
    initializeLegacy(projectPath: string): IHLedgerConfig {
        // Legacy synchronous method
        const config = new ConfigManager();
        config.scanWorkspace(projectPath);
        this.legacyProjects.set(projectPath, config);
        
        // Also update smart cache asynchronously
        this.initialize(createProjectPath(projectPath)).catch(error => {
            console.error('Enhanced ProjectCache: Error in async initialization:', error);
        });
        
        return config;
    }
    
    hasLegacyProject(projectPath: string): boolean {
        return this.legacyProjects.has(projectPath);
    }
    
    findLegacyProjectForFile(filePath: string): string | null {
        // Return synchronously from legacy cache
        for (const [projectPath] of this.legacyProjects) {
            if (filePath.startsWith(projectPath + path.sep) || filePath === projectPath) {
                return projectPath;
            }
        }
        
        return null;
    }
    
    clearLegacy(): void {
        this.legacyProjects.clear();
        // Also clear smart cache asynchronously
        this.smartCache.clear().catch(error => {
            console.error('Enhanced ProjectCache: Error clearing smart cache:', error);
        });
    }
    
    // === PRIVATE HELPERS ===
    
    private async findProjectFiles(projectPath: string): Promise<FilePath[]> {
        return await this.findHLedgerFiles(projectPath, true);
    }
    
    private async findHLedgerFiles(dir: string, recursive: boolean): Promise<FilePath[]> {
        const hledgerExtensions = ['.journal', '.hledger', '.ledger'];
        const results: FilePath[] = [];
        
        try {
            const fs = await import('fs');
            const entries = await fs.promises.readdir(dir, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                
                if (entry.isFile()) {
                    const ext = path.extname(entry.name).toLowerCase();
                    if (hledgerExtensions.includes(ext) || entry.name === 'journal') {
                        results.push(createFilePath(fullPath));
                    }
                } else if (entry.isDirectory() && recursive && entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
                    const subResults = await this.findHLedgerFiles(fullPath, true);
                    results.push(...subResults);
                }
            }
        } catch (error) {
            if (process.env.NODE_ENV !== 'test') {
                console.error('Enhanced ProjectCache: Error reading directory:', dir, error);
            }
        }
        
        return results;
    }
}

/**
 * Enhanced Workspace Cache with smart invalidation
 */
export class EnhancedWorkspaceCache implements IEnhancedWorkspaceCache {
    private readonly smartCache: ISmartCache<WorkspaceConfigData>;
    private readonly invalidationManager: ICacheInvalidationManager;
    
    // Legacy state for backward compatibility
    private legacyConfig: IHLedgerConfig | null = null;
    private legacyLastUpdate: number = 0;
    private legacyWorkspacePath: string | null = null;
    
    constructor(
        invalidationManager?: ICacheInvalidationManager
    ) {
        this.smartCache = createSmartCache<WorkspaceConfigData>('workspace-cache', {
            maxSize: 10,
            maxAge: 300000, // 5 minutes
            enableCompression: false,
            enablePersistence: false
        });
        
        this.invalidationManager = invalidationManager || createCacheInvalidationManager();
        this.invalidationManager.registerCache(this.smartCache);
    }
    
    // === ENHANCED INTERFACE IMPLEMENTATION ===
    
    async get(key: CacheKey): Promise<WorkspaceConfigData | null> {
        return await this.smartCache.get(key);
    }
    
    async set(
        key: CacheKey, 
        data: WorkspaceConfigData, 
        dependencies?: readonly FilePath[], 
        tags?: readonly string[]
    ): Promise<void> {
        await this.smartCache.set(key, data, dependencies, tags);
    }
    
    async has(key: CacheKey): Promise<boolean> {
        return await this.smartCache.has(key);
    }
    
    async delete(key: CacheKey): Promise<boolean> {
        return await this.smartCache.delete(key);
    }
    
    async clear(): Promise<void> {
        await this.smartCache.clear();
        this.clearLegacyState();
    }
    
    async invalidateByDependencies(files: readonly FilePath[]): Promise<readonly CacheKey[]> {
        return await this.smartCache.invalidateByDependencies(files);
    }
    
    async invalidateByTags(tags: readonly string[]): Promise<readonly CacheKey[]> {
        return await this.smartCache.invalidateByTags(tags);
    }
    
    getMetrics() {
        return this.smartCache.getMetrics();
    }
    
    async getKeys(): Promise<readonly CacheKey[]> {
        return await this.smartCache.getKeys();
    }
    
    async validate() {
        return await this.smartCache.validate();
    }
    
    get name(): string {
        return this.smartCache.name;
    }
    
    get config() {
        return this.smartCache.config;
    }
    
    // === ENHANCED WORKSPACE CACHE INTERFACE ===
    
    async isValid(workspacePath: WorkspacePath): Promise<boolean> {
        const key = createCacheKey(`workspace:${workspacePath}`);
        return await this.smartCache.has(key);
    }
    
    async update(workspacePath: WorkspacePath): Promise<void> {
        try {
            if (process.env.NODE_ENV !== 'test') {
                console.log('Enhanced WorkspaceCache: Updating workspace:', workspacePath);
            }
            
            const config = new ConfigManager();
            const startTime = Date.now();
            
            config.scanWorkspace(workspacePath);
            
            const scanTime = Date.now() - startTime;
            
            // Create cache data
            const cacheData: WorkspaceConfigData = {
                config,
                workspacePath,
                scanTime,
                lastUpdate: Date.now()
            };
            
            // Find workspace files for dependencies
            const dependencies = await this.findWorkspaceFiles(workspacePath);
            const tags = ['hledger-workspace', path.basename(workspacePath)];
            
            // Cache with smart cache
            const key = createCacheKey(`workspace:${workspacePath}`);
            await this.smartCache.set(key, cacheData, dependencies, tags);
            
            // Update legacy state
            this.legacyConfig = config;
            this.legacyLastUpdate = Date.now();
            this.legacyWorkspacePath = workspacePath;
            
            if (process.env.NODE_ENV !== 'test') {
                console.log(`Enhanced WorkspaceCache: Updated workspace with ${config.getAccounts().length} accounts`);
            }
        } catch (error) {
            console.error('Enhanced WorkspaceCache: Error updating workspace:', error);
            throw error;
        }
    }
    
    async getConfig(): Promise<IHLedgerConfig | null> {
        // Try to get from smart cache first
        const keys = await this.smartCache.getKeys();
        for (const key of keys) {
            if (key.startsWith('workspace:')) {
                const cachedData = await this.smartCache.get(key);
                if (cachedData) {
                    return cachedData.config;
                }
            }
        }
        
        // Fallback to legacy
        return this.legacyConfig;
    }
    
    async getWorkspacePath(): Promise<WorkspacePath | null> {
        // Try to get from smart cache first
        const keys = await this.smartCache.getKeys();
        for (const key of keys) {
            if (key.startsWith('workspace:')) {
                const cachedData = await this.smartCache.get(key);
                if (cachedData) {
                    return createWorkspacePath(cachedData.workspacePath);
                }
            }
        }
        
        // Fallback to legacy
        return this.legacyWorkspacePath ? createWorkspacePath(this.legacyWorkspacePath) : null;
    }
    
    // === LEGACY INTERFACE COMPATIBILITY ===
    
    isLegacyValid(workspacePath: string): boolean {
        // Legacy synchronous method - check legacy state only
        return this.legacyConfig !== null && 
               this.legacyWorkspacePath === workspacePath && 
               (Date.now() - this.legacyLastUpdate) < 60000; // 1 minute
    }
    
    updateLegacy(workspacePath: string): void {
        // Legacy synchronous method
        if (process.env.NODE_ENV !== 'test') {
            console.log('Enhanced WorkspaceCache: Legacy update for:', workspacePath);
        }
        
        this.legacyWorkspacePath = workspacePath;
        this.legacyConfig = new ConfigManager();
        this.legacyConfig.scanWorkspace(createWorkspacePath(workspacePath));
        this.legacyLastUpdate = Date.now();
        
        // Also update smart cache asynchronously
        this.update(createWorkspacePath(workspacePath)).catch(error => {
            console.error('Enhanced WorkspaceCache: Error in async update:', error);
        });
    }
    
    getLegacyConfig(): IHLedgerConfig | null {
        return this.legacyConfig;
    }
    
    invalidate(): void {
        if (process.env.NODE_ENV !== 'test') {
            console.log('Enhanced WorkspaceCache: Legacy invalidate');
        }
        
        this.clearLegacyState();
        
        // Also clear smart cache asynchronously
        this.smartCache.clear().catch(error => {
            console.error('Enhanced WorkspaceCache: Error clearing smart cache:', error);
        });
    }
    
    // === PRIVATE HELPERS ===
    
    private clearLegacyState(): void {
        this.legacyConfig = null;
        this.legacyLastUpdate = 0;
        this.legacyWorkspacePath = null;
    }
    
    private async findWorkspaceFiles(workspacePath: string): Promise<FilePath[]> {
        const hledgerExtensions = ['.journal', '.hledger', '.ledger'];
        const results: FilePath[] = [];
        
        try {
            const fs = await import('fs');
            const entries = await fs.promises.readdir(workspacePath, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(workspacePath, entry.name);
                
                if (entry.isFile()) {
                    const ext = path.extname(entry.name).toLowerCase();
                    if (hledgerExtensions.includes(ext) || entry.name === 'journal') {
                        results.push(createFilePath(fullPath));
                    }
                } else if (entry.isDirectory() && entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
                    // Recursively scan subdirectories
                    const subResults = await this.findWorkspaceFiles(fullPath);
                    results.push(...subResults);
                }
            }
        } catch (error) {
            if (process.env.NODE_ENV !== 'test') {
                console.error('Enhanced WorkspaceCache: Error reading workspace directory:', workspacePath, error);
            }
        }
        
        return results;
    }
}

/**
 * Factory functions for creating enhanced caches
 */
export function createEnhancedProjectCache(
    invalidationManager?: ICacheInvalidationManager
): EnhancedProjectCache {
    return new EnhancedProjectCache(invalidationManager);
}

export function createEnhancedWorkspaceCache(
    invalidationManager?: ICacheInvalidationManager
): EnhancedWorkspaceCache {
    return new EnhancedWorkspaceCache(invalidationManager);
}