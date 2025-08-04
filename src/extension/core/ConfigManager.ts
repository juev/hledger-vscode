import { IConfigManager, IHLedgerParser, IDataStore, IUsageTracker, IFileScanner } from './interfaces';
import { HLedgerParser } from './HLedgerParser';
import { DataStore } from './DataStore';
import { UsageTracker } from './UsageTracker';
import { FileScanner } from './FileScanner';

/**
 * Main configuration manager that coordinates all HLedger components
 * Replaces the old HLedgerConfig class with proper separation of concerns
 */
export class ConfigManager implements IConfigManager {
    private readonly parser: IHLedgerParser;
    private readonly dataStore: IDataStore;
    private readonly usageTracker: IUsageTracker;
    private readonly fileScanner: IFileScanner;
    
    constructor(
        parser?: IHLedgerParser,
        dataStore?: IDataStore,
        usageTracker?: IUsageTracker,
        fileScanner?: IFileScanner
    ) {
        // Use dependency injection for better testability
        this.parser = parser || new HLedgerParser();
        this.dataStore = dataStore || new DataStore();
        this.usageTracker = usageTracker || new UsageTracker();
        this.fileScanner = fileScanner || new FileScanner();
    }
    
    // === File Operations ===
    
    /**
     * Parse a file and update internal state
     */
    parseFile(filePath: string): void {
        const parsedData = this.parser.parseFile(filePath);
        this.updateFromParsedData(parsedData);
    }
    
    /**
     * Parse content and update internal state
     */
    parseContent(content: string, basePath?: string): void {
        const parsedData = this.parser.parseContent(content, basePath);
        this.updateFromParsedData(parsedData);
    }
    
    /**
     * Scan workspace for files and parse them
     */
    scanWorkspace(workspacePath: string): void {
        try {
            if (process.env.NODE_ENV !== 'test') {
                console.log('ConfigManager: Scanning workspace:', workspacePath);
            }
            
            const files = this.fileScanner.scanWorkspace(workspacePath);
            
            if (process.env.NODE_ENV !== 'test') {
                console.log('ConfigManager: Found files:', files);
            }
            
            for (const file of files) {
                if (process.env.NODE_ENV !== 'test') {
                    console.log('ConfigManager: Parsing file:', file);
                }
                this.parseFile(file);
            }
            
            if (process.env.NODE_ENV !== 'test') {
                console.log('ConfigManager: Total accounts found:', this.dataStore.getAccounts().length);
                console.log('ConfigManager: Defined accounts:', this.dataStore.getDefinedAccounts());
                console.log('ConfigManager: Used accounts:', this.dataStore.getUsedAccounts());
            }
        } catch (error) {
            console.error('ConfigManager: Error scanning workspace:', error);
        }
    }
    
    // === Data Access Methods ===
    
    getAccounts(): string[] {
        return this.dataStore.getAccounts();
    }
    
    getDefinedAccounts(): string[] {
        return this.dataStore.getDefinedAccounts();
    }
    
    getUsedAccounts(): string[] {
        return this.dataStore.getUsedAccounts();
    }
    
    getUndefinedAccounts(): string[] {
        return this.dataStore.getUndefinedAccounts();
    }
    
    getPayees(): string[] {
        return this.dataStore.getPayees();
    }
    
    getTags(): string[] {
        return this.dataStore.getTags();
    }
    
    getCommodities(): string[] {
        return this.dataStore.getCommodities();
    }
    
    getAliases(): Map<string, string> {
        return this.dataStore.getAliases();
    }
    
    getDefaultCommodity(): string | null {
        return this.dataStore.getDefaultCommodity();
    }
    
    getLastDate(): string | null {
        return this.dataStore.getLastDate();
    }
    
    // === Usage-Based Methods ===
    
    getAccountsByUsage(): Array<{account: string, count: number}> {
        const accounts = this.dataStore.getAccounts();
        return accounts.map(account => ({
            account,
            count: this.usageTracker.getAccountUsage(account)
        })).sort((a: {account: string, count: number}, b: {account: string, count: number}) => b.count - a.count);
    }
    
    getPayeesByUsage(): Array<{payee: string, count: number}> {
        const payees = this.dataStore.getPayees();
        return payees.map(payee => ({
            payee,
            count: this.usageTracker.getPayeeUsage(payee)
        })).sort((a: {payee: string, count: number}, b: {payee: string, count: number}) => b.count - a.count);
    }
    
    getTagsByUsage(): Array<{tag: string, count: number}> {
        const tags = this.dataStore.getTags();
        return tags.map(tag => ({
            tag,
            count: this.usageTracker.getTagUsage(tag)
        })).sort((a: {tag: string, count: number}, b: {tag: string, count: number}) => b.count - a.count);
    }
    
    getCommoditiesByUsage(): Array<{commodity: string, count: number}> {
        const commodities = this.dataStore.getCommodities();
        return commodities.map(commodity => ({
            commodity,
            count: this.usageTracker.getCommodityUsage(commodity)
        })).sort((a: {commodity: string, count: number}, b: {commodity: string, count: number}) => b.count - a.count);
    }
    
