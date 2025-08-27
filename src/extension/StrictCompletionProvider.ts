import * as vscode from 'vscode';
import { HLedgerConfig } from './HLedgerConfig';
import { CompletionType, CompletionContext } from './types';
import { StrictPositionAnalyzer, StrictCompletionContext } from './strict/StrictPositionAnalyzer';
import { CompletionSuppressor } from './strict/CompletionSuppressor';
import { StrictPositionValidator } from './strict/StrictPositionValidator';
import { AccountCompleter } from './completion/AccountCompleter';
import { CommodityCompleter } from './completion/CommodityCompleter';
import { DateCompleter } from './completion/DateCompleter';
import { PayeeCompleter } from './completion/PayeeCompleter';

export class StrictCompletionProvider implements vscode.CompletionItemProvider {
    private positionAnalyzer = new StrictPositionAnalyzer();
    private suppressor = new CompletionSuppressor();
    private validator = new StrictPositionValidator();
    
    // Completers (adapted for strict mode)
    private dateCompleter: DateCompleter;
    private accountCompleter: AccountCompleter;
    private commodityCompleter: CommodityCompleter;
    private payeeCompleter: PayeeCompleter;
    
    constructor(private config: HLedgerConfig) {
        // Initialize completers with config
        this.dateCompleter = new DateCompleter(config);
        this.accountCompleter = new AccountCompleter(config);
        this.commodityCompleter = new CommodityCompleter(config);
        this.payeeCompleter = new PayeeCompleter(config);
    }
    
    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext
    ): vscode.CompletionItem[] {
        
        // 1. Update configuration for current document
        this.config.getConfigForDocument(document);
        
        // 2. Analyze position with strict rules
        const strictContext = this.positionAnalyzer.analyzePosition(document, position);
        
        // 3. Apply suppression rules
        if (this.suppressor.shouldSuppressAll(strictContext)) {
            return [];
        }
        
        // 4. Filter allowed types
        const allowedTypes = this.suppressor.filterAllowedTypes(strictContext);
        if (allowedTypes.length === 0) {
            return [];
        }
        
        // 5. Route to single completion type (strict rule: only one type per position)
        return this.provideSingleTypeCompletion(strictContext, allowedTypes[0]);
    }
    
    private provideSingleTypeCompletion(
        context: StrictCompletionContext,
        completionType: CompletionType
    ): vscode.CompletionItem[] {
        
        switch (completionType) {
            case 'date':
                return this.provideDateCompletion(context);
                
            case 'account': 
                return this.provideAccountCompletion(context);
                
            case 'commodity':
                return this.provideCommodityCompletion(context);
                
            case 'payee':
                return this.providePayeeCompletion(context);
                
            default:
                return [];
        }
    }
    
    private provideDateCompletion(context: StrictCompletionContext): vscode.CompletionItem[] {
        // Additional strict validation
        if (!this.validator.isDatePosition(context.position.lineText, context.position.character)) {
            return [];
        }
        
        // Convert StrictCompletionContext to legacy CompletionContext for existing DateCompleter
        const legacyContext = this.convertToLegacyContext(context, 'date');
        return this.dateCompleter.complete(legacyContext);
    }
    
    private provideAccountCompletion(context: StrictCompletionContext): vscode.CompletionItem[] {
        // Additional strict validation
        if (!this.validator.isAccountPosition(context.position.lineText, context.position.character)) {
            return [];
        }
        
        // Convert StrictCompletionContext to legacy CompletionContext for existing AccountCompleter
        const legacyContext = this.convertToLegacyContext(context, 'account');
        return this.accountCompleter.complete(legacyContext);
    }
    
    private provideCommodityCompletion(context: StrictCompletionContext): vscode.CompletionItem[] {
        // Additional strict validation
        if (!this.validator.isCommodityPosition(context.position.lineText, context.position.character)) {
            return [];
        }
        
        // Convert StrictCompletionContext to legacy CompletionContext for existing CommodityCompleter
        const legacyContext = this.convertToLegacyContext(context, 'commodity');
        return this.commodityCompleter.complete(legacyContext);
    }
    
    private providePayeeCompletion(context: StrictCompletionContext): vscode.CompletionItem[] {
        // Additional strict validation
        if (!this.validator.isPayeePosition(context.position.lineText, context.position.character)) {
            return [];
        }
        
        // Convert StrictCompletionContext to legacy CompletionContext for existing PayeeCompleter
        const legacyContext = this.convertToLegacyContext(context, 'payee');
        return this.payeeCompleter.complete(legacyContext);
    }
    
    /**
     * Convert new StrictCompletionContext to legacy CompletionContext format
     * This enables reuse of existing completers while maintaining strict rules
     */
    private convertToLegacyContext(context: StrictCompletionContext, type: CompletionType): CompletionContext {
        // Extract query from position
        const query = this.extractQueryFromPosition(context);
        
        return {
            type: type,
            query: query,
            position: {
                line: 0 as any, // Legacy compatibility - not actually used by completers
                character: context.position.character as any
            }
        };
    }
    
    /**
     * Extract completion query from position context
     */
    private extractQueryFromPosition(context: StrictCompletionContext): string {
        const { beforeCursor } = context.position;
        
        // Extract the word being typed at cursor position
        const match = beforeCursor.match(/[\w:.-]*$/);
        return match ? match[0] : '';
    }
    
    /**
     * Validate that completion is appropriate for current context
     */
    private isValidForStrictContext(context: StrictCompletionContext, completionType: CompletionType): boolean {
        switch (completionType) {
            case 'date':
                return context.lineContext === 'line_start' && 
                       this.validator.isDatePosition(context.position.lineText, context.position.character);
                       
            case 'account':
                return context.lineContext === 'in_posting' &&
                       this.validator.isAccountPosition(context.position.lineText, context.position.character);
                       
            case 'payee':
                return context.lineContext === 'after_date' &&
                       this.validator.isPayeePosition(context.position.lineText, context.position.character);
                       
            case 'commodity':
                return context.lineContext === 'after_amount' &&
                       this.validator.isCommodityPosition(context.position.lineText, context.position.character);
                       
            default:
                return false;
        }
    }
}