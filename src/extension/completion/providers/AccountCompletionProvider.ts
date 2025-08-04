import * as vscode from 'vscode';
import { BaseCompletionProvider, CompletionData } from '../base/BaseCompletionProvider';
import { CompletionItemOptions } from '../base/CompletionItemFactory';
import { getConfig } from '../../main';
import { DEFAULT_ACCOUNT_PREFIXES } from '../../types';
import { ICompletionLimits, IFuzzyMatch } from '../../core/interfaces';

interface AccountInfo {
    account: string;
    kind: vscode.CompletionItemKind;
    detail: string;
    priority: number;
    usageCount: number;
}

/**
 * Provides completion for hledger accounts on posting lines
 */
export class AccountCompletionProvider extends BaseCompletionProvider {
    protected shouldProvideCompletions(
        document: vscode.TextDocument,
        position: vscode.Position
    ): boolean {
        const linePrefix = document.lineAt(position).text.substring(0, position.character);
        
        // Only provide account completions if this is clearly a posting line (starts with 2+ spaces)
        // Exclude lines that look like they already have amounts or dates
        return linePrefix.match(/^\s{2,}/) !== null && 
               !linePrefix.match(/\s+[-+]?\d+([.,]\d+)*\s*\S*$/) && 
               !linePrefix.match(/^\s*\d{1,4}[-/.]\d{0,2}/);
    }
    
    protected getCompletionData(
        document: vscode.TextDocument,
        position: vscode.Position
    ): CompletionData | null {
        const linePrefix = document.lineAt(position).text.substring(0, position.character);
        const config = getConfig(document);
        const accountsByUsage = config.getAccountsByUsage();
        const definedAccounts = config.getDefinedAccounts();
        
        // Extract what user has already typed after spaces
        const accountMatch = linePrefix.match(/^\s+(.*)$/);
        const typedText = accountMatch ? accountMatch[1] : '';
        
        // Build account info list with metadata
        const accountInfoList: AccountInfo[] = [];
        
        // Add accounts sorted by usage frequency
        accountsByUsage.forEach(({account, count}) => {
            const isDefined = definedAccounts.includes(account);
            accountInfoList.push({
                account,
                kind: isDefined ? vscode.CompletionItemKind.Class : vscode.CompletionItemKind.Reference,
                detail: isDefined ? `Defined account (used ${count} times)` : `Used account (${count} times)`,
                priority: isDefined ? 1 : 2,
                usageCount: count
            });
        });
        
        // Add default prefixes if they don't exist
        DEFAULT_ACCOUNT_PREFIXES.forEach(prefix => {
            if (!accountInfoList.some(info => info.account === prefix)) {
                accountInfoList.push({
                    account: prefix,
                    kind: vscode.CompletionItemKind.Folder,
                    detail: 'Default account prefix',
                    priority: 3,
                    usageCount: 0
                });
            }
        });
        
        // Create usage counts map for fuzzy matcher
        const usageCounts = new Map<string, number>();
        accountInfoList.forEach(info => {
            // Prioritize usage frequency with small priority bonus
            // Priority 1 (defined): +10 bonus, Priority 2 (used): +5 bonus, Priority 3 (default): +0 bonus
            const priorityBonus = info.priority === 1 ? 10 : info.priority === 2 ? 5 : 0;
            const score = info.usageCount + priorityBonus;
            usageCounts.set(info.account, score);
        });
        
        // Store account info in a map for later lookup
        this.accountInfoMap = new Map<string, AccountInfo>();
        accountInfoList.forEach(info => {
            this.accountInfoMap!.set(info.account, info);
        });
        
        return {
            items: accountInfoList.map(info => info.account),
            query: typedText,
            usageCounts
        };
    }
    
    protected getCompletionItemOptions(data: CompletionData): CompletionItemOptions {
        // This will be customized per item
        return {
            kind: vscode.CompletionItemKind.Reference,
            detail: ''
        };
    }
    
    protected applyLimits(matches: IFuzzyMatch[], limits: ICompletionLimits): IFuzzyMatch[] {
        // Accounts use maxAccountResults limit
        return matches.slice(0, limits.maxAccountResults);
    }
    
    /**
     * Override to customize completion items with account-specific metadata
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
        
        // Customize each item with account-specific metadata
        return items.map(item => {
            const accountInfo = this.accountInfoMap?.get(item.label.toString());
            if (accountInfo) {
                item.kind = accountInfo.kind;
                item.detail = accountInfo.detail;
            }
            return item;
        });
    }
    
    // Temporary storage for account info during completion
    private accountInfoMap?: Map<string, AccountInfo>;
}