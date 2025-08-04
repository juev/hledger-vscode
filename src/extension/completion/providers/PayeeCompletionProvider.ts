import * as vscode from 'vscode';
import { BaseCompletionProvider, CompletionData } from '../base/BaseCompletionProvider';
import { CompletionItemOptions } from '../base/CompletionItemFactory';
import { getConfig } from '../../main';
import { PayeeName, unbranded } from '../../types';

interface PayeeInfo {
    payee: PayeeName;
    detail: string;
    usageCount: number;
}

/**
 * Provides completion for payees in transaction description lines
 */
export class PayeeCompletionProvider extends BaseCompletionProvider {
    // Temporary storage for payee info during completion
    private payeeInfoMap?: Map<string, PayeeInfo>;
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
        
        // Build payee info list with metadata
        const payeeInfoList: PayeeInfo[] = payeesByUsage.map(({payee, count}) => ({
            payee,
            detail: count > 0 ? `Payee/Store (used ${count} times)` : 'Payee/Store',
            usageCount: count
        }));
        
        // Create usage counts map for fuzzy matcher
        const usageCounts = new Map<string, number>();
        payeeInfoList.forEach(info => {
            usageCounts.set(unbranded(info.payee), info.usageCount);
        });
        
        // Store payee info in a map for later lookup
        this.payeeInfoMap = new Map<string, PayeeInfo>();
        payeeInfoList.forEach(info => {
            this.payeeInfoMap!.set(unbranded(info.payee), info);
        });
        
        return {
            items: payeeInfoList.map(info => unbranded(info.payee)),
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
        
        // Customize each item with payee-specific metadata
        return items.map(item => {
            const payeeInfo = this.payeeInfoMap?.get(item.label.toString());
            if (payeeInfo) {
                item.detail = payeeInfo.detail;
            }
            return item;
        });
    }
    
    /**
     * Invalidates cached payee information
     */
    public invalidateCache(): void {
        this.payeeInfoMap = undefined;
    }
}