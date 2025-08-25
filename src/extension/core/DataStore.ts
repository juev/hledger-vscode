import { IDataStore } from './interfaces';
import {
    AccountName,
    PayeeName,
    CommodityName,
    TagEntry,
    DateString,
    AccountAlias,
    unbranded
} from './BrandedTypes';

/**
 * In-memory data store for HLedger parsed data
 * Responsible for storing and retrieving all parsed information
 */
export class DataStore implements IDataStore {
    private _accounts: Set<AccountName> = new Set();
    private _definedAccounts: Set<AccountName> = new Set();
    private _usedAccounts: Set<AccountName> = new Set();
    private _payees: Set<PayeeName> = new Set();
    private _tags: Set<TagEntry> = new Set();
    private _tagValues: Map<string, Set<string>> = new Map();
    private _commodities: Set<CommodityName> = new Set();
    private _aliases: Map<AccountAlias, AccountName> = new Map();
    private _defaultCommodity: CommodityName | null = null;
    private _lastDate: DateString | null = null;
    
    // === Data Management ===
    
    /**
     * Add an account to the store
     */
    addAccount(account: AccountName): void {
        this._accounts.add(account);
    }
    
    /**
     * Add a defined account (from account directive)
     */
    addDefinedAccount(account: AccountName): void {
        this._definedAccounts.add(account);
        this._accounts.add(account); // Also add to main accounts set
    }
    
    /**
     * Add a used account (from transactions)
     */
    addUsedAccount(account: AccountName): void {
        this._usedAccounts.add(account);
        this._accounts.add(account); // Also add to main accounts set
    }
    
    /**
     * Add a payee to the store
     */
    addPayee(payee: PayeeName): void {
        this._payees.add(payee);
    }
    
    /**
     * Add a tag to the store
     */
    addTag(tag: TagEntry): void {
        this._tags.add(tag);
    }
    
    /**
     * Add a commodity to the store
     */
    addCommodity(commodity: CommodityName): void {
        this._commodities.add(commodity);
    }
    
    /**
     * Set an account alias
     */
    setAlias(alias: AccountAlias, target: AccountName): void {
        this._aliases.set(alias, target);
        this.addAccount(target); // Only add the target account to accounts set
    }
    
    /**
     * Set the default commodity
     */
    setDefaultCommodity(commodity: CommodityName): void {
        this._defaultCommodity = commodity;
    }
    
    /**
     * Set the last transaction date
     */
    setLastDate(date: DateString): void {
        this._lastDate = date;
    }
    
    // === Data Retrieval ===
    
    /**
     * Get all accounts (defined + used)
     */
    getAccounts(): AccountName[] {
        return Array.from(this._accounts);
    }
    
    /**
     * Get only defined accounts
     */
    getDefinedAccounts(): AccountName[] {
        return Array.from(this._definedAccounts);
    }
    
    /**
     * Get only used accounts
     */
    getUsedAccounts(): AccountName[] {
        return Array.from(this._usedAccounts);
    }
    
    /**
     * Get undefined accounts (used but not defined)
     */
    getUndefinedAccounts(): AccountName[] {
        return Array.from(this._usedAccounts).filter(acc => !this._definedAccounts.has(acc));
    }
    
    /**
     * Get all payees
     */
    getPayees(): PayeeName[] {
        return Array.from(this._payees);
    }
    
    /**
     * Get all tags
     */
    getTags(): TagEntry[] {
        return Array.from(this._tags);
    }
    
    /**
     * Get all commodities
     */
    getCommodities(): CommodityName[] {
        return Array.from(this._commodities);
    }
    
    /**
     * Get all aliases as a Map
     */
    getAliases(): Map<AccountAlias, AccountName> {
        return new Map(this._aliases); // Return a copy to prevent external modification
    }
    
    /**
     * Get the default commodity
     */
    getDefaultCommodity(): CommodityName | null {
        return this._defaultCommodity;
    }
    
    /**
     * Get the last transaction date
     */
    getLastDate(): DateString | null {
        return this._lastDate;
    }
    
