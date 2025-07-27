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
import { HLedgerSemanticTokensProvider } from './semanticTokenProvider';
import { HLedgerEnterCommand } from './indentProvider';

// Fuzzy matching score interface
interface FuzzyMatch {
    item: string;
    score: number;
}

// Fuzzy finding algorithm for payees and tags
export function fuzzyMatch(query: string, items: string[]): FuzzyMatch[] {
    if (!query) return items.map(item => ({ item, score: 1 }));
    
    const queryLower = query.toLowerCase();
    const matches: FuzzyMatch[] = [];
    
    for (const item of items) {
        const itemLower = item.toLowerCase();
        let score = 0;
        let queryIndex = 0;
        let matchedChars = 0;
        
        // Calculate fuzzy match score
        for (let i = 0; i < itemLower.length && queryIndex < queryLower.length; i++) {
            if (itemLower[i] === queryLower[queryIndex]) {
                matchedChars++;
                // Higher score for consecutive matches
                score += queryIndex === 0 ? 100 : 50; // First character match gets highest score
                // Bonus for word boundaries
                if (i === 0 || itemLower[i - 1] === ' ' || itemLower[i - 1] === '-' || itemLower[i - 1] === '_') {
                    score += 30;
                }
                queryIndex++;
            }
        }
        
        // Only include items that match all query characters in order
        if (matchedChars === queryLower.length) {
            // Bonus for exact prefix matches
            if (itemLower.startsWith(queryLower)) {
                score += 200;
            }
            // Penalty for longer strings (prefer shorter matches)
            score -= item.length;
            matches.push({ item, score });
        }
    }
    
    // Sort by score (higher score first)
    return matches.sort((a, b) => b.score - a.score);
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
                                    this.tags.add(tagMatch[1]);
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
        
        // Extract what user has typed on the line
        const typedText = linePrefix.trim();
        
        if (linePrefix.match(/^\s*\S*/)) {
            // Use fuzzy matching for keywords
            const fuzzyMatches = fuzzyMatch(typedText, [...HLEDGER_KEYWORDS]);
            
            if (fuzzyMatches.length === 0) {
                return undefined;
            }
            
            return fuzzyMatches.map((match, index) => {
                const item = new vscode.CompletionItem(match.item, vscode.CompletionItemKind.Keyword);
                item.detail = 'hledger directive';
                item.sortText = (1000 - match.score).toString().padStart(4, '0') + '_' + index.toString().padStart(3, '0');
                
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
        
        // Only provide account completions if there's no amount in the line yet
        if (linePrefix.match(/^\s+\S*/) && !linePrefix.match(/\s+[-+]?\d+([.,]\d+)*\s*\S*$/)) {
            const config = getConfig(document);
            const definedAccounts = config.getDefinedAccounts();
            const usedAccounts = config.getUsedAccounts();
            
            // Extract what user has already typed after spaces
            const accountMatch = linePrefix.match(/^\s+(.*)$/);
            const typedText = accountMatch ? accountMatch[1] : '';
            
            // Combine all accounts for fuzzy matching
            const allAccounts: Array<{account: string, kind: vscode.CompletionItemKind, detail: string, priority: number}> = [];
            
            // Add defined accounts
            definedAccounts.forEach(acc => {
                allAccounts.push({
                    account: acc,
                    kind: vscode.CompletionItemKind.Class,
                    detail: 'Defined account',
                    priority: 1
                });
            });
            
            // Add used accounts
            usedAccounts.forEach(acc => {
                if (!definedAccounts.includes(acc)) {
                    allAccounts.push({
                        account: acc,
                        kind: vscode.CompletionItemKind.Reference,
                        detail: 'Used account',
                        priority: 2
                    });
                }
            });
            
            // Add default prefixes
            DEFAULT_ACCOUNT_PREFIXES.forEach(prefix => {
                allAccounts.push({
                    account: prefix,
                    kind: vscode.CompletionItemKind.Folder,
                    detail: 'Default account prefix',
                    priority: 3
                });
            });
            
            // Use fuzzy matching for accounts
            const accountNames = allAccounts.map(a => a.account);
            const fuzzyMatches = fuzzyMatch(typedText, accountNames);
            
            // If no fuzzy matches, return undefined to let other providers handle
            if (fuzzyMatches.length === 0) {
                return undefined;
            }
            
            const suggestions = fuzzyMatches.map((match, index) => {
                const accountInfo = allAccounts.find(a => a.account === match.item)!;
                const item = new vscode.CompletionItem(match.item, accountInfo.kind);
                item.detail = accountInfo.detail;
                
                // Use fuzzy score and priority for sorting
                item.sortText = (1000 - match.score).toString().padStart(4, '0') + '_' + 
                               accountInfo.priority.toString() + '_' + 
                               index.toString().padStart(3, '0');
                
                // Set the text to replace - only replace what user typed
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

export class CommodityCompletionProvider implements vscode.CompletionItemProvider {
    provideCompletionItems(
        document: vscode.TextDocument, 
        position: vscode.Position
    ): vscode.ProviderResult<vscode.CompletionItem[]> {
        const linePrefix = document.lineAt(position).text.substring(0, position.character);
        
        // Match after amount, with optional partial commodity
        const amountMatch = linePrefix.match(/\s+[-+]?\d+([.,]\d+)*\s*(\S*)$/);
        if (amountMatch) {
            const typedText = amountMatch[2] || '';
            const config = getConfig(document);
            const configCommodities = config.getCommodities();
            
            // Combine all commodities for fuzzy matching
            const allCommodities: Array<{commodity: string, detail: string, priority: number}> = [];
            
            configCommodities.forEach(comm => {
                allCommodities.push({
                    commodity: comm,
                    detail: 'Configured commodity',
                    priority: 1
                });
            });
            
            DEFAULT_COMMODITIES.forEach(comm => {
                if (!configCommodities.includes(comm)) {
                    allCommodities.push({
                        commodity: comm,
                        detail: 'Default commodity',
                        priority: 2
                    });
                }
            });
            
            // Use fuzzy matching for commodities
            const commodityNames = allCommodities.map(c => c.commodity);
            const fuzzyMatches = fuzzyMatch(typedText, commodityNames);
            
            if (fuzzyMatches.length === 0) {
                return undefined;
            }
            
            return fuzzyMatches.map((match, index) => {
                const commodityInfo = allCommodities.find(c => c.commodity === match.item)!;
                const item = new vscode.CompletionItem(match.item, vscode.CompletionItemKind.Unit);
                item.detail = commodityInfo.detail;
                item.sortText = (1000 - match.score).toString().padStart(4, '0') + '_' + 
                               commodityInfo.priority.toString() + '_' + 
                               index.toString().padStart(3, '0');
                
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
            
            // Find the most recent date before current position
            const lastTransactionDate = this.findLastTransactionDate(document, position);
            
            // Today's date
            const today = new Date();
            const todayStr = today.toISOString().split('T')[0];
            
            // Yesterday's date
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];
            
            // Add last transaction date first (if available and different from today)
            if (lastTransactionDate && lastTransactionDate !== todayStr) {
                const item = createDateItem(lastTransactionDate, 'Last transaction date', '0');
                if (item) suggestions.push(item);
            }
            
            // Add today's date
            const todayItem = createDateItem(todayStr, 'Today\'s date', '1');
            if (todayItem) suggestions.push(todayItem);
            
            // Add yesterday's date (if different from last transaction)
            if (yesterdayStr !== lastTransactionDate) {
                const yesterdayItem = createDateItem(yesterdayStr, 'Yesterday\'s date', '2');
                if (yesterdayItem) suggestions.push(yesterdayItem);
            }
            
            // Add all previous dates from document
            const allDates = this.getAllPreviousDates(document, position);
            allDates.forEach((date, index) => {
                if (date !== lastTransactionDate && date !== todayStr && date !== yesterdayStr) {
                    const item = createDateItem(date, 'Previous date', '3_' + index.toString().padStart(3, '0'));
                    if (item) suggestions.push(item);
                }
            });
            
            return suggestions;
        }
        
        return undefined;
    }
    
    private findLastTransactionDate(document: vscode.TextDocument, position: vscode.Position): string | null {
        // Search backwards from current position to find the most recent transaction date
        for (let i = position.line - 1; i >= 0; i--) {
            const line = document.lineAt(i);
            const dateMatch = line.text.trim().match(/^(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2})/);
            if (dateMatch) {
                return dateMatch[1];
            }
        }
        return null;
    }
    
    private getAllPreviousDates(document: vscode.TextDocument, position: vscode.Position): string[] {
        const dates: string[] = [];
        const seenDates = new Set<string>();
        
        // Search all lines before current position
        for (let i = position.line - 1; i >= 0; i--) {
            const line = document.lineAt(i);
            const dateMatch = line.text.trim().match(/^(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2})/);
            if (dateMatch && !seenDates.has(dateMatch[1])) {
                dates.push(dateMatch[1]);
                seenDates.add(dateMatch[1]);
            }
        }
        
        return dates;
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
            
            // Use fuzzy matching for payees
            const fuzzyMatches = fuzzyMatch(typedText, payees);
            
            // If no fuzzy matches found, return undefined to let other providers handle it
            if (fuzzyMatches.length === 0) {
                return undefined;
            }
            
            const suggestions = fuzzyMatches.map((match, index) => {
                const item = new vscode.CompletionItem(match.item, vscode.CompletionItemKind.Value);
                item.detail = 'Payee/Store';
                // Use fuzzy score for sorting, with index as tie-breaker
                item.sortText = (1000 - match.score).toString().padStart(4, '0') + '_' + index.toString().padStart(3, '0');
                
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
            
            // Look for tag:value format
            const tagMatch = linePrefix.match(/([a-zA-Z\u0400-\u04FF][a-zA-Z\u0400-\u04FF0-9_]*)(:?)$/);
            const typedText = tagMatch ? tagMatch[1] : '';
            
            // Use fuzzy matching for tags
            const fuzzyMatches = fuzzyMatch(typedText, tags);
            
            const suggestions = fuzzyMatches.map((match, index) => {
                const item = new vscode.CompletionItem(match.item, vscode.CompletionItemKind.Keyword);
                item.detail = 'Tag/Category';
                // Use fuzzy score for sorting, with index as tie-breaker
                item.sortText = (1000 - match.score).toString().padStart(4, '0') + '_' + index.toString().padStart(3, '0');
                
                // Set insert text for tag:value format
                item.insertText = match.item + ':';
                
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

// Function to apply custom color settings
async function applyCustomColors(): Promise<void> {
    try {
        const hledgerConfig = vscode.workspace.getConfiguration('hledger.colors');
        const editorConfig = vscode.workspace.getConfiguration('editor');
        
        // Get custom colors from settings
        const dateColor = hledgerConfig.get<string>('date', '#00D7FF');
        const accountColor = hledgerConfig.get<string>('account', '#FFD700');
        const amountColor = hledgerConfig.get<string>('amount', '#228B22');
        const commodityColor = hledgerConfig.get<string>('commodity', '#FF6B6B');
        const payeeColor = hledgerConfig.get<string>('payee', '#D2691E');
        const commentColor = hledgerConfig.get<string>('comment', '#87CEEB');
        const tagColor = hledgerConfig.get<string>('tag', '#DA70D6');
        const directiveColor = hledgerConfig.get<string>('directive', '#DA70D6');
        const accountDefinedColor = hledgerConfig.get<string>('accountDefined', '#9CDCFE');
        const accountVirtualColor = hledgerConfig.get<string>('accountVirtual', '#A0A0A0');
        
        // Apply semantic token color customizations
        const semanticColors = {
            "[*]": {
                "enabled": true,
                "rules": {
                    "hledgerDate": {
                        "foreground": dateColor,
                        "bold": true
                    },
                    "hledgerAccount": accountColor,
                    "hledgerAmount": {
                        "foreground": amountColor,
                        "bold": true
                    },
                    "hledgerCommodity": {
                        "foreground": commodityColor,
                        "bold": true
                    },
                    "hledgerPayee": payeeColor,
                    "hledgerComment": commentColor,
                    "hledgerTag": {
                        "foreground": tagColor,
                        "bold": true
                    },
                    "hledgerDirective": {
                        "foreground": directiveColor,
                        "bold": true
                    },
                    "hledgerAccount.defined": accountDefinedColor,
                    "hledgerAccount.virtual": accountVirtualColor
                }
            }
        };
        
        // Apply TextMate rules for themes that don't support semantic tokens
        const textMateRules = [
            {
                "scope": "hledgerDate",
                "settings": { 
                    "foreground": dateColor,
                    "fontStyle": "bold"
                }
            },
            {
                "scope": "hledgerAccount",
                "settings": { 
                    "foreground": accountColor,
                    "fontStyle": ""
                }
            },
            {
                "scope": "hledgerAmount",
                "settings": { 
                    "foreground": amountColor,
                    "fontStyle": "bold"
                }
            },
            {
                "scope": "hledgerCommodity",
                "settings": { 
                    "foreground": commodityColor,
                    "fontStyle": "bold"
                }
            },
            {
                "scope": "hledgerPayee",
                "settings": { 
                    "foreground": payeeColor,
                    "fontStyle": ""
                }
            },
            {
                "scope": "hledgerComment",
                "settings": { 
                    "foreground": commentColor,
                    "fontStyle": ""
                }
            },
            {
                "scope": "hledgerTag",
                "settings": { 
                    "foreground": tagColor,
                    "fontStyle": "bold"
                }
            }
        ];
        
        // Update semantic token colors
        await editorConfig.update('semanticTokenColorCustomizations', semanticColors, vscode.ConfigurationTarget.Global);
        
        // Update TextMate rules
        const currentTextMateCustomizations = editorConfig.get('tokenColorCustomizations') || {};
        const updatedTextMateCustomizations = {
            ...currentTextMateCustomizations,
            "[*]": {
                ...((currentTextMateCustomizations as any)["[*]"] || {}),
                "textMateRules": textMateRules
            }
        };
        await editorConfig.update('tokenColorCustomizations', updatedTextMateCustomizations, vscode.ConfigurationTarget.Global);
        
        console.log('HLedger: Applied custom color settings');
    } catch (error) {
        console.warn('HLedger: Could not apply custom colors:', error);
    }
}

// Function to automatically enable semantic highlighting
async function ensureSemanticHighlightingEnabled(): Promise<void> {
    try {
        // Check if auto-enable is enabled in hledger settings
        const hledgerConfig = vscode.workspace.getConfiguration('hledger');
        const autoEnableEnabled = hledgerConfig.get<boolean>('semanticHighlighting.autoEnable', true);
        
        if (!autoEnableEnabled) {
            console.log('HLedger: Auto-enable semantic highlighting is disabled in settings');
            return;
        }

        const config = vscode.workspace.getConfiguration('editor');
        const currentSetting = config.get<boolean>('semanticHighlighting.enabled');
        
        // If semantic highlighting is not explicitly enabled, enable it
        if (currentSetting !== true) {
            await config.update('semanticHighlighting.enabled', true, vscode.ConfigurationTarget.Global);
            console.log('HLedger: Enabled semantic highlighting for better syntax coloring');
            
            // Show info message to user
            vscode.window.showInformationMessage(
                'HLedger: Enabled semantic highlighting for enhanced syntax coloring. You can disable this in extension settings.',
                'Learn More', 'Disable Auto-Enable'
            ).then(selection => {
                if (selection === 'Learn More') {
                    vscode.env.openExternal(vscode.Uri.parse('https://code.visualstudio.com/api/language-extensions/semantic-highlight-guide'));
                } else if (selection === 'Disable Auto-Enable') {
                    hledgerConfig.update('semanticHighlighting.autoEnable', false, vscode.ConfigurationTarget.Global);
                }
            });
        }
        
        // Also ensure it's enabled specifically for hledger files
        const hledgerLangConfig = vscode.workspace.getConfiguration('[hledger]');
        const hledgerSetting = hledgerLangConfig.get<boolean>('editor.semanticHighlighting.enabled');
        if (hledgerSetting !== true) {
            await hledgerLangConfig.update('editor.semanticHighlighting.enabled', true, vscode.ConfigurationTarget.Global);
        }
    } catch (error) {
        console.warn('HLedger: Could not automatically enable semantic highlighting:', error);
    }
}

export function activate(context: vscode.ExtensionContext): void {
    // No cache invalidation - caches are persistent for better performance
    console.log('HLedger extension activated with persistent caching');

    // Automatically enable semantic highlighting for better hledger experience
    ensureSemanticHighlightingEnabled();
    
    // Apply custom color settings
    applyCustomColors();

    // Get auto completion setting
    const config = vscode.workspace.getConfiguration('hledger');
    const autoCompletionEnabled = config.get<boolean>('autoCompletion.enabled', true);
    
    // Define trigger characters based on setting - include letters and numbers for auto-trigger
    const baseTriggerChars = [' ', ':', '/', '-', '.', ';'];
    const autoTriggerChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789абвгдеёжзийклмнопрстуфхцчшщъыьэюяАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ'.split('');
    const triggerChars = autoCompletionEnabled ? [...baseTriggerChars, ...autoTriggerChars] : [];

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

    // Register semantic token provider
    const semanticTokenProvider = vscode.languages.registerDocumentSemanticTokensProvider(
        'hledger',
        new HLedgerSemanticTokensProvider(),
        HLedgerSemanticTokensProvider.getLegend()
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
        semanticTokenProvider,
        enterKeyHandler,
        configChangeDisposable
    );
}

export function deactivate(): void {
    // Clean up project caches
    projectCache.clear();
    console.log('HLedger extension deactivated, caches cleared');
}