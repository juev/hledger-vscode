import { IDataStore } from './interfaces';

/**
 * In-memory data store for HLedger parsed data
 * Responsible for storing and retrieving all parsed information
 */
export class DataStore implements IDataStore {
    private _accounts: Set<string> = new Set();
    private _definedAccounts: Set<string> = new Set();
    private _usedAccounts: Set<string> = new Set();
    private _payees: Set<string> = new Set();
    private _tags: Set<string> = new Set();
    private _commodities: Set<string> = new Set();
    private _aliases: Map<string, string> = new Map();
    private _defaultCommodity: string | null = null;
    private _lastDate: string | null = null;
    
    // === Data Management ===
    
    /**
     * Add an account to the store
     */
    addAccount(account: string): void {
        this._accounts.add(account);
    }
    
    /**
     * Add a defined account (from account directive)
     */
    addDefinedAccount(account: string): void {
        this._definedAccounts.add(account);
        this._accounts.add(account); // Also add to main accounts set
    }
    
    /**
     * Add a used account (from transactions)
     */
    addUsedAccount(account: string): void {
        this._usedAccounts.add(account);
        this._accounts.add(account); // Also add to main accounts set
    }
    
    /**
     * Add a payee to the store
     */
    addPayee(payee: string): void {
        this._payees.add(payee);
    }
    
    /**
     * Add a tag to the store
     */
    addTag(tag: string): void {
        this._tags.add(tag);
    }
    
    /**
     * Add a commodity to the store
     */
    addCommodity(commodity: string): void {
        this._commodities.add(commodity);
    }
    
    /**
     * Set an account alias
     */
    setAlias(alias: string, target: string): void {
        this._aliases.set(alias, target);
        this.addAccount(alias);
        this.addAccount(target);
    }
    
    /**
     * Set the default commodity
     */
    setDefaultCommodity(commodity: string): void {
        this._defaultCommodity = commodity;
    }
    
    /**
     * Set the last transaction date
     */
    setLastDate(date: string): void {
        this._lastDate = date;
    }
    
    // === Data Retrieval ===
    
    /**
     * Get all accounts (defined + used)
     */
    getAccounts(): string[] {
        return Array.from(this._accounts);
    }
    
    /**
     * Get only defined accounts
     */
    getDefinedAccounts(): string[] {
        return Array.from(this._definedAccounts);
    }
    
    /**
     * Get only used accounts
     */
    getUsedAccounts(): string[] {
        return Array.from(this._usedAccounts);
    }
    
    /**
     * Get undefined accounts (used but not defined)
     */
    getUndefinedAccounts(): string[] {
        return Array.from(this._usedAccounts).filter(acc => !this._definedAccounts.has(acc));
    }
    
    /**
     * Get all payees
     */
    getPayees(): string[] {
        return Array.from(this._payees);
    }
    
    /**
     * Get all tags
     */
    getTags(): string[] {
        return Array.from(this._tags);
    }
    
    /**
     * Get all commodities
     */
    getCommodities(): string[] {
        return Array.from(this._commodities);
    }
    
    /**
     * Get all aliases as a Map
     */
    getAliases(): Map<string, string> {
        return new Map(this._aliases); // Return a copy to prevent external modification
    }
    
    /**
     * Get the default commodity
     */
    getDefaultCommodity(): string | null {
        return this._defaultCommodity;
    }
    
    /**
     * Get the last transaction date
     */
    getLastDate(): string | null {
        return this._lastDate;
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
    get accounts(): Set<string> {
        return new Set(this._accounts); // Return copy to prevent modification
    }
    
    /**
     * Get defined accounts set (read-only)
     * @deprecated Use getDefinedAccounts() method instead
     */
    get definedAccounts(): Set<string> {
        return new Set(this._definedAccounts);
    }
    
    /**
     * Get used accounts set (read-only)
     * @deprecated Use getUsedAccounts() method instead
     */
    get usedAccounts(): Set<string> {
        return new Set(this._usedAccounts);
    }
    
    /**
     * Get payees set (read-only)
     * @deprecated Use getPayees() method instead
     */
    get payees(): Set<string> {
        return new Set(this._payees);
    }
    
    /**
     * Get tags set (read-only)
     * @deprecated Use getTags() method instead
     */
    get tags(): Set<string> {
        return new Set(this._tags);
    }
    
    /**
     * Get commodities set (read-only)
     * @deprecated Use getCommodities() method instead
     */
    get commodities(): Set<string> {
        return new Set(this._commodities);
    }
    
    /**
     * Get aliases map (read-only)
     * @deprecated Use getAliases() method instead
     */
    get aliases(): Map<string, string> {
        return new Map(this._aliases);
    }
    
    /**
     * Get default commodity (read-only)
     * @deprecated Use getDefaultCommodity() method instead
     */
    get defaultCommodity(): string | null {
        return this._defaultCommodity;
    }
    
    /**
     * Get last date (read-only)
     * @deprecated Use getLastDate() method instead
     */
    get lastDate(): string | null {
        return this._lastDate;
    }
}