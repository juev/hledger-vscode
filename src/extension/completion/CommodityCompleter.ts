// CommodityCompleter.ts - Simple commodity completion logic
// ~50 lines according to REFACTORING.md FASE G

import * as vscode from 'vscode';
import { HLedgerConfig } from '../HLedgerConfig';
import { CompletionContext, CommodityCode } from '../types';
import { SimpleFuzzyMatcher, FuzzyMatch } from '../SimpleFuzzyMatcher';

export class CommodityCompleter {
    private fuzzyMatcher: SimpleFuzzyMatcher;

    constructor(private config: HLedgerConfig) {
        this.fuzzyMatcher = new SimpleFuzzyMatcher();
    }

    complete(context: CompletionContext): vscode.CompletionItem[] {
        const commodities = this.config.getCommoditiesByUsage();
        const matches = this.fuzzyMatcher.match(context.query, commodities, {
            usageCounts: this.config.commodityUsage,
            maxResults: 20
        });

        return matches.map(match => this.createCompletionItem(match, context));
    }

    private createCompletionItem(match: FuzzyMatch, context: CompletionContext): vscode.CompletionItem {
        const item = new vscode.CompletionItem(match.item, vscode.CompletionItemKind.Unit);
        item.detail = 'Commodity';
        item.sortText = this.getSortText(match);
        
        // Set replacement range if available
        if (context.range && context.position) {
            item.range = new vscode.Range(
                new vscode.Position(context.range.start.line, context.range.start.character),
                new vscode.Position(context.range.end.line, context.range.end.character)
            );
        }
        
        // Mark default commodity
        const defaultCommodity = this.config.getDefaultCommodity();
        if (match.item === defaultCommodity) {
            item.detail = 'Commodity (default)';
            item.documentation = new vscode.MarkdownString('Default commodity');
        }

        const usageCount = this.config.commodityUsage.get(match.item as CommodityCode) || 0;
        if (usageCount > 1) {
            const doc = item.documentation || new vscode.MarkdownString();
            if (doc instanceof vscode.MarkdownString) {
                doc.appendText(`\nUsed ${usageCount} times`);
                item.documentation = doc;
            }
        }

        return item;
    }

    private getSortText(match: FuzzyMatch): string {
        const scoreStr = (1000 - match.score).toString().padStart(4, '0');
        return `${scoreStr}_${match.item}`;
    }
}