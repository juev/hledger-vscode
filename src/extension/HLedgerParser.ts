// HLedgerParser.ts - Modular parser orchestrator for hledger files
// Refactored to use Lexer → AST Builder → FileProcessor pipeline
// Maintains backward compatibility with existing API

import * as fs from "fs";
import * as path from "path";
import {
  AccountName,
  PayeeName,
  TagName,
  TagValue,
  CommodityCode,
  UsageCount,
  TransactionTemplate,
  TemplateKey,
  createTagName,
  createTagValue,
  createCommodityCode,
  createUsageCount,
} from "./types";
import {
  NumberFormatService,
  CommodityFormat,
} from "./services/NumberFormatService";
import { RegexPatterns } from "./RegexPatterns";
import { HLedgerLexer } from "./lexer/HLedgerLexer";
import { HLedgerASTBuilder } from "./ast/HLedgerASTBuilder";
import { HLedgerFileProcessor } from "./processor/HLedgerFileProcessor";
import { SimpleProjectCache } from "./SimpleProjectCache";
import { ErrorNotificationHandler } from "./utils/ErrorNotificationHandler";

/**
 * Mutable transaction template for internal building.
 */
interface MutableTransactionTemplate {
  payee: PayeeName;
  postings: {
    account: AccountName;
    amount: string | null;
    commodity: CommodityCode | null;
  }[];
  usageCount: UsageCount;
  lastUsedDate: string | null;
}

/**
 * Internal mutable interface for building parsed data during parsing.
 */
interface MutableParsedHLedgerData {
  accounts: Set<AccountName>;
  definedAccounts: Set<AccountName>;
  usedAccounts: Set<AccountName>;
  payees: Set<PayeeName>;
  tags: Set<TagName>;
  commodities: Set<CommodityCode>;
  aliases: Map<AccountName, AccountName>;

  // Tag value mappings and usage tracking
  tagValues: Map<TagName, Set<TagValue>>;
  tagValueUsage: Map<string, UsageCount>;

  // Usage tracking with branded types for frequency-based prioritization
  accountUsage: Map<AccountName, UsageCount>;
  payeeUsage: Map<PayeeName, UsageCount>;
  tagUsage: Map<TagName, UsageCount>;
  commodityUsage: Map<CommodityCode, UsageCount>;

  // Payee-to-account mappings for import history
  payeeAccounts: Map<PayeeName, Set<AccountName>>;
  payeeAccountPairUsage: Map<string, UsageCount>;

  // Transaction templates for autocomplete
  transactionTemplates: Map<PayeeName, Map<TemplateKey, MutableTransactionTemplate>>;

  // Format information for number formatting and commodity display
  commodityFormats: Map<CommodityCode, CommodityFormat>;
  decimalMark: "." | "," | null;

  defaultCommodity: CommodityCode | null;
  lastDate: string | null;
}

/**
 * Enhanced ParsedHLedgerData interface with branded types for type safety.
 * Represents all parsed data from hledger files including usage tracking.
 */
export interface ParsedHLedgerData {
  readonly accounts: ReadonlySet<AccountName>;
  readonly definedAccounts: ReadonlySet<AccountName>;
  readonly usedAccounts: ReadonlySet<AccountName>;
  readonly payees: ReadonlySet<PayeeName>;
  readonly tags: ReadonlySet<TagName>;
  readonly commodities: ReadonlySet<CommodityCode>;
  readonly aliases: ReadonlyMap<AccountName, AccountName>;

  // Tag value mappings and usage tracking
  readonly tagValues: ReadonlyMap<TagName, ReadonlySet<TagValue>>;
  readonly tagValueUsage: ReadonlyMap<string, UsageCount>;

  // Usage tracking with branded types for frequency-based prioritization
  readonly accountUsage: ReadonlyMap<AccountName, UsageCount>;
  readonly payeeUsage: ReadonlyMap<PayeeName, UsageCount>;
  readonly tagUsage: ReadonlyMap<TagName, UsageCount>;
  readonly commodityUsage: ReadonlyMap<CommodityCode, UsageCount>;

  // Payee-to-account mappings for import history
  readonly payeeAccounts: ReadonlyMap<PayeeName, ReadonlySet<AccountName>>;
  readonly payeeAccountPairUsage: ReadonlyMap<string, UsageCount>;

  // Transaction templates for autocomplete
  readonly transactionTemplates: ReadonlyMap<
    PayeeName,
    ReadonlyMap<TemplateKey, TransactionTemplate>
  >;

