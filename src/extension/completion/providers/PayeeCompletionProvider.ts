import * as vscode from 'vscode';
import { BaseCompletionProvider, CompletionData } from '../base/BaseCompletionProvider';
import { CompletionItemOptions } from '../base/CompletionItemFactory';
import { getConfig } from '../../main';

/**
 * Provides completion for payees in transaction description lines
 */
export class PayeeCompletionProvider extends BaseCompletionProvider {
    protected shouldProvideCompletions(
        document: vscode.TextDocument,
        position: vscode.Position
    ): boolean {
        const linePrefix = document.lineAt(position).text.substring(0, position.character);
        
        // Trigger after date pattern in transaction lines (support all hledger date formats)
        // Format: DATE [*|!] [CODE] DESCRIPTION
        const dateLineMatch = linePrefix.match(/^(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2})\s*(\*|!)?\s*(\([^)]+\))?\s*(.*)$/);
        
        if (!dateLineMatch) {
            return false;
        }
        
        const afterDateText = dateLineMatch[4];
        
        // Provide completions in these cases:
        // 1. There's text after the date/status/code (user is typing a payee)
        // 2. Line ends with exactly one space after date/status/code (ready for payee)
        // But not if there are multiple trailing spaces
        
        // Count trailing spaces
        const trailingSpaces = linePrefix.length - linePrefix.trimEnd().length;
        
        return afterDateText.length > 0 || (trailingSpaces === 1 && afterDateText.length === 0);
    }
    
    protected getCompletionData(
        document: vscode.TextDocument,
        position: vscode.Position
    ): CompletionData | null {
        const linePrefix = document.lineAt(position).text.substring(0, position.character);
        
        // Extract the text after date/status/code
        const dateLineMatch = linePrefix.match(/^(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2})\s*(\*|!)?\s*(\([^)]+\))?\s*(.*)$/);
        
        if (!dateLineMatch) {
            return null;
        }
        
        const typedText = dateLineMatch[4];
        const config = getConfig(document);
        const payeesByUsage = config.getPayeesByUsage();
        
        if (payeesByUsage.length === 0) {
            return null;
        }
        
        // Convert to string array for fuzzy matcher
        const items = payeesByUsage.map(p => p.payee);
        
        // Create usage counts map
        const usageCounts = new Map<string, number>();
        payeesByUsage.forEach(p => {
            usageCounts.set(p.payee, p.count);
        });
        
        return {
            items,
            query: typedText,
            usageCounts
        };
    }
    
    protected getCompletionItemOptions(data: CompletionData): CompletionItemOptions {
        return {
            kind: vscode.CompletionItemKind.Value,
            detail: 'Payee/Store'
        };
    }
    
    /**
     * Override to customize completion items with payee-specific metadata
     */
    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext
    ): vscode.ProviderResult<vscode.CompletionItem[]> {
        const items = super.provideCompletionItems(document, position, token, context);
        
        if (!items || !Array.isArray(items)) {
            return items;
        }
        
        // Customize details to show usage count
        return items.map(item => {
            const config = getConfig(document);
            const payeesByUsage = config.getPayeesByUsage();
            const payeeInfo = payeesByUsage.find(p => p.payee === item.label);
            
            if (payeeInfo && payeeInfo.count > 0) {
                item.detail = `Payee/Store (used ${payeeInfo.count} times)`;
            }
            
            return item;
        });
    }
}