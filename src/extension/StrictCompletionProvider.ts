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
import { TagCompleter } from './completion/TagCompleter';
import { NumberFormatService, createNumberFormatService } from './services/NumberFormatService';

export class StrictCompletionProvider implements vscode.CompletionItemProvider {
    private numberFormatService: NumberFormatService;
    private positionAnalyzer: StrictPositionAnalyzer;
    private suppressor = new CompletionSuppressor();
    private validator = new StrictPositionValidator();

    // Completers (adapted for strict mode)
    private dateCompleter: DateCompleter;
    private accountCompleter: AccountCompleter;
    private commodityCompleter: CommodityCompleter;
    private payeeCompleter: PayeeCompleter;
    private tagCompleter: TagCompleter;

    constructor(private config: HLedgerConfig) {
        // Initialize NumberFormatService
        this.numberFormatService = createNumberFormatService();
        
        // Initialize position analyzer with required dependencies
        this.positionAnalyzer = new StrictPositionAnalyzer(this.numberFormatService, config);
        
        // Initialize completers with config
        this.dateCompleter = new DateCompleter(config);
        this.accountCompleter = new AccountCompleter(config);
        this.commodityCompleter = new CommodityCompleter(config);
        this.payeeCompleter = new PayeeCompleter(config);
        this.tagCompleter = new TagCompleter(config);
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
        const primaryType = allowedTypes[0];
        if (!primaryType) {
            return [];
        }

        return this.provideSingleTypeCompletion(strictContext, primaryType);
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

            case 'tag':
                return this.provideTagCompletion(context);

            case 'tag_value':
                return this.provideTagValueCompletion(context);

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

    private provideTagCompletion(context: StrictCompletionContext): vscode.CompletionItem[] {
        // Additional strict validation for tag position
        if (!this.validator.isTagPosition(context.position.lineText, context.position.character)) {
            return [];
        }

        // Convert StrictCompletionContext to legacy CompletionContext for existing TagCompleter
        const legacyContext = this.convertToLegacyContext(context, 'tag');
        const items = this.tagCompleter.complete(legacyContext);
        return items;
    }

    private provideTagValueCompletion(context: StrictCompletionContext): vscode.CompletionItem[] {
        // Additional strict validation for tag value position
        if (!this.validator.isTagValuePosition(context.position.lineText, context.position.character)) {
            return [];
        }

        // Convert StrictCompletionContext to legacy CompletionContext for existing TagCompleter
        const legacyContext = this.convertToLegacyContext(context, 'tag_value');
        const items = this.tagCompleter.complete(legacyContext);
        return items;
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
     * Different extraction logic for different completion types
     */
    private extractQueryFromPosition(context: StrictCompletionContext): string {
        const { beforeCursor } = context.position;

        // For tag value completion, extract the full tag:value pattern
        if (context.lineContext === 'in_tag_value') {
            // Extract from after comment marker to cursor
            const commentMatch = beforeCursor.match(/[;#]\s*(.*)$/);
            if (commentMatch && commentMatch[1]) {
                return commentMatch[1];
            }
        }

        // For tag name completion in comments, extract just the tag name
        if (context.lineContext === 'in_comment') {
            // Extract from after comment marker to cursor, stop at colon
            const commentMatch = beforeCursor.match(/[;#]\s*([\p{L}\p{N}_-]*)$/u);
            if (commentMatch && commentMatch[1]) {
                return commentMatch[1];
            }
        }

        // For other completion types, extract the word being typed at cursor position
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

            case 'tag':
                return context.lineContext === 'in_comment' &&
                    this.validator.isTagPosition(context.position.lineText, context.position.character);

            case 'tag_value':
                return context.lineContext === 'in_tag_value' &&
                    this.validator.isTagValuePosition(context.position.lineText, context.position.character);

            default:
                return false;
        }
    }
}