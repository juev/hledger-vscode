// StrictPositionAnalyzer.test.ts - Tests for strict position analysis
import * as vscode from 'vscode';
import { StrictPositionAnalyzer, LineContext, StrictCompletionContext } from '../strict/StrictPositionAnalyzer';

// Import MockTextDocument from the mock
const { MockTextDocument } = vscode as any;

describe('StrictPositionAnalyzer', () => {
    let analyzer: StrictPositionAnalyzer;

    beforeEach(() => {
        analyzer = new StrictPositionAnalyzer();
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
        it('should detect currency context after amount with single space', () => {
            const document = new MockTextDocument(['  Assets:Cash  100.00 USD']);
            const position = new vscode.Position(0, 25);
            
            const result = analyzer.analyzePosition(document, position);
            
            expect(result.lineContext).toBe(LineContext.AfterAmount);
            expect(result.allowedTypes).toContain('commodity');
        });

        it('should detect currency context for partial currency', () => {
            const document = new MockTextDocument(['  Assets:Cash  100.00 U']);
            const position = new vscode.Position(0, 23);
            
            const result = analyzer.analyzePosition(document, position);
            
            expect(result.lineContext).toBe(LineContext.AfterAmount);
            expect(result.allowedTypes).toContain('commodity');
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
            const document = new MockTextDocument(['  Assets:Cash  100.00  ; some comment']);
            const position = new vscode.Position(0, 30);
            
            const result = analyzer.analyzePosition(document, position);
            
            expect(result.lineContext).toBe(LineContext.Forbidden);
            expect(result.suppressAll).toBe(true);
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
});