  // Format information for number formatting and commodity display
  readonly commodityFormats: ReadonlyMap<CommodityCode, CommodityFormat>;
  readonly decimalMark: "." | "," | null;

  readonly defaultCommodity: CommodityCode | null;
  readonly lastDate: string | null;
}

/**
 * Enhanced HLedger file parser with modular architecture.
 *
 * Architecture:
 * - Uses HLedgerLexer for tokenization
 * - Uses HLedgerASTBuilder for AST construction
 * - Uses HLedgerFileProcessor for file I/O operations
 *
 * Features:
 * - Branded types for all parsed entities (accounts, payees, tags, commodities)
 * - Usage frequency tracking for intelligent completion prioritization
 * - Async parsing support for large files (>1MB)
 * - Include directive support for modular file structures
 * - Comprehensive error handling with graceful degradation
 * - Memory-efficient parsing with configurable chunking
 *
 * Supports all hledger file formats (.journal, .hledger, .ledger) and follows
 * hledger 1.43 specification for maximum compatibility.
 */
export class HLedgerParser {
  private readonly numberFormatService: NumberFormatService;
  private readonly lexer: HLedgerLexer;
  private readonly astBuilder: HLedgerASTBuilder;
  private readonly fileProcessor: HLedgerFileProcessor;
  private readonly errorHandler: ErrorNotificationHandler | undefined;

  // Legacy state for backward compatibility with commodity format handling
  private pendingFormatDirective: {
    commodity: CommodityCode;
    expectingFormat: boolean;
  } | null = null;

  constructor(errorHandler?: ErrorNotificationHandler) {
    this.errorHandler = errorHandler;
    this.numberFormatService = new NumberFormatService();
    this.lexer = new HLedgerLexer();
    this.astBuilder = new HLedgerASTBuilder(this.numberFormatService);
    this.fileProcessor = new HLedgerFileProcessor({
      enableAsync: true,
      asyncThreshold: 1024 * 1024, // 1MB
      processIncludes: true,
      maxIncludeDepth: 10,
    });
  }

  /**
   * Parses a single hledger file synchronously.
   * Uses the new modular architecture: Lexer → AST Builder → Data
   */
  parseFile(filePath: string): ParsedHLedgerData {
    try {
      if (!fs.existsSync(filePath)) {
        return this.toReadonly(this.createEmptyData());
      }

      const content = fs.readFileSync(filePath, "utf8");
      const basePath = path.dirname(filePath);
      return this.parseContent(content, basePath);
    } catch (error) {
      // Log error only in non-test environment
      if (process.env.NODE_ENV !== "test") {
        console.error("Error parsing file:", filePath, error);
      }
      return this.toReadonly(this.createEmptyData());
    }
  }

  /**
   * Parses a single hledger file asynchronously for large files.
   * Uses HLedgerFileProcessor for efficient async processing.
   */
  async parseFileAsync(filePath: string): Promise<ParsedHLedgerData> {
    try {
      const stats = await fs.promises.stat(filePath);
      // For large files (>1MB), use async processing via FileProcessor
      if (stats.size > 1024 * 1024) {
        const result = await this.fileProcessor.processFile(filePath);

        // Propagate errors and warnings to ErrorNotificationHandler
        if (this.errorHandler) {
          if (result.errors.length > 0) {
            this.errorHandler.handleFileProcessingErrors(result.errors);
          }
          if (result.warnings.length > 0) {
            this.errorHandler.handleFileProcessingWarnings(result.warnings);
          }
        }

        return this.enhanceWithLegacyParsing(
          result.data,
          await fs.promises.readFile(filePath, "utf8"),
        );
      }
      return this.parseFile(filePath);
    } catch (error) {
      if (process.env.NODE_ENV !== "test") {
        console.error("Error parsing file async:", filePath, error);
      }
      return this.toReadonly(this.createEmptyData());
    }
  }

  /**
   * Parses hledger content string using the modular architecture.
   * Pipeline: Content → Lexer → Tokens → AST Builder → ParsedHLedgerData
   */
  parseContent(content: string, basePath?: string): ParsedHLedgerData {
    // Reset pending format directive state for each content parse
    this.pendingFormatDirective = null;

    // Step 1: Tokenize content using HLedgerLexer
    const tokens = this.lexer.tokenizeContent(content);

    // Step 2: Build AST from tokens using HLedgerASTBuilder
    const astData = this.astBuilder.buildFromTokens(tokens, basePath);

    // Step 3: Enhance with legacy parsing for complex features (commodity formats, etc.)
    return this.enhanceWithLegacyParsing(astData, content, basePath);
  }

