import * as vscode from 'vscode';
import { BaseCompletionProvider, CompletionData } from '../base/BaseCompletionProvider';
import { CompletionItemOptions } from '../base/CompletionItemFactory';
import { HLEDGER_KEYWORDS } from '../../types';

/**
 * Provides completion for hledger keywords/directives
 */
export class KeywordCompletionProvider extends BaseCompletionProvider {
    // Common keywords that should be prioritized
    private static readonly COMMON_KEYWORDS = ['account', 'commodity', 'include', 'alias', 'payee'];
    
    protected shouldProvideCompletions(
        document: vscode.TextDocument,
        position: vscode.Position
    ): boolean {
        const linePrefix = document.lineAt(position).text.substring(0, position.character);
        
        // Provide keyword completions for directive lines (at start of line with minimal whitespace)
        // Avoid conflicts with AccountCompletionProvider which handles posting lines (significant indentation)
        return linePrefix.match(/^\s{0,1}\S*$/) !== null;
    }
    
    protected getCompletionData(
        document: vscode.TextDocument,
        position: vscode.Position
    ): CompletionData | null {
        const linePrefix = document.lineAt(position).text.substring(0, position.character);
        const typedText = linePrefix.trim();
        
        // Create usage counts based on keyword importance
        const usageCounts = new Map<string, number>();
        
        HLEDGER_KEYWORDS.forEach(keyword => {
            let score = 100; // Base score for all keywords
            
            // Prioritize commonly used directives
            if (KeywordCompletionProvider.COMMON_KEYWORDS.includes(keyword)) {
                score += 20;
            }
            
            // Shorter keywords get slight priority
            score += Math.max(0, 10 - keyword.length);
            
            usageCounts.set(keyword, score);
        });
        
        return {
            items: [...HLEDGER_KEYWORDS],
            query: typedText,
            usageCounts
        };
    }
    
    protected getCompletionItemOptions(data: CompletionData): CompletionItemOptions {
        return {
            kind: vscode.CompletionItemKind.Keyword,
            detail: 'hledger directive'
        };
    }
    
    protected applyLimits(matches: any[], limits: any): any[] {
        // Keywords use the general maxResults limit
        return matches.slice(0, limits.maxResults);
    }
}