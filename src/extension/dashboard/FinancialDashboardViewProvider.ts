import * as vscode from 'vscode';
import { DashboardDataService } from './DashboardDataService';

export class FinancialDashboardViewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
    static readonly viewType = 'hledger.dashboardView';

    private readonly disposables: vscode.Disposable[] = [];
    private webviewView: vscode.WebviewView | undefined;
    private refreshCancellation: vscode.CancellationTokenSource | undefined;
    private autoRefreshTimer: NodeJS.Timeout | undefined;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly dataService: DashboardDataService
    ) {
        const configurationSubscription = vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration('hledger.dashboard.autoRefreshInterval')) {
                this.scheduleAutoRefresh();
            }
        });
        this.disposables.push(configurationSubscription);
    }

    dispose(): void {
        this.refreshCancellation?.cancel();
        this.refreshCancellation?.dispose();
        this.clearAutoRefresh();
        this.disposables.forEach(disposable => disposable.dispose());
    }

    async resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ): Promise<void> {
        this.webviewView = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.context.extensionUri]
        };
        webviewView.webview.html = this.getHtml(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(message => {
            switch (message?.type) {
                case 'ready':
                    this.refresh();
                    break;
                case 'refresh':
                    this.refresh();
                    break;
                default:
                    break;
            }
        }, undefined, this.disposables);

        webviewView.onDidDispose(() => {
            this.webviewView = undefined;
            this.clearAutoRefresh();
        }, undefined, this.disposables);

        this.scheduleAutoRefresh();
    }

    async refresh(): Promise<void> {
        if (!this.webviewView) {
            return;
        }

        this.refreshCancellation?.cancel();
        this.refreshCancellation?.dispose();
        this.refreshCancellation = new vscode.CancellationTokenSource();

        this.postMessage({ type: 'loading' });

        try {
            const folder = vscode.workspace.workspaceFolders?.[0];
            const data = await this.dataService.fetchDashboardData(folder, this.refreshCancellation.token);
            this.postMessage({ type: 'data', payload: data });
        } catch (error) {
            if (error instanceof vscode.CancellationError) {
                return;
            }
            this.postMessage({ type: 'error', message: this.describeError(error) });
        }
    }

    private postMessage(message: unknown): void {
        this.webviewView?.webview.postMessage(message);
    }

    private scheduleAutoRefresh(): void {
        this.clearAutoRefresh();
        const folder = vscode.workspace.workspaceFolders?.[0];
        const config = vscode.workspace.getConfiguration('hledger', folder);
        const intervalSeconds = Math.max(0, config.get<number>('dashboard.autoRefreshInterval', 300));

        if (intervalSeconds <= 0) {
            return;
        }

        this.autoRefreshTimer = setInterval(() => {
            if (this.webviewView?.visible) {
                void this.refresh();
            }
        }, intervalSeconds * 1000);
    }

    private clearAutoRefresh(): void {
        if (this.autoRefreshTimer) {
            clearInterval(this.autoRefreshTimer);
            this.autoRefreshTimer = undefined;
        }
    }

    private describeError(error: unknown): string {
        if (error instanceof Error) {
            return error.message;
        }
        return 'Unexpected error while collecting hledger data.';
    }

    private getHtml(webview: vscode.Webview): string {
        const nonce = this.getNonce();
        const csp = [
            `default-src 'none'`,
            `style-src 'nonce-${nonce}'`,
            `script-src 'nonce-${nonce}'`,
            `img-src ${webview.cspSource} https: data:`
        ].join('; ');

        return /* html */ `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="${csp}">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>HLedger Dashboard</title>
    <style nonce="${nonce}">
        :root {
            color-scheme: light dark;
        }
        body {
            margin: 0;
            padding: 0.75rem;
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-sideBar-background);
        }
        h1 {
            font-size: 1.2rem;
            margin: 0 0 0.5rem 0;
        }
        h2 {
            font-size: 1rem;
            margin: 1rem 0 0.5rem 0;
        }
        .section {
            border: 1px solid var(--vscode-input-border);
            border-radius: 6px;
            padding: 0.75rem;
            margin-bottom: 1rem;
            background-color: var(--vscode-editor-background);
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 0.5rem;
        }
        .meta {
            font-size: 0.8rem;
            color: var(--vscode-descriptionForeground);
        }
        button {
            border: 1px solid var(--vscode-button-border, transparent);
            border-radius: 4px;
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            padding: 0.3rem 0.6rem;
            cursor: pointer;
        }
        button:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.9rem;
        }
        th, td {
            padding: 0.35rem 0.4rem;
            border-bottom: 1px solid var(--vscode-input-border);
            vertical-align: top;
        }
        th {
            text-align: left;
            font-weight: 600;
        }
        .positive {
            color: var(--vscode-testing-iconPassed);
        }
        .negative {
            color: var(--vscode-testing-iconFailed);
        }
        ul {
            list-style: none;
            padding-left: 0;
            margin: 0;
        }
        li + li {
            margin-top: 0.3rem;
        }
        .warning {
            background: var(--vscode-editorWarning-background);
            color: var(--vscode-editorWarning-foreground);
            border-radius: 4px;
            padding: 0.5rem;
            margin-top: 0.5rem;
        }
        .placeholder {
            color: var(--vscode-descriptionForeground);
            font-style: italic;
        }
        .loading {
            display: flex;
            gap: 0.5rem;
            align-items: center;
            color: var(--vscode-descriptionForeground);
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>HLedger Finance Dashboard</h1>
        <div>
            <button id="refreshButton">Refresh</button>
        </div>
    </div>
    <div class="meta" id="summaryMeta">Waiting for data…</div>

    <div id="warnings"></div>

    <div class="section">
        <h2>Account Balances</h2>
        <div id="balances"></div>
    </div>

    <div class="section">
        <h2>Income vs Expenses</h2>
        <div id="incomeExpense"></div>
    </div>

    <div class="section">
        <h2>Top Expenses (Current Month)</h2>
        <div id="topExpenses"></div>
    </div>

    <div class="section">
        <h2>Recent Transactions</h2>
        <div id="recentTransactions"></div>
    </div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        const state = {
            data: null,
            loading: false
        };

        const summaryMetaEl = document.getElementById('summaryMeta');
        const balancesEl = document.getElementById('balances');
        const incomeExpenseEl = document.getElementById('incomeExpense');
        const topExpensesEl = document.getElementById('topExpenses');
        const recentTransactionsEl = document.getElementById('recentTransactions');
        const warningsEl = document.getElementById('warnings');

        document.getElementById('refreshButton').addEventListener('click', () => {
            vscode.postMessage({ type: 'refresh' });
        });

        window.addEventListener('message', event => {
            const message = event.data;
            switch (message?.type) {
                case 'loading':
                    setLoading(true);
                    break;
                case 'data':
                    setLoading(false);
                    renderDashboard(message.payload);
                    break;
                case 'error':
                    setLoading(false);
                    showError(message.message);
                    break;
                default:
                    break;
            }
        });

        function setLoading(isLoading) {
            state.loading = isLoading;
            if (isLoading) {
                summaryMetaEl.innerHTML = '<div class="loading">Loading data…</div>';
            }
        }

        function renderDashboard(data) {
            state.data = data;
            if (!data) {
                summaryMetaEl.textContent = 'No data available.';
                return;
            }
            summaryMetaEl.textContent = buildSummaryMeta(data);
            renderWarnings(data.warnings ?? []);
            renderBalanceSummary(data.balances);
            renderIncomeExpense(data.incomeExpense);
            renderTopExpenses(data.topExpenses ?? []);
            renderRecentTransactions(data.recentTransactions ?? []);
        }

        function renderWarnings(warnings) {
            if (!warnings.length) {
                warningsEl.innerHTML = '';
                return;
            }
            warningsEl.innerHTML = warnings.map(text => '<div class="warning">' + escapeHtml(text) + '</div>').join('');
        }

        function renderBalanceSummary(balances) {
            if (!balances) {
                balancesEl.innerHTML = '<div class="placeholder">No balance information available.</div>';
                return;
            }
            const sections = [
                { label: 'Assets', summary: balances.assets },
                { label: 'Liabilities', summary: balances.liabilities },
                { label: 'Net Worth', summary: balances.netWorth }
            ];

            balancesEl.innerHTML = sections.map(section => renderSummaryTable(section.label, section.summary)).join('');
        }

        function renderIncomeExpense(summary) {
            if (!summary) {
                incomeExpenseEl.innerHTML = '<div class="placeholder">No income or expense data available.</div>';
                return;
            }
            const header = \`<div class="meta">\${escapeHtml(summary.periodLabel)} (\${escapeHtml(summary.periodStart)} → \${escapeHtml(summary.periodEnd)})</div>\`;
            const sections = [
                { label: 'Income', summary: summary.income },
                { label: 'Expenses', summary: summary.expenses },
                { label: 'Net', summary: summary.net }
            ];
            incomeExpenseEl.innerHTML = header + sections.map(section => renderSummaryTable(section.label, section.summary)).join('');
        }

        function renderTopExpenses(expenses) {
            if (!expenses.length) {
                topExpensesEl.innerHTML = '<div class="placeholder">No expenses recorded for this period.</div>';
                return;
            }
            const items = expenses.map(item => {
                const amount = formatAmount(item.amount);
                const cls = item.amount.amount >= 0 ? 'negative' : 'positive';
                return \`<li><strong>\${escapeHtml(item.account)}</strong>: <span class="\${cls}">\${escapeHtml(amount)}</span></li>\`;
            });
            topExpensesEl.innerHTML = '<ul>' + items.join('') + '</ul>';
        }

        function renderRecentTransactions(transactions) {
            if (!transactions.length) {
                recentTransactionsEl.innerHTML = '<div class="placeholder">No recent transactions found.</div>';
                return;
            }

            const rows = transactions.map(txn => {
                const postings = txn.postings.map(posting => {
                    const amounts = posting.amounts.map(formatAmount).join(', ');
                    return \`<div><strong>\${escapeHtml(posting.account)}</strong>: \${escapeHtml(amounts)}</div>\`;
                }).join('');
                return \`<tr>
                    <td>\${escapeHtml(txn.date)}</td>
                    <td>\${escapeHtml(txn.description || '')}</td>
                    <td>\${postings}</td>
                </tr>\`;
            });

            recentTransactionsEl.innerHTML = '<table><thead><tr><th>Date</th><th>Description</th><th>Postings</th></tr></thead><tbody>' + rows.join('') + '</tbody></table>';
        }

        function renderSummaryTable(title, summary) {
            if (!summary || !Array.isArray(summary.totals) || summary.totals.length === 0) {
                return \`<div class="placeholder">\${escapeHtml(title)}: no data</div>\`;
            }
            const rows = summary.totals.map(item => {
                const formatted = formatAmount(item);
                const cls = item.amount >= 0 ? 'positive' : 'negative';
                return \`<tr><th>\${escapeHtml(title)}</th><td>\${escapeHtml(item.commodity || '')}</td><td class="\${cls}">\${escapeHtml(formatted)}</td></tr>\`;
            });
            return '<table>' + rows.join('') + '</table>';
        }

        function formatAmount(amount) {
            const formatter = new Intl.NumberFormat(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
            const formatted = formatter.format(amount.amount ?? 0);
            const commodity = amount.commodity ?? '';
            return commodity ? \`\${formatted} \${commodity}\` : formatted;
        }

        function buildSummaryMeta(data) {
            const generatedAt = new Date(data.generatedAt);
            const timestamp = Number.isNaN(generatedAt.getTime()) ? data.generatedAt : generatedAt.toLocaleString();
            return \`Last updated: \${timestamp}\${data.workspaceName ? \` • Workspace: \${escapeHtml(data.workspaceName)}\` : ''}\`;
        }

        function showError(message) {
            warningsEl.innerHTML = '<div class="warning">' + escapeHtml(message) + '</div>';
        }

        function escapeHtml(value) {
            return String(value ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        vscode.postMessage({ type: 'ready' });
    </script>
</body>
</html>`;
    }

    private getNonce(): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const length = 32;
        let nonce = '';
        for (let i = 0; i < length; i += 1) {
            nonce += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return nonce;
    }
}