  /**
   * Enhances AST data with legacy parsing for complex features.
   * This handles commodity format templates, tag extraction with regex patterns, etc.
   * that require more sophisticated parsing than basic tokenization.
   */
  private enhanceWithLegacyParsing(
    astData: ParsedHLedgerData,
    content: string,
    basePath?: string,
  ): ParsedHLedgerData {
    const data = this.createMutableDataFrom(astData);
    const lines = content.split("\n");

    let inTransaction = false;
    let transactionPayee = "";

    for (const line of lines) {
      const trimmedLine = line.trim();

      // Update transaction state BEFORE parsing the line
      if (trimmedLine && !line.startsWith(" ") && !line.startsWith("\t")) {
        if (this.isTransactionLine(trimmedLine)) {
          inTransaction = true;
          transactionPayee = this.extractPayeeFromTransaction(trimmedLine);
        } else {
          inTransaction = false;
          transactionPayee = "";
        }
      }

      // Parse line for enhanced features
      this.parseLegacyFeatures(
        line,
        data,
        basePath,
        inTransaction,
        transactionPayee,
      );
    }

    return this.toReadonly(data);
  }

  /**
   * Parses legacy features that require complex regex patterns and state tracking.
   * This includes:
   * - Commodity format templates (inline and multi-line)
   * - Tag extraction with advanced regex patterns
   * - Decimal mark directives
   * - Default commodity with format templates
   */
  private parseLegacyFeatures(
    line: string,
    data: MutableParsedHLedgerData,
    basePath?: string,
    inTransaction = false,
    _transactionPayee = "",
  ): void {
    const trimmedLine = line.trim();

    // Handle comment lines - extract tags from them
    if (trimmedLine.startsWith(";") || trimmedLine.startsWith("#")) {
      this.extractTags(trimmedLine, data);
      return;
    }

    if (!trimmedLine) {
      return;
    }

    // Include directives are handled by HLedgerFileProcessor
    if (trimmedLine.startsWith("include ")) {
      this.handleIncludeDirective(trimmedLine, data, basePath);
      return;
    }

    // Commodity directive (enhanced to handle format templates)
    if (trimmedLine.startsWith("commodity ")) {
      this.handleCommodityDirective(trimmedLine, data);
      return;
    }

    // Format directive (for multi-line commodity format specification)
    if (trimmedLine.startsWith("format ")) {
      this.handleFormatDirective(trimmedLine, data);
      return;
    }

    // Decimal-mark directive
    if (trimmedLine.startsWith("decimal-mark ")) {
      this.handleDecimalMarkDirective(trimmedLine, data);
      return;
    }

    // Default commodity (enhanced to handle format templates)
    if (trimmedLine.startsWith("D ")) {
      this.handleDefaultCommodityDirective(trimmedLine, data);
      return;
    }

    // Transaction line - extract tags
    if (this.isTransactionLine(trimmedLine)) {
      this.extractTags(trimmedLine, data);
      return;
    }

    // Posting line - extract tags and commodity formats
    if (inTransaction && (line.startsWith("    ") || line.startsWith("\t"))) {
      const parts = trimmedLine.split(RegexPatterns.AMOUNT_SPLIT);

      // Extract commodity from amount (if present) with format detection
      if (parts.length > 1 && parts[1]) {
        const amountPart = parts[1].trim();
        this.extractCommodityFromAmount(amountPart, data);
      }

      // Extract tags from posting line
      this.extractTags(trimmedLine, data);
      return;
    }
  }

  /**
   * Async content parsing for large files.
   */
  private async parseContentAsync(
    content: string,
    basePath?: string,
  ): Promise<ParsedHLedgerData> {
    // Reset pending format directive state
    this.pendingFormatDirective = null;

    // Step 1: Tokenize content using HLedgerLexer
    const tokens = this.lexer.tokenizeContent(content);

    // Step 2: Build AST from tokens using HLedgerASTBuilder
    const astData = this.astBuilder.buildFromTokens(tokens, basePath);

    // Step 3: Enhance with legacy parsing
    return this.enhanceWithLegacyParsing(astData, content, basePath);
  }

