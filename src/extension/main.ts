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
import { IConfigManager as IHLedgerConfig, ConfigManager, getOptimizationManager, OptimizationManager } from './core';
import { HLedgerEnterCommand } from './indentProvider';
import { FuzzyMatcher, FuzzyMatch } from './completion/base/FuzzyMatcher';
import { KeywordCompletionProvider as NewKeywordCompletionProvider } from './completion/providers/KeywordCompletionProvider';
import { AccountCompletionProvider as NewAccountCompletionProvider } from './completion/providers/AccountCompletionProvider';
import { CommodityCompletionProvider as NewCommodityCompletionProvider } from './completion/providers/CommodityCompletionProvider';
import { DateCompletionProvider as NewDateCompletionProvider } from './completion/providers/DateCompletionProvider';
import { PayeeCompletionProvider as NewPayeeCompletionProvider } from './completion/providers/PayeeCompletionProvider';
import { TagCompletionProvider as NewTagCompletionProvider } from './completion/providers/TagCompletionProvider';

// Create a global instance of FuzzyMatcher for backward compatibility
const globalFuzzyMatcher = new FuzzyMatcher();

// Backward-compatible fuzzy match function that uses the new FuzzyMatcher class
export function fuzzyMatch(query: string, items: string[]): FuzzyMatch[] {
    return globalFuzzyMatcher.match(query, items);
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
export class HLedgerConfig extends ConfigManager implements IHLedgerConfig {
    constructor() {
        super();
    }
}

export class WorkspaceCache implements IWorkspaceCache {
    private config: IHLedgerConfig | null = null;
    private lastUpdate: number = 0;
    private workspacePath: string | null = null;
    
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
        this.config = new ConfigManager();
        this.config.scanWorkspace(workspacePath);
        this.lastUpdate = Date.now();
        if (process.env.NODE_ENV !== 'test') {
            console.log('Cache updated with', this.config.accounts.size, 'accounts');
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
}

export class ProjectCache implements IProjectCache {
    private projects: Map<string, IHLedgerConfig> = new Map();
    
    getConfig(projectPath: string): IHLedgerConfig | null {
        return this.projects.get(projectPath) || null;
    }
    
    initialize(projectPath: string): IHLedgerConfig {
        console.log('Initializing project cache for:', projectPath);
        
        const config = new ConfigManager();
        config.scanWorkspace(projectPath);
        
        this.projects.set(projectPath, config);
        console.log(`Project cache initialized with ${config.accounts.size} accounts, ${config.payees.size} payees, ${config.tags.size} tags`);
        
        return config;
    }
    
    hasProject(projectPath: string): boolean {
        return this.projects.has(projectPath);
    }
    
    findProjectForFile(filePath: string): string | null {
        // Find the closest project that contains this file
        const fileDir = path.dirname(filePath);
        
        // First check exact matches
        for (const [projectPath] of this.projects) {
            if (filePath.startsWith(projectPath + path.sep) || filePath === projectPath) {
                return projectPath;
            }
        }
        
        // Check if file is in any parent directory that could be a project
        let currentDir = fileDir;
        while (currentDir !== path.dirname(currentDir)) {
            // Look for hledger files in this directory (non-recursive)
            const hledgerFiles = findHLedgerFiles(currentDir, false);
            if (hledgerFiles.length > 0) {
                return currentDir;
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
}

const workspaceCache = new WorkspaceCache(); // Available for future workspace-level caching features
const projectCache = new ProjectCache();

// Get completion limits from configuration
function getCompletionLimits(): { maxResults: number, maxAccountResults: number } {
    const config = vscode.workspace.getConfiguration('hledger.autoCompletion');
    return {
        maxResults: config.get<number>('maxResults', 25),
        maxAccountResults: config.get<number>('maxAccountResults', 30)
    };
}

export function getConfig(document: vscode.TextDocument): IHLedgerConfig {
    const filePath = document.uri.fsPath;
    
    // Try to find existing project for this file
    let projectPath = projectCache.findProjectForFile(filePath);
    
    if (!projectPath) {
        // If no project found, try to determine project from workspace
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        if (workspaceFolder) {
            projectPath = workspaceFolder.uri.fsPath;
        } else {
            // No workspace, parse only current document
            const config = new ConfigManager();
            config.parseContent(document.getText(), path.dirname(filePath));
            return config;
        }
    }
    
    // Get or initialize project cache
    let cachedConfig = projectCache.getConfig(projectPath);
    if (!cachedConfig) {
        cachedConfig = projectCache.initialize(projectPath);
    }
    
    // Create a copy of cached config and merge with current document
    const config = new HLedgerConfig();
    
    // Copy data from cache - create a new config instance and merge
    const cachedComponents = (cachedConfig as any).getComponents();
    const configComponents = (config as any).getComponents();
    
    configComponents.dataStore.merge(cachedComponents.dataStore);
    configComponents.usageTracker.merge(cachedComponents.usageTracker);
    
    // Usage counts are already merged via usageTracker.merge() above
    
    // Parse current document to get latest changes
    config.parseContent(document.getText(), path.dirname(filePath));
    
    return config;
}







// Function to apply custom color settings without writing to global settings
async function applyCustomColors(): Promise<void> {
    try {
        const hledgerConfig = vscode.workspace.getConfiguration('hledger.colors');
        const editorConfig = vscode.workspace.getConfiguration('editor');
        
        // Get custom colors from settings
        const dateColor = hledgerConfig.get<string>('date', '#2563EB');
        const accountColor = hledgerConfig.get<string>('account', '#059669');
        const amountColor = hledgerConfig.get<string>('amount', '#DC2626');
        const commodityColor = hledgerConfig.get<string>('commodity', '#7C3AED');
        const payeeColor = hledgerConfig.get<string>('payee', '#EA580C');
        const commentColor = hledgerConfig.get<string>('comment', '#6B7280');
        const tagColor = hledgerConfig.get<string>('tag', '#DB2777');
        const directiveColor = hledgerConfig.get<string>('directive', '#059669');
        const accountDefinedColor = hledgerConfig.get<string>('accountDefined', '#0891B2');
        const accountVirtualColor = hledgerConfig.get<string>('accountVirtual', '#6B7280');
        
        // Apply TextMate rules for all syntax highlighting
        const textMateRules = [
            // Date styles
            {
                "scope": "constant.numeric.date.hledger",
                "settings": { 
                    "foreground": dateColor,
                    "fontStyle": "bold"
                }
            },
            // Account styles
            {
                "scope": "entity.name.function.account.hledger",
                "settings": { 
                    "foreground": accountColor
                }
            },
            {
                "scope": "entity.name.function.account.defined.hledger",
                "settings": { 
                    "foreground": accountDefinedColor,
                    "fontStyle": "bold"
                }
            },
            {
                "scope": "entity.name.function.account.virtual.hledger",
                "settings": { 
                    "foreground": accountVirtualColor,
                    "fontStyle": "italic"
                }
            },
            // Special account types
            {
                "scope": "entity.name.function.account.asset.hledger",
                "settings": { 
                    "foreground": accountColor
                }
            },
            {
                "scope": "entity.name.function.account.liability.hledger",
                "settings": { 
                    "foreground": accountColor
                }
            },
            {
                "scope": "entity.name.function.account.equity.hledger",
                "settings": { 
                    "foreground": accountColor
                }
            },
            {
                "scope": "entity.name.function.account.income.hledger",
                "settings": { 
                    "foreground": accountColor
                }
            },
            {
                "scope": "entity.name.function.account.expense.hledger",
                "settings": { 
                    "foreground": accountColor
                }
            },
            // Amount styles
            {
                "scope": "constant.numeric.amount.hledger",
                "settings": { 
                    "foreground": amountColor,
                    "fontStyle": "bold"
                }
            },
            // Commodity styles
            {
                "scope": "entity.name.type.commodity.hledger",
                "settings": { 
                    "foreground": commodityColor,
                    "fontStyle": "bold"
                }
            },
            {
                "scope": "entity.name.type.commodity.defined.hledger",
                "settings": { 
                    "foreground": commodityColor,
                    "fontStyle": "bold"
                }
            },
            {
                "scope": "entity.name.type.commodity.quoted.hledger",
                "settings": { 
                    "foreground": commodityColor,
                    "fontStyle": "bold"
                }
            },
            // Payee styles
            {
                "scope": "entity.name.tag.payee.hledger",
                "settings": { 
                    "foreground": payeeColor
                }
            },
            // Comment styles
            {
                "scope": "comment.line.semicolon.hledger",
                "settings": { 
                    "foreground": commentColor,
                    "fontStyle": "italic"
                }
            },
            {
                "scope": "comment.line.number-sign.hledger",
                "settings": { 
                    "foreground": commentColor,
                    "fontStyle": "italic"
                }
            },
            // Tag styles
            {
                "scope": "entity.name.tag.hledger",
                "settings": { 
                    "foreground": tagColor,
                    "fontStyle": "bold"
                }
            },
            // Directive styles
            {
                "scope": "keyword.directive.hledger",
                "settings": { 
                    "foreground": directiveColor,
                    "fontStyle": "bold"
                }
            },
            // Operator styles
            {
                "scope": "keyword.operator",
                "settings": { 
                    "foreground": directiveColor
                }
            }
        ];
        
        // Update TextMate rules in workspace settings only (not global)
        const currentTextMateCustomizations = editorConfig.get('tokenColorCustomizations') || {};
        
        const updatedTextMateCustomizations = {
            ...currentTextMateCustomizations,
            "[*]": {
                ...((currentTextMateCustomizations as any)["[*]"] || {}),
                "textMateRules": [
                    // Keep existing non-hledger rules
                    ...((currentTextMateCustomizations as any)["[*]"]?.textMateRules || []).filter((rule: any) => 
                        !rule.scope?.includes('.hledger')
                    ),
                    // Add our hledger rules
                    ...textMateRules
                ]
            }
        };
        
        // Apply to workspace settings only (not global)
        await editorConfig.update('tokenColorCustomizations', updatedTextMateCustomizations, vscode.ConfigurationTarget.Workspace);
    } catch (error) {
        console.warn('HLedger: Could not apply custom colors:', error);
    }
}


export function activate(context: vscode.ExtensionContext): void {
    // No cache invalidation - caches are persistent for better performance
    console.log('HLedger extension activated with persistent caching');

    // Initialize optimization manager
    const optimizationManager = getOptimizationManager(context);
    console.log('HLedger optimization manager initialized');
    
    // Apply custom color settings
    applyCustomColors();
    
    // Register command to apply colors
    const applyColorsCommand = vscode.commands.registerCommand('hledger.applyColors', () => {
        applyCustomColors();
        vscode.window.showInformationMessage('HLedger: Applied custom colors');
    });
    context.subscriptions.push(applyColorsCommand);
    
    // Watch for configuration changes and reapply colors
    const configChangeListener = vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('hledger.colors')) {
            applyCustomColors();
        }
    });
    context.subscriptions.push(configChangeListener);

    // Get auto completion setting
    const config = vscode.workspace.getConfiguration('hledger');
    const autoCompletionEnabled = config.get<boolean>('autoCompletion.enabled', true);
    
    // Define trigger characters based on setting - include letters and numbers for auto-trigger
    // Note: Space removed from base triggers to prevent unwanted completions after dates
    const baseTriggerChars = [':', '/', '-', '.', ';'];
    const autoTriggerChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789абвгдеёжзийклмнопрстуфхцчшщъыьэюяАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ'.split('');
    const triggerChars = autoCompletionEnabled ? [...baseTriggerChars, ...autoTriggerChars] : [];
    
    // Special trigger chars for providers that need space
    const triggerCharsWithSpace = autoCompletionEnabled ? [' ', ...baseTriggerChars, ...autoTriggerChars] : [' '];

    const keywordProvider = vscode.languages.registerCompletionItemProvider(
        'hledger',
        new NewKeywordCompletionProvider(),
        ...triggerChars
    );

    const accountProvider = vscode.languages.registerCompletionItemProvider(
        'hledger',
        new NewAccountCompletionProvider(),
        ...triggerCharsWithSpace // Space is needed for account lines
    );

    const commodityProvider = vscode.languages.registerCompletionItemProvider(
        'hledger',
        new NewCommodityCompletionProvider(),
        ...triggerCharsWithSpace // Space is needed after amounts
    );

    const dateProvider = vscode.languages.registerCompletionItemProvider(
        'hledger',
        new NewDateCompletionProvider(),
        ...triggerChars // No space trigger for dates
    );

    const payeeProvider = vscode.languages.registerCompletionItemProvider(
        'hledger',
        new NewPayeeCompletionProvider(),
        ...triggerCharsWithSpace // Space is needed after date
    );

    const tagProvider = vscode.languages.registerCompletionItemProvider(
        'hledger',
        new NewTagCompletionProvider(),
        ...triggerChars // No space trigger for tags
    );


    // Register Enter key handler for smart indentation
    const enterKeyHandler = new HLedgerEnterCommand();

    // Listen for configuration changes and re-register providers
    const configChangeDisposable = vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('hledger.autoCompletion.enabled')) {
            // Restart extension to apply new settings
            vscode.commands.executeCommand('workbench.action.reloadWindow');
        }
        
        // Apply color changes immediately
        if (event.affectsConfiguration('hledger.colors')) {
            applyCustomColors();
        }
    });

    context.subscriptions.push(
        keywordProvider, 
        accountProvider, 
        commodityProvider, 
        dateProvider,
        payeeProvider,
        tagProvider,
        enterKeyHandler,
        configChangeDisposable
    );
}

export function deactivate(): void {
    // Clean up project caches
    projectCache.clear();
    
    // Clean up optimization manager
    const { disposeOptimizationManager } = require('./core');
    disposeOptimizationManager();
    
    console.log('HLedger extension deactivated, caches cleared, optimization manager disposed');
}