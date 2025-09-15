// StrictPositionAnalyzer.test.ts - Tests for strict position analysis
import * as vscode from 'vscode';
import { StrictPositionAnalyzer, LineContext, StrictCompletionContext } from '../strict/StrictPositionAnalyzer';
import { HLedgerConfig } from '../HLedgerConfig';
import { NumberFormatService, createNumberFormatService } from '../services/NumberFormatService';

// Import MockTextDocument from the mock
const { MockTextDocument } = vscode as any;

describe('StrictPositionAnalyzer', () => {
    let analyzer: StrictPositionAnalyzer;
    let config: HLedgerConfig;
    let numberFormatService: NumberFormatService;

    beforeEach(() => {
        config = new HLedgerConfig();
        numberFormatService = createNumberFormatService();
        analyzer = new StrictPositionAnalyzer(numberFormatService, config);
    });

    describe('Date completion at line beginning', () => {
        it('should detect date context at line start with digits', () => {
            const document = new MockTextDocument(['2024']);
            const position = new vscode.Position(0, 4);
            
            const result = analyzer.analyzePosition(document, position);
            
            expect(result.lineContext).toBe(LineContext.LineStart);
            expect(result.allowedTypes).toContain('date');
            expect(result.suppressAll).toBe(false);
        });

        it('should handle special zero digit at line beginning', () => {
            const document = new MockTextDocument(['0']);
            const position = new vscode.Position(0, 1);
            
            const result = analyzer.analyzePosition(document, position);
            
            expect(result.lineContext).toBe(LineContext.LineStart);
            expect(result.allowedTypes).toContain('date');
        });

        it('should handle zero-based months (01, 02, etc.)', () => {
            const document = new MockTextDocument(['01']);
            const position = new vscode.Position(0, 2);
            
            const result = analyzer.analyzePosition(document, position);
            
            expect(result.lineContext).toBe(LineContext.LineStart);
            expect(result.allowedTypes).toContain('date');
        });

        it('should handle partial dates with zero (01-15)', () => {
            const document = new MockTextDocument(['01-15']);
            const position = new vscode.Position(0, 5);
            
            const result = analyzer.analyzePosition(document, position);
            
            expect(result.lineContext).toBe(LineContext.LineStart);
            expect(result.allowedTypes).toContain('date');
        });

        it('should reject zero digit not at line beginning', () => {
            const document = new MockTextDocument(['  0']);
            const position = new vscode.Position(0, 3);
            
            const result = analyzer.analyzePosition(document, position);
            
            expect(result.lineContext).not.toBe(LineContext.LineStart);
            expect(result.allowedTypes).not.toContain('date');
        });
    });

    describe('Account completion on indented lines', () => {
        it('should detect account context on indented lines', () => {
            const document = new MockTextDocument(['  Assets:Cash']);
            const position = new vscode.Position(0, 12);
            
            const result = analyzer.analyzePosition(document, position);
            
            expect(result.lineContext).toBe(LineContext.InPosting);
            expect(result.allowedTypes).toContain('account');
        });

        it('should detect account context with tab indentation', () => {
            const document = new MockTextDocument(['\tAssets:Bank']);
            const position = new vscode.Position(0, 11);
            
            const result = analyzer.analyzePosition(document, position);
            
            expect(result.lineContext).toBe(LineContext.InPosting);
            expect(result.allowedTypes).toContain('account');
        });

        it('should reject account completion on non-indented lines', () => {
            const document = new MockTextDocument(['Assets:Cash']);
            const position = new vscode.Position(0, 10);
            
            const result = analyzer.analyzePosition(document, position);
            
            expect(result.lineContext).not.toBe(LineContext.InPosting);
            expect(result.allowedTypes).not.toContain('account');
        });
    });

    describe('Currency completion after amounts', () => {
        it('should detect currency context after decimal amount with existing currency', () => {
            const document = new MockTextDocument(['  Assets:Cash  100.00 USD']);
            const position = new vscode.Position(0, 25);
            
            const result = analyzer.analyzePosition(document, position);
            
            expect(result.lineContext).toBe(LineContext.AfterAmount);
            expect(result.allowedTypes).toContain('commodity');
        });

        it('should detect currency context for partial currency after decimal', () => {
            const document = new MockTextDocument(['  Assets:Cash  100.00 U']);
            const position = new vscode.Position(0, 23);
            
            const result = analyzer.analyzePosition(document, position);
            
            expect(result.lineContext).toBe(LineContext.AfterAmount);
            expect(result.allowedTypes).toContain('commodity');
        });

        it('should detect currency context after whole number amount', () => {
            const document = new MockTextDocument(['  Assets:Cash  111 ']);
            const position = new vscode.Position(0, 19);
            
            const result = analyzer.analyzePosition(document, position);
            
            expect(result.lineContext).toBe(LineContext.AfterAmount);
            expect(result.allowedTypes).toContain('commodity');
        });

        it('should detect currency context after whole number with existing currency', () => {
            const document = new MockTextDocument(['  Assets:Cash  111 USD']);
            const position = new vscode.Position(0, 22);
            
            const result = analyzer.analyzePosition(document, position);
            
            expect(result.lineContext).toBe(LineContext.AfterAmount);
            expect(result.allowedTypes).toContain('commodity');
        });

        it('should detect currency context after decimal amount with space', () => {
            const document = new MockTextDocument(['  Assets:Cash  111.50 ']);
            const position = new vscode.Position(0, 22);
            
            const result = analyzer.analyzePosition(document, position);
            
            expect(result.lineContext).toBe(LineContext.AfterAmount);
            expect(result.allowedTypes).toContain('commodity');
        });

        it('should support currency symbols like €, £, ¥', () => {
            const document = new MockTextDocument(['  Assets:Cash  50.00 €']);
            const position = new vscode.Position(0, 22);
            
            const result = analyzer.analyzePosition(document, position);
            
            expect(result.lineContext).toBe(LineContext.AfterAmount);
            expect(result.allowedTypes).toContain('commodity');
        });

        it('should handle various decimal precision patterns', () => {
            // Test with different decimal places
            const testCases = [
                '  Assets:Cash  123.5 EUR',
                '  Assets:Cash  123.50 GBP', 
                '  Assets:Cash  123.456 BTC'
            ];

            testCases.forEach(testCase => {
                const document = new MockTextDocument([testCase]);
                const position = new vscode.Position(0, testCase.length);
                
                const result = analyzer.analyzePosition(document, position);
                
                expect(result.lineContext).toBe(LineContext.AfterAmount);
                expect(result.allowedTypes).toContain('commodity');
            });
        });
    });

    describe('Forbidden zones', () => {
        it('should suppress all completions after amount + two spaces', () => {
            const document = new MockTextDocument(['  Assets:Cash  100.00  ']);
            const position = new vscode.Position(0, 24);
            
            const result = analyzer.analyzePosition(document, position);
            
            expect(result.lineContext).toBe(LineContext.Forbidden);
            expect(result.suppressAll).toBe(true);
            expect(result.allowedTypes).toHaveLength(0);
        });

        it('should suppress completions after amount with text following two spaces', () => {
            // Test forbidden zone without comment
            const document = new MockTextDocument(['  Assets:Cash  100.00  text']);
            const position = new vscode.Position(0, 24); // Position right after two spaces
            
            const result = analyzer.analyzePosition(document, position);
            
            expect(result.lineContext).toBe(LineContext.Forbidden);
            expect(result.suppressAll).toBe(true);
        });

        it('should allow tag completion in comments even after amounts', () => {
            // Comments have priority over forbidden zone
            const document = new MockTextDocument(['  Assets:Cash  100.00  ; category:']);
            const position = new vscode.Position(0, 36); // After "category:"
            
            const result = analyzer.analyzePosition(document, position);
            
            expect(result.lineContext).toBe(LineContext.InTagValue);
            expect(result.allowedTypes).toContain('tag_value');
        });
    });

    describe('Edge cases', () => {
        it('should handle empty lines', () => {
            const document = new MockTextDocument(['']);
            const position = new vscode.Position(0, 0);
            
            const result = analyzer.analyzePosition(document, position);
            
            expect(result.lineContext).toBe(LineContext.Forbidden);
            expect(result.suppressAll).toBe(true);
        });

        it('should handle lines with only whitespace', () => {
            const document = new MockTextDocument(['   ']);
            const position = new vscode.Position(0, 3);
            
            const result = analyzer.analyzePosition(document, position);
            
            expect(result.lineContext).toBe(LineContext.InPosting);
        });

        it('should handle position beyond line length', () => {
            const document = new MockTextDocument(['2024']);
            const position = new vscode.Position(0, 10); // Beyond line end
            
            const result = analyzer.analyzePosition(document, position);
            
            expect(result.position.character).toBe(10);
            expect(result.position.beforeCursor).toBe('2024');
        });
    });

    describe('Position information', () => {
        it('should provide correct position information', () => {
            const document = new MockTextDocument(['2024-01-15 Test']);
            const position = new vscode.Position(0, 10);
            
            const result = analyzer.analyzePosition(document, position);
            
            expect(result.position.lineText).toBe('2024-01-15 Test');
            expect(result.position.character).toBe(10);
            expect(result.position.beforeCursor).toBe('2024-01-15');
            expect(result.position.afterCursor).toBe(' Test');
        });
    });

    describe('Comment and tag completion contexts', () => {
        it('should detect comment context after semicolon', () => {
            const document = new MockTextDocument(['  Assets:Cash  100.00 USD ; this is a comment']);
            const position = new vscode.Position(0, 35);
            
            const result = analyzer.analyzePosition(document, position);
            
            expect(result.lineContext).toBe(LineContext.InComment);
            expect(result.allowedTypes).toContain('tag');
        });

        it('should detect comment context after hash', () => {
            const document = new MockTextDocument(['  Assets:Cash  100.00 USD # this is a comment']);
            const position = new vscode.Position(0, 35);
            
            const result = analyzer.analyzePosition(document, position);
            
            expect(result.lineContext).toBe(LineContext.InComment);
            expect(result.allowedTypes).toContain('tag');
        });

        it('should detect tag value context after tag name and colon', () => {
            const document = new MockTextDocument(['  Assets:Cash  100.00 USD ; category:']);
            const position = new vscode.Position(0, 37);
            
            const result = analyzer.analyzePosition(document, position);
            
            expect(result.lineContext).toBe(LineContext.InTagValue);
            expect(result.allowedTypes).toContain('tag_value');
        });

        it('should detect tag value context with partial value', () => {
            const document = new MockTextDocument(['  Assets:Cash  100.00 USD ; category:groc']);
            const position = new vscode.Position(0, 41);
            
            const result = analyzer.analyzePosition(document, position);
            
            expect(result.lineContext).toBe(LineContext.InTagValue);
            expect(result.allowedTypes).toContain('tag_value');
        });

        it('should support Unicode tag names (Cyrillic)', () => {
            const document = new MockTextDocument(['  Assets:Cash  100.00 USD ; категория:подарки']);
            const position = new vscode.Position(0, 44);
            
            const result = analyzer.analyzePosition(document, position);
            
            expect(result.lineContext).toBe(LineContext.InTagValue);
            expect(result.allowedTypes).toContain('tag_value');
        });

        it('should support tag values with spaces', () => {
            const document = new MockTextDocument(['  Assets:Cash  100.00 USD ; project:web development']);
            const position = new vscode.Position(0, 50);
            
            const result = analyzer.analyzePosition(document, position);
            
            expect(result.lineContext).toBe(LineContext.InTagValue);
            expect(result.allowedTypes).toContain('tag_value');
        });

        it('should support tag names with hyphens and underscores', () => {
            const document = new MockTextDocument(['  Assets:Cash  100.00 USD ; tag_name:value']);
            const position = new vscode.Position(0, 42);
            
            const result = analyzer.analyzePosition(document, position);
            
            expect(result.lineContext).toBe(LineContext.InTagValue);
            expect(result.allowedTypes).toContain('tag_value');
        });

        it('should detect comment context without tag value when no colon', () => {
            const document = new MockTextDocument(['  Assets:Cash  100.00 USD ; regular comment']);
            const position = new vscode.Position(0, 40);
            
            const result = analyzer.analyzePosition(document, position);
            
            expect(result.lineContext).toBe(LineContext.InComment);
            expect(result.allowedTypes).toContain('tag');
            expect(result.allowedTypes).not.toContain('tag_value');
        });

        it('should handle multiple tags with comma separation', () => {
            const document = new MockTextDocument(['  Assets:Cash  100.00 USD ; category:food, type:grocery']);
            const position = new vscode.Position(0, 55); // Position after "type:grocer"
            
            const result = analyzer.analyzePosition(document, position);
            
            expect(result.lineContext).toBe(LineContext.InTagValue);
            expect(result.allowedTypes).toContain('tag_value');
        });

        it('should handle tag value context at semicolon position', () => {
            const document = new MockTextDocument(['  Assets:Cash  100.00 USD ; category:food; type:fuel']);
            const position = new vscode.Position(0, 52);
            
            const result = analyzer.analyzePosition(document, position);
            
            expect(result.lineContext).toBe(LineContext.InTagValue);
            expect(result.allowedTypes).toContain('tag_value');
        });

        it('should correctly handle tag values with single spaces but not double spaces', () => {
            // Test that single spaces in tag values work correctly
            const document1 = new MockTextDocument(['  Assets:Cash  100.00 USD ; project:web development tool']);
            const position1 = new vscode.Position(0, 56); // At end of "tool"
            
            const result1 = analyzer.analyzePosition(document1, position1);
            expect(result1.lineContext).toBe(LineContext.InTagValue);
            expect(result1.allowedTypes).toContain('tag_value');

            // Test that we correctly detect forbidden zones even in comments when appropriate
            // This is a more complex case - normally comments take priority, but we need to be careful
            // about the interaction between tag contexts and forbidden zones
        });

        it('should handle edge case with spaces in tag values vs forbidden zones', () => {
            // This test verifies the behavior when there might be confusion between
            // tag values with spaces and forbidden zones
            
            // Single space in tag value - should remain in tag context
            const document1 = new MockTextDocument(['  Assets:Cash  100.00 USD ; note:single space']);
            const position1 = new vscode.Position(0, 48); // At end of "space"
            const result1 = analyzer.analyzePosition(document1, position1);
            expect(result1.lineContext).toBe(LineContext.InTagValue);
            expect(result1.allowedTypes).toContain('tag_value');
            
            // The forbidden zone detection happens at a different level and takes
            // precedence over tag contexts when appropriate, but tags in comments
            // have special handling
        });
    });

    describe('Performance', () => {
        it('should analyze positions quickly', () => {
            const document = new MockTextDocument(['2024-01-15 Test transaction']);
            const position = new vscode.Position(0, 10);
            
            const startTime = Date.now();
            
            // Run analysis 1000 times
            for (let i = 0; i < 1000; i++) {
                analyzer.analyzePosition(document, position);
            }
            
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            // Should complete 1000 analyses in under 100ms
            expect(duration).toBeLessThan(100);
        });
    });

    describe('International Number Format Support', () => {
        it('should detect currency completion after comma decimal amount', () => {
            // European format: 111,50 EUR
            const document = new MockTextDocument(['  Assets:Checking  111,50 ']);
            const position = new vscode.Position(0, 26); // After space following comma decimal
            
            const result = analyzer.analyzePosition(document, position);
            
            expect(result.lineContext).toBe(LineContext.AfterAmount);
            expect(result.allowedTypes).toContain('commodity');
            expect(result.suppressAll).toBe(false);
        });

        it('should detect currency completion after period decimal amount', () => {
            // US format: 111.50 USD
            const document = new MockTextDocument(['  Assets:Checking  111.50 ']);
            const position = new vscode.Position(0, 26); // After space following period decimal
            
            const result = analyzer.analyzePosition(document, position);
            
            expect(result.lineContext).toBe(LineContext.AfterAmount);
            expect(result.allowedTypes).toContain('commodity');
            expect(result.suppressAll).toBe(false);
        });

        it('should detect forbidden zone after comma decimal + two spaces', () => {
            // European format: 111,50 + two spaces = forbidden zone
            const document = new MockTextDocument(['  Assets:Checking  111,50  text']);
            const position = new vscode.Position(0, 28); // After two spaces following comma decimal
            
            const result = analyzer.analyzePosition(document, position);
            
            expect(result.lineContext).toBe(LineContext.Forbidden);
            expect(result.suppressAll).toBe(true);
        });

        it('should detect forbidden zone after period decimal + two spaces', () => {
            // US format: 111.50 + two spaces = forbidden zone
            const document = new MockTextDocument(['  Assets:Checking  111.50  text']);
            const position = new vscode.Position(0, 28); // After two spaces following period decimal
            
            const result = analyzer.analyzePosition(document, position);
            
            expect(result.lineContext).toBe(LineContext.Forbidden);
            expect(result.suppressAll).toBe(true);
        });

        it('should handle grouped numbers with comma decimal (European)', () => {
            // European format: 1 234,56 EUR
            const document = new MockTextDocument(['  Assets:Bank  1 234,56 ']);
            const position = new vscode.Position(0, 24); // After space following grouped comma decimal
            
            const result = analyzer.analyzePosition(document, position);
            
            expect(result.lineContext).toBe(LineContext.AfterAmount);
            expect(result.allowedTypes).toContain('commodity');
        });

        it('should handle whole numbers without decimals', () => {
            // Whole number format: 150 EUR
            const document = new MockTextDocument(['  Assets:Cash  150 ']);
            const position = new vscode.Position(0, 19); // After space following whole number
            
            const result = analyzer.analyzePosition(document, position);
            
            expect(result.lineContext).toBe(LineContext.AfterAmount);
            expect(result.allowedTypes).toContain('commodity');
        });

        it('should handle crypto amounts with many decimal places', () => {
            // Crypto format: 0,00123456 BTC (comma decimal, many places)
            const document = new MockTextDocument(['  Assets:Bitcoin  0,00123456 ']);
            const position = new vscode.Position(0, 30); // After space following crypto amount
            
            const result = analyzer.analyzePosition(document, position);
            
            expect(result.lineContext).toBe(LineContext.AfterAmount);
            expect(result.allowedTypes).toContain('commodity');
        });
    });
});