    // === Legacy Properties (for backward compatibility) ===
    
    /** @deprecated Use getAccounts() instead */
    get accounts(): Set<string> {
        return (this.dataStore as any).accounts;
    }
    
    /** @deprecated Use getDefinedAccounts() instead */
    get definedAccounts(): Set<string> {
        return (this.dataStore as any).definedAccounts;
    }
    
    /** @deprecated Use getUsedAccounts() instead */
    get usedAccounts(): Set<string> {
        return (this.dataStore as any).usedAccounts;
    }
    
    /** @deprecated Use getPayees() instead */
    get payees(): Set<string> {
        return (this.dataStore as any).payees;
    }
    
    /** @deprecated Use getTags() instead */
    get tags(): Set<string> {
        return (this.dataStore as any).tags;
    }
    
    /** @deprecated Use getCommodities() instead */
    get commodities(): Set<string> {
        return (this.dataStore as any).commodities;
    }
    
    /** @deprecated Use getAliases() instead */
    get aliases(): Map<string, string> {
        return (this.dataStore as any).aliases;
    }
    
    /** @deprecated Use getDefaultCommodity() instead */
    get defaultCommodity(): string | null {
        return (this.dataStore as any).defaultCommodity;
    }
    
    /** @deprecated Use getLastDate() instead */
    get lastDate(): string | null {
        return (this.dataStore as any).lastDate;
    }
    
    /** @deprecated Internal usage tracking - use getAccountsByUsage() instead */
    get accountUsageCount(): Map<string, number> {
        return (this.usageTracker as any).accountUsageCount;
    }
    
    /** @deprecated Internal usage tracking - use getPayeesByUsage() instead */
    get payeeUsageCount(): Map<string, number> {
        return (this.usageTracker as any).payeeUsageCount;
    }
    
    /** @deprecated Internal usage tracking - use getTagsByUsage() instead */
    get tagUsageCount(): Map<string, number> {
        return (this.usageTracker as any).tagUsageCount;
    }
    
    /** @deprecated Internal usage tracking - use getCommoditiesByUsage() instead */
    get commodityUsageCount(): Map<string, number> {
        return (this.usageTracker as any).commodityUsageCount;
    }
    
    // === Utility Methods ===
    
    /**
     * Clear all data
     */
    clear(): void {
        this.dataStore.clear();
        this.usageTracker.clear();
    }
    
    /**
     * Merge data from another ConfigManager
     */
    merge(other: ConfigManager): void {
        this.dataStore.merge(other.dataStore);
        this.usageTracker.merge(other.usageTracker);
    }
    
    /**
     * Get internal components (for testing or advanced usage)
     */
    getComponents() {
        return {
            parser: this.parser,
            dataStore: this.dataStore,
            usageTracker: this.usageTracker,
            fileScanner: this.fileScanner
        };
    }
    
    // === Private Helper Methods ===
    
    /**
     * Update internal state from parsed data
     */
    private updateFromParsedData(parsedData: any): void {
        // Update data store
        parsedData.accounts.forEach((account: string) => this.dataStore.addAccount(account));
        parsedData.definedAccounts.forEach((account: string) => this.dataStore.addDefinedAccount(account));
        parsedData.usedAccounts.forEach((account: string) => this.dataStore.addUsedAccount(account));
        parsedData.payees.forEach((payee: string) => this.dataStore.addPayee(payee));
        parsedData.tags.forEach((tag: string) => this.dataStore.addTag(tag));
        parsedData.commodities.forEach((commodity: string) => this.dataStore.addCommodity(commodity));
        
        // Update aliases
        parsedData.aliases.forEach((target: string, alias: string) => {
            this.dataStore.setAlias(alias, target);
        });
        
        // Update scalar values
        if (parsedData.defaultCommodity) {
            this.dataStore.setDefaultCommodity(parsedData.defaultCommodity);
        }
        if (parsedData.lastDate) {
            this.dataStore.setLastDate(parsedData.lastDate);
        }
        
        // Update usage tracking
        parsedData.accountUsage.forEach((count: number, account: string) => {
            for (let i = 0; i < count; i++) {
                this.usageTracker.incrementAccountUsage(account);
            }
        });
        parsedData.payeeUsage.forEach((count: number, payee: string) => {
            for (let i = 0; i < count; i++) {
                this.usageTracker.incrementPayeeUsage(payee);
            }
        });
        parsedData.tagUsage.forEach((count: number, tag: string) => {
            for (let i = 0; i < count; i++) {
                this.usageTracker.incrementTagUsage(tag);
            }
        });
        parsedData.commodityUsage.forEach((count: number, commodity: string) => {
            for (let i = 0; i < count; i++) {
                this.usageTracker.incrementCommodityUsage(commodity);
            }
        });
    }
}