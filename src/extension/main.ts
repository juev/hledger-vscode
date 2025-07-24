import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';
import { 
    IHLedgerConfig, 
    IWorkspaceCache, 
    HLEDGER_KEYWORDS, 
    DEFAULT_ACCOUNT_PREFIXES, 
    DEFAULT_COMMODITIES 
} from './types';

export class HLedgerConfig implements IHLedgerConfig {
    accounts: Set<string> = new Set();
    definedAccounts: Set<string> = new Set();
    usedAccounts: Set<string> = new Set();
    aliases: Map<string, string> = new Map();
    commodities: Set<string> = new Set();
    defaultCommodity: string | null = null;
    lastDate: string | null = null;
    
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
            const dateMatch = trimmed.match(/^(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2})/);
            if (dateMatch) {
                this.lastDate = dateMatch[1];
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
                const postingMatch = line.match(/^\s+([A-Za-z\u0400-\u04FF][A-Za-z\u0400-\u04FF0-9:_\-\s]*?)(?:\s{2,}|\t|$)/);
                if (postingMatch) {
                    const account = postingMatch[1].trim();
                    this.accounts.add(account);
                    this.usedAccounts.add(account);
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
    
    scanWorkspace(workspacePath: string): void {
        try {
            console.log('Scanning workspace:', workspacePath);
            const patterns = [
                path.join(workspacePath, '**/*.journal'),
                path.join(workspacePath, '**/*.hledger'), 
                path.join(workspacePath, '**/*.ledger')
            ];
            
            for (const pattern of patterns) {
                console.log('Checking pattern:', pattern);
                const files = glob.sync(pattern, { ignore: '**/node_modules/**' });
                console.log('Found files:', files);
                for (const file of files) {
                    console.log('Parsing file:', file);
                    this.parseFile(file);
                }
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

const workspaceCache = new WorkspaceCache();

export function getConfig(document: vscode.TextDocument): IHLedgerConfig {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (!workspaceFolder) {
        // If no workspace, parse only current document
        const config = new HLedgerConfig();
        config.parseContent(document.getText(), path.dirname(document.uri.fsPath));
        return config;
    }
    
    const workspacePath = workspaceFolder.uri.fsPath;
    
    // Check cache
    if (!workspaceCache.isValid(workspacePath)) {
        workspaceCache.update(workspacePath);
    }
    
    // Get cached configuration and add current document
    const cachedConfig = workspaceCache.getConfig();
    if (!cachedConfig) {
        throw new Error('Failed to get cached configuration');
    }
    
    const config = new HLedgerConfig();
    
    // Copy data from cache
    cachedConfig.accounts.forEach(acc => config.accounts.add(acc));
    cachedConfig.definedAccounts.forEach(acc => config.definedAccounts.add(acc));
    cachedConfig.usedAccounts.forEach(acc => config.usedAccounts.add(acc));
    cachedConfig.commodities.forEach(comm => config.commodities.add(comm));
    config.aliases = new Map(cachedConfig.getAliases());
    config.defaultCommodity = cachedConfig.defaultCommodity;
    config.lastDate = cachedConfig.lastDate;
    
    // Parse current document to get latest changes
    config.parseContent(document.getText(), path.dirname(document.uri.fsPath));
    
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
        
        // Trigger on empty line or partial date input
        if (linePrefix.match(/^$/) || linePrefix.match(/^\d{0,4}[-/]?\d{0,2}[-/]?\d{0,2}$/)) {
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

export function activate(context: vscode.ExtensionContext): void {
    // Event handlers for cache invalidation
    const onDidOpenTextDocument = vscode.workspace.onDidOpenTextDocument(document => {
        if (document.languageId === 'hledger') {
            console.log('HLedger file opened, invalidating cache');
            workspaceCache.invalidate();
        }
    });
    
    const onDidSaveTextDocument = vscode.workspace.onDidSaveTextDocument(document => {
        if (document.languageId === 'hledger') {
            // Only invalidate cache on explicit save (not auto-save)
            // Check if this is an explicit save by checking if the document is dirty after save
            if (!document.isDirty) {
                console.log('HLedger file explicitly saved, invalidating cache');
                workspaceCache.invalidate();
            }
        }
    });

    const keywordProvider = vscode.languages.registerCompletionItemProvider(
        'hledger',
        new KeywordCompletionProvider()
    );

    const accountProvider = vscode.languages.registerCompletionItemProvider(
        'hledger',
        new AccountCompletionProvider()
    );

    const commodityProvider = vscode.languages.registerCompletionItemProvider(
        'hledger',
        new CommodityCompletionProvider()
    );

    const dateProvider = vscode.languages.registerCompletionItemProvider(
        'hledger',
        new DateCompletionProvider()
    );

    context.subscriptions.push(
        keywordProvider, 
        accountProvider, 
        commodityProvider, 
        dateProvider,
        onDidOpenTextDocument,
        onDidSaveTextDocument
    );
}

export function deactivate(): void {
    // Clean up if needed
}