import { IUsageTracker } from './interfaces';
import {
    AccountName,
    PayeeName,
    CommodityName,
    TagEntry
} from './BrandedTypes';

/**
 * Usage frequency tracker for HLedger completion prioritization
 * Maintains usage counters for accounts, payees, tags, and commodities
 */
export class UsageTracker implements IUsageTracker {
    private _accountUsage: Map<AccountName, number> = new Map();
    private _payeeUsage: Map<PayeeName, number> = new Map();
    private _tagUsage: Map<TagEntry, number> = new Map();
    private _commodityUsage: Map<CommodityName, number> = new Map();
    
    // === Usage Tracking ===
    
    /**
     * Increment usage count for an account
     */
    incrementAccountUsage(account: AccountName): void {
        this._accountUsage.set(account, (this._accountUsage.get(account) || 0) + 1);
    }
    
    /**
     * Increment usage count for a payee
     */
    incrementPayeeUsage(payee: PayeeName): void {
        this._payeeUsage.set(payee, (this._payeeUsage.get(payee) || 0) + 1);
    }
    
    /**
     * Increment usage count for a tag
     */
    incrementTagUsage(tag: TagEntry): void {
        this._tagUsage.set(tag, (this._tagUsage.get(tag) || 0) + 1);
    }
    
    /**
     * Increment usage count for a commodity
     */
    incrementCommodityUsage(commodity: CommodityName): void {
        this._commodityUsage.set(commodity, (this._commodityUsage.get(commodity) || 0) + 1);
    }
    
    /**
     * Set usage count for an account (for batch operations)
     */
    setAccountUsage(account: AccountName, count: number): void {
        this._accountUsage.set(account, count);
    }
    
    /**
     * Set usage count for a payee (for batch operations)
     */
    setPayeeUsage(payee: PayeeName, count: number): void {
        this._payeeUsage.set(payee, count);
    }
    
    /**
     * Set usage count for a tag (for batch operations)
     */
    setTagUsage(tag: TagEntry, count: number): void {
        this._tagUsage.set(tag, count);
    }
    
    /**
     * Set usage count for a commodity (for batch operations)
     */
    setCommodityUsage(commodity: CommodityName, count: number): void {
        this._commodityUsage.set(commodity, count);
    }
    
    // === Usage Retrieval ===
    
    /**
     * Get usage count for an account
     */
    getAccountUsage(account: AccountName): number {
        return this._accountUsage.get(account) || 0;
    }
    
    /**
     * Get usage count for a payee
     */
    getPayeeUsage(payee: PayeeName): number {
        return this._payeeUsage.get(payee) || 0;
    }
    
    /**
     * Get usage count for a tag
     */
    getTagUsage(tag: TagEntry): number {
        return this._tagUsage.get(tag) || 0;
    }
    
    /**
     * Get usage count for a commodity
     */
    getCommodityUsage(commodity: CommodityName): number {
        return this._commodityUsage.get(commodity) || 0;
    }
    
    // === Sorted Results ===
    
    /**
     * Get accounts sorted by usage frequency (most used first)
     */
    getAccountsByUsage(): Array<{account: AccountName, count: number}> {
        return Array.from(this._accountUsage.entries())
            .map(([account, count]) => ({ account, count }))
            .sort((a, b) => b.count - a.count);
    }
    
    /**
     * Get payees sorted by usage frequency (most used first)
     */
    getPayeesByUsage(): Array<{payee: PayeeName, count: number}> {
        return Array.from(this._payeeUsage.entries())
            .map(([payee, count]) => ({ payee, count }))
            .sort((a, b) => b.count - a.count);
    }
    
    /**
     * Get tags sorted by usage frequency (most used first)
     */
    getTagsByUsage(): Array<{tag: TagEntry, count: number}> {
        return Array.from(this._tagUsage.entries())
            .map(([tag, count]) => ({ tag, count }))
            .sort((a, b) => b.count - a.count);
    }
    
