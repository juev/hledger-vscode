import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { 
    IHLedgerConfig, 
    IWorkspaceCache, 
    IProjectCache,
    HLEDGER_KEYWORDS, 
    DEFAULT_ACCOUNT_PREFIXES, 
    DEFAULT_COMMODITIES 
} from './types';
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

export class HLedgerConfig implements IHLedgerConfig {
    accounts: Set<string> = new Set();
    definedAccounts: Set<string> = new Set();
    usedAccounts: Set<string> = new Set();
    aliases: Map<string, string> = new Map();
    commodities: Set<string> = new Set();
    defaultCommodity: string | null = null;
    lastDate: string | null = null;
    payees: Set<string> = new Set(); // Stores/payees
    tags: Set<string> = new Set();   // Tags/categories
    
    // Usage counters for frequency-based prioritization
    accountUsageCount: Map<string, number> = new Map();
    payeeUsageCount: Map<string, number> = new Map();
    tagUsageCount: Map<string, number> = new Map();
    commodityUsageCount: Map<string, number> = new Map();
    
    parseFile(filePath: string): void {
        try {
            if (!fs.existsSync(filePath)) {
                return;
            }
            
            const content = fs.readFileSync(filePath, 'utf8');
            this.parseContent(content, path.dirname(filePath));
        } catch (error) {
            console.error('Error parsing file:', filePath, error);
        }
    }
    
