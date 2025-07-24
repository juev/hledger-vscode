import { WorkspaceCache, HLedgerConfig } from '../main';

describe('WorkspaceCache', () => {
    let cache: WorkspaceCache;
    
    beforeEach(() => {
        cache = new WorkspaceCache();
        jest.useFakeTimers();
        jest.clearAllMocks();
    });
    
    afterEach(() => {
        jest.useRealTimers();
    });
    
    describe('isValid', () => {
        it('should return false for empty cache', () => {
            expect(cache.isValid('/test/workspace')).toBe(false);
        });
        
        it('should return false for different workspace path', () => {
            cache.update('/test/workspace1');
            expect(cache.isValid('/test/workspace2')).toBe(false);
        });
        
        it('should return true for same workspace within time limit', () => {
            cache.update('/test/workspace');
            expect(cache.isValid('/test/workspace')).toBe(true);
        });
        
        it('should return false when cache is expired', () => {
            cache.update('/test/workspace');
            
            // Advance time by 61 seconds (cache expires after 60)
            jest.advanceTimersByTime(61000);
            
            expect(cache.isValid('/test/workspace')).toBe(false);
        });
    });
    
    describe('update', () => {
        it('should create new config and scan workspace', () => {
            cache.update('/test/workspace');
            
            // Verify cache is created and valid
            expect(cache.isValid('/test/workspace')).toBe(true);
            expect(cache.getConfig()).not.toBeNull();
        });
        
        it('should update cache timestamp', () => {
            const beforeTime = Date.now();
            cache.update('/test/workspace');
            const afterTime = Date.now();
            
            // Cache should be valid immediately after update
            expect(cache.isValid('/test/workspace')).toBe(true);
            
            // Advance time by 30 seconds - should still be valid
            jest.advanceTimersByTime(30000);
            expect(cache.isValid('/test/workspace')).toBe(true);
        });
    });
    
    describe('getConfig', () => {
        it('should return null for empty cache', () => {
            expect(cache.getConfig()).toBeNull();
        });
        
        it('should return config after update', () => {
            cache.update('/test/workspace');
            
            const config = cache.getConfig();
            expect(config).toBeDefined();
            expect(config).not.toBeNull();
            expect(typeof config?.getAccounts).toBe('function');
        });
    });
    
    describe('invalidate', () => {
        it('should clear cache', () => {
            cache.update('/test/workspace');
            expect(cache.getConfig()).not.toBeNull();
            
            cache.invalidate();
            
            expect(cache.getConfig()).toBeNull();
            expect(cache.isValid('/test/workspace')).toBe(false);
        });
    });
    
    describe('cache lifecycle', () => {
        it('should handle multiple updates correctly', () => {
            // First update
            cache.update('/workspace1');
            expect(cache.isValid('/workspace1')).toBe(true);
            expect(cache.isValid('/workspace2')).toBe(false);
            
            // Second update with different workspace
            cache.update('/workspace2');
            expect(cache.isValid('/workspace1')).toBe(false);
            expect(cache.isValid('/workspace2')).toBe(true);
            
            // Invalidate
            cache.invalidate();
            expect(cache.isValid('/workspace1')).toBe(false);
            expect(cache.isValid('/workspace2')).toBe(false);
        });
        
        it('should handle time-based expiration correctly', () => {
            cache.update('/test/workspace');
            expect(cache.isValid('/test/workspace')).toBe(true);
            
            // Advance time by 59 seconds - should still be valid
            jest.advanceTimersByTime(59000);
            expect(cache.isValid('/test/workspace')).toBe(true);
            
            // Advance time by 2 more seconds (total 61) - should be invalid
            jest.advanceTimersByTime(2000);
            expect(cache.isValid('/test/workspace')).toBe(false);
        });
    });
});