import * as vscode from 'vscode';
import { BaseCompletionProvider, CompletionData } from '../base/BaseCompletionProvider';
import { CompletionItemOptions } from '../base/CompletionItemFactory';

/**
 * Provides completion for dates at the beginning of transaction lines
 */
export class DateCompletionProvider extends BaseCompletionProvider {
    protected shouldProvideCompletions(
        document: vscode.TextDocument,
        position: vscode.Position
    ): boolean {
        const linePrefix = document.lineAt(position).text.substring(0, position.character);
        
        // Only provide date completions at the start of a line (transaction dates)
        // Support empty line or partial date input (all hledger date formats)
        return linePrefix.match(/^$/) !== null || 
               linePrefix.match(/^\d{0,4}[-/.]?\d{0,2}[-/.]?\d{0,2}$/) !== null;
    }
    
    protected getCompletionData(
        document: vscode.TextDocument,
        position: vscode.Position
    ): CompletionData | null {
        const linePrefix = document.lineAt(position).text.substring(0, position.character);
        // Only get the date pattern that was typed, not the entire line
        const dateMatch = linePrefix.match(/^(\d{0,4}[-/.]?\d{0,2}[-/.]?\d{0,2})$/);
        const typedText = dateMatch ? dateMatch[1] : '';
        
        // Find unique dates with their positions
        const dateInfoMap = this.collectDateInfo(document, position);
        
        // Get today and yesterday
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        
        // Build items array with all dates
        const items: string[] = [];
        const usageCounts = new Map<string, number>();
        
        // Find the most recent date before current position
        const lastTransactionDate = this.findLastTransactionDate(document, position);
        
        // Add dates with priority scores
        // 1. Last transaction date (highest priority)
        if (lastTransactionDate && lastTransactionDate !== todayStr) {
            items.push(lastTransactionDate);
            usageCounts.set(lastTransactionDate, 10000);
        }
        
        // 2. Today's date
        items.push(todayStr);
        usageCounts.set(todayStr, lastTransactionDate === todayStr ? 10000 : 9000);
        
        // 3. Yesterday's date
        if (yesterdayStr !== lastTransactionDate) {
            items.push(yesterdayStr);
            usageCounts.set(yesterdayStr, 8000);
        }
        
        // 4. All other previous dates (sorted by recency)
        const allDates = this.getAllPreviousDates(document, position);
        allDates.forEach((date, index) => {
            if (date !== lastTransactionDate && date !== todayStr && date !== yesterdayStr) {
                items.push(date);
                // Score based on recency (more recent = higher score)
                usageCounts.set(date, 7000 - index * 10);
            }
        });
        
        // Store date details for later lookup
        this.dateDetailsMap = new Map<string, string>();
        if (lastTransactionDate && lastTransactionDate !== todayStr) {
            this.dateDetailsMap.set(lastTransactionDate, 'Last transaction date');
        }
        this.dateDetailsMap.set(todayStr, "Today's date");
        if (yesterdayStr !== lastTransactionDate) {
            this.dateDetailsMap.set(yesterdayStr, "Yesterday's date");
        }
        allDates.forEach(date => {
            if (!this.dateDetailsMap!.has(date)) {
                this.dateDetailsMap!.set(date, 'Previous date');
            }
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
            detail: ''
        };
    }
    
    /**
     * Override to customize completion items with date-specific metadata
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
        
        // Customize each item with date-specific details
        return items.map((item, index) => {
            const detail = this.dateDetailsMap?.get(item.label.toString());
            if (detail) {
                item.detail = detail;
            }
            
            // Mark first few items as preselect for better UX
            if (index < 2) {
                item.preselect = true;
            }
            
            // Ensure space is added after date - but use insertText, not override existing
            if (!item.insertText || item.insertText === item.label) {
                item.insertText = item.label.toString() + ' ';
            } else if (typeof item.insertText === 'string') {
                item.insertText = item.insertText + ' ';
            }
            
            return item;
        });
    }
    
    private findLastTransactionDate(document: vscode.TextDocument, position: vscode.Position): string | null {
        // Search backwards from current position to find the most recent transaction date
        for (let i = position.line - 1; i >= 0; i--) {
            const line = document.lineAt(i);
            const dateMatch = line.text.trim().match(/^(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2})/);
            if (dateMatch) {
                return dateMatch[1];
            }
        }
        return null;
    }
    
    private getAllPreviousDates(document: vscode.TextDocument, position: vscode.Position): string[] {
        const dates: string[] = [];
        const seenDates = new Set<string>();
        
        // Search all lines before current position
        for (let i = position.line - 1; i >= 0; i--) {
            const line = document.lineAt(i);
            const dateMatch = line.text.trim().match(/^(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2})/);
            if (dateMatch && !seenDates.has(dateMatch[1])) {
                dates.push(dateMatch[1]);
                seenDates.add(dateMatch[1]);
            }
        }
        
        return dates;
    }
    
    private collectDateInfo(document: vscode.TextDocument, position: vscode.Position): Map<string, number> {
        const dateInfo = new Map<string, number>();
        
        // Count occurrences of each date
        for (let i = 0; i < document.lineCount && i < position.line; i++) {
            const line = document.lineAt(i);
            const dateMatch = line.text.trim().match(/^(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2})/);
            if (dateMatch) {
                const date = dateMatch[1];
                dateInfo.set(date, (dateInfo.get(date) || 0) + 1);
            }
        }
        
        return dateInfo;
    }
    
    // Temporary storage for date details during completion
    private dateDetailsMap?: Map<string, string>;
}