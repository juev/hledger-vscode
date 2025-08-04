import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { 
    IWorkspaceCache, 
    IProjectCache,
    HLEDGER_KEYWORDS, 
    DEFAULT_ACCOUNT_PREFIXES, 
    DEFAULT_COMMODITIES 
} from './types';
import { FilePath, WorkspacePath, createFilePath, createWorkspacePath } from './core/BrandedTypes';
import { IConfigManager as IHLedgerConfig, ConfigManager, IComponentContainer } from './core';
import { SyncSingleton, SingletonLifecycleManager } from './core/SingletonManager';
import { FuzzyMatcher, FuzzyMatch } from './completion/base/FuzzyMatcher';
import { createServices } from './services';

// Backward-compatible fuzzy match function that creates a new FuzzyMatcher instance
export function fuzzyMatch(query: string, items: string[]): FuzzyMatch[] {
    const matcher = new FuzzyMatcher();
    return matcher.match(query, items);
}

// Safe file search without shell execution
function findHLedgerFiles(dir: string, recursive: boolean = true): string[] {
    const hledgerExtensions = ['.journal', '.hledger', '.ledger'];
    const results: string[] = [];
    
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            
            if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase();
                if (hledgerExtensions.includes(ext) || entry.name === 'journal') {
                    results.push(fullPath);
                }
            } else if (entry.isDirectory() && recursive && entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
                results.push(...findHLedgerFiles(fullPath, true));
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

// Legacy class for backward compatibility - replaced by ConfigManager
export class HLedgerConfig extends ConfigManager {
    constructor() {
        super();
    }
}

export class WorkspaceCache extends SyncSingleton implements IWorkspaceCache {
    private config: IHLedgerConfig | null = null;
    private lastUpdate: number = 0;
    private workspacePath: string | null = null;

    constructor() {
        super();
    }

    protected getSingletonKey(): string {
        return 'WorkspaceCache';
    }

    protected initialize(): void {
        // Initialize cache state
        this.config = null;
        this.lastUpdate = 0;
        this.workspacePath = null;
        
        // Register with lifecycle manager
        SingletonLifecycleManager.register(this);
    }
    
    isValid(workspacePath: string): boolean {
        return this.config !== null && 
               this.workspacePath === workspacePath && 
               (Date.now() - this.lastUpdate) < 60000; // Cache valid for 1 minute
    }
    
    update(workspacePath: string): void {
        if (process.env.NODE_ENV !== 'test') {
            console.log('Updating workspace cache for:', workspacePath);
        }
        this.workspacePath = workspacePath;
        this.config = new ConfigManager() as any;
        if (this.config) {
            this.config.scanWorkspace(workspacePath as any);
        }
        this.lastUpdate = Date.now();
        if (process.env.NODE_ENV !== 'test') {
            console.log('Cache updated with', this.config?.accounts?.size || 0, 'accounts');
        }
    }
    
    getConfig(): IHLedgerConfig | null {
        return this.config;
    }
    
    invalidate(): void {
        if (process.env.NODE_ENV !== 'test') {
            console.log('Cache invalidated');
        }
        this.config = null;
        this.lastUpdate = 0;
    }


    /**
     * Override dispose to cleanup resources properly
     */
    public dispose(): void {
        this.config = null;
        this.workspacePath = null;
        this.lastUpdate = 0;
        super.dispose();
    }

    /**
     * Get singleton instance
     */
    public static getInstance(context?: vscode.ExtensionContext): WorkspaceCache {
        return super.getInstance.call(this, context) as WorkspaceCache;
    }

    /**
     * Reset singleton for testing
     */
    public static resetInstance(): void {
        const instances = SyncSingleton.getActiveInstances();
        const instance = instances.get('WorkspaceCache');
        if (instance) {
            instance.reset();
        }
    }
}

export class ProjectCache extends SyncSingleton implements IProjectCache {
    private projects: Map<string, IHLedgerConfig> = new Map();

    constructor() {
        super();
    }

    protected getSingletonKey(): string {
        return 'ProjectCache';
    }

    protected initialize(): void {
        // Initialize cache state
        this.projects.clear();
        
        // Register with lifecycle manager
        SingletonLifecycleManager.register(this);
    }
    
    getConfig(projectPath: string): IHLedgerConfig | null {
        return this.projects.get(projectPath) || null;
    }
    
    initializeProject(projectPath: string): IHLedgerConfig {
        console.log('Initializing project cache for:', projectPath);
        
        const config = new ConfigManager() as any;
        config.scanWorkspace(projectPath as any);
        
        this.projects.set(projectPath, config as any);
        console.log(`Project cache initialized with ${config.accounts.size} accounts, ${config.payees.size} payees, ${config.tags.size} tags`);
        
        return config;
    }
    
    hasProject(projectPath: string): boolean {
        return this.projects.has(projectPath);
    }
    
    findProjectForFile(filePath: FilePath): WorkspacePath | null {
        // Find the closest project that contains this file
        const fileDir = path.dirname(filePath);
        
        // First check exact matches
        for (const [projectPath] of this.projects) {
            if (filePath.startsWith(projectPath + path.sep) || filePath === projectPath) {
                return createWorkspacePath(projectPath);
            }
        }
        
        // Check if file is in any parent directory that could be a project
        let currentDir = fileDir;
        while (currentDir !== path.dirname(currentDir)) {
            // Look for hledger files in this directory (non-recursive)
            const hledgerFiles = findHLedgerFiles(currentDir, false);
            if (hledgerFiles.length > 0) {
                return createWorkspacePath(currentDir);
            }
            currentDir = path.dirname(currentDir);
        }
        
        return null;
    }
    
    clear(): void {
        this.projects.clear();
        if (process.env.NODE_ENV !== 'test') {
            console.log('Project cache cleared');
        }
    }

    /**
     * Get singleton instance of ProjectCache
     */
    public static getInstance(context?: vscode.ExtensionContext): ProjectCache {
        return super.getInstance.call(this, context) as ProjectCache;
    }

    /**
     * Reset singleton for testing
     */
    public static resetInstance(): void {
        const instances = SyncSingleton.getActiveInstances();
        const instance = instances.get('ProjectCache');
        if (instance) {
            instance.reset();
        }
    }

    /**
     * Alternative static method for backward compatibility
     */
    public static get(): ProjectCache {
        return ProjectCache.getInstance();
    }

    /**
     * Override dispose to cleanup resources properly
     */
    public dispose(): void {
        this.projects.clear();
        super.dispose();
    }
}

// Deprecated: Use WorkspaceCache.getInstance() and ProjectCache.getInstance() instead

// Global extension service instance
let extensionService: any | null = null;

// Get completion limits from configuration - maintained for backward compatibility
function getCompletionLimits(): { maxResults: number, maxAccountResults: number } {
    const config = vscode.workspace.getConfiguration('hledger.autoCompletion');
    return {
        maxResults: config.get<number>('maxResults', 25),
        maxAccountResults: config.get<number>('maxAccountResults', 30)
    };
}

export function getConfig(document: vscode.TextDocument): IHLedgerConfig {
    // Delegate to extension service if available, otherwise fallback to original implementation
    if (extensionService !== null) {
        return extensionService.getConfig(document);
    }
    
    // Fallback implementation for backward compatibility
    const filePath = document.uri.fsPath;
    const projectCacheInstance = ProjectCache.getInstance();
    
    // Try to find existing project for this file
    let projectPath = projectCacheInstance.findProjectForFile(filePath);
    
    if (!projectPath) {
        // If no project found, try to determine project from workspace
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        if (workspaceFolder) {
            projectPath = workspaceFolder.uri.fsPath;
        } else {
            // No workspace, parse only current document
            const config = new ConfigManager() as any;
            config.parseContent(document.getText(), path.dirname(filePath));
            return config;
        }
    }
    
    // Get or initialize project cache
    let cachedConfig = projectCacheInstance.getConfig(projectPath);
    if (!cachedConfig) {
        cachedConfig = projectCacheInstance.initializeProject(projectPath);
    }
    
    // Create a copy of cached config and merge with current document
    const config = new HLedgerConfig() as any;
    
    // Copy data from cache - create a new config instance and merge
    const cachedComponents = (cachedConfig as IComponentContainer).getComponents();
    const configComponents = (config as IComponentContainer).getComponents();
    
    configComponents.dataStore.merge(cachedComponents.dataStore);
    configComponents.usageTracker.merge(cachedComponents.usageTracker);
    
    // Usage counts are already merged via usageTracker.merge() above
    
    // Parse current document to get latest changes
    config.parseContent(document.getText(), path.dirname(filePath));
    
    return config;
}







// Legacy function maintained for backward compatibility
// Theme functionality now handled by ThemeService
async function applyCustomColors(): Promise<void> {
    console.warn('applyCustomColors: This function is deprecated. Theme functionality is now handled by ThemeService.');
}


export function activate(context: vscode.ExtensionContext): void {
    try {
        // Create services with dependency injection
        const services = createServices();
        extensionService = services.extensionService;
        
        // Activate the extension through the service
        extensionService.activate(context);
        
        // Add extension service to disposables for proper cleanup
        context.subscriptions.push({
            dispose: () => {
                if (extensionService) {
                    extensionService.dispose();
                    extensionService = null;
                }
            }
        });
        
    } catch (error) {
        console.error('HLedger extension activation failed:', error);
        // Fall back to basic logging for debugging
        console.log('HLedger extension loaded in degraded mode');
    }
}

export function deactivate(): void {
    try {
        if (extensionService) {
            extensionService.deactivate();
            extensionService.dispose();
            extensionService = null;
        } else {
            // Fallback to original deactivation logic
            SingletonLifecycleManager.onExtensionDeactivated();
            console.log('HLedger extension deactivated, all singletons disposed');
        }
    } catch (error) {
        console.error('HLedger extension deactivation error:', error);
    }
}