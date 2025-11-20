import * as vscode from "vscode";
import { HLedgerConfig } from "./HLedgerConfig";
import {
  CompletionType,
  CompletionContext,
  createLineNumber,
  createCharacterPosition,
  DocumentReference,
  createFilePath,
  createDocumentVersion,
} from "./types";
import {
  StrictPositionAnalyzer,
  StrictCompletionContext,
} from "./strict/StrictPositionAnalyzer";
import { CompletionSuppressor } from "./strict/CompletionSuppressor";
import { StrictPositionValidator } from "./strict/StrictPositionValidator";
import { AccountCompleter } from "./completion/AccountCompleter";
import { CommodityCompleter } from "./completion/CommodityCompleter";
import { DateCompleter } from "./completion/DateCompleter";
import { PayeeCompleter } from "./completion/PayeeCompleter";
import { TagCompleter } from "./completion/TagCompleter";
import {
  NumberFormatService,
  createNumberFormatService,
} from "./services/NumberFormatService";

export class StrictCompletionProvider implements vscode.CompletionItemProvider {
  private numberFormatService: NumberFormatService;
  private positionAnalyzer: StrictPositionAnalyzer;
  private suppressor: CompletionSuppressor;
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
    this.positionAnalyzer = new StrictPositionAnalyzer(
      this.numberFormatService,
      config,
    );