    parseContent(content: string, basePath: string = ''): void {
        const lines = content.split('\n');
        
        for (const line of lines) {
            const trimmed = line.trim();
            
            // Extract dates from transactions for date completion (keep the most recent)
            // Support all hledger date formats: YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD, MM-DD, MM/DD, MM.DD
            const dateMatch = trimmed.match(/^(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2})/);
            if (dateMatch) {
                this.lastDate = dateMatch[1];
                
                // Extract payee from transaction line
                // Format: DATE [*|!] [CODE] DESCRIPTION [; COMMENT]
                // Support payee|note format as per hledger spec
                const transactionMatch = trimmed.match(/^(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2})\s*(\*|!)?\s*(\([^)]+\))?\s*([^;]+)(?:;(.*))?$/);
                if (transactionMatch) {
                    const description = transactionMatch[4]?.trim();
                    if (description) {
                        // Store entire description as payee, including pipe characters
                        // Do not split on | to support payees like "Store | Branch"
                        this.payees.add(description);
                        // Increment usage count for payee
                        this.payeeUsageCount.set(description, (this.payeeUsageCount.get(description) || 0) + 1);
                    }
                    
                    // Extract tags from comment
                    const comment = transactionMatch[5]?.trim();
                    if (comment) {
                        // Look for tags in format: tag:value
                        const tagMatches = comment.match(/(^|[,\s])([a-zA-Z\u0400-\u04FF][a-zA-Z\u0400-\u04FF0-9_]*):([^\s,;]+)/g);
                        if (tagMatches) {
                            tagMatches.forEach(match => {
                                const tagMatch = match.trim().match(/([a-zA-Z\u0400-\u04FF][a-zA-Z\u0400-\u04FF0-9_]*):(.+)/);
                                if (tagMatch) {
                                    const tag = tagMatch[1];
                                    this.tags.add(tag);
                                    // Increment usage count for tag
                                    this.tagUsageCount.set(tag, (this.tagUsageCount.get(tag) || 0) + 1);
                                }
                            });
                        }
                    }
                }
            }
            
            // Account definitions
            const accountMatch = trimmed.match(/^account\s+([^;]+)/);
            if (accountMatch) {
                const account = accountMatch[1].trim();
                this.accounts.add(account);
                this.definedAccounts.add(account);
                continue;
            }
            
            // Alias definitions
            const aliasMatch = trimmed.match(/^alias\s+([^=]+)\s*=\s*(.+)/);
            if (aliasMatch) {
                const alias = aliasMatch[1].trim();
                const target = aliasMatch[2].trim();
                this.aliases.set(alias, target);
                this.accounts.add(alias);
                this.accounts.add(target);
                continue;
            }
            
            // Commodity definitions
            const commodityMatch = trimmed.match(/^commodity\s+(.+)/);
            if (commodityMatch) {
                const commodity = commodityMatch[1].trim();
                this.commodities.add(commodity);
                continue;
            }
            
            // Default commodity
            const defaultMatch = trimmed.match(/^D\s+(.+)/);
            if (defaultMatch) {
                this.defaultCommodity = defaultMatch[1].trim();
                continue;
            }
            
            // Include files
            const includeMatch = trimmed.match(/^include\s+(.+)/);
            if (includeMatch && basePath) {
                const includePath = includeMatch[1].trim();
                const fullPath = path.resolve(basePath, includePath);
                this.parseFile(fullPath);
                continue;
            }
            
            // Extract accounts from transactions
            if (/^\s+/.test(line)) { // Check that line starts with spaces
                // Parse posting line: ACCOUNT [AMOUNT] [@ PRICE] [= BALANCE_ASSERTION] [; COMMENT]
                // Support cost/price notation: @ unit_price, @@ total_price
                // Support balance assertions: = single commodity balance, == sole commodity balance
                const postingMatch = line.match(/^\s+([A-Za-z\u0400-\u04FF][A-Za-z\u0400-\u04FF0-9:_\-\s]*?)(?:\s{2,}([^@=;]+))?(?:\s*@@?\s*[^=;]+)?(?:\s*==?\s*[^;]+)?(?:\s*;(.*))?$/);
                if (postingMatch) {
                    const account = postingMatch[1].trim();
                    this.accounts.add(account);
                    this.usedAccounts.add(account);
                    // Increment usage count for account
                    this.accountUsageCount.set(account, (this.accountUsageCount.get(account) || 0) + 1);
                    
                    // Extract and count commodities from amount
                    const amount = postingMatch[2]?.trim();
                    if (amount) {
                        // Match commodity symbols (letters, symbols like $, €, etc.)
                        const commodityMatch = amount.match(/([A-Z]{3,}|[^\d\s.,+-]+)/);
                        if (commodityMatch) {
                            const commodity = commodityMatch[1].trim();
                            this.commodities.add(commodity);
                            // Increment usage count for commodity
                            this.commodityUsageCount.set(commodity, (this.commodityUsageCount.get(commodity) || 0) + 1);
                        }
                    }
                    
                    // Parse posting comment for tags including date:
                    const postingComment = postingMatch[3]?.trim();
                    if (postingComment) {
                        // Look for date:DATE tags specifically
                        const dateTagMatch = postingComment.match(/\bdate:(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2})/);
                        if (dateTagMatch) {
                            // Store posting dates for date completion
                            this.lastDate = dateTagMatch[1];
                        }
                        
                        // Parse other tags from posting comments
                        const tagMatches = postingComment.match(/(^|[,\s])([a-zA-Z\u0400-\u04FF][a-zA-Z\u0400-\u04FF0-9_]*):([^\s,;]+)/g);
                        if (tagMatches) {
                            tagMatches.forEach(match => {
                                const tagMatch = match.trim().match(/([a-zA-Z\u0400-\u04FF][a-zA-Z\u0400-\u04FF0-9_]*):(.+)/);
                                if (tagMatch) {
                                    const tag = tagMatch[1];
                                    this.tags.add(tag);
                                    // Increment usage count for tag
                                    this.tagUsageCount.set(tag, (this.tagUsageCount.get(tag) || 0) + 1);
                                }
                            });
                        }
                    }
                }
            }
        }
    }
    
    getAccounts(): string[] {
        return Array.from(this.accounts);
    }
    
    getDefinedAccounts(): string[] {
        return Array.from(this.definedAccounts);
    }
    
    getUsedAccounts(): string[] {
        return Array.from(this.usedAccounts);
    }
    
    getUndefinedAccounts(): string[] {
        return Array.from(this.usedAccounts).filter(acc => !this.definedAccounts.has(acc));
    }
    
    getCommodities(): string[] {
        return Array.from(this.commodities);
    }
    
    getAliases(): Map<string, string> {
        return this.aliases;
    }
    
    getLastDate(): string | null {
        return this.lastDate;
    }
    
    getPayees(): string[] {
        return Array.from(this.payees);
    }
    
    getTags(): string[] {
        return Array.from(this.tags);
    }
    
    // Methods to get sorted lists by usage frequency
    getAccountsByUsage(): Array<{account: string, count: number}> {
        return Array.from(this.accounts).map(account => ({
            account,
            count: this.accountUsageCount.get(account) || 0
        })).sort((a, b) => b.count - a.count);
    }
    
    getPayeesByUsage(): Array<{payee: string, count: number}> {
        return Array.from(this.payees).map(payee => ({
            payee,
            count: this.payeeUsageCount.get(payee) || 0
        })).sort((a, b) => b.count - a.count);
    }
    
    getTagsByUsage(): Array<{tag: string, count: number}> {
        return Array.from(this.tags).map(tag => ({
            tag,
            count: this.tagUsageCount.get(tag) || 0
        })).sort((a, b) => b.count - a.count);
    }
    
    getCommoditiesByUsage(): Array<{commodity: string, count: number}> {
        return Array.from(this.commodities).map(commodity => ({
            commodity,
            count: this.commodityUsageCount.get(commodity) || 0
        })).sort((a, b) => b.count - a.count);
    }
    
    scanWorkspace(workspacePath: string): void {
        try {
            if (process.env.NODE_ENV !== 'test') {
                console.log('Scanning workspace:', workspacePath);
            }
            const files = findHLedgerFiles(workspacePath, true);
            if (process.env.NODE_ENV !== 'test') {
                console.log('Found files:', files);
            }
            
            for (const file of files) {
                if (process.env.NODE_ENV !== 'test') {
                    console.log('Parsing file:', file);
                }
                this.parseFile(file);
            }
            
            if (process.env.NODE_ENV !== 'test') {
                console.log('Total accounts found:', this.accounts.size);
            }
            if (process.env.NODE_ENV !== 'test') {
                console.log('Defined accounts:', Array.from(this.definedAccounts));
            }
            if (process.env.NODE_ENV !== 'test') {
                console.log('Used accounts:', Array.from(this.usedAccounts));
            }
        } catch (error) {
            console.error('Error scanning workspace:', error);
        }
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
        this.config = new HLedgerConfig();
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
        
        const config = new HLedgerConfig();
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
            const config = new HLedgerConfig();
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
    
    // Copy data from cache
    cachedConfig.accounts.forEach(acc => config.accounts.add(acc));
    cachedConfig.definedAccounts.forEach(acc => config.definedAccounts.add(acc));
    cachedConfig.usedAccounts.forEach(acc => config.usedAccounts.add(acc));
    cachedConfig.commodities.forEach(comm => config.commodities.add(comm));
    cachedConfig.payees.forEach(payee => config.payees.add(payee));
    cachedConfig.tags.forEach(tag => config.tags.add(tag));
    config.aliases = new Map(cachedConfig.getAliases());
    config.defaultCommodity = cachedConfig.defaultCommodity;
    config.lastDate = cachedConfig.lastDate;
    
    // Copy usage counts from cache
    cachedConfig.accountUsageCount.forEach((count, account) => 
        config.accountUsageCount.set(account, count));
    cachedConfig.payeeUsageCount.forEach((count, payee) => 
        config.payeeUsageCount.set(payee, count));
    cachedConfig.tagUsageCount.forEach((count, tag) => 
        config.tagUsageCount.set(tag, count));
    cachedConfig.commodityUsageCount.forEach((count, commodity) => 
        config.commodityUsageCount.set(commodity, count));
    
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
    console.log('HLedger extension deactivated, caches cleared');
}