  // ==================== Legacy Parsing Methods ====================
  // These methods handle complex parsing features that require regex patterns
  // and state tracking beyond basic tokenization.

  private handleIncludeDirective(
    line: string,
    data: MutableParsedHLedgerData,
    basePath?: string,
  ): void {
    const includeFile = line.substring(8).trim();
    if (includeFile && basePath) {
      const fullPath = path.resolve(basePath, includeFile);
      try {
        const includedData = this.parseFile(fullPath);
        this.mergeData(data, includedData);
      } catch {
        // Silently ignore include errors
      }
    }
  }

  /**
   * Handles commodity directives, including format templates.
   * Supports:
   * - Basic commodity definition: "commodity EUR"
   * - Inline format template: "commodity 1 000,00 EUR"
   */
  private handleCommodityDirective(
    line: string,
    data: MutableParsedHLedgerData,
  ): void {
    const commodityPart = line.substring(10).trim(); // Remove 'commodity '

    // Remove inline comments
    const commentIndex = commodityPart.indexOf(";");
    const cleanCommodityPart =
      commentIndex !== -1
        ? commodityPart.substring(0, commentIndex).trim()
        : commodityPart;

    if (!cleanCommodityPart) {
      return;
    }

    // Check if this is a format template (contains numbers)
    const hasNumbers = RegexPatterns.NUMBERS.test(cleanCommodityPart);

    if (hasNumbers) {
      // This is a format template like "1 000,00 EUR"
      const formatResult =
        this.numberFormatService.parseFormatTemplate(cleanCommodityPart);
      if (formatResult.success) {
        const format = formatResult.data;
        const commodityCode = createCommodityCode(format.symbol);
        if (commodityCode) {
          data.commodities.add(commodityCode);
          data.commodityFormats.set(commodityCode, format);
        }
      } else {
        // Fallback: try to extract just the commodity symbol from the end
        const commodityMatch = cleanCommodityPart.match(
          RegexPatterns.COMMODITY_DETECTION,
        );
        if (commodityMatch?.[1]) {
          const commodityCode = createCommodityCode(commodityMatch[1]);
          if (commodityCode) {
            data.commodities.add(commodityCode);
            // Try to create a basic format from the number pattern
            const numberPattern = cleanCommodityPart
              .replace(RegexPatterns.COMMODITY_CLEANUP, "")
              .trim();
            if (numberPattern) {
              const basicFormat = this.createBasicCommodityFormat(
                numberPattern,
                commodityMatch[1],
              );
              if (basicFormat) {
                data.commodityFormats.set(commodityCode, basicFormat);
              }
            }
          }
        }
      }
    } else {
      // Simple commodity definition like "commodity EUR"
      const commodityCode = createCommodityCode(cleanCommodityPart);
      if (commodityCode) {
        data.commodities.add(commodityCode);
        // Set up pending format directive expectation for multi-line format
        this.pendingFormatDirective = {
          commodity: commodityCode,
          expectingFormat: true,
        };
      }
    }
  }

  /**
   * Handles format directives for multi-line commodity format specification.
   * Example: "format EUR 1 000,00"
   */
  private handleFormatDirective(
    line: string,
    data: MutableParsedHLedgerData,
  ): void {
    const formatPart = line.substring(7).trim(); // Remove 'format '

    // Remove inline comments
    const commentIndex = formatPart.indexOf(";");
    const cleanFormatPart =
      commentIndex !== -1
        ? formatPart.substring(0, commentIndex).trim()
        : formatPart;

    if (!cleanFormatPart) {
      return;
    }

    // Parse the format template
    const formatResult =
      this.numberFormatService.parseFormatTemplate(cleanFormatPart);
    if (formatResult.success) {
      const format = formatResult.data;
      const commodityCode = createCommodityCode(format.symbol);
      if (commodityCode) {
        data.commodities.add(commodityCode);
        data.commodityFormats.set(commodityCode, format);

        // Clear pending format directive
        if (this.pendingFormatDirective?.commodity === commodityCode) {
          this.pendingFormatDirective = null;
        }
      }
    }
  }

