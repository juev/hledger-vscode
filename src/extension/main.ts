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
        console.error('Error reading directory:', dir, error);
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
                        // Handle payee|note format as per hledger spec
                        if (description.includes('|')) {
                            const parts = description.split('|');
                            const payee = parts[0].trim();
                            if (payee) {
                                this.payees.add(payee);
                            }
                            // Note part could be added to a notes set if needed
                        } else {
                            // Entire description is treated as payee
                            this.payees.add(description);
                        }
                    }
                    
                    // Extract tags from comment
                    const comment = transactionMatch[5]?.trim();
                    if (comment) {
                        // Look for tags in format: tag:value or #tag
                        const tagMatches = comment.match(/(^|[,\s])([a-zA-Z\u0400-\u04FF][a-zA-Z\u0400-\u04FF0-9_]*):([^\s,;]+)/g);
                        if (tagMatches) {
                            tagMatches.forEach(match => {
                                const tagMatch = match.trim().match(/([a-zA-Z\u0400-\u04FF][a-zA-Z\u0400-\u04FF0-9_]*):(.+)/);
                                if (tagMatch) {
                                    this.tags.add(tagMatch[1]);
                                }
                            });
                        }
                        
                        // Also look for hashtags
                        const hashtagMatches = comment.match(/#([a-zA-Z\u0400-\u04FF][a-zA-Z\u0400-\u04FF0-9_]*)/g);
                        if (hashtagMatches) {
                            hashtagMatches.forEach(match => {
                                this.tags.add(match.substring(1));
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
                // Support balance assertions: = expected_balance, == strict_balance
                const postingMatch = line.match(/^\s+([A-Za-z\u0400-\u04FF][A-Za-z\u0400-\u04FF0-9:_\-\s]*?)(?:\s{2,}([^@=;]+))?(?:\s*@@?\s*[^=;]+)?(?:\s*==?\s*[^;]+)?(?:\s*;(.*))?$/);
                if (postingMatch) {
                    const account = postingMatch[1].trim();
                    this.accounts.add(account);
                    this.usedAccounts.add(account);
                    
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
                                    this.tags.add(tagMatch[1]);
                                }
                            });
                        }
                        
                        // Parse hashtags from posting comments
                        const hashtagMatches = postingComment.match(/#([a-zA-Z\u0400-\u04FF][a-zA-Z\u0400-\u04FF0-9_]*)/g);
                        if (hashtagMatches) {
                            hashtagMatches.forEach(match => {
                                this.tags.add(match.substring(1));
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
    
    scanWorkspace(workspacePath: string): void {
        try {
            console.log('Scanning workspace:', workspacePath);
            const files = findHLedgerFiles(workspacePath, true);
            console.log('Found files:', files);
            
            for (const file of files) {
                console.log('Parsing file:', file);
                this.parseFile(file);
            }
            
            console.log('Total accounts found:', this.accounts.size);
            console.log('Defined accounts:', Array.from(this.definedAccounts));
            console.log('Used accounts:', Array.from(this.usedAccounts));
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
        console.log('Updating workspace cache for:', workspacePath);
        this.workspacePath = workspacePath;
        this.config = new HLedgerConfig();
        this.config.scanWorkspace(workspacePath);
        this.lastUpdate = Date.now();
        console.log('Cache updated with', this.config.accounts.size, 'accounts');
    }
    
    getConfig(): IHLedgerConfig | null {
        return this.config;
    }
    
    invalidate(): void {
        console.log('Cache invalidated');
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
        console.log('Project cache cleared');
    }
}

const workspaceCache = new WorkspaceCache();
const projectCache = new ProjectCache();

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
    
    // Parse current document to get latest changes
    config.parseContent(document.getText(), path.dirname(filePath));
    
    return config;
}

export class KeywordCompletionProvider implements vscode.CompletionItemProvider {
    provideCompletionItems(
        document: vscode.TextDocument, 
        position: vscode.Position
    ): vscode.ProviderResult<vscode.CompletionItem[]> {
        const linePrefix = document.lineAt(position).text.substring(0, position.character);
        
        if (linePrefix.match(/^\s*$/)) {
            return HLEDGER_KEYWORDS.map(keyword => {
                const item = new vscode.CompletionItem(keyword, vscode.CompletionItemKind.Keyword);
                item.detail = 'hledger directive';
                return item;
            });
        }
        
        return undefined;
    }
}

export class AccountCompletionProvider implements vscode.CompletionItemProvider {
    provideCompletionItems(
        document: vscode.TextDocument, 
        position: vscode.Position
    ): vscode.ProviderResult<vscode.CompletionItem[]> {
        const linePrefix = document.lineAt(position).text.substring(0, position.character);
        
        if (linePrefix.match(/^\s+\S*/)) {
            const config = getConfig(document);
            const definedAccounts = config.getDefinedAccounts();
            const usedAccounts = config.getUsedAccounts();
            
            // Extract what user has already typed after spaces
            const accountMatch = linePrefix.match(/^\s+(.*)$/);
            const typedText = accountMatch ? accountMatch[1] : '';
            
            const suggestions: vscode.CompletionItem[] = [];
            
            // Helper function to create completion item with proper text replacement
            const createAccountItem = (
                fullAccount: string, 
                kind: vscode.CompletionItemKind, 
                detail: string, 
                priority: string
            ): vscode.CompletionItem | null => {
                if (fullAccount.toLowerCase().startsWith(typedText.toLowerCase())) {
                    const item = new vscode.CompletionItem(fullAccount, kind);
                    item.detail = detail;
                    item.sortText = priority + '_' + fullAccount;
                    
                    // Set the text to replace - only replace what user typed
                    const range = new vscode.Range(
                        position.line, 
                        position.character - typedText.length,
                        position.line,
                        position.character
                    );
                    item.range = range;
                    item.insertText = fullAccount;
                    
                    return item;
                }
                return null;
            };
            
            // First add defined accounts (from account directives)
            definedAccounts.forEach(acc => {
                const item = createAccountItem(acc, vscode.CompletionItemKind.Class, 'Defined account', '1');
                if (item) suggestions.push(item);
            });
            
            // Then add used accounts (from transactions)
            usedAccounts.forEach(acc => {
                // Avoid duplication with defined accounts
                if (!definedAccounts.includes(acc)) {
                    const item = createAccountItem(acc, vscode.CompletionItemKind.Reference, 'Used account', '2');
                    if (item) suggestions.push(item);
                }
            });
            
            // Finally add standard prefixes
            DEFAULT_ACCOUNT_PREFIXES.forEach(prefix => {
                const item = createAccountItem(prefix, vscode.CompletionItemKind.Folder, 'Default account prefix', '3');
                if (item) suggestions.push(item);
            });
            
            return suggestions;
        }
        
        return undefined;
    }
}

export class CommodityCompletionProvider implements vscode.CompletionItemProvider {
    provideCompletionItems(
        document: vscode.TextDocument, 
        position: vscode.Position
    ): vscode.ProviderResult<vscode.CompletionItem[]> {
        const linePrefix = document.lineAt(position).text.substring(0, position.character);
        
        if (linePrefix.match(/\s+[-+]?\d+([.,]\d+)*\s*$/)) {
            const config = getConfig(document);
            const configCommodities = config.getCommodities();
            
            const suggestions = [
                ...configCommodities.map(comm => {
                    const item = new vscode.CompletionItem(comm, vscode.CompletionItemKind.Unit);
                    item.detail = 'Configured commodity';
                    return item;
                }),
                ...DEFAULT_COMMODITIES.map(comm => {
                    const item = new vscode.CompletionItem(comm, vscode.CompletionItemKind.Unit);
                    item.detail = 'Default commodity';
                    return item;
                })
            ];
            
            return suggestions;
        }
        
        return undefined;
    }
}

export class DateCompletionProvider implements vscode.CompletionItemProvider {
    provideCompletionItems(
        document: vscode.TextDocument, 
        position: vscode.Position
    ): vscode.ProviderResult<vscode.CompletionItem[]> {
        const linePrefix = document.lineAt(position).text.substring(0, position.character);
        
        // Trigger on empty line or partial date input (support all hledger date formats)
        if (linePrefix.match(/^$/) || linePrefix.match(/^\d{0,4}[-/.]?\d{0,2}[-/.]?\d{0,2}$/)) {
            const suggestions: vscode.CompletionItem[] = [];
            
            // Extract what user has typed
            const typedText = linePrefix.trim();
            
            // Helper function to create date completion item
            const createDateItem = (dateStr: string, detail: string, priority: string): vscode.CompletionItem | null => {
                if (dateStr.startsWith(typedText) || typedText === '') {
                    const item = new vscode.CompletionItem(dateStr, vscode.CompletionItemKind.Value);
                    item.detail = detail;
                    item.insertText = dateStr + ' ';
                    item.sortText = priority + '_' + dateStr;
                    
                    // Replace what user typed
                    if (typedText) {
                        const range = new vscode.Range(
                            position.line,
                            position.character - typedText.length,
                            position.line,
                            position.character
                        );
                        item.range = range;
                    }
                    
                    return item;
                }
                return null;
            };
            
            // Get config for last used date
            const config = getConfig(document);
            const lastDate = config.getLastDate();
            
            // Today's date
            const today = new Date();
            const todayStr = today.toISOString().split('T')[0];
            
            // Yesterday's date
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];
            
            // Add last used date first (if available and different from today)
            if (lastDate && lastDate !== todayStr) {
                const item = createDateItem(lastDate, 'Last used date', '0');
                if (item) suggestions.push(item);
            }
            
            // Add today's date
            const todayItem = createDateItem(todayStr, 'Today\'s date', '1');
            if (todayItem) suggestions.push(todayItem);
            
            // Add yesterday's date (if different from last used)
            if (yesterdayStr !== lastDate) {
                const yesterdayItem = createDateItem(yesterdayStr, 'Yesterday\'s date', '2');
                if (yesterdayItem) suggestions.push(yesterdayItem);
            }
            
            return suggestions;
        }
        
        return undefined;
    }
}

export class PayeeCompletionProvider implements vscode.CompletionItemProvider {
    provideCompletionItems(
        document: vscode.TextDocument, 
        position: vscode.Position
    ): vscode.ProviderResult<vscode.CompletionItem[]> {
        const linePrefix = document.lineAt(position).text.substring(0, position.character);
        
        // Trigger after date pattern in transaction lines (support all hledger date formats)
        // Format: DATE [*|!] [CODE] DESCRIPTION
        if (linePrefix.match(/^(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2})\s*(\*|!)?\s*(\([^)]+\))?\s*\S*/)) {
            const config = getConfig(document);
            const payees = config.getPayees();
            
            if (payees.length === 0) {
                return undefined;
            }
            
            // Extract what user has typed (support all hledger date formats)
            const transactionMatch = linePrefix.match(/^(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2})\s*(\*|!)?\s*(\([^)]+\))?\s*(.*)$/);
            const typedText = transactionMatch ? transactionMatch[4] : '';
            
            const suggestions = payees
                .filter(payee => payee.toLowerCase().startsWith(typedText.toLowerCase()))
                .map(payee => {
                    const item = new vscode.CompletionItem(payee, vscode.CompletionItemKind.Value);
                    item.detail = 'Payee/Store';
                    item.sortText = payee;
                    
                    if (typedText) {
                        const range = new vscode.Range(
                            position.line,
                            position.character - typedText.length,
                            position.line,
                            position.character
                        );
                        item.range = range;
                    }
                    
                    return item;
                });
            
            return suggestions;
        }
        
        return undefined;
    }
}

