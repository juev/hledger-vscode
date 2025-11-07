import * as vscode from 'vscode';
import { HledgerCliService, HledgerCliError, HledgerRunOptions } from '../cli/HledgerCliService';

export interface CommodityAmount {
    readonly commodity: string;
    readonly amount: number;
}

export interface BalanceSummary {
    readonly totals: CommodityAmount[];
}

export interface TransactionPosting {
    readonly account: string;
    readonly amounts: CommodityAmount[];
}

export interface RecentTransaction {
    readonly date: string;
    readonly description: string;
    readonly postings: TransactionPosting[];
}

export interface IncomeExpenseSummary {
    readonly periodLabel: string;
    readonly periodStart: string;
    readonly periodEnd: string;
    readonly income: BalanceSummary;
    readonly expenses: BalanceSummary;
    readonly net: BalanceSummary;
}

export interface DashboardData {
    readonly generatedAt: string;
    readonly workspaceName?: string;
    readonly balances: {
        readonly assets: BalanceSummary;
        readonly liabilities: BalanceSummary;
        readonly netWorth: BalanceSummary;
    };
    readonly incomeExpense: IncomeExpenseSummary;
    readonly topExpenses: Array<{ account: string; amount: CommodityAmount }>;
    readonly recentTransactions: RecentTransaction[];
    readonly warnings: string[];
}

interface BalanceQueryOptions {
    readonly folder?: vscode.WorkspaceFolder;
    readonly begin?: string;
    readonly end?: string;
    readonly extraArgs?: string[];
    readonly token?: vscode.CancellationToken;
}

interface ParsedCsvRecord {
    readonly [key: string]: string;
}

interface HledgerTransactionJson {
    readonly tdate?: string;
    readonly tdescription?: string;
    readonly tpostings?: HledgerPostingJson[];
}

interface HledgerPostingJson {
    readonly paccount?: string;
    readonly pamount?: HledgerAmountJson[];
}

interface HledgerAmountJson {
    readonly acommodity?: string;
    readonly aquantity?: {
        readonly floatingPoint?: number;
        readonly decimalPlaces?: number;
        readonly decimalMantissa?: number;
    };
}

export class DashboardDataService {
    private readonly cli: HledgerCliService;
    private readonly journalCache = new Map<string, string | null>();

    constructor(cli: HledgerCliService) {
        this.cli = cli;
    }

    async fetchDashboardData(folder?: vscode.WorkspaceFolder, token?: vscode.CancellationToken): Promise<DashboardData> {
        const warnings: string[] = [];

        const [assets, liabilities] = await Promise.all([
            this.safeBalanceQuery(['assets'], { folder, token }).catch(error => {
                warnings.push(this.describeError('assets balance', error));
                return { totals: [] };
            }),
            this.safeBalanceQuery(['liabilities'], { folder, token }).catch(error => {
                warnings.push(this.describeError('liabilities balance', error));
                return { totals: [] };
            })
        ]);

        const netWorth = this.combineSummaries(assets, liabilities);

        const incomeExpense = await this.safeIncomeExpenseSummary(folder, token).catch(error => {
            warnings.push(this.describeError('income & expenses', error));
            return this.emptyIncomeExpenseSummary();
        });

        const topExpenses = await this.safeTopExpenses(folder, token).catch(error => {
            warnings.push(this.describeError('top expenses', error));
            return [];
        });

        const recentTransactions = await this.safeRecentTransactions(folder, token).catch(error => {
            warnings.push(this.describeError('recent transactions', error));
            return [];
        });

        return {
            generatedAt: new Date().toISOString(),
            workspaceName: folder?.name ?? vscode.workspace.name ?? undefined,
            balances: {
                assets,
                liabilities,
                netWorth
            },
            incomeExpense,
            topExpenses,
            recentTransactions,
            warnings
        };
    }

    private async safeBalanceQuery(query: string[], options: BalanceQueryOptions): Promise<BalanceSummary> {
        const csv = await this.runBalanceCommand(query, options);
        return this.extractTotalsFromCsv(csv);
    }

    private async safeIncomeExpenseSummary(folder: vscode.WorkspaceFolder | undefined, token?: vscode.CancellationToken): Promise<IncomeExpenseSummary> {
        const { periodStart, periodEnd, label } = this.getCurrentMonthRange();
        const options: BalanceQueryOptions = { folder, begin: periodStart, end: periodEnd, token };

        const [income, expenses] = await Promise.all([
            this.safeBalanceQuery(['income'], options),
            this.safeBalanceQuery(['expenses'], options)
        ]);

        const net = this.combineSummaries(income, expenses);

        return {
            periodLabel: label,
            periodStart,
            periodEnd,
            income,
            expenses,
            net
        };
    }

