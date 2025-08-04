import * as vscode from 'vscode';
import { BaseCompletionProvider, CompletionData } from '../base/BaseCompletionProvider';
import { CompletionItemOptions } from '../base/CompletionItemFactory';
import { HLEDGER_KEYWORDS } from '../../types';
import { ICompletionLimits, IFuzzyMatch } from '../../core/interfaces';

/**
 * Provides completion for hledger keywords/directives
 */
export class KeywordCompletionProvider extends BaseCompletionProvider {
    
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
        
        // Return keywords without artificial usage counts
        // Let FuzzyMatcher sort by relevance based on query match quality
        return {
            items: [...HLEDGER_KEYWORDS],
            query: typedText
            // No usageCounts - rely on FuzzyMatcher's relevance scoring
        };
    }
    
    protected getCompletionItemOptions(data: CompletionData): CompletionItemOptions {
        return {
            kind: vscode.CompletionItemKind.Keyword,
            detail: 'hledger directive'
        };
    }
    
    protected applyLimits(matches: IFuzzyMatch[], limits: ICompletionLimits): IFuzzyMatch[] {
        // Keywords use the general maxResults limit
        return matches.slice(0, limits.maxResults);
    }
}