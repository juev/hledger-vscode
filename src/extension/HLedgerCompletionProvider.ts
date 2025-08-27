// HLedgerCompletionProvider.ts - Unified completion provider
// ~150 lines according to REFACTORING.md FASE G
// Coordinates all completion types through modular completers

import * as vscode from 'vscode';
import { HLedgerConfig } from './HLedgerConfig';
import { CompletionContext } from './types';
import { AccountCompleter } from './completion/AccountCompleter';
import { PayeeCompleter } from './completion/PayeeCompleter';
import { TagCompleter } from './completion/TagCompleter';
import { CommodityCompleter } from './completion/CommodityCompleter';
import { DateCompleter } from './completion/DateCompleter';

// Common hledger keywords
const HLEDGER_KEYWORDS = [
    'account', 'alias', 'commodity', 'payee', 'tag', 'include', 'year', 
    'apply', 'end', 'default', 'format', 'note', 'assert', 'check'
];

export class HLedgerCompletionProvider implements vscode.CompletionItemProvider {
    private accountCompleter: AccountCompleter;
    private payeeCompleter: PayeeCompleter;
    private tagCompleter: TagCompleter;
    private commodityCompleter: CommodityCompleter;
    private dateCompleter: DateCompleter;
    
    constructor(private config: HLedgerConfig) {
        // Initialize modular completers
        this.accountCompleter = new AccountCompleter(config);
        this.payeeCompleter = new PayeeCompleter(config);
        this.tagCompleter = new TagCompleter(config);
        this.commodityCompleter = new CommodityCompleter(config);
        this.dateCompleter = new DateCompleter(config);
    }
    
    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext
    ): vscode.ProviderResult<vscode.CompletionItem[]> {
        
        // Update config for current document
        this.config.getConfigForDocument(document);
        
        // Get completion context
        const completionContext = this.config.getCompletionContext(document, position);
        
        // Route to appropriate completer based on context type
        switch (completionContext.type) {
            case 'account':
                return this.accountCompleter.complete(completionContext);
            
            case 'payee':
                return this.payeeCompleter.complete(completionContext);
            
            case 'tag':
                return this.tagCompleter.complete(completionContext);
            
            case 'commodity':
                return this.commodityCompleter.complete(completionContext);
            
            case 'date':
                return this.dateCompleter.complete(completionContext);
            
            case 'keyword':
                return this.provideKeywordCompletions(completionContext);
            
            default:
                return [];
        }
    }
    
    private provideKeywordCompletions(context: CompletionContext): vscode.CompletionItem[] {
        const query = context.query.toLowerCase();
        const items: vscode.CompletionItem[] = [];
        
        // Filter keywords by query
        const filteredKeywords = HLEDGER_KEYWORDS.filter(keyword => 
            keyword.toLowerCase().includes(query)
        );
        
        // Sort by relevance
        filteredKeywords.sort((a, b) => {
            const aStarts = a.toLowerCase().startsWith(query);
            const bStarts = b.toLowerCase().startsWith(query);
            
            if (aStarts && !bStarts) return -1;
            if (!aStarts && bStarts) return 1;
            
            return a.localeCompare(b);
        });
        
        // Create completion items
        for (const keyword of filteredKeywords.slice(0, 15)) {
            const item = new vscode.CompletionItem(keyword, vscode.CompletionItemKind.Keyword);
            item.detail = 'HLedger directive';
            item.sortText = this.getKeywordSortText(keyword, query);
            
            // Add helpful documentation
            const docs = this.getKeywordDocumentation(keyword);
            if (docs) {
                item.documentation = new vscode.MarkdownString(docs);
            }
            
            items.push(item);
        }
        
        return items;
    }
    
    private getKeywordSortText(keyword: string, query: string): string {
        // Prioritize exact matches and prefix matches
        if (keyword === query) return '0000_' + keyword;
        if (keyword.startsWith(query)) return '0001_' + keyword;
        return '0002_' + keyword;
    }
    
    private getKeywordDocumentation(keyword: string): string | null {
        const docs: { [key: string]: string } = {
            'account': 'Declare an account. Usage: `account Assets:Cash`',
            'alias': 'Create an account alias. Usage: `alias checking = Assets:Bank:Checking`',
            'commodity': 'Declare a commodity. Usage: `commodity $`',
            'payee': 'Declare a payee. Usage: `payee Grocery Store`',
            'tag': 'Declare a tag. Usage: `tag category`',
            'include': 'Include another journal file. Usage: `include expenses.journal`',
            'year': 'Set default year. Usage: `year 2024`',
            'apply': 'Apply account prefix to following transactions. Usage: `apply account Assets:`',
            'end': 'End the most recent apply account directive',
            'default': 'Set default commodity. Usage: `default $`',
            'format': 'Set date format. Usage: `format %Y-%m-%d`',
            'note': 'Add a note to the journal',
            'assert': 'Assert account balance. Usage: `2024-01-01 * assert Assets:Cash $100`',
            'check': 'Check account balance. Usage: `2024-01-01 * check Assets:Cash >= $0`'
        };
        
        return docs[keyword] || null;
    }
}