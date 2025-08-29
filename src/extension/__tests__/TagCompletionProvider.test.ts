// TagCompletionProvider test - now integrated in modular completers
// This functionality is now tested through TagCompleter

import { HLedgerConfig } from '../HLedgerConfig';
import { TagCompleter } from '../completion/TagCompleter';
import { createTagName, createTagValue, createUsageCount } from '../types';

describe('Tag Completion (Legacy Test)', () => {
    let config: HLedgerConfig;
    let completer: TagCompleter;

    beforeEach(() => {
        config = new HLedgerConfig();
        completer = new TagCompleter(config);
    });

    it('should create tag completer', () => {
        expect(completer).toBeDefined();
    });

    it('should provide empty completions for empty data', () => {
        const context = { type: 'tag' as const, query: '' };
        const completions = completer.complete(context);
        expect(completions).toBeDefined();
        expect(completions.length).toBe(0);
    });

    it('should show available tag values in documentation (no auto-trigger command after fix)', () => {
        // Mock config to return tag names and tag values
        const mockTagUsage = new Map([
            [createTagName('category'), createUsageCount(3)], 
            [createTagName('project'), createUsageCount(2)]
        ]);
        const mockTagValueUsage = new Map([
            ['category:groceries', createUsageCount(2)],
            ['category:travel', createUsageCount(1)],
            ['project:web', createUsageCount(1)]
        ]);
        
        jest.spyOn(config, 'getTagsByUsage').mockReturnValue([
            createTagName('category'), 
            createTagName('project')
        ]);
        jest.spyOn(config, 'tagUsage', 'get').mockReturnValue(mockTagUsage);
        jest.spyOn(config, 'getTagValuesByUsageFor').mockImplementation((tagName) => {
            if (tagName === createTagName('category')) return [
                createTagValue('groceries'), 
                createTagValue('travel')
            ];
            if (tagName === createTagName('project')) return [createTagValue('web')];
            return [];
        });

        const context = { type: 'tag' as const, query: 'cat' };
        const completions = completer.complete(context);

        expect(completions.length).toBeGreaterThan(0);
        
        // Find the category completion item
        const categoryItem = completions.find(item => item.label === 'category');
        expect(categoryItem).toBeDefined();
        expect(categoryItem?.insertText).toBe('category:');
        
        // FIXED: Should NOT have command (prevents double completion)
        expect(categoryItem?.command).toBeUndefined();
        
        // Should show available values in documentation instead
        expect(categoryItem?.documentation).toBeDefined();
        const docText = (categoryItem?.documentation as any)?.value || '';
        expect(docText).toContain('Available values:');
        expect(docText).toContain('groceries');
        expect(docText).toContain('travel');
    });

    it('should not add triggerSuggest command when no tag values exist', () => {
        // Mock config to return tag name with no values
        jest.spyOn(config, 'getTagsByUsage').mockReturnValue([createTagName('empty-tag')]);
        jest.spyOn(config, 'getTagValuesByUsageFor').mockReturnValue([]);

        const context = { type: 'tag' as const, query: 'empty' };
        const completions = completer.complete(context);

        expect(completions.length).toBeGreaterThan(0);
        
        const emptyTagItem = completions.find(item => item.label === 'empty-tag');
        expect(emptyTagItem).toBeDefined();
        expect(emptyTagItem?.insertText).toBe('empty-tag:');
        expect(emptyTagItem?.command).toBeUndefined();
    });
});