  /**
   * Handles decimal-mark directives.
   * Example: "decimal-mark ," or "decimal-mark ."
   */
  private handleDecimalMarkDirective(
    line: string,
    data: MutableParsedHLedgerData,
  ): void {
    const decimalMarkPart = line.substring(13).trim(); // Remove 'decimal-mark '

    // Remove inline comments
    const commentIndex = decimalMarkPart.indexOf(";");
    const cleanDecimalMarkPart =
      commentIndex !== -1
        ? decimalMarkPart.substring(0, commentIndex).trim()
        : decimalMarkPart;

    if (cleanDecimalMarkPart === "." || cleanDecimalMarkPart === ",") {
      data.decimalMark = cleanDecimalMarkPart;
    }
  }

  /**
   * Handles default commodity directives, including format templates.
   * Supports:
   * - Basic default commodity: "D RUB"
   * - Format template: "D 1000,00 RUB"
   */
  private handleDefaultCommodityDirective(
    line: string,
    data: MutableParsedHLedgerData,
  ): void {
    const defaultPart = line.substring(2).trim(); // Remove 'D '

    // Remove inline comments
    const commentIndex = defaultPart.indexOf(";");
    const cleanDefaultPart =
      commentIndex !== -1
        ? defaultPart.substring(0, commentIndex).trim()
        : defaultPart;

    if (!cleanDefaultPart) {
      return;
    }

    // Check if this is a format template (contains numbers)
    const hasNumbers = RegexPatterns.NUMBERS.test(cleanDefaultPart);

    if (hasNumbers) {
      // This is a format template like "1000,00 RUB"
      const formatResult =
        this.numberFormatService.parseFormatTemplate(cleanDefaultPart);
      if (formatResult.success) {
        const format = formatResult.data;
        const commodityCode = createCommodityCode(format.symbol);
        if (commodityCode) {
          data.defaultCommodity = commodityCode;
          data.commodities.add(commodityCode);
          data.commodityFormats.set(commodityCode, format);
        }
      } else {
        // Fallback: try to extract just the commodity symbol from the end
        const commodityMatch = cleanDefaultPart.match(
          RegexPatterns.COMMODITY_DETECTION,
        );
        if (commodityMatch?.[1]) {
          const commodityCode = createCommodityCode(commodityMatch[1]);
          if (commodityCode) {
            data.defaultCommodity = commodityCode;
            data.commodities.add(commodityCode);
            // Try to create a basic format from the number pattern
            const numberPattern = cleanDefaultPart
              .replace(RegexPatterns.COMMODITY_CLEANUP, "")
              .trim();
            if (numberPattern) {
              const basicFormat = this.createBasicCommodityFormat(
                numberPattern,
                commodityMatch[1],
              );
              if (basicFormat) {
                data.commodityFormats.set(commodityCode, basicFormat);
              }
            }
          }
        }
      }
    } else {
      // Simple default commodity like "D RUB"
      const commodityCode = createCommodityCode(cleanDefaultPart);
      if (commodityCode) {
        data.defaultCommodity = commodityCode;
        data.commodities.add(commodityCode);
      }
    }
  }

  /**
   * Creates a basic CommodityFormat from a number pattern and symbol.
   * Used as fallback when NumberFormatService.parseFormatTemplate fails.
   */
  private createBasicCommodityFormat(
    numberPattern: string,
    symbol: string,
  ): CommodityFormat | null {
    try {
      // Detect decimal mark by looking for the last comma or period followed by 1-4 digits
      const decimalMatch = numberPattern.match(RegexPatterns.DECIMAL_MATCH);

      let decimalMark: "." | "," = ".";
      let groupSeparator: " " | "," | "." | "" = "";
      let decimalPlaces = 2;
      let useGrouping = false;

      if (decimalMatch) {
        const integerPart = decimalMatch[1]!;
        const decimalChar = decimalMatch[2]! as "." | ",";
        const decimalDigits = decimalMatch[3]!;
        decimalMark = decimalChar;
        decimalPlaces = decimalDigits.length;

        // Check for grouping in the integer part
        if (integerPart.includes(" ")) {
          groupSeparator = " ";
          useGrouping = true;
        } else if (decimalMark === "," && integerPart.includes(".")) {
          groupSeparator = ".";
          useGrouping = true;
        } else if (decimalMark === "." && integerPart.includes(",")) {
          groupSeparator = ",";
          useGrouping = true;
        }
      } else {
        // No decimal point, check for grouping
        if (numberPattern.includes(" ")) {
          groupSeparator = " ";
          useGrouping = true;
          decimalMark = ",";
        } else if (numberPattern.includes(",")) {
          groupSeparator = ",";
          useGrouping = true;
          decimalMark = ".";
        }
      }

      const format: CommodityFormat = {
        format: {
          decimalMark,
          groupSeparator,
          decimalPlaces,
          useGrouping,
        },
        symbol,
        symbolBefore: false, // Assume symbol comes after number in basic format
        symbolSpacing: true,
        template: `${numberPattern} ${symbol}`,
      };

      return format;
    } catch {
      // Return null on any parsing error
      return null;
    }
  }

