const vscode = require('vscode');

const hledgerKeywords = [
    'account', 'alias', 'apply account', 'end apply account',
    'comment', 'end comment', 'commodity', 'D', 'include',
    'P', 'year', 'Y'
];

const hledgerAccountPrefixes = [
    'Assets', 'Liabilities', 'Equity', 'Income', 'Expenses',
    'Revenue', 'Cash', 'Bank', 'Checking', 'Savings',
    'Credit Card', 'Investment', 'Payable', 'Receivable'
];

const hledgerCommodities = [
    'USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD',
    'CNY', 'INR', 'RUB', 'BRL', 'MXN', 'SEK', 'NOK',
    'DKK', 'PLN', 'TRY', 'KRW', 'SGD', 'HKD', 'NZD',
    'ZAR', 'THB', 'MYR', 'IDR', 'PHP', 'CZK', 'HUF',
    'BTC', 'ETH', 'USDT', 'BNB', 'XRP', 'ADA', 'DOGE'
];

function activate(context) {
    const keywordProvider = vscode.languages.registerCompletionItemProvider(
        'hledger',
        {
            provideCompletionItems(document, position) {
                const linePrefix = document.lineAt(position).text.substr(0, position.character);
                
                if (linePrefix.match(/^\s*$/)) {
                    return hledgerKeywords.map(keyword => {
                        const item = new vscode.CompletionItem(keyword, vscode.CompletionItemKind.Keyword);
                        item.detail = 'hledger directive';
                        return item;
                    });
                }
                
                return undefined;
            }
        }
    );

    const accountProvider = vscode.languages.registerCompletionItemProvider(
        'hledger',
        {
            provideCompletionItems(document, position) {
                const linePrefix = document.lineAt(position).text.substr(0, position.character);
                
                if (linePrefix.match(/^\s+\S*/)) {
                    const existingAccounts = [];
                    const text = document.getText();
                    const accountRegex = /^\s+([\w:]+)(?:\s|$)/gm;
                    let match;
                    
                    while ((match = accountRegex.exec(text)) !== null) {
                        if (!existingAccounts.includes(match[1])) {
                            existingAccounts.push(match[1]);
                        }
                    }
                    
                    const suggestions = [
                        ...existingAccounts.map(acc => {
                            const item = new vscode.CompletionItem(acc, vscode.CompletionItemKind.Reference);
                            item.detail = 'Existing account';
                            return item;
                        }),
                        ...hledgerAccountPrefixes.map(prefix => {
                            const item = new vscode.CompletionItem(prefix, vscode.CompletionItemKind.Class);
                            item.detail = 'Account prefix';
                            return item;
                        })
                    ];
                    
                    return suggestions;
                }
                
                return undefined;
            }
        }
    );

    const commodityProvider = vscode.languages.registerCompletionItemProvider(
        'hledger',
        {
            provideCompletionItems(document, position) {
                const linePrefix = document.lineAt(position).text.substr(0, position.character);
                
                if (linePrefix.match(/\s+[-+]?\d+([.,]\d+)*\s*$/)) {
                    const existingCommodities = [];
                    const text = document.getText();
                    const commodityRegex = /\b([A-Z]{3,4})\b/g;
                    let match;
                    
                    while ((match = commodityRegex.exec(text)) !== null) {
                        if (!existingCommodities.includes(match[1]) && !hledgerCommodities.includes(match[1])) {
                            existingCommodities.push(match[1]);
                        }
                    }
                    
                    const suggestions = [
                        ...existingCommodities.map(comm => {
                            const item = new vscode.CompletionItem(comm, vscode.CompletionItemKind.Unit);
                            item.detail = 'Used commodity';
                            return item;
                        }),
                        ...hledgerCommodities.map(comm => {
                            const item = new vscode.CompletionItem(comm, vscode.CompletionItemKind.Unit);
                            item.detail = 'Common commodity';
                            return item;
                        })
                    ];
                    
                    return suggestions;
                }
                
                return undefined;
            }
        }
    );

    const dateProvider = vscode.languages.registerCompletionItemProvider(
        'hledger',
        {
            provideCompletionItems(document, position) {
                const linePrefix = document.lineAt(position).text.substr(0, position.character);
                
                if (linePrefix.match(/^$/)) {
                    const today = new Date();
                    const dateStr = today.toISOString().split('T')[0];
                    
                    const item = new vscode.CompletionItem(dateStr, vscode.CompletionItemKind.Value);
                    item.detail = 'Today\'s date';
                    item.insertText = dateStr + ' ';
                    
                    return [item];
                }
                
                return undefined;
            }
        }
    );

    context.subscriptions.push(keywordProvider, accountProvider, commodityProvider, dateProvider);
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};