import { HLedgerLexer, TokenType } from '../lexer/HLedgerLexer';
import { AmountParser } from './AmountParser';
import { ParsedTransaction, ParsedPosting } from './types';

export class TransactionExtractor {
    private static readonly KNOWN_DIRECTIVES = [
        'account ',
        'commodity ',
        'payee ',
        'tag ',
        'alias ',
        'include ',
        'decimal-mark ',
        'default commodity ',
        'Y ',
        'P ',
        'apply account',
        'end apply account',
        'comment',
        'end comment',
    ] as const;

    private readonly lexer: HLedgerLexer;
    private readonly amountParser: AmountParser;

    constructor() {
        this.lexer = new HLedgerLexer();
        this.amountParser = new AmountParser();
    }

    extractTransactions(content: string): ParsedTransaction[] {
        const lines = content.split('\n');
        const transactions: ParsedTransaction[] = [];

        let currentTransaction: {
            date: string;
            description: string;
            headerLineNumber: number;
        } | null = null;
        let currentPostings: ParsedPosting[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i]!;
            const trimmed = line.trim();

            if (!trimmed) {
                if (currentTransaction && currentPostings.length > 0) {
                    transactions.push(this.finalizeTransaction(currentTransaction, currentPostings));
                }
                currentTransaction = null;
                currentPostings = [];
                continue;
            }

            if (trimmed.startsWith(';') || trimmed.startsWith('#')) {
                continue;
            }

            if (trimmed.startsWith('~') || trimmed.startsWith('=')) {
                if (currentTransaction && currentPostings.length > 0) {
                    transactions.push(this.finalizeTransaction(currentTransaction, currentPostings));
                }
                currentTransaction = null;
                currentPostings = [];
                continue;
            }

            if (this.isDirective(trimmed)) {
                if (currentTransaction && currentPostings.length > 0) {
                    transactions.push(this.finalizeTransaction(currentTransaction, currentPostings));
                }
                currentTransaction = null;
                currentPostings = [];
                continue;
            }

            if (this.lexer.isTransactionLine(trimmed)) {
                if (currentTransaction && currentPostings.length > 0) {
                    transactions.push(this.finalizeTransaction(currentTransaction, currentPostings));
                }

                const transactionInfo = this.parseTransactionHeader(trimmed);
                currentTransaction = {
                    date: transactionInfo.date,
                    description: transactionInfo.description,
                    headerLineNumber: i,
                };
                currentPostings = [];
                continue;
            }

            if (currentTransaction && this.lexer.isPostingLine(line)) {
                if (trimmed.startsWith(';') || trimmed.startsWith('#')) {
                    continue;
                }

                const posting = this.amountParser.parsePostingLine(line, i);
                if (posting) {
                    currentPostings.push(posting);
                }
            }
        }

        if (currentTransaction && currentPostings.length > 0) {
            transactions.push(this.finalizeTransaction(currentTransaction, currentPostings));
        }

        return transactions;
    }

    private isDirective(line: string): boolean {
        return TransactionExtractor.KNOWN_DIRECTIVES.some(d => line.startsWith(d));
    }

    private parseTransactionHeader(line: string): { date: string; description: string } {
        const parts = line.split(/\s+/);
        const date = parts[0] ?? '';

        let descriptionStartIndex = 1;

        if (parts[1] && /^[*!]$/.test(parts[1])) {
            descriptionStartIndex = 2;
        }

        const codePart = parts[descriptionStartIndex];
        if (codePart && codePart.startsWith('(') && codePart.endsWith(')')) {
            descriptionStartIndex++;
        }

        const description = parts.slice(descriptionStartIndex).join(' ').split(/[;#]/)[0]?.trim() ?? '';

        return { date, description };
    }

    private finalizeTransaction(
        header: { date: string; description: string; headerLineNumber: number },
        postings: ParsedPosting[]
    ): ParsedTransaction {
        return {
            date: header.date,
            description: header.description,
            headerLineNumber: header.headerLineNumber,
            postings,
        };
    }
}