  private extractPayeeFromTransaction(line: string): string {
    // Remove date and status, extract payee (handle both full and short date formats)
    let cleaned = line.replace(RegexPatterns.DATE_FULL, "").trim();
    cleaned = cleaned.replace(RegexPatterns.TRANSACTION_STATUS, "").trim(); // Remove status

    // Remove transaction codes like (REF123), (CODE456)
    cleaned = cleaned.replace(RegexPatterns.TRANSACTION_CODE, "").trim();

    // Split only by ; to separate payee from comment, but preserve pipe characters
    const parts = cleaned.split(RegexPatterns.COMMENT_SEMICOLON);
    const payee = parts[0] ? parts[0].trim() : "";

    // Normalize Unicode characters for consistent matching (NFC normalization)
    // This ensures characters like Cyrillic are handled consistently
    return payee ? payee.normalize("NFC") : "";
  }

  private extractTags(line: string, data: MutableParsedHLedgerData): void {
    // Extract tags only from comments (after ; or #)
    // Tags are in the format tag: or tag:value within comments
    const commentMatch = line.match(RegexPatterns.COMMENT_LINE);
    if (!commentMatch?.[1]) {
      return;
    }

    const commentText = commentMatch[1];

    // Enhanced pattern to extract tag:value pairs with support for:
    // - Unicode letters and numbers in tag names (no spaces allowed in tag name)
    // - Optional values after colon (tag: is valid)
    // - Spaces and special characters in values
    // - Multiple tags separated by commas
    // Pattern matches: tagname: or tagname:value where value can contain spaces until next comma or end
    const tagPattern = RegexPatterns.TAG_PATTERN;
    const tagMatches = commentText.matchAll(tagPattern);

    for (const match of tagMatches) {
      const tagName = match[1]?.trim();
      const tagValue = match[2]?.trim(); // May be empty string for tags without values

      if (tagName) {
        // Store tag name (with or without value)
        const tag = createTagName(tagName);

        // Add tag to tags set
        data.tags.add(tag);
        this.incrementUsage(data.tagUsage, tag);

        // If tag has a value, store it
        if (tagValue) {
          const value = createTagValue(tagValue);

          // Add value to tag's value set
          if (!data.tagValues.has(tag)) {
            data.tagValues.set(tag, new Set<TagValue>());
          }
          data.tagValues.get(tag)!.add(value);

          // Track usage of this specific tag:value pair
          const pairKey = `${tagName}:${tagValue}`;
          this.incrementUsage(data.tagValueUsage, pairKey);
        } else {
          // Tag without value - just ensure the tag exists in tagValues map
          // This allows completion to work even for tags that appear without values
          if (!data.tagValues.has(tag)) {
            data.tagValues.set(tag, new Set<TagValue>());
          }
        }
      }
    }
  }

  private extractCommodityFromAmount(
    amountStr: string,
    data: MutableParsedHLedgerData,
  ): void {
    // Enhanced Unicode-aware commodity extraction
    // Matches international currency symbols, cryptocurrency symbols, and commodity codes
    // Supports Latin, Cyrillic, Greek, and other Unicode letter systems
    const commodityMatch = amountStr.match(RegexPatterns.AMOUNT_EXTRACTION);
    if (commodityMatch?.[1]) {
      const commodity = createCommodityCode(commodityMatch[1]);
      data.commodities.add(commodity);
      this.incrementUsage(data.commodityUsage, commodity);
    }
  }

  private isTransactionLine(line: string): boolean {
    // Transaction lines start with a date (full or short format)
    return RegexPatterns.TRANSACTION_LINE.test(line);
  }

  private incrementUsage<TKey extends string>(
    usageMap: Map<TKey, UsageCount>,
    key: TKey,
  ): void {
    const currentCount = usageMap.get(key) ?? createUsageCount(0);
    usageMap.set(key, createUsageCount(currentCount + 1));
  }

  // ==================== Data Management Methods ====================