    // Initialize suppressor with NumberFormatService for international number format support
    this.suppressor = new CompletionSuppressor(this.numberFormatService);

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
    _token: vscode.CancellationToken,
    _context: vscode.CompletionContext,
  ): vscode.CompletionItem[] {
    // 1. Update configuration for current document
    this.config.getConfigForDocument(document);

    // 2. Analyze position with strict rules
    const strictContext = this.positionAnalyzer.analyzePosition(
      document,
      position,
    );

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

    const result = this.provideSingleTypeCompletion(
      strictContext,
      primaryType,
      document,
      position,
    );
    return result;
  }

  private provideSingleTypeCompletion(
    context: StrictCompletionContext,
    completionType: CompletionType,
    vscodeDocument: vscode.TextDocument,
    vscodePosition: vscode.Position,
  ): vscode.CompletionItem[] {
    switch (completionType) {
      case "date":
        return this.provideDateCompletion(
          context,
          vscodeDocument,
          vscodePosition,
        );

      case "account":
        return this.provideAccountCompletion(
          context,
          vscodeDocument,
          vscodePosition,
        );

      case "commodity":
        return this.provideCommodityCompletion(
          context,
          vscodeDocument,
          vscodePosition,
        );

      case "payee":
        return this.providePayeeCompletion(
          context,
          vscodeDocument,
          vscodePosition,
        );

      case "tag":
        return this.provideTagCompletion(
          context,
          vscodeDocument,
          vscodePosition,
        );

      case "tag_value":
        return this.provideTagValueCompletion(
          context,
          vscodeDocument,
          vscodePosition,
        );

      default:
        return [];
    }
  }

  private provideDateCompletion(
    context: StrictCompletionContext,
    vscodeDocument: vscode.TextDocument,
    vscodePosition: vscode.Position,
  ): vscode.CompletionItem[] {
    // Additional strict validation
    if (
      !this.validator.isDatePosition(
        context.position.lineText,
        context.position.character,
      )
    ) {
      return [];
    }

    // Convert StrictCompletionContext to legacy CompletionContext for existing DateCompleter
    const legacyContext = this.convertToLegacyContext(
      context,
      "date",
      vscodeDocument,
      vscodePosition,
    );
    return this.dateCompleter.complete(legacyContext);
  }

  private provideAccountCompletion(
    context: StrictCompletionContext,
    vscodeDocument: vscode.TextDocument,
    vscodePosition: vscode.Position,
  ): vscode.CompletionItem[] {
    // Additional strict validation
    if (
      !this.validator.isAccountPosition(
        context.position.lineText,
        context.position.character,
      )
    ) {
      return [];
    }

    // Convert StrictCompletionContext to legacy CompletionContext for existing AccountCompleter
    const legacyContext = this.convertToLegacyContext(
      context,
      "account",
      vscodeDocument,
      vscodePosition,
    );
    return this.accountCompleter.complete(legacyContext);
  }

  private provideCommodityCompletion(
    context: StrictCompletionContext,
    vscodeDocument: vscode.TextDocument,
    vscodePosition: vscode.Position,
  ): vscode.CompletionItem[] {
    // Additional strict validation
    if (
      !this.validator.isCommodityPosition(
        context.position.lineText,
        context.position.character,
      )
    ) {
      return [];
    }

    // Convert StrictCompletionContext to legacy CompletionContext for existing CommodityCompleter
    const legacyContext = this.convertToLegacyContext(
      context,
      "commodity",
      vscodeDocument,
      vscodePosition,
    );
    return this.commodityCompleter.complete(legacyContext);
  }

  private providePayeeCompletion(
    context: StrictCompletionContext,
    vscodeDocument: vscode.TextDocument,
    vscodePosition: vscode.Position,
  ): vscode.CompletionItem[] {
    // Additional strict validation
    if (
      !this.validator.isPayeePosition(
        context.position.lineText,
        context.position.character,
      )
    ) {
      return [];
    }

    // Convert StrictCompletionContext to legacy CompletionContext for existing PayeeCompleter
    const legacyContext = this.convertToLegacyContext(
      context,
      "payee",
      vscodeDocument,
      vscodePosition,
    );
    return this.payeeCompleter.complete(legacyContext);
  }

  private provideTagCompletion(
    context: StrictCompletionContext,
    vscodeDocument: vscode.TextDocument,
    vscodePosition: vscode.Position,
  ): vscode.CompletionItem[] {
    // Additional strict validation for tag position
    if (
      !this.validator.isTagPosition(
        context.position.lineText,
        context.position.character,
      )
    ) {
      return [];
    }

    // Convert StrictCompletionContext to legacy CompletionContext for existing TagCompleter
    const legacyContext = this.convertToLegacyContext(
      context,
      "tag",
      vscodeDocument,
      vscodePosition,
    );
    const items = this.tagCompleter.complete(legacyContext);
    return items;
  }

  private provideTagValueCompletion(
    context: StrictCompletionContext,
    vscodeDocument: vscode.TextDocument,
    vscodePosition: vscode.Position,
  ): vscode.CompletionItem[] {
    // Additional strict validation for tag value position
    if (
      !this.validator.isTagValuePosition(
        context.position.lineText,
        context.position.character,
      )
    ) {
      return [];
    }

    // Convert StrictCompletionContext to legacy CompletionContext for existing TagCompleter
    const legacyContext = this.convertToLegacyContext(
      context,
      "tag_value",
      vscodeDocument,
      vscodePosition,
    );
    const items = this.tagCompleter.complete(legacyContext);
    return items;
  }

  /**
   * Convert new StrictCompletionContext to legacy CompletionContext format
   * This enables reuse of existing completers while maintaining strict rules
   */
  private convertToLegacyContext(
    context: StrictCompletionContext,
    type: CompletionType,
    vscodeDocument?: vscode.TextDocument,
    vscodePosition?: vscode.Position,
  ): CompletionContext {
    // Extract query from position
    const query = this.extractQueryFromPosition(context);

    // Determine case sensitivity
    const isCaseSensitive = this.isQueryCaseSensitive(query);

    // Calculate replacement range based on query length
    const currentPosition = {
      line: createLineNumber(vscodePosition ? vscodePosition.line : 0),
      character: createCharacterPosition(context.position.character),
    };

    const startPosition = {
      line: currentPosition.line,
      character: createCharacterPosition(
        context.position.character - query.length,
      ),
    };

    const range = {
      start: startPosition,
      end: currentPosition,
    };

    // Create DocumentReference if document is provided
    let documentRef: DocumentReference | undefined;
    if (vscodeDocument) {
      documentRef = {
        uri: createFilePath(vscodeDocument.uri.fsPath),
        languageId: vscodeDocument.languageId,
        version: createDocumentVersion(vscodeDocument.version),
      };
    }

    return {
      type: type,
      query: query,
      position: currentPosition,
      document: documentRef,
      range: range,
      isCaseSensitive: isCaseSensitive,
    };
  }

  /**
   * Extract completion query from position context
   * Different extraction logic for different completion types
   */
  private extractQueryFromPosition(context: StrictCompletionContext): string {
    const { beforeCursor } = context.position;

    // For tag value completion, extract the full tag:value pattern needed by TagCompleter
    if (context.lineContext === "in_tag_value") {
      // Extract from after comment marker to cursor - TagCompleter expects full tag:value format
      const commentMatch = beforeCursor.match(/[;#]\s*(.*)$/);
      if (commentMatch?.[1]) {
        // TagCompleter needs the full comment content to extract tag name and value
        // It uses pattern: /([\p{L}\p{N}_-]+):\s*[\p{L}\p{N}_-]*$/u to extract tag name
        return commentMatch[1];
      }
    }

    // For tag name completion in comments, extract just the tag name
    if (context.lineContext === "in_comment") {
      // Extract from after comment marker to cursor, stop at colon
      const commentMatch = beforeCursor.match(/[;#]\s*([\p{L}\p{N}_-]*)$/u);
      if (commentMatch?.[1]) {
        return commentMatch[1];
      }
    }

    // For other completion types, extract the word being typed at cursor position
    // Use Unicode-aware pattern to support international characters including spaces
    const match = beforeCursor.match(/[\p{L}\p{N}:_.\s-]*$/u);
    return match ? match[0].trim() : "";
  }

  /**
   * Determine if the query should be case-sensitive based on character casing
   * If query contains uppercase letters, use case-sensitive matching
   */
  private isQueryCaseSensitive(query: string): boolean {
    return /[A-Z]/.test(query);
  }

  /**
   * Validate that completion is appropriate for current context
   */
  private isValidForStrictContext(
    context: StrictCompletionContext,
    completionType: CompletionType,
  ): boolean {
    switch (completionType) {
      case "date":
        return (
          context.lineContext === "line_start" &&
          this.validator.isDatePosition(
            context.position.lineText,
            context.position.character,
          )
        );

      case "account":
        return (
          context.lineContext === "in_posting" &&
          this.validator.isAccountPosition(
            context.position.lineText,
            context.position.character,
          )
        );

      case "payee":
        return (
          context.lineContext === "after_date" &&
          this.validator.isPayeePosition(
            context.position.lineText,
            context.position.character,
          )
        );

      case "commodity":
        return (
          context.lineContext === "after_amount" &&
          this.validator.isCommodityPosition(
            context.position.lineText,
            context.position.character,
          )
        );

      case "tag":
        return (
          context.lineContext === "in_comment" &&
          this.validator.isTagPosition(
            context.position.lineText,
            context.position.character,
          )
        );

      case "tag_value":
        return (
          context.lineContext === "in_tag_value" &&
          this.validator.isTagValuePosition(
            context.position.lineText,
            context.position.character,
          )
        );

      default:
        return false;
    }
  }

  /**
   * Cleanup method to prevent memory leaks.
   * Disposes the position analyzer which clears the RegexCache.
   */
  public dispose(): void {
    this.positionAnalyzer.dispose();
  }
}
