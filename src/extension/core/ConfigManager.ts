import { IConfigManager, IHLedgerParser, IDataStore, IUsageTracker, IFileScanner, IConfigManagerComponents, IDataStoreInternal, IUsageTrackerInternal } from './interfaces';
import { HLedgerParser } from './HLedgerParser';
import { DataStore } from './DataStore';
import { UsageTracker } from './UsageTracker';
import { FileScanner } from './FileScanner';
import { 
    createAccountName, 
    createPayeeName, 
    createTagEntry, 
    createCommodityName, 
    createAccountAlias,
    createFilePath,
    createWorkspacePath,
    AccountName,
    PayeeName,
    TagEntry,
    CommodityName,
    AccountAlias,
    DateString,
    WorkspacePath,
    FilePath,
    unbranded
} from './BrandedTypes';

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
        const parsedData = this.parser.parseFile(createFilePath(filePath));
        this.updateFromParsedData(parsedData);
    }
    
    /**
     * Parse content and update internal state
     */
    parseContent(content: string, basePath?: string): void {
        const parsedData = this.parser.parseContent(content, (basePath && basePath.trim() && basePath.trim().length > 0) ? createFilePath(basePath) : undefined);
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
            
            const files = this.fileScanner.scanWorkspace(createWorkspacePath(workspacePath));
            
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
    
    getAccounts(): AccountName[] {
        return this.dataStore.getAccounts();
    }
    
    getDefinedAccounts(): AccountName[] {
        return this.dataStore.getDefinedAccounts();
    }
    
    getUsedAccounts(): AccountName[] {
        return this.dataStore.getUsedAccounts();
    }
    
    getUndefinedAccounts(): AccountName[] {
        return this.dataStore.getUndefinedAccounts();
    }
    
    getPayees(): PayeeName[] {
        return this.dataStore.getPayees();
    }
    
    getTags(): TagEntry[] {
        return this.dataStore.getTags();
    }
    
    getCommodities(): CommodityName[] {
        return this.dataStore.getCommodities();
    }
    
    getAliases(): Map<AccountAlias, AccountName> {
        return this.dataStore.getAliases();
    }
    
    getDefaultCommodity(): CommodityName | null {
        return this.dataStore.getDefaultCommodity();
    }
    
    getLastDate(): DateString | null {
        return this.dataStore.getLastDate();
    }
    
    // === Usage-Based Methods ===
    
    getAccountsByUsage(): Array<{account: AccountName, count: number}> {
        const accounts = this.dataStore.getAccounts();
        return accounts.map(account => ({
            account,
            count: this.usageTracker.getAccountUsage(account)
        })).sort((a: {account: AccountName, count: number}, b: {account: AccountName, count: number}) => b.count - a.count);
    }
    
    getPayeesByUsage(): Array<{payee: PayeeName, count: number}> {
        const payees = this.dataStore.getPayees();
        return payees.map(payee => ({
            payee,
            count: this.usageTracker.getPayeeUsage(payee)
        })).sort((a: {payee: PayeeName, count: number}, b: {payee: PayeeName, count: number}) => b.count - a.count);
    }
    
    getTagsByUsage(): Array<{tag: TagEntry, count: number}> {
        const tags = this.dataStore.getTags();
        return tags.map(tag => ({
            tag,
            count: this.usageTracker.getTagUsage(tag)
        })).sort((a: {tag: TagEntry, count: number}, b: {tag: TagEntry, count: number}) => b.count - a.count);
    }
    
    getCommoditiesByUsage(): Array<{commodity: CommodityName, count: number}> {
        const commodities = this.dataStore.getCommodities();
        return commodities.map(commodity => ({
            commodity,
            count: this.usageTracker.getCommodityUsage(commodity)
        })).sort((a: {commodity: CommodityName, count: number}, b: {commodity: CommodityName, count: number}) => b.count - a.count);
    }
    
    // === Legacy Properties (for backward compatibility) ===
    
    /** @deprecated Use getAccounts() instead */
    get accounts(): Set<AccountName> {
        return (this.dataStore as IDataStoreInternal).accounts;
    }
    
    /** @deprecated Use getDefinedAccounts() instead */
    get definedAccounts(): Set<AccountName> {
        return (this.dataStore as IDataStoreInternal).definedAccounts;
    }
    
    /** @deprecated Use getUsedAccounts() instead */
    get usedAccounts(): Set<AccountName> {
        return (this.dataStore as IDataStoreInternal).usedAccounts;
    }
    
    /** @deprecated Use getPayees() instead */
    get payees(): Set<PayeeName> {
        return (this.dataStore as IDataStoreInternal).payees;
    }
    
    /** @deprecated Use getTags() instead */
    get tags(): Set<TagEntry> {
        return (this.dataStore as IDataStoreInternal).tags;
    }
    
    /** @deprecated Use getCommodities() instead */
    get commodities(): Set<CommodityName> {
        return (this.dataStore as IDataStoreInternal).commodities;
    }
    
    /** @deprecated Use getAliases() instead */
    get aliases(): Map<AccountAlias, AccountName> {
        return (this.dataStore as IDataStoreInternal).aliases;
    }
    
    /** @deprecated Use getDefaultCommodity() instead */
    get defaultCommodity(): CommodityName | null {
        return (this.dataStore as IDataStoreInternal).defaultCommodity;
    }
    
    /** @deprecated Use getLastDate() instead */
    get lastDate(): DateString | null {
        return (this.dataStore as IDataStoreInternal).lastDate;
    }
    
    /** @deprecated Internal usage tracking - use getAccountsByUsage() instead */
    get accountUsageCount(): Map<AccountName, number> {
        return (this.usageTracker as IUsageTrackerInternal).accountUsageCount;
    }
    
    /** @deprecated Internal usage tracking - use getPayeesByUsage() instead */
    get payeeUsageCount(): Map<PayeeName, number> {
        return (this.usageTracker as IUsageTrackerInternal).payeeUsageCount;
    }
    
    /** @deprecated Internal usage tracking - use getTagsByUsage() instead */
    get tagUsageCount(): Map<TagEntry, number> {
        return (this.usageTracker as IUsageTrackerInternal).tagUsageCount;
    }
    
    /** @deprecated Internal usage tracking - use getCommoditiesByUsage() instead */
    get commodityUsageCount(): Map<CommodityName, number> {
        return (this.usageTracker as IUsageTrackerInternal).commodityUsageCount;
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
    getComponents(): IConfigManagerComponents {
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
        parsedData.accounts.forEach((account: string) => this.dataStore.addAccount(createAccountName(account)));
        parsedData.definedAccounts.forEach((account: string) => this.dataStore.addDefinedAccount(createAccountName(account)));
        parsedData.usedAccounts.forEach((account: string) => this.dataStore.addUsedAccount(createAccountName(account)));
        parsedData.payees.forEach((payee: string) => this.dataStore.addPayee(createPayeeName(payee)));
        parsedData.tags.forEach((tag: string) => this.dataStore.addTag(createTagEntry(tag)));
        parsedData.commodities.forEach((commodity: string) => this.dataStore.addCommodity(createCommodityName(commodity)));
        
        // Update aliases
        parsedData.aliases.forEach((target: string, alias: string) => {
            this.dataStore.setAlias(createAccountAlias(alias), createAccountName(target));
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
                this.usageTracker.incrementAccountUsage(createAccountName(account));
            }
        });
        parsedData.payeeUsage.forEach((count: number, payee: string) => {
            for (let i = 0; i < count; i++) {
                this.usageTracker.incrementPayeeUsage(createPayeeName(payee));
            }
        });
        parsedData.tagUsage.forEach((count: number, tag: string) => {
            for (let i = 0; i < count; i++) {
                this.usageTracker.incrementTagUsage(createTagEntry(tag));
            }
        });
        parsedData.commodityUsage.forEach((count: number, commodity: string) => {
            for (let i = 0; i < count; i++) {
                this.usageTracker.incrementCommodityUsage(createCommodityName(commodity));
            }
        });
    }
}