  private createMutableDataFrom(
    source: ParsedHLedgerData,
  ): MutableParsedHLedgerData {
    // Deep clone transaction templates
    const clonedTemplates = new Map<
      PayeeName,
      Map<TemplateKey, MutableTransactionTemplate>
    >();
    if (source.transactionTemplates) {
      source.transactionTemplates.forEach((templates, payee) => {
        const clonedInner = new Map<TemplateKey, MutableTransactionTemplate>();
        templates.forEach((template, key) => {
          clonedInner.set(key, {
            payee: template.payee,
            postings: [...template.postings],
            usageCount: template.usageCount,
            lastUsedDate: template.lastUsedDate,
          });
        });
        clonedTemplates.set(payee, clonedInner);
      });
    }

    return {
      accounts: new Set(source.accounts),
      definedAccounts: new Set(source.definedAccounts),
      usedAccounts: new Set(source.usedAccounts),
      payees: new Set(source.payees),
      tags: new Set(source.tags),
      commodities: new Set(source.commodities),
      aliases: new Map(source.aliases),
      tagValues: new Map(
        Array.from(source.tagValues.entries()).map(([k, v]) => [k, new Set(v)]),
      ),
      tagValueUsage: new Map(source.tagValueUsage),
      accountUsage: new Map(source.accountUsage),
      payeeUsage: new Map(source.payeeUsage),
      tagUsage: new Map(source.tagUsage),
      commodityUsage: new Map(source.commodityUsage),
      payeeAccounts: new Map(
        Array.from(source.payeeAccounts.entries()).map(([k, v]) => [
          k,
          new Set(v),
        ]),
      ),
      payeeAccountPairUsage: new Map(source.payeeAccountPairUsage),
      transactionTemplates: clonedTemplates,
      commodityFormats: new Map(source.commodityFormats),
      decimalMark: source.decimalMark,
      defaultCommodity: source.defaultCommodity,
      lastDate: source.lastDate,
    };
  }

  private mergeData(
    target: MutableParsedHLedgerData,
    source: ParsedHLedgerData,
  ): void {
    // Merge sets
    source.accounts.forEach((acc) => target.accounts.add(acc));
    source.definedAccounts.forEach((acc) => target.definedAccounts.add(acc));
    source.usedAccounts.forEach((acc) => target.usedAccounts.add(acc));
    source.payees.forEach((p) => target.payees.add(p));
    source.tags.forEach((t) => target.tags.add(t));
    source.commodities.forEach((c) => target.commodities.add(c));

    // Merge maps
    source.aliases.forEach((value, key) => target.aliases.set(key, value));

    // Merge tag values
    source.tagValues.forEach((values, tag) => {
      if (!target.tagValues.has(tag)) {
        target.tagValues.set(tag, new Set<TagValue>());
      }
      values.forEach((value) => target.tagValues.get(tag)!.add(value));
    });

    // Merge usage maps with overflow protection
    source.accountUsage.forEach((count, key) => {
      const existing = target.accountUsage.get(key) ?? createUsageCount(0);
      const newCount = Math.min(existing + count, Number.MAX_SAFE_INTEGER);
      target.accountUsage.set(key, createUsageCount(newCount));
    });

    source.payeeUsage.forEach((count, key) => {
      const existing = target.payeeUsage.get(key) ?? createUsageCount(0);
      const newCount = Math.min(existing + count, Number.MAX_SAFE_INTEGER);
      target.payeeUsage.set(key, createUsageCount(newCount));
    });

    source.tagUsage.forEach((count, key) => {
      const existing = target.tagUsage.get(key) ?? createUsageCount(0);
      const newCount = Math.min(existing + count, Number.MAX_SAFE_INTEGER);
      target.tagUsage.set(key, createUsageCount(newCount));
    });

    source.commodityUsage.forEach((count, key) => {
      const existing = target.commodityUsage.get(key) ?? createUsageCount(0);
      const newCount = Math.min(existing + count, Number.MAX_SAFE_INTEGER);
      target.commodityUsage.set(key, createUsageCount(newCount));
    });

    // Merge tag value usage with overflow protection
    source.tagValueUsage.forEach((count, key) => {
      const existing = target.tagValueUsage.get(key) ?? createUsageCount(0);
      const newCount = Math.min(existing + count, Number.MAX_SAFE_INTEGER);
      target.tagValueUsage.set(key, createUsageCount(newCount));
    });

    // Merge payee-account history
    source.payeeAccounts.forEach((accounts, payee) => {
      if (!target.payeeAccounts.has(payee)) {
        target.payeeAccounts.set(payee, new Set<AccountName>());
      }
      accounts.forEach((account) =>
        target.payeeAccounts.get(payee)!.add(account),
      );
    });

    source.payeeAccountPairUsage.forEach((count, key) => {
      const existing =
        target.payeeAccountPairUsage.get(key) ?? createUsageCount(0);
      const newCount = Math.min(existing + count, Number.MAX_SAFE_INTEGER);
      target.payeeAccountPairUsage.set(key, createUsageCount(newCount));
    });

    // Merge commodity formats
    source.commodityFormats.forEach((format, commodity) => {
      target.commodityFormats.set(commodity, format);
    });

    // Update decimal mark (prefer the most recently parsed one)
    if (source.decimalMark) {
      target.decimalMark = source.decimalMark;
    }

    // Update last date if newer
    if (
      source.lastDate &&
      (!target.lastDate || source.lastDate > target.lastDate)
    ) {
      target.lastDate = source.lastDate;
    }

    // Update default commodity
    if (source.defaultCommodity) {
      target.defaultCommodity = source.defaultCommodity;
    }
  }

