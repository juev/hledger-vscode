// DateCompleter.ts - Simple date completion logic
// ~50 lines according to REFACTORING.md FASE G

import * as vscode from 'vscode';
import { HLedgerConfig } from '../HLedgerConfig';
import { CompletionContext } from '../types';

export class DateCompleter {
    constructor(private config: HLedgerConfig) {}

    complete(context: CompletionContext): vscode.CompletionItem[] {
        const completions: vscode.CompletionItem[] = [];

        // Today's date
        const today = new Date();
        completions.push(this.createDateItem(today, 'Today'));

        // Yesterday
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        completions.push(this.createDateItem(yesterday, 'Yesterday'));

        // Last week (7 days ago)
        const lastWeek = new Date(today);
        lastWeek.setDate(lastWeek.getDate() - 7);
        completions.push(this.createDateItem(lastWeek, 'Last week'));

        // Start of this month
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        completions.push(this.createDateItem(monthStart, 'Month start'));

        // Last month start
        const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        completions.push(this.createDateItem(lastMonthStart, 'Last month start'));

        // Use last date from ledger if available
        const lastDate = this.config.getLastDate();
        if (lastDate) {
            const item = new vscode.CompletionItem(lastDate, vscode.CompletionItemKind.Reference);
            item.detail = 'Last used date';
            item.sortText = '0000_last';
            completions.push(item);
        }

        return completions;
    }

    private createDateItem(date: Date, description: string): vscode.CompletionItem {
        const dateStr = this.formatDate(date);
        const item = new vscode.CompletionItem(dateStr, vscode.CompletionItemKind.Constant);
        item.detail = description;
        item.documentation = new vscode.MarkdownString(`${description}: ${dateStr}`);
        item.sortText = `${this.getSortPrefix(description)}_${dateStr}`;
        
        return item;
    }

    private formatDate(date: Date): string {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    private getSortPrefix(description: string): string {
        switch (description) {
            case 'Today': return '0001';
            case 'Yesterday': return '0002';
            case 'Last week': return '0003';
            case 'Month start': return '0004';
            case 'Last month start': return '0005';
            default: return '0099';
        }
    }
}