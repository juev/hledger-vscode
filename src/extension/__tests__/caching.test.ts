import { HLedgerConfig, ProjectCache } from '../main';
import { SimpleProjectCache } from '../SimpleProjectCache';
import { createCacheKey, createAccountName, createUsageCount, createPayeeName, createTagName, createCommodityCode } from '../types';
// Enhanced with proper type imports

describe('Simplified Caching System - PHASE C', () => {
    let config: HLedgerConfig;
    let projectCache: ProjectCache;
    let simpleCache: SimpleProjectCache;
    
    beforeEach(() => {
        config = new HLedgerConfig();
        projectCache = new ProjectCache();
        simpleCache = new SimpleProjectCache();
    });
    
    describe('Payee and Tag Parsing', () => {
        it('should extract payees from transaction descriptions', () => {
            const content = `
2025-01-15 * Магазин Пятёрочка
    Assets:Cash    100
    
2025-01-16 ТЦ Европейский
    Assets:Cash    -50
    
2025-01-17 ! Заправка Лукойл
    Assets:Cash    -30
`;
            
            config.parseContent(content);
            
            const payees = config.getPayees();
            expect(payees).toEqual(expect.arrayContaining([
                'Магазин Пятёрочка',
                'ТЦ Европейский', 
                'Заправка Лукойл'
            ]));
        });
        
        it('should extract tags from transaction comments', () => {
            const content = `
2025-01-15 * Shop ; category:groceries, type:food
    Assets:Cash    100
    
2025-01-16 Gas Station ; type:gas, category:transport
    Assets:Cash    -50
    
2025-01-17 Restaurant ; category:dining, cuisine:italian
    Assets:Cash    -30
`;
            
            config.parseContent(content);
            
            const tags = config.getTags();
            expect(tags).toEqual(expect.arrayContaining([
                'category',
                'type',
                'cuisine'
            ]));
        });
        
        it('should handle Cyrillic payees and tags', () => {
            const content = `
2025-01-15 * Магазин Пятёрочка ; категория:продукты, тип:еда
    Активы:Наличные    1000 RUB
    Расходы:Продукты   -1000 RUB
`;
            
            config.parseContent(content);
            
            expect(config.getPayees()).toContain('Магазин Пятёрочка');
            expect(config.getTags()).toEqual(expect.arrayContaining(['категория', 'тип']));
        });
    });
    
    describe('ProjectCache', () => {
        it('should create and manage project caches', () => {
            expect(projectCache.hasProject('/test/project1')).toBe(false);
            expect(projectCache.getConfig('/test/project1')).toBeNull();
            
            // Initialize would normally scan workspace, but we'll mock a config
            const testConfig = new HLedgerConfig();
            testConfig.parseContent('2024-01-01 Test Store\n    Assets:Cash  $100\n    tag: test');
            
            // Test legacy ProjectCache wrapper (backward compatibility)
            const cachedConfig = projectCache.initializeProject('/test/project1');
            
            expect(projectCache.hasProject('/test/project1')).toBe(true);
            expect(projectCache.getConfig('/test/project1')).not.toBeNull();
        });
        
        it('should support simple caching with mtime validation', () => {
            const testConfig = new HLedgerConfig();
            testConfig.parseContent('account Assets:Test');
            
            // Cache should be empty initially
            expect(simpleCache.get(createCacheKey('/test/project.journal'))).toBeNull();
            
            // After setting, should return cached value
            // Cannot set HLedgerConfig directly - cache expects ParsedHLedgerData
            // Create mock parsed data
            const mockData = {
                accounts: new Set([createAccountName('Assets:Test')]),
                definedAccounts: new Set([createAccountName('Assets:Test')]),
                usedAccounts: new Set([createAccountName('Assets:Test')]),
                payees: new Set([createPayeeName('TestPayee')]),
                tags: new Set([createTagName('TestTag')]),
                commodities: new Set([createCommodityCode('USD')]),
                aliases: new Map([[createAccountName('Assets'), createAccountName('Assets:Test')]]),
                accountUsage: new Map([[createAccountName('Assets:Test'), createUsageCount(1)]]),
                payeeUsage: new Map([[createPayeeName('TestPayee'), createUsageCount(1)]]),
                tagUsage: new Map([[createTagName('TestTag'), createUsageCount(1)]]),
                commodityUsage: new Map([[createCommodityCode('USD'), createUsageCount(1)]]),
                defaultCommodity: null,
                lastDate: null
            };
            simpleCache.set(createCacheKey('/test/project.journal'), mockData);
            expect(simpleCache.get(createCacheKey('/test/project.journal'))).not.toBeNull();
            
            // Stats should reflect cached items
            const stats = simpleCache.getStats();
            expect(stats.size).toBeGreaterThan(0);
        });
        
        it('should clear all cached data', () => {
            // Create mock parsed data for clearing test
            const mockData = {
                accounts: new Set([createAccountName('Assets:Test')]),
                definedAccounts: new Set([createAccountName('Assets:Test')]),
                usedAccounts: new Set([createAccountName('Assets:Test')]),
                payees: new Set([createPayeeName('TestPayee')]),
                tags: new Set([createTagName('TestTag')]),
                commodities: new Set([createCommodityCode('USD')]),
                aliases: new Map([[createAccountName('Assets'), createAccountName('Assets:Test')]]),
                accountUsage: new Map([[createAccountName('Assets:Test'), createUsageCount(1)]]),
                payeeUsage: new Map([[createPayeeName('TestPayee'), createUsageCount(1)]]),
                tagUsage: new Map([[createTagName('TestTag'), createUsageCount(1)]]),
                commodityUsage: new Map([[createCommodityCode('USD'), createUsageCount(1)]]),
                defaultCommodity: null,
                lastDate: null
            };
            
            simpleCache.set(createCacheKey('/test/project1'), mockData);
            simpleCache.set(createCacheKey('/test/project2'), mockData);
            
            expect(simpleCache.has(createCacheKey('/test/project1'))).toBe(true);
            expect(simpleCache.has(createCacheKey('/test/project2'))).toBe(true);
            
            simpleCache.clear();
            
            expect(simpleCache.has(createCacheKey('/test/project1'))).toBe(false);
            expect(simpleCache.has(createCacheKey('/test/project2'))).toBe(false);
        });
    });
    
    describe('Complex Transaction Parsing', () => {
        it('should handle transaction with code and status', () => {
            const content = `
2025-01-15 * (REF123) Магазин Пятёрочка ; category:groceries
    Assets:Cash    100
    
2025-01-16 ! (CODE456) ТЦ Европейский ; type:shopping
    Assets:Cash    -50
`;
            
            config.parseContent(content);
            
            expect(config.getPayees()).toEqual(expect.arrayContaining([
                'Магазин Пятёрочка',
                'ТЦ Европейский'
            ]));
            expect(config.getTags()).toEqual(expect.arrayContaining([
                'category',
                'type'
            ]));
        });
        
        it('should handle multiple tags in one comment', () => {
            const content = `
2025-01-15 * Store ; category:food, subcategory:fruits, type:healthy, priority:high
    Assets:Cash    100
`;
            
            config.parseContent(content);
            
            const tags = config.getTags();
            expect(tags).toEqual(expect.arrayContaining([
                'category',
                'subcategory', 
                'type',
                'priority'
            ]));
        });
    });
});