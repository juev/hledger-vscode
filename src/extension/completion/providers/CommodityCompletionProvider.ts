import * as vscode from 'vscode';
import { BaseCompletionProvider, CompletionData } from '../base/BaseCompletionProvider';
import { CompletionItemOptions } from '../base/CompletionItemFactory';
import { getConfig } from '../../main';
import { DEFAULT_COMMODITIES } from '../../types';

interface CommodityInfo {
    commodity: string;
    detail: string;
    priority: number;
    usageCount: number;
}

/**
 * Provides completion for commodity symbols after amounts in posting lines
 */
export class CommodityCompletionProvider extends BaseCompletionProvider {
    protected shouldProvideCompletions(
        document: vscode.TextDocument,
        position: vscode.Position
    ): boolean {
        const linePrefix = document.lineAt(position).text.substring(0, position.character);
        
        // Only provide commodity completions after an amount (digits with optional decimal)
        // Match: whitespace + optional sign + digits + optional decimal part + optional whitespace + typed text
        return linePrefix.match(/\s+[-+]?\d+([.,]\d+)*\s*\S*$/) !== null;
    }
    
    protected getCompletionData(
        document: vscode.TextDocument,
        position: vscode.Position
    ): CompletionData | null {
        const linePrefix = document.lineAt(position).text.substring(0, position.character);
        
        // Extract what user has typed after the amount
        const amountMatch = linePrefix.match(/\s+[-+]?\d+([.,]\d+)*\s*(\S*)$/);
        if (!amountMatch) {
            return null;
        }
        
        const typedText = amountMatch[2] || '';
        const config = getConfig(document);
        const commoditiesByUsage = config.getCommoditiesByUsage();
        
        // Build commodity info list with metadata
        const commodityInfoList: CommodityInfo[] = [];
        
        // Add configured commodities sorted by usage frequency
        commoditiesByUsage.forEach(({commodity, count}) => {
            commodityInfoList.push({
                commodity,
                detail: `Configured commodity (used ${count} times)`,
                priority: 1,
                usageCount: count
            });
        });
        
        // Add default commodities if they don't exist
        DEFAULT_COMMODITIES.forEach(commodity => {
            if (!commoditiesByUsage.some(c => c.commodity === commodity)) {
                commodityInfoList.push({
                    commodity,
                    detail: 'Default commodity',
                    priority: 2,
                    usageCount: 0
                });
            }
        });
        
        // Create usage counts map for fuzzy matcher
        const usageCounts = new Map<string, number>();
        commodityInfoList.forEach(info => {
            // Prioritize usage frequency with small priority bonus
            // Priority 1 (configured): +5 bonus, Priority 2 (default): +0 bonus
            const priorityBonus = info.priority === 1 ? 5 : 0;
            const score = info.usageCount + priorityBonus;
            usageCounts.set(info.commodity, score);
        });
        
        // Store commodity info in a map for later lookup
        this.commodityInfoMap = new Map<string, CommodityInfo>();
        commodityInfoList.forEach(info => {
            this.commodityInfoMap!.set(info.commodity, info);
        });
        
        return {
            items: commodityInfoList.map(info => info.commodity),
            query: typedText,
            usageCounts
        };
    }
    
    protected getCompletionItemOptions(data: CompletionData): CompletionItemOptions {
        // This will be customized per item
        return {
            kind: vscode.CompletionItemKind.Unit,
            detail: ''
        };
    }
    
    /**
     * Override to customize completion items with commodity-specific metadata
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
        
        // Customize each item with commodity-specific metadata
        return items.map(item => {
            const commodityInfo = this.commodityInfoMap?.get(item.label.toString());
            if (commodityInfo) {
                item.detail = commodityInfo.detail;
            }
            return item;
        });
    }
    
    // Temporary storage for commodity info during completion
    private commodityInfoMap?: Map<string, CommodityInfo>;
}