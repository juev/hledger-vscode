import * as vscode from 'vscode';
import * as path from 'path';
import { IExtensionService, IConfigService, IThemeService, IProviderService } from './interfaces';
import { IConfigManager as IHLedgerConfig, ConfigManager, OptimizationManager, IComponentContainer } from '../core';
import { createFilePath, createWorkspacePath } from '../core/BrandedTypes';
import { SingletonLifecycleManager } from '../core/SingletonManager';
import { ProjectCache } from '../main'; // Import existing cache classes

/**
 * Main extension service that orchestrates all other services
 * Implements dependency injection and coordinates between all services
 */
export class ExtensionService implements IExtensionService {
    private disposables: vscode.Disposable[] = [];
    private optimizationManager: OptimizationManager | null = null;

    constructor(
        private configService: IConfigService,
        private themeService: IThemeService,
        private providerService: IProviderService
    ) {
        // Dependency injection - all services are injected for testability
    }

    /**
     * Activate the extension
     */
    public activate(context: vscode.ExtensionContext): void {
        try {
            // No cache invalidation - caches are persistent for better performance
            console.log('HLedger extension activated with persistent caching');

            // Notify lifecycle manager that extension is activating
            SingletonLifecycleManager.onExtensionActivated();

            // Initialize optimization manager
            this.optimizationManager = OptimizationManager.getInstance(context);
            console.log('HLedger optimization manager initialized');

            // Start configuration watching
            this.configService.startWatching();

            // Apply custom color settings
            this.themeService.applyCustomColors();

            // Register theme commands
            this.themeService.registerApplyColorsCommand(context);

            // Register completion providers
            this.providerService.registerProviders(context);

            // Register Enter key handler
            this.providerService.registerEnterKeyHandler(context);

            // Setup configuration change watching
            this.setupConfigurationWatching();

            // Setup provider configuration watching
            this.providerService.updateProvidersOnConfigChange();

            // Setup document change watching for real-time tag detection
            this.setupDocumentWatching();

            console.log('HLedger extension services initialized successfully');

        } catch (error) {
            console.error('HLedger extension activation failed:', error);
            // Don't rethrow - let extension load in degraded mode
        }
    }

    /**
     * Deactivate the extension
     */
    public deactivate(): void {
        try {
            // Notify lifecycle manager that extension is deactivating
            // This will properly dispose all managed singletons
            SingletonLifecycleManager.onExtensionDeactivated();

            console.log('HLedger extension deactivated, all singletons disposed');
        } catch (error) {
            console.error('HLedger extension deactivation error:', error);
        }
    }

    /**
     * Get HLedger configuration for a document
     * This maintains backward compatibility with the existing getConfig function
     */
    public getConfig(document: vscode.TextDocument): IHLedgerConfig {
        const filePath = document.uri.fsPath;
        const projectCacheInstance = ProjectCache.getInstance();
        
        // Try to find existing project for this file
        let projectPath = projectCacheInstance.findProjectForFile(createFilePath(filePath));
        
        if (!projectPath) {
            // If no project found, try to determine project from workspace
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
            if (workspaceFolder) {
                projectPath = createWorkspacePath(workspaceFolder.uri.fsPath);
            } else {
                // No workspace, parse only current document
                const config = new ConfigManager() as any;
                config.parseContent(document.getText(), path.dirname(filePath));
                return config;
            }
        }
        
        // Get or initialize project cache
        let cachedConfig = projectCacheInstance.getConfig(projectPath as string);
        if (!cachedConfig) {
            cachedConfig = projectCacheInstance.initializeProject(projectPath as string);
        }
        
        // Create a copy of cached config and merge with current document
        // Using any type as specified in the user's global instructions
        const config = new ConfigManager() as any;
        
        // Copy data from cache - create a new config instance and merge
        const cachedComponents = (cachedConfig as IComponentContainer).getComponents();
        const configComponents = (config as IComponentContainer).getComponents();
        
        configComponents.dataStore.merge(cachedComponents.dataStore);
        configComponents.usageTracker.merge(cachedComponents.usageTracker);
        
        // Parse current document to get latest changes
        config.parseContent(document.getText(), path.dirname(filePath));
        
        return config;
    }