    // === Tag Value Methods ===
    
    /**
     * Get tag values for a specific tag name
     */
    getTagValues(tagName: string): string[] {
        const values = this._tagValues.get(tagName);
        return values ? Array.from(values) : [];
    }
    
    /**
     * Add a tag value for a specific tag name
     */
    addTagValue(tagName: string, value: string): void {
        if (!this._tagValues.has(tagName)) {
            this._tagValues.set(tagName, new Set());
        }
        this._tagValues.get(tagName)!.add(value);
    }
    
    // === Utility ===
    
    /**
     * Clear all stored data
     */
    clear(): void {
        this._accounts.clear();
        this._definedAccounts.clear();
        this._usedAccounts.clear();
        this._payees.clear();
        this._tags.clear();
        this._tagValues.clear();
        this._commodities.clear();
        this._aliases.clear();
        this._defaultCommodity = null;
        this._lastDate = null;
    }
    
    /**
     * Merge data from another data store
     */
    merge(other: IDataStore): void {
        // Merge accounts
        other.getAccounts().forEach(account => this.addAccount(account));
        other.getDefinedAccounts().forEach(account => this.addDefinedAccount(account));
        other.getUsedAccounts().forEach(account => this.addUsedAccount(account));
        
        // Merge other data
        other.getPayees().forEach(payee => this.addPayee(payee));
        other.getTags().forEach(tag => this.addTag(tag));
        
        // Merge tag values
        other.getTags().forEach(tag => {
            const tagName = unbranded(tag);
            const values = other.getTagValues(tagName);
            values.forEach(value => this.addTagValue(tagName, value));
        });
        
        other.getCommodities().forEach(commodity => this.addCommodity(commodity));
        
        // Merge aliases
        other.getAliases().forEach((target, alias) => this.setAlias(alias, target));
        
        // Update scalar values (keep latest if they exist)
        const otherDefaultCommodity = other.getDefaultCommodity();
        if (otherDefaultCommodity) {
            this.setDefaultCommodity(otherDefaultCommodity);
        }
        
        const otherLastDate = other.getLastDate();
        if (otherLastDate) {
            this.setLastDate(otherLastDate);
        }
    }
    
    // === Getters for Direct Property Access (for backward compatibility) ===
    
    /**
     * Get accounts set (read-only)
     * @deprecated Use getAccounts() method instead
     */
    get accounts(): Set<AccountName> {
        return new Set(this._accounts); // Return copy to prevent modification
    }
    
    /**
     * Get defined accounts set (read-only)
     * @deprecated Use getDefinedAccounts() method instead
     */
    get definedAccounts(): Set<AccountName> {
        return new Set(this._definedAccounts);
    }
    
    /**
     * Get used accounts set (read-only)
     * @deprecated Use getUsedAccounts() method instead
     */
    get usedAccounts(): Set<AccountName> {
        return new Set(this._usedAccounts);
    }
    
    /**
     * Get payees set (read-only)
     * @deprecated Use getPayees() method instead
     */
    get payees(): Set<PayeeName> {
        return new Set(this._payees);
    }
    
    /**
     * Get tags set (read-only)
     * @deprecated Use getTags() method instead
     */
    get tags(): Set<TagEntry> {
        return new Set(this._tags);
    }
    
    /**
     * Get commodities set (read-only)
     * @deprecated Use getCommodities() method instead
     */
    get commodities(): Set<CommodityName> {
        return new Set(this._commodities);
    }
    
    /**
     * Get aliases map (read-only)
     * @deprecated Use getAliases() method instead
     */
    get aliases(): Map<AccountAlias, AccountName> {
        return new Map(this._aliases);
    }
    
    /**
     * Get default commodity (read-only)
     * @deprecated Use getDefaultCommodity() method instead
     */
    get defaultCommodity(): CommodityName | null {
        return this._defaultCommodity;
    }
    
    /**
     * Get last date (read-only)
     * @deprecated Use getLastDate() method instead
     */
    get lastDate(): DateString | null {
        return this._lastDate;
    }
}