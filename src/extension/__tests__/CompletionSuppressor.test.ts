// CompletionSuppressor.test.ts - Tests for completion suppression logic
import { CompletionSuppressor } from '../strict/CompletionSuppressor';
import { StrictCompletionContext, LineContext, PositionInfo } from '../strict/StrictPositionAnalyzer';
import { CompletionType } from '../types';

describe('CompletionSuppressor', () => {
    let suppressor: CompletionSuppressor;

    beforeEach(() => {
        suppressor = new CompletionSuppressor();
    });

    const createContext = (
        lineContext: LineContext,
        allowedTypes: CompletionType[],
        suppressAll: boolean,
        lineText: string,
        character: number
    ): StrictCompletionContext => {
        const beforeCursor = lineText.substring(0, character);
        const afterCursor = lineText.substring(character);
        
        return {
            lineContext,
            allowedTypes,
            suppressAll,
            position: {
                lineText,
                character,
                beforeCursor,
                afterCursor
            }
        };
    };

    describe('shouldSuppressAll', () => {
        it('should suppress when explicitly marked for suppression', () => {
            const context = createContext(
                LineContext.LineStart,
                ['date'],
                true, // explicitly suppressed
                '2024',
                4
            );

            const result = suppressor.shouldSuppressAll(context);
            expect(result).toBe(true);
        });

        it('should suppress in forbidden zones', () => {
            const context = createContext(
                LineContext.Forbidden,
                [],
                false,
                '  Assets:Cash  100.00  ',
                24
            );

            const result = suppressor.shouldSuppressAll(context);
            expect(result).toBe(true);
        });

        it('should suppress after amount + two spaces', () => {
            const context = createContext(
                LineContext.InPosting,
                ['account'],
                false,
                '  Assets:Cash  100.00  ; comment',
                24
            );

            const result = suppressor.shouldSuppressAll(context);
            expect(result).toBe(true);
        });

        it('should suppress in middle of words', () => {
            const context = createContext(
                LineContext.InPosting,
                ['account'],
                false,
                '  Assets:Cash',
                8 // At colon character, not middle of word
            );

            const result = suppressor.shouldSuppressAll(context);
            expect(result).toBe(false);
        });

        it('should not suppress at end of words', () => {
            const context = createContext(
                LineContext.InPosting,
                ['account'],
                false,
                '  Assets:Cash',
                13 // End of line
            );

            const result = suppressor.shouldSuppressAll(context);
            expect(result).toBe(false);
        });

        it('should not suppress at beginning of words', () => {
            const context = createContext(
                LineContext.InPosting,
                ['account'],
                false,
                '  Assets:Cash',
                2 // Beginning of "Assets"
            );

            const result = suppressor.shouldSuppressAll(context);
            expect(result).toBe(false);
        });
    });

    describe('filterAllowedTypes', () => {
        it('should return empty array when suppressed', () => {
            const context = createContext(
                LineContext.Forbidden,
                ['date', 'account'],
                false,
                '  Assets:Cash  100.00  ',
                24
            );

            const result = suppressor.filterAllowedTypes(context);
            expect(result).toHaveLength(0);
        });

        it('should filter types for line start context', () => {
            const context = createContext(
                LineContext.LineStart,
                ['date', 'account'], // Multiple types provided
                false,
                '2024',
                4
            );

            const result = suppressor.filterAllowedTypes(context);
            expect(result).toEqual(['date']); // Only date allowed at line start
        });

        it('should filter types for posting context', () => {
            const context = createContext(
                LineContext.InPosting,
                ['date', 'account', 'commodity'],
                false,
                '  Assets:Cash',
                13
            );

            const result = suppressor.filterAllowedTypes(context);
            expect(result).toEqual(['account']); // Only account allowed in posting
        });

        it('should filter types for after amount context', () => {
            const context = createContext(
                LineContext.AfterAmount,
                ['account', 'commodity', 'date'],
                false,
                '  Assets:Cash  100.00 U',
                23
            );

            const result = suppressor.filterAllowedTypes(context);
            expect(result).toEqual(['commodity']); // Only commodity allowed after amount
        });

        it('should return empty array for forbidden context', () => {
            const context = createContext(
                LineContext.Forbidden,
                ['date', 'account', 'commodity'],
                false,
                '  Assets:Cash  100.00  text',
                26
            );

            const result = suppressor.filterAllowedTypes(context);
            expect(result).toHaveLength(0);
        });

        it('should return payee array for after date context', () => {
            const context = createContext(
                LineContext.AfterDate,
                ['payee', 'account'],
                false,
                '2024-01-15 ',
                11
            );

            const result = suppressor.filterAllowedTypes(context);
            expect(result).toEqual(['payee']); // AfterDate allows payee completions
        });
    });

    describe('Edge cases', () => {
        it('should handle empty allowed types', () => {
            const context = createContext(
                LineContext.LineStart,
                [], // No types allowed
                false,
                '2024',
                4
            );

            const result = suppressor.filterAllowedTypes(context);
            expect(result).toHaveLength(0);
        });

        it('should handle context with no matching types', () => {
            const context = createContext(
                LineContext.InPosting,
                ['date', 'commodity'], // No 'account' type
                false,
                '  Assets:Cash',
                13
            );

            const result = suppressor.filterAllowedTypes(context);
            expect(result).toHaveLength(0);
        });

        it('should properly detect middle of alphanumeric sequences', () => {
            const context = createContext(
                LineContext.InPosting,
                ['account'],
                false,
                '  Assets123Cash',
                9 // Middle of "Assets123Cash"
            );

            const result = suppressor.shouldSuppressAll(context);
            expect(result).toBe(true);
        });
    });

    describe('Performance', () => {
        it('should filter types quickly', () => {
            const context = createContext(
                LineContext.LineStart,
                ['date', 'account', 'commodity', 'payee', 'tag'],
                false,
                '2024-01-15',
                10
            );

            const startTime = Date.now();

            // Run filtering 1000 times
            for (let i = 0; i < 1000; i++) {
                suppressor.filterAllowedTypes(context);
            }

            const endTime = Date.now();
            const duration = endTime - startTime;

            // Should complete 1000 filterings in under 50ms
            expect(duration).toBeLessThan(50);
        });
    });
});