  private createEmptyData(): MutableParsedHLedgerData {
    return {
      accounts: new Set<AccountName>(),
      definedAccounts: new Set<AccountName>(),
      usedAccounts: new Set<AccountName>(),
      payees: new Set<PayeeName>(),
      tags: new Set<TagName>(),
      commodities: new Set<CommodityCode>(),
      aliases: new Map<AccountName, AccountName>(),
      tagValues: new Map<TagName, Set<TagValue>>(),
      tagValueUsage: new Map<string, UsageCount>(),
      accountUsage: new Map<AccountName, UsageCount>(),
      payeeUsage: new Map<PayeeName, UsageCount>(),
      tagUsage: new Map<TagName, UsageCount>(),
      commodityUsage: new Map<CommodityCode, UsageCount>(),
      payeeAccounts: new Map<PayeeName, Set<AccountName>>(),
      payeeAccountPairUsage: new Map<string, UsageCount>(),
      transactionTemplates: new Map(),
      commodityFormats: new Map<CommodityCode, CommodityFormat>(),
      decimalMark: null,
      defaultCommodity: null,
      lastDate: null,
    };
  }

  private toReadonly(data: MutableParsedHLedgerData): ParsedHLedgerData {
    return data as ParsedHLedgerData;
  }

  // ==================== Public Utility Methods ====================

  /**
   * Convenience method for scanning entire workspace.
   * Uses HLedgerFileProcessor for efficient file discovery and processing.
   *
   * Supports incremental caching:
   * - If cache provided, checks each file's modification time before parsing
   * - Only parses files that were modified since last cache
   * - Updates cache with newly parsed files
   * - For 50+ file projects, provides ~50x speedup on subsequent calls
   *
   * @param workspacePath - Root directory to scan for hledger files
   * @param cache - Optional cache for incremental updates (checks mtimeMs automatically)
   * @returns Merged parsed data from all workspace files
   */
  parseWorkspace(
    workspacePath: string,
    cache?: SimpleProjectCache,
  ): ParsedHLedgerData {
    const data = this.createEmptyData();

    try {
      const files = this.findHLedgerFiles(workspacePath);
      for (const file of files) {
        try {
          // Check cache before parsing (validates mtimeMs automatically)
          const cached = cache?.get(file);
          const fileData = cached ?? this.parseFile(file);

          // If file was parsed (not from cache), update cache
          if (!cached && cache) {
            cache.set(file, fileData);
          }

          this.mergeData(data, fileData);
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          console.error(`HLedger: Error parsing file ${file}: ${errorMessage}`);

          if (
            process.env.NODE_ENV !== "test" &&
            error instanceof Error &&
            error.stack
          ) {
            console.error("Stack trace:", error.stack);
          }
          // Continue processing other files
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
        `HLedger: Error scanning workspace ${workspacePath}: ${errorMessage}`,
      );

      if (
        process.env.NODE_ENV !== "test" &&
        error instanceof Error &&
        error.stack
      ) {
        console.error("Stack trace:", error.stack);
      }
    }

    return this.toReadonly(data);
  }

  private findHLedgerFiles(dirPath: string): string[] {
    // Delegate to HLedgerFileProcessor for file discovery
    return this.fileProcessor.findHLedgerFiles(dirPath);
  }
}