    /**
     * Get commodities sorted by usage frequency (most used first)
     */
    getCommoditiesByUsage(): Array<{commodity: CommodityName, count: number}> {
        return Array.from(this._commodityUsage.entries())
            .map(([commodity, count]) => ({ commodity, count }))
            .sort((a, b) => b.count - a.count);
    }
    
    /**
     * Get accounts with usage data for a given list (preserves order, adds usage count)
     */
    getAccountsWithUsage(accounts: AccountName[]): Array<{account: AccountName, count: number}> {
        return accounts.map(account => ({
            account,
            count: this.getAccountUsage(account)
        }));
    }
    
    /**
     * Get payees with usage data for a given list (preserves order, adds usage count)
     */
    getPayeesWithUsage(payees: PayeeName[]): Array<{payee: PayeeName, count: number}> {
        return payees.map(payee => ({
            payee,
            count: this.getPayeeUsage(payee)
        }));
    }
    
    /**
     * Get tags with usage data for a given list (preserves order, adds usage count)
     */
    getTagsWithUsage(tags: TagEntry[]): Array<{tag: TagEntry, count: number}> {
        return tags.map(tag => ({
            tag,
            count: this.getTagUsage(tag)
        }));
    }
    
    /**
     * Get commodities with usage data for a given list (preserves order, adds usage count)
     */
    getCommoditiesWithUsage(commodities: CommodityName[]): Array<{commodity: CommodityName, count: number}> {
        return commodities.map(commodity => ({
            commodity,
            count: this.getCommodityUsage(commodity)
        }));
    }
    
    // === Utility ===
    
    /**
     * Clear all usage statistics
     */
    clear(): void {
        this._accountUsage.clear();
        this._payeeUsage.clear();
        this._tagUsage.clear();
        this._commodityUsage.clear();
    }
    
    /**
     * Merge usage statistics from another tracker
     */
    merge(other: IUsageTracker): void {
        // Merge account usage
        other.getAccountsByUsage().forEach(({ account, count }) => {
            this._accountUsage.set(account, (this._accountUsage.get(account) || 0) + count);
        });
        
        // Merge payee usage
        other.getPayeesByUsage().forEach(({ payee, count }) => {
            this._payeeUsage.set(payee, (this._payeeUsage.get(payee) || 0) + count);
        });
        
        // Merge tag usage
        other.getTagsByUsage().forEach(({ tag, count }) => {
            this._tagUsage.set(tag, (this._tagUsage.get(tag) || 0) + count);
        });
        
        // Merge commodity usage
        other.getCommoditiesByUsage().forEach(({ commodity, count }) => {
            this._commodityUsage.set(commodity, (this._commodityUsage.get(commodity) || 0) + count);
        });
    }
    
    // === Direct Map Access (for backward compatibility) ===
    
    /**
     * Get account usage map (read-only copy)
     * @deprecated Use getAccountsByUsage() or getAccountUsage() methods instead
     */
    get accountUsageCount(): Map<AccountName, number> {
        return new Map(this._accountUsage);
    }
    
    /**
     * Get payee usage map (read-only copy)
     * @deprecated Use getPayeesByUsage() or getPayeeUsage() methods instead
     */
    get payeeUsageCount(): Map<PayeeName, number> {
        return new Map(this._payeeUsage);
    }
    
    /**
     * Get tag usage map (read-only copy)
     * @deprecated Use getTagsByUsage() or getTagUsage() methods instead
     */
    get tagUsageCount(): Map<TagEntry, number> {
        return new Map(this._tagUsage);
    }
    
    /**
     * Get commodity usage map (read-only copy)
     * @deprecated Use getCommoditiesByUsage() or getCommodityUsage() methods instead
     */
    get commodityUsageCount(): Map<CommodityName, number> {
        return new Map(this._commodityUsage);
    }
}