    /**
     * Setup configuration change watching for theme updates
     */
    private setupConfigurationWatching(): void {
        const configChangeListener = this.configService.onDidChangeConfiguration(event => {
            if (this.configService.affectsConfiguration(event, 'hledger.colors')) {
                // Apply color changes immediately
                this.themeService.applyCustomColors();
            }
        });

        this.disposables.push(configChangeListener);
    }

    /**
     * Setup document change watching for real-time tag detection
     */
    private setupDocumentWatching(): void {
        // Watch for text document changes to update tag parsing in real-time
        const documentChangeListener = vscode.workspace.onDidChangeTextDocument(event => {
            const document = event.document;
            
            // Only handle HLedger files
            if (!this.isHLedgerFile(document)) {
                return;
            }

            // Debounce changes to avoid excessive parsing
            if (this.documentChangeTimeout) {
                clearTimeout(this.documentChangeTimeout);
            }
            this.documentChangeTimeout = setTimeout(() => {
                this.updateDocumentCache(document);
            }, 500); // Wait 500ms after last change
        });

        this.disposables.push(documentChangeListener);
    }

    /**
     * Timeout for debouncing document changes
     */
    private documentChangeTimeout: NodeJS.Timeout | null = null;

    /**
     * Check if a document is an HLedger file
     */
    private isHLedgerFile(document: vscode.TextDocument): boolean {
        const fileName = path.basename(document.uri.fsPath).toLowerCase();
        const extension = path.extname(fileName);
        
        return extension === '.journal' || 
               extension === '.hledger' || 
               extension === '.ledger' ||
               fileName === 'journal';
    }

    /**
     * Update the document cache with latest changes
     */
    private updateDocumentCache(document: vscode.TextDocument): void {
        try {
            const filePath = document.uri.fsPath;
            const projectCacheInstance = ProjectCache.getInstance();
            
            // Find project for this file
            let projectPath = projectCacheInstance.findProjectForFile(createFilePath(filePath));
            
            if (!projectPath) {
                const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
                if (workspaceFolder) {
                    projectPath = createWorkspacePath(workspaceFolder.uri.fsPath);
                }
            }

            if (projectPath) {
                // Get the cached config for this project
                let cachedConfig = projectCacheInstance.getConfig(projectPath as string);
                
                if (cachedConfig) {
                    // Parse current document and merge with cache
                    const tempConfig = new ConfigManager();
                    tempConfig.parseContent(document.getText(), path.dirname(filePath));
                    
                    // Merge the new data into the cached config
                    const cachedComponents = (cachedConfig as IComponentContainer).getComponents();
                    const tempComponents = (tempConfig as IComponentContainer).getComponents();
                    
                    // Update cached data with new tags/accounts/etc from current document
                    cachedComponents.dataStore.merge(tempComponents.dataStore);
                    cachedComponents.usageTracker.merge(tempComponents.usageTracker);
                    
                    console.log('Updated document cache for real-time tag detection');
                }
            }
        } catch (error) {
            console.warn('Error updating document cache:', error);
        }
    }

    /**
     * Dispose of resources
     */
    public dispose(): void {
        // Clear document change timeout
        if (this.documentChangeTimeout) {
            clearTimeout(this.documentChangeTimeout);
            this.documentChangeTimeout = null;
        }

        // Stop configuration watching
        this.configService.stopWatching();

        // Dispose all services
        try {
            this.configService.dispose();
        } catch (error) {
            console.warn('ExtensionService: Error disposing ConfigService:', error);
        }

        try {
            this.themeService.dispose();
        } catch (error) {
            console.warn('ExtensionService: Error disposing ThemeService:', error);
        }

        try {
            this.providerService.dispose();
        } catch (error) {
            console.warn('ExtensionService: Error disposing ProviderService:', error);
        }

        // Dispose optimization manager
        if (this.optimizationManager) {
            try {
                this.optimizationManager.dispose();
            } catch (error) {
                console.warn('ExtensionService: Error disposing OptimizationManager:', error);
            }
            this.optimizationManager = null;
        }

        // Dispose all tracked disposables
        for (const disposable of this.disposables) {
            try {
                disposable.dispose();
            } catch (error) {
                console.warn('ExtensionService: Error disposing resource:', error);
            }
        }
        
        this.disposables = [];
    }
}