// DateCompleter.ts - Simple date completion logic
// ~50 lines according to REFACTORING.md FASE G

import * as vscode from 'vscode';
import { HLedgerConfig } from '../HLedgerConfig';
import { CompletionContext, ValidationResult, validationSuccess, validationFailure } from '../types';

// Enum for date completion types with better type safety
const enum DateCompletionType {
    Today = 'Today',
    Yesterday = 'Yesterday',
    LastWeek = 'Last week',
    MonthStart = 'Month start',
    LastMonthStart = 'Last month start',
    LastUsed = 'Last used date'
}

// Date format enum for type safety
const enum DateFormat {
    Full = 'full',        // YYYY-MM-DD
    Short = 'short'       // MM-DD
}

// Pre-compiled regex patterns for performance
const DatePatterns = {
    SHORT_FORMAT_QUERY: /^(0[1-9]|1[0-2])[-\/]?/,
    NUMERIC_QUERY: /^[0-9]{1,2}$/,
    DATE_PARTS: /^(\d{4})-(\d{2})-(\d{2})$/
} as const;

export class DateCompleter {
    constructor(private readonly config: HLedgerConfig) {}

    complete(context: CompletionContext): vscode.CompletionItem[] {
        // Validate input context
        const validation = this.validateCompletionContext(context);
        if (!validation.isValid) {
            // Return empty array if validation fails, but log errors in development
            if (process.env.NODE_ENV !== 'test') {
                console.warn('Date completion validation failed:', validation.errors);
            }
            return [];
        }

        const completions: vscode.CompletionItem[] = [];
        const query = context.query.toLowerCase();

        // Determine if we should suggest short or full format dates
        const useShortFormat = this.shouldUseShortFormat(query);

        // Today's date
        const today = new Date();
        completions.push(this.createDateItem(today, DateCompletionType.Today, useShortFormat, context));

        // Yesterday
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        completions.push(this.createDateItem(yesterday, DateCompletionType.Yesterday, useShortFormat, context));

        // Last week (7 days ago)
        const lastWeek = new Date(today);
        lastWeek.setDate(lastWeek.getDate() - 7);
        completions.push(this.createDateItem(lastWeek, DateCompletionType.LastWeek, useShortFormat, context));

        // Start of this month
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        completions.push(this.createDateItem(monthStart, DateCompletionType.MonthStart, useShortFormat, context));

        // Last month start
        const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        completions.push(this.createDateItem(lastMonthStart, DateCompletionType.LastMonthStart, useShortFormat, context));

        // Use last date from ledger if available
        const lastDate = this.config.getLastDate();
        if (lastDate) {
            // Convert last date to appropriate format if needed
            const formattedLastDate = useShortFormat ? this.convertToShortFormat(lastDate) : lastDate;
            const item = new vscode.CompletionItem(formattedLastDate, vscode.CompletionItemKind.Reference);
            item.detail = DateCompletionType.LastUsed;
            item.sortText = '0000_last';
            
            // Set replacement range if available
            if (context.range && context.position) {
                item.range = new vscode.Range(
                    new vscode.Position(context.range.start.line, context.range.start.character),
                    new vscode.Position(context.range.end.line, context.range.end.character)
                );
            }
            
            completions.push(item);
        }

        return completions;
    }

    private validateCompletionContext(context: CompletionContext): ValidationResult<CompletionContext> {
        const errors: string[] = [];

        if (context.type !== 'date') {
            errors.push(`Expected completion type 'date', got '${context.type}'`);
        }

        if (typeof context.query !== 'string') {
            errors.push('Query must be a string');
        }

        if (errors.length > 0) {
            return validationFailure(errors);
        }

        return validationSuccess(context);
    }

    private shouldUseShortFormat(query: string): boolean {
        // If query starts with 2 digits (like "08"), it's likely a month-day format
        return DatePatterns.SHORT_FORMAT_QUERY.test(query) || DatePatterns.NUMERIC_QUERY.test(query);
    }

    private createDateItem(date: Date, description: DateCompletionType, useShortFormat = false, context?: CompletionContext): vscode.CompletionItem {
        const dateStr = useShortFormat ? this.formatShortDate(date) : this.formatDate(date);
        const item = new vscode.CompletionItem(dateStr, vscode.CompletionItemKind.Constant);
        item.detail = description;
        item.documentation = new vscode.MarkdownString(`${description}: ${dateStr}`);
        item.sortText = `${this.getSortPrefix(description)}_${dateStr}`;
        
        // Set replacement range if available
        if (context?.range && context.position) {
            item.range = new vscode.Range(
                new vscode.Position(context.range.start.line, context.range.start.character),
                new vscode.Position(context.range.end.line, context.range.end.character)
            );
        }
        
        return item;
    }

    private formatDate(date: Date): string {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    private formatShortDate(date: Date): string {
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${month}-${day}`;
    }

    private convertToShortFormat(fullDate: string): string {
        // Convert "2024-01-15" to "01-15" with type-safe parsing
        const match = fullDate.match(DatePatterns.DATE_PARTS);
        if (match) {
            const [, , month, day] = match;
            return `${month}-${day}`;
        }
        return fullDate; // Return as-is if can't parse
    }

    private getSortPrefix(description: DateCompletionType): string {
        switch (description) {
            case DateCompletionType.Today: return '0001';
            case DateCompletionType.Yesterday: return '0002';
            case DateCompletionType.LastWeek: return '0003';
            case DateCompletionType.MonthStart: return '0004';
            case DateCompletionType.LastMonthStart: return '0005';
            case DateCompletionType.LastUsed: return '0000';
            default: {
                // Exhaustive check - TypeScript will error if we miss a case
                const _exhaustiveCheck: never = description;
                return '0099';
            }
        }
    }
}