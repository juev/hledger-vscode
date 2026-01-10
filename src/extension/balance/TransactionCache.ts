import { ParsedTransaction } from './types';
import { TransactionExtractor } from './TransactionExtractor';
import { NumberFormatContext } from './AmountParser';

interface CachedDocument {
    contentLines: readonly string[];
    transactions: readonly CachedTransaction[];
    parsedTransactions: readonly ParsedTransaction[];
}

interface CachedTransaction {
    transaction: ParsedTransaction;
    startLine: number;
    endLine: number;
    contentHash: string;
}

export class TransactionCache {
    private readonly cache = new Map<string, CachedDocument>();
    private readonly extractor = new TransactionExtractor();

    getTransactions(
        documentUri: string,
        content: string,
        formatContext?: NumberFormatContext
    ): ParsedTransaction[] {
        const newLines = content.split('\n');
        const cached = this.cache.get(documentUri);

        // First time parsing this document
        if (!cached) {
            return this.fullParse(documentUri, content, newLines, formatContext);
        }

        // Content unchanged - return cached
        if (this.contentEqual(cached.contentLines, newLines)) {
            return cached.parsedTransactions as ParsedTransaction[];
        }

        // Content changed - do incremental parse
        return this.incrementalParse(documentUri, cached, content, newLines, formatContext);
    }

    invalidate(documentUri: string): void {
        this.cache.delete(documentUri);
    }

    clear(): void {
        this.cache.clear();
    }

    private fullParse(
        documentUri: string,
        content: string,
        lines: readonly string[],
        formatContext?: NumberFormatContext
    ): ParsedTransaction[] {
        const transactions = this.extractor.extractTransactions(content, formatContext);
        const cachedTransactions = this.buildCachedTransactions(transactions, lines);

        this.cache.set(documentUri, {
            contentLines: lines,
            transactions: cachedTransactions,
            parsedTransactions: transactions,
        });

        return transactions;
    }

    private incrementalParse(
        documentUri: string,
        cached: CachedDocument,
        content: string,
        newLines: readonly string[],
        formatContext?: NumberFormatContext
    ): ParsedTransaction[] {
        const changedRanges = this.detectChangedLineRanges(
            cached.contentLines as string[],
            newLines as string[]
        );

        // If massive changes or line count differs significantly, do full re-parse
        const lineDiff = Math.abs(newLines.length - cached.contentLines.length);
        if (changedRanges.length > cached.transactions.length / 2 || lineDiff > 50) {
            return this.fullParse(documentUri, content, newLines, formatContext);
        }

        // Find which cached transactions are affected
        const affectedIndices = this.findAffectedTransactions(
            cached.transactions,
            changedRanges,
            lineDiff
        );

        // If all or most transactions affected, do full re-parse
        if (affectedIndices.size >= cached.transactions.length * 0.7) {
            return this.fullParse(documentUri, content, newLines, formatContext);
        }

        // Re-parse the entire document to get accurate transactions with correct line numbers
        // This is simpler and more reliable than trying to merge partial parses
        const transactions = this.extractor.extractTransactions(content, formatContext);
        const cachedTransactions = this.buildCachedTransactions(transactions, newLines);

        this.cache.set(documentUri, {
            contentLines: newLines,
            transactions: cachedTransactions,
            parsedTransactions: transactions,
        });

        return transactions;
    }

    private buildCachedTransactions(
        transactions: readonly ParsedTransaction[],
        lines: readonly string[]
    ): CachedTransaction[] {
        return transactions.map(txn => {
            const startLine = txn.headerLineNumber;
            const endLine = this.findTransactionEndLine(txn, lines);
            const contentHash = this.computeLineHash(lines, startLine, endLine);

            return {
                transaction: txn,
                startLine,
                endLine,
                contentHash,
            };
        });
    }

    private findTransactionEndLine(
        transaction: ParsedTransaction,
        lines: readonly string[]
    ): number {
        const { headerLineNumber, postings } = transaction;

        if (postings.length === 0) {
            return headerLineNumber;
        }

        // Find the last posting's line number
        const lastPostingLine = Math.max(...postings.map(p => p.lineNumber));

        // Look for additional lines (comments, etc.) that belong to this transaction
        let endLine = lastPostingLine;
        for (let i = lastPostingLine + 1; i < lines.length; i++) {
            const line = lines[i];
            if (line === undefined) break;

            const trimmed = line.trim();

            // Empty line ends transaction
            if (!trimmed) break;

            // Non-indented line starts new transaction/directive
            if (!/^\s/.test(line)) break;

            // Indented comment or continuation - part of transaction
            endLine = i;
        }

        return endLine;
    }

    private detectChangedLineRanges(
        oldLines: string[],
        newLines: string[]
    ): Array<{ start: number; end: number }> {
        const changes: Array<{ start: number; end: number }> = [];
        const maxLen = Math.max(oldLines.length, newLines.length);
        let changeStart = -1;

        for (let i = 0; i < maxLen; i++) {
            const oldLine = oldLines[i] ?? '';
            const newLine = newLines[i] ?? '';

            if (oldLine !== newLine) {
                if (changeStart === -1) changeStart = i;
            } else {
                if (changeStart !== -1) {
                    changes.push({ start: changeStart, end: i - 1 });
                    changeStart = -1;
                }
            }
        }

        if (changeStart !== -1) {
            changes.push({ start: changeStart, end: maxLen - 1 });
        }

        return changes;
    }

    private findAffectedTransactions(
        cachedTransactions: readonly CachedTransaction[],
        changedRanges: readonly { start: number; end: number }[],
        _lineDiff: number
    ): Set<number> {
        const affected = new Set<number>();

        for (let i = 0; i < cachedTransactions.length; i++) {
            const txn = cachedTransactions[i]!;

            for (const range of changedRanges) {
                // Check if transaction overlaps with changed range
                if (this.rangesOverlap(txn.startLine, txn.endLine, range.start, range.end)) {
                    affected.add(i);
                    break;
                }

                // If change is before this transaction and lines were added/removed,
                // this transaction's line numbers need updating
                if (range.end < txn.startLine) {
                    affected.add(i);
                    break;
                }
            }
        }

        return affected;
    }

    private rangesOverlap(
        start1: number,
        end1: number,
        start2: number,
        end2: number
    ): boolean {
        return start1 <= end2 && end1 >= start2;
    }

    private contentEqual(
        oldLines: readonly string[],
        newLines: readonly string[]
    ): boolean {
        if (oldLines.length !== newLines.length) return false;

        for (let i = 0; i < oldLines.length; i++) {
            if (oldLines[i] !== newLines[i]) return false;
        }

        return true;
    }

    private computeLineHash(
        lines: readonly string[],
        start: number,
        end: number
    ): string {
        // Simple hash: concatenate lines with separator
        const relevantLines: string[] = [];
        for (let i = start; i <= end && i < lines.length; i++) {
            relevantLines.push(lines[i] ?? '');
        }
        return relevantLines.join('\n');
    }
}