export class TagCompletionProvider implements vscode.CompletionItemProvider {
    provideCompletionItems(
        document: vscode.TextDocument, 
        position: vscode.Position
    ): vscode.ProviderResult<vscode.CompletionItem[]> {
        const linePrefix = document.lineAt(position).text.substring(0, position.character);
        
        // Trigger in comments (after semicolon) when typing tag: or #
        if (linePrefix.match(/;\s*.*([a-zA-Z\u0400-\u04FF][a-zA-Z\u0400-\u04FF0-9_]*)?:?$/) || 
            linePrefix.match(/;\s*.*#([a-zA-Z\u0400-\u04FF][a-zA-Z\u0400-\u04FF0-9_]*)?$/)) {
            
            const config = getConfig(document);
            const tags = config.getTags();
            
            if (tags.length === 0) {
                return undefined;
            }
            
            // Determine if we're in tag:value or #tag format
            const isHashTag = linePrefix.includes('#');
            const tagMatch = linePrefix.match(/([a-zA-Z\u0400-\u04FF][a-zA-Z\u0400-\u04FF0-9_]*)(:?)$/);
            const typedText = tagMatch ? tagMatch[1] : '';
            
            const suggestions = tags
                .filter(tag => tag.toLowerCase().startsWith(typedText.toLowerCase()))
                .map(tag => {
                    const item = new vscode.CompletionItem(tag, vscode.CompletionItemKind.Keyword);
                    item.detail = 'Tag/Category';
                    item.sortText = tag;
                    
                    // Set insert text based on context
                    if (isHashTag) {
                        item.insertText = tag;
                    } else {
                        item.insertText = tag + ':';
                    }
                    
                    if (typedText) {
                        const range = new vscode.Range(
                            position.line,
                            position.character - typedText.length,
                            position.line,
                            position.character
                        );
                        item.range = range;
                    }
                    
                    return item;
                });
            
            return suggestions;
        }
        
        return undefined;
    }
}

export function activate(context: vscode.ExtensionContext): void {
    // No cache invalidation - caches are persistent for better performance
    console.log('HLedger extension activated with persistent caching');

    // Get auto completion setting
    const config = vscode.workspace.getConfiguration('hledger');
    const autoCompletionEnabled = config.get<boolean>('autoCompletion.enabled', true);
    
    // Define trigger characters based on setting
    const triggerChars = autoCompletionEnabled ? [' ', ':', '/', '-', '.', '#', ';'] : [];

    const keywordProvider = vscode.languages.registerCompletionItemProvider(
        'hledger',
        new KeywordCompletionProvider(),
        ...triggerChars
    );

    const accountProvider = vscode.languages.registerCompletionItemProvider(
        'hledger',
        new AccountCompletionProvider(),
        ...triggerChars
    );

    const commodityProvider = vscode.languages.registerCompletionItemProvider(
        'hledger',
        new CommodityCompletionProvider(),
        ...triggerChars
    );

    const dateProvider = vscode.languages.registerCompletionItemProvider(
        'hledger',
        new DateCompletionProvider(),
        ...triggerChars
    );

    const payeeProvider = vscode.languages.registerCompletionItemProvider(
        'hledger',
        new PayeeCompletionProvider(),
        ...triggerChars
    );

    const tagProvider = vscode.languages.registerCompletionItemProvider(
        'hledger',
        new TagCompletionProvider(),
        ...triggerChars
    );

    // Listen for configuration changes and re-register providers
    const configChangeDisposable = vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('hledger.autoCompletion.enabled')) {
            // Restart extension to apply new settings
            vscode.commands.executeCommand('workbench.action.reloadWindow');
        }
    });

    context.subscriptions.push(
        keywordProvider, 
        accountProvider, 
        commodityProvider, 
        dateProvider,
        payeeProvider,
        tagProvider,
        configChangeDisposable
    );
}

export function deactivate(): void {
    // Clean up project caches
    projectCache.clear();
    console.log('HLedger extension deactivated, caches cleared');
}