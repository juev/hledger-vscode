import { HLedgerConfig, ProjectCache } from '../main';

describe('Enhanced Caching System', () => {
    let config: HLedgerConfig;
    let projectCache: ProjectCache;
    
    beforeEach(() => {
        config = new HLedgerConfig();
        projectCache = new ProjectCache();
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
2025-01-15 * Shop ; category:groceries, #food
    Assets:Cash    100
    
2025-01-16 Gas Station ; type:gas, #transport
    Assets:Cash    -50
    
2025-01-17 Restaurant ; #dining, cuisine:italian
    Assets:Cash    -30
`;
            
            config.parseContent(content);
            
            const tags = config.getTags();
            expect(tags).toEqual(expect.arrayContaining([
                'category',
                'food',
                'type',
                'transport',
                'dining',
                'cuisine'
            ]));
        });
        
        it('should handle Cyrillic payees and tags', () => {
            const content = `
2025-01-15 * Магазин Пятёрочка ; категория:продукты, #еда
    Активы:Наличные    1000 RUB
    Расходы:Продукты   -1000 RUB
`;
            
            config.parseContent(content);
            
            expect(config.getPayees()).toContain('Магазин Пятёрочка');
            expect(config.getTags()).toEqual(expect.arrayContaining(['категория', 'еда']));
        });
    });
    
    describe('ProjectCache', () => {
        it('should create and manage project caches', () => {
            expect(projectCache.hasProject('/test/project1')).toBe(false);
            expect(projectCache.getConfig('/test/project1')).toBeNull();
            
            // Initialize would normally scan workspace, but we'll mock a config
            const testConfig = new HLedgerConfig();
            testConfig.payees.add('Test Store');
            testConfig.tags.add('test');
            
            // Manually set for testing
            projectCache['projects'].set('/test/project1', testConfig);
            
            expect(projectCache.hasProject('/test/project1')).toBe(true);
            expect(projectCache.getConfig('/test/project1')).toBe(testConfig);
        });
        
        it('should find project for file path', () => {
            // Create a test project
            const testConfig = new HLedgerConfig();
            projectCache['projects'].set('/home/user/finance', testConfig);
            
            // Should find project for files within it
            const projectPath = projectCache.findProjectForFile('/home/user/finance/2025.journal');
            expect(projectPath).toBe('/home/user/finance');
            
            // Should not find project for unrelated files
            const noProject = projectCache.findProjectForFile('/other/path/file.journal');
            expect(noProject).toBeNull();
        });
        
        it('should clear all project caches', () => {
            const testConfig = new HLedgerConfig();
            projectCache['projects'].set('/test/project1', testConfig);
            projectCache['projects'].set('/test/project2', testConfig);
            
            expect(projectCache.hasProject('/test/project1')).toBe(true);
            expect(projectCache.hasProject('/test/project2')).toBe(true);
            
            projectCache.clear();
            
            expect(projectCache.hasProject('/test/project1')).toBe(false);
            expect(projectCache.hasProject('/test/project2')).toBe(false);
        });
    });
    
    describe('Complex Transaction Parsing', () => {
        it('should handle transaction with code and status', () => {
            const content = `
2025-01-15 * (REF123) Магазин Пятёрочка ; category:groceries
    Assets:Cash    100
    
2025-01-16 ! (CODE456) ТЦ Европейский ; #shopping
    Assets:Cash    -50
`;
            
            config.parseContent(content);
            
            expect(config.getPayees()).toEqual(expect.arrayContaining([
                'Магазин Пятёрочка',
                'ТЦ Европейский'
            ]));
            expect(config.getTags()).toEqual(expect.arrayContaining([
                'category',
                'shopping'
            ]));
        });
        
        it('should handle multiple tags in one comment', () => {
            const content = `
2025-01-15 * Store ; category:food, subcategory:fruits, #healthy, priority:high
    Assets:Cash    100
`;
            
            config.parseContent(content);
            
            const tags = config.getTags();
            expect(tags).toEqual(expect.arrayContaining([
                'category',
                'subcategory', 
                'healthy',
                'priority'
            ]));
        });
    });
});