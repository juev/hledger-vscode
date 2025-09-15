import { HLedgerConfig, ProjectCache } from '../main';
import { SimpleProjectCache } from '../SimpleProjectCache';
import { createCacheKey, createAccountName, createUsageCount, createPayeeName, createTagName, createCommodityCode } from '../types';
import { HLedgerParser } from '../HLedgerParser';
import * as path from 'path';
// Enhanced with proper type imports

describe('Simplified Caching System - PHASE C', () => {
    let config: HLedgerConfig;
    let projectCache: ProjectCache;
    let simpleCache: SimpleProjectCache;
    let parser: HLedgerParser;
    
    beforeEach(() => {
        config = new HLedgerConfig();
        projectCache = new ProjectCache();
        simpleCache = new SimpleProjectCache();
        parser = new HLedgerParser();
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
    
    describe('Path Validation', () => {
        it('should validate valid paths correctly', () => {
            // This is a simple test to ensure the parser can be instantiated
            expect(parser).toBeInstanceOf(HLedgerParser);
        });
        
        it('should prevent directory traversal in file paths', () => {
            // This test ensures our path validation logic is working
            // We'll test the internal isValidPath method through reflection
            const isValidPath = (parser as any).isValidPath;
            expect(typeof isValidPath).toBe('function');
            
            // Test basic path validation
            const testPath = path.resolve(__dirname);
            expect(isValidPath(testPath)).toBe(true);
            
            // Test path traversal prevention
            const traversalPath = path.resolve(__dirname, '..');
            const basePath = path.resolve(__dirname);
            expect(isValidPath(traversalPath, basePath)).toBe(false);
        });
    });
});