    private emptyIncomeExpenseSummary(): IncomeExpenseSummary {
        const { periodStart, periodEnd, label } = this.getCurrentMonthRange();
        const empty: BalanceSummary = { totals: [] };
        return {
            periodLabel: label,
            periodStart,
            periodEnd,
            income: empty,
            expenses: empty,
            net: empty
        };
    }

    private async safeTopExpenses(folder: vscode.WorkspaceFolder | undefined, token?: vscode.CancellationToken): Promise<Array<{ account: string; amount: CommodityAmount }>> {
        const config = vscode.workspace.getConfiguration('hledger', folder);
        const limit = config.get<number>('dashboard.maxRecentTransactions', 10);

        const { periodStart, periodEnd } = this.getCurrentMonthRange();
        const csv = await this.runBalanceCommand(['expenses'], {
            folder,
            begin: periodStart,
            end: periodEnd,
            extraArgs: ['--flat', '--depth', '2'],
            token
        });

        return this.extractTopAccountsFromCsv(csv, limit);
    }

    private async safeRecentTransactions(folder: vscode.WorkspaceFolder | undefined, token?: vscode.CancellationToken): Promise<RecentTransaction[]> {
        const config = vscode.workspace.getConfiguration('hledger', folder);
        const recentDays = Math.max(1, config.get<number>('dashboard.recentDays', 14));
        const maxItems = Math.max(1, config.get<number>('dashboard.maxRecentTransactions', 10));

        const end = this.formatDate(new Date());
        const beginDate = new Date();
        beginDate.setDate(beginDate.getDate() - (recentDays - 1));
        const begin = this.formatDate(beginDate);

        const args = [...await this.getJournalArgs(folder), 'print', '-O', 'json', '-b', begin, '-e', this.nextDay(end)];
        const runOptions: HledgerRunOptions = { folder, cancellationToken: token };
        const transactions = await this.cli.runJson<HledgerTransactionJson[]>(args, runOptions);

        return this.transformTransactions(transactions, maxItems);
    }

    private async runBalanceCommand(query: string[], options: BalanceQueryOptions): Promise<string> {
        const args = [...await this.getJournalArgs(options.folder), 'balance', ...query];

        if (options.begin) {
            args.push('-b', options.begin);
        }
        if (options.end) {
            args.push('-e', options.end);
        }
        if (options.extraArgs) {
            args.push(...options.extraArgs);
        }

        args.push('-O', 'csv', '--layout', 'bare');

        return this.cli.run(args, {
            folder: options.folder,
            cancellationToken: options.token
        });
    }

    private async getJournalArgs(folder?: vscode.WorkspaceFolder): Promise<string[]> {
        const config = vscode.workspace.getConfiguration('hledger', folder);
        const configured = config.get<string>('cli.defaultJournal', '').trim();
        if (configured) {
            return [];
        }

        const cacheKey = folder ? folder.uri.toString() : '__default__';
        if (this.journalCache.has(cacheKey)) {
            const cached = this.journalCache.get(cacheKey);
            return cached ? ['-f', cached] : [];
        }

        const detected = await this.detectJournalFile(folder);
        this.journalCache.set(cacheKey, detected ?? null);
        return detected ? ['-f', detected] : [];
    }

    private async detectJournalFile(folder?: vscode.WorkspaceFolder): Promise<string | undefined> {
        try {
            const pattern = folder
                ? new vscode.RelativePattern(folder, '**/*.{journal,hledger,ledger}')
                : '**/*.{journal,hledger,ledger}';
            const ignore = '**/{.git,node_modules,out,dist,build,coverage}/**';
            const matches = await vscode.workspace.findFiles(pattern, ignore, 1);
            return matches[0]?.fsPath;
        } catch {
            return undefined;
        }
    }

    private extractTotalsFromCsv(csv: string): BalanceSummary {
        const records = this.parseCsv(csv);
        const totals = new Map<string, number>();

        for (const record of records) {
            const account = (record['account'] ?? '').toLowerCase();
            if (account === 'total:' || account === 'total') {
                const commodity = record['commodity'] ?? '';
                const amount = this.parseNumber(record['balance'] ?? '');
                totals.set(commodity, (totals.get(commodity) ?? 0) + amount);
            }
        }

        return { totals: this.mapToArray(totals) };
    }

    private extractTopAccountsFromCsv(csv: string, limit: number): Array<{ account: string; amount: CommodityAmount }> {
        const records = this.parseCsv(csv);
        const entries = records
            .filter(record => {
                const account = record['account'] ?? '';
                return account && account.toLowerCase() !== 'total:' && account.toLowerCase() !== 'total';
            })
            .map(record => ({
                account: record['account'] ?? '',
                commodity: record['commodity'] ?? '',
                amount: this.parseNumber(record['balance'] ?? '')
            }))
            .filter(entry => entry.amount !== 0);

        entries.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

        return entries.slice(0, limit).map(entry => ({
            account: entry.account,
            amount: { commodity: entry.commodity, amount: entry.amount }
        }));
    }

    private transformTransactions(transactions: HledgerTransactionJson[], limit: number): RecentTransaction[] {
        const summaries = transactions
            .map(txn => ({
                date: txn.tdate ?? '',
                description: txn.tdescription ?? '',
                postings: (txn.tpostings ?? []).map(posting => ({
                    account: posting.paccount ?? '',
                    amounts: (posting.pamount ?? []).map(amount => ({
                        commodity: amount.acommodity ?? '',
                        amount: this.parseAmountQuantity(amount)
                    })).filter(amount => amount.amount !== 0)
                })).filter(posting => posting.account)
            }))
            .filter(txn => txn.date || txn.description)
            .sort((a, b) => {
                if (a.date === b.date) {
                    return b.description.localeCompare(a.description);
                }
                return b.date.localeCompare(a.date);
            });

        return summaries.slice(0, limit);
    }

    private parseCsv(text: string): ParsedCsvRecord[] {
        const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
        if (lines.length === 0) {
            return [];
        }

        const headers = this.parseCsvLine(lines[0]).map(header => header.trim().toLowerCase());
        const records: ParsedCsvRecord[] = [];

        for (let i = 1; i < lines.length; i += 1) {
            const values = this.parseCsvLine(lines[i]);
            if (values.length === 0) {
                continue;
            }

            const record: ParsedCsvRecord = {};
            headers.forEach((header, index) => {
                record[header] = values[index]?.trim() ?? '';
            });
            records.push(record);
        }

        return records;
    }

    private parseCsvLine(line: string): string[] {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i += 1) {
            const char = line[i];

            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i += 1;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }

        result.push(current);
        return result;
    }

    private parseNumber(value: string): number {
        if (!value) {
            return 0;
        }
        const normalized = value.replace(/,/g, '');
        const parsed = Number(normalized);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    private parseAmountQuantity(amount: HledgerAmountJson): number {
        const qty = amount.aquantity;
        if (!qty) {
            return 0;
        }
        if (typeof qty.floatingPoint === 'number' && Number.isFinite(qty.floatingPoint)) {
            return qty.floatingPoint;
        }
        if (typeof qty.decimalMantissa === 'number' && typeof qty.decimalPlaces === 'number') {
            const scale = Math.pow(10, qty.decimalPlaces);
            return qty.decimalMantissa / scale;
        }
        return 0;
    }

    private mapToArray(map: Map<string, number>): CommodityAmount[] {
        return Array.from(map.entries())
            .map(([commodity, amount]) => ({ commodity, amount }))
            .sort((a, b) => a.commodity.localeCompare(b.commodity));
    }

    private combineSummaries(...summaries: BalanceSummary[]): BalanceSummary {
        const totals = new Map<string, number>();
        summaries.forEach(summary => {
            summary.totals.forEach(amount => {
                totals.set(amount.commodity, (totals.get(amount.commodity) ?? 0) + amount.amount);
            });
        });
        return { totals: this.mapToArray(totals) };
    }

    private getCurrentMonthRange(): { periodStart: string; periodEnd: string; label: string } {
        const today = new Date();
        const start = new Date(today.getFullYear(), today.getMonth(), 1);
        const end = new Date(today.getFullYear(), today.getMonth() + 1, 1);
        const formatter = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' });
        return {
            periodStart: this.formatDate(start),
            periodEnd: this.formatDate(end),
            label: formatter.format(start)
        };
    }

    private formatDate(date: Date): string {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    private nextDay(dateStr: string): string {
        const [year, month, day] = dateStr.split('-').map(part => parseInt(part, 10));
        const date = new Date(year, month - 1, day);
        date.setDate(date.getDate() + 1);
        return this.formatDate(date);
    }

    private describeError(context: string, error: unknown): string {
        if (error instanceof vscode.CancellationError) {
            return `${context} request was cancelled.`;
        }
        if (error instanceof HledgerCliError) {
            return `${context} failed: ${error.message}${error.stderr ? ` (${error.stderr.trim().split('\n')[0]})` : ''}`;
        }
        if (error instanceof Error) {
            return `${context} failed: ${error.message}`;
        }
        return `${context} failed due to an unknown error.`;
    }
}
