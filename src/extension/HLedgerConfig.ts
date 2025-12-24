// HLedgerConfig.ts - Configuration and cache management
// ~200 lines according to REFACTORING.md FASE G
// Combines configuration and caching functionality

import * as vscode from "vscode";
import * as path from "path";
import { HLedgerParser, ParsedHLedgerData } from "./HLedgerParser";
import { SimpleProjectCache } from "./SimpleProjectCache";
import {
  CompletionContext,
  AccountName,
  PayeeName,
  TagName,
  TagValue,
  CommodityCode,
  UsageCount,
  TransactionTemplate,
  TemplateKey,
  createUsageCount,
  createCacheKey,
} from "./types";

// CompletionContext is now imported from types.ts
export { CompletionContext } from "./types";

/**
 * Result type for document path validation.
 * Discriminated union enabling type-safe handling of valid vs invalid paths.
 */
type PathValidationResult =
  | { valid: true; projectPath: string }
  | {
      valid: false;
      reason: "virtual-document" | "malformed-path" | "invalid-derived-path";
    };

export class HLedgerConfig {
  // Pre-compiled regex patterns for performance optimization
  private static readonly PATTERNS = {
    TAG_IN_COMMENT: /\w+:\s*$|\/\w+:\w*$/,
    INDENTED_LINE: /^\s+/,
    KEYWORD_CONTEXT: /^\s*\w*$/,
    AFTER_NUMBER: /\d+(\.\d+)?\s*$/,
    CURRENCY_CONTEXT: /[\d$€£¥₽]\s*$/,
    POSTING_WITH_AMOUNTS: /^\s+.*\d+/,
    ACCOUNT_END: /^\s+[^0-9]*\s+/,
    // Improved date patterns for progressive typing
    NUMERIC_START: /^\d{1,4}$/, // Just digits at line start (for typing year)
    PARTIAL_DATE: /^\d{1,4}[-/]?\d{0,2}[-/]?\d{0,2}$/, // Flexible partial date
    FULL_DATE: /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/, // Complete date format
    SHORT_DATE: /^(0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])$/, // MM/DD or M/D format
    // Fixed: Support both full dates (YYYY-MM-DD) and short dates (MM-DD) in transactions
    DATE_IN_TRANSACTION:
      /^\s*(?:\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2})\s*[*!]?\s*/,
  } as const;

  private parser: HLedgerParser;
  private cache: SimpleProjectCache;
  private data: ParsedHLedgerData | null = null;
  private lastWorkspacePath: string | null = null;

  constructor(parser?: HLedgerParser, cache?: SimpleProjectCache) {
    this.parser = parser ?? new HLedgerParser();
    this.cache = cache ?? new SimpleProjectCache();
  }

  /**
   * Validates document path and determines project path for workspace scanning.
   * Handles three scenarios:
   * 1. Virtual documents (non-file scheme) - cannot scan workspace
   * 2. Malformed file paths - invalid or dangerous paths
   * 3. Invalid derived paths - when path.dirname yields unusable result
   */
  private validateDocumentPath(
    document: vscode.TextDocument,
  ): PathValidationResult {
    const filePath = document.uri.fsPath;

    // Virtual documents (untitled, vscode-notebook, output, custom schemes)
    // don't have real file paths - skip workspace scanning
    if (document.uri.scheme !== "file") {
      return { valid: false, reason: "virtual-document" };
    }

    // Check workspace folder first
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (workspaceFolder) {
      return { valid: true, projectPath: workspaceFolder.uri.fsPath };
    }

    // Validate filePath before calling path.dirname()
    // Even for file:// scheme, fsPath could be malformed
    if (
      !filePath ||
      typeof filePath !== "string" ||
      !path.isAbsolute(filePath) ||
      filePath === "/" ||
      filePath === "."
    ) {
      return { valid: false, reason: "malformed-path" };
    }

    // No workspace, use directory of the file
    const projectPath = path.dirname(filePath);

    // Safety check: ensure derived path is absolute and reasonable
    if (
      !path.isAbsolute(projectPath) ||
      projectPath === "/" ||
      projectPath === "."
    ) {
      return { valid: false, reason: "invalid-derived-path" };
    }

    return { valid: true, projectPath };
  }

  // Main method to get configuration for a document
  // Optional currentLine parameter: when provided, excludes that line from parsing
  // This prevents incomplete data (e.g., partial account names being typed) from appearing in completions
  getConfigForDocument(
    document: vscode.TextDocument,
    currentLine?: number,
  ): void {
    const filePath = document.uri.fsPath;
    const validationResult = this.validateDocumentPath(document);

    // For invalid paths, parse document content only without workspace scanning
    if (!validationResult.valid) {
      const currentContent = this.getContentExcludingCurrentLine(
        document,
        currentLine,
      );
      const effectivePath = filePath || "untitled";
      this.data = this.parser.parseContent(currentContent, effectivePath);
      return;
    }

    const projectPath = validationResult.projectPath;

    // Get cached data or parse workspace with incremental cache support
    const cacheKey = createCacheKey(projectPath);
    this.data = this.cache.get(cacheKey);
    if (!this.data || this.lastWorkspacePath !== projectPath) {
      // Pass cache to parseWorkspace for incremental updates (mtimeMs validation)
      this.data = this.parser.parseWorkspace(projectPath, this.cache);
      this.cache.set(cacheKey, this.data);
      this.lastWorkspacePath = projectPath;
    }

    // Parse current document content to capture unsaved changes
    // This ensures that accounts, payees, commodities, and tags defined in the current
    // (potentially unsaved) document are available for completion.
    // When currentLine is provided, exclude that line to prevent incomplete data
    // (e.g., "Прод" while typing "Расходы:Продукты") from polluting completions.
    const currentContent = this.getContentExcludingCurrentLine(
      document,
      currentLine,
    );
    const currentData = this.parser.parseContent(currentContent, filePath);

    // Clone workspace data before merging to prevent cache pollution.
    // This ensures incomplete data from current line doesn't persist in cache.
    if (currentLine !== undefined && this.data) {
      this.data = this.cloneData(this.data);
    }
    this.mergeCurrentData(currentData);
  }

  /**
   * Get document content, optionally excluding a specific line.
   * Used to prevent incomplete/in-progress typing from appearing in completions.
   */
  private getContentExcludingCurrentLine(
    document: vscode.TextDocument,
    lineToExclude?: number,
  ): string {
    if (lineToExclude === undefined) {
      return document.getText();
    }

    const lines: string[] = [];
    for (let i = 0; i < document.lineCount; i++) {
      if (i !== lineToExclude) {
        lines.push(document.lineAt(i).text);
      }
    }
    return lines.join("\n");
  }

  // Helper method to cast readonly data to mutable for internal operations
  // Type-safe conversion that preserves structure while allowing mutations
  private asMutable(data: ParsedHLedgerData): {
    accounts: Set<AccountName>;
    usedAccounts: Set<AccountName>;
    payees: Set<PayeeName>;
    tags: Set<TagName>;
    commodities: Set<CommodityCode>;
    accountUsage: Map<AccountName, UsageCount>;
    payeeUsage: Map<PayeeName, UsageCount>;
    tagUsage: Map<TagName, UsageCount>;
    commodityUsage: Map<CommodityCode, UsageCount>;
  } {
    // Safe cast through unknown to bypass readonly constraints
    // This is justified because we know the underlying implementation uses mutable collections
    return data as unknown as {
      accounts: Set<AccountName>;
      usedAccounts: Set<AccountName>;
      payees: Set<PayeeName>;
      tags: Set<TagName>;
      commodities: Set<CommodityCode>;
      accountUsage: Map<AccountName, UsageCount>;
      payeeUsage: Map<PayeeName, UsageCount>;
      tagUsage: Map<TagName, UsageCount>;
      commodityUsage: Map<CommodityCode, UsageCount>;
    };
  }

  /**
   * Creates a shallow clone with Copy-on-Write (CoW) optimization.
   * Only clones collections that mergeCurrentData() actually mutates.
   * Read-only collections share references with the original to reduce allocations.
   *
   * Cloned (mutated by mergeCurrentData):
   *   accounts, usedAccounts, payees, tags, commodities,
   *   accountUsage, payeeUsage, tagUsage, commodityUsage
   *
   * Shared (read-only, never mutated):
   *   definedAccounts, aliases, payeeAccounts, payeeAccountPairUsage,
   *   transactionTemplates, tagValues, tagValueUsage, commodityFormats, decimalMark, defaultCommodity, lastDate
   */
  private cloneData(data: ParsedHLedgerData): ParsedHLedgerData {
    return {
      // Cloned: mutated by mergeCurrentData
      accounts: new Set(data.accounts),
      usedAccounts: new Set(data.usedAccounts),
      payees: new Set(data.payees),
      tags: new Set(data.tags),
      commodities: new Set(data.commodities),
      accountUsage: new Map(data.accountUsage),
      payeeUsage: new Map(data.payeeUsage),
      tagUsage: new Map(data.tagUsage),
      commodityUsage: new Map(data.commodityUsage),

      // Shared: read-only references (CoW optimization)
      definedAccounts: data.definedAccounts,
      aliases: data.aliases,
      payeeAccounts: data.payeeAccounts,
      payeeAccountPairUsage: data.payeeAccountPairUsage,
      transactionTemplates: data.transactionTemplates,
      payeeRecentTemplates: data.payeeRecentTemplates,
      tagValues: data.tagValues,
      tagValueUsage: data.tagValueUsage,
      commodityFormats: data.commodityFormats,
      decimalMark: data.decimalMark,
      defaultCommodity: data.defaultCommodity,
      lastDate: data.lastDate,
    };
  }

  // Merge current document data with cached workspace data
  private mergeCurrentData(currentData: ParsedHLedgerData): void {
    if (!this.data) return;

    const mutableData = this.asMutable(this.data);

    // Update with current document data
    currentData.accounts.forEach((acc) => mutableData.accounts.add(acc));
    currentData.usedAccounts.forEach((acc) =>
      mutableData.usedAccounts.add(acc),
    );
    currentData.payees.forEach((p) => mutableData.payees.add(p));
    currentData.tags.forEach((t) => mutableData.tags.add(t));
    currentData.commodities.forEach((c) => mutableData.commodities.add(c));

    // Update usage counts with proper type handling
    currentData.accountUsage.forEach((count, key) => {
      const existing = mutableData.accountUsage.get(key) ?? createUsageCount(0);
      mutableData.accountUsage.set(key, createUsageCount(existing + count));
    });

    currentData.payeeUsage.forEach((count, key) => {
      const existing = mutableData.payeeUsage.get(key) ?? createUsageCount(0);
      mutableData.payeeUsage.set(key, createUsageCount(existing + count));
    });

    currentData.tagUsage.forEach((count, key) => {
      const existing = mutableData.tagUsage.get(key) ?? createUsageCount(0);
      mutableData.tagUsage.set(key, createUsageCount(existing + count));
    });

    currentData.commodityUsage.forEach((count, key) => {
      const existing =
        mutableData.commodityUsage.get(key) ?? createUsageCount(0);
      mutableData.commodityUsage.set(key, createUsageCount(existing + count));
    });
  }

  // Account methods with enhanced type safety
  getAccounts(): AccountName[] {
    return this.data ? Array.from(this.data.accounts) : [];
  }

  getAccountsByUsage(): AccountName[] {
    if (!this.data) return [];

    return Array.from(this.data.accounts).sort((a, b) => {
      const aUsage = this.data!.accountUsage.get(a) ?? 0;
      const bUsage = this.data!.accountUsage.get(b) ?? 0;

      if (aUsage !== bUsage) {
        return bUsage - aUsage; // Sort by usage descending
      }

      return a.localeCompare(b); // Then alphabetically
    });
  }

  getDefinedAccounts(): AccountName[] {
    return this.data ? Array.from(this.data.definedAccounts) : [];
  }

  getUsedAccounts(): AccountName[] {
    return this.data ? Array.from(this.data.usedAccounts) : [];
  }

  // Payee methods with enhanced type safety
  getPayees(): PayeeName[] {
    return this.data ? Array.from(this.data.payees) : [];
  }

  getPayeesByUsage(): PayeeName[] {
    if (!this.data) return [];

    return Array.from(this.data.payees).sort((a, b) => {
      const aUsage = this.data!.payeeUsage.get(a) ?? 0;
      const bUsage = this.data!.payeeUsage.get(b) ?? 0;

      if (aUsage !== bUsage) {
        return bUsage - aUsage;
      }

      return a.localeCompare(b);
    });
  }

  // Tag methods with enhanced type safety
  getTags(): TagName[] {
    return this.data ? Array.from(this.data.tags) : [];
  }

  getTagsByUsage(): TagName[] {
    if (!this.data) return [];

    return Array.from(this.data.tags).sort((a, b) => {
      const aUsage = this.data!.tagUsage.get(a) ?? 0;
      const bUsage = this.data!.tagUsage.get(b) ?? 0;

      if (aUsage !== bUsage) {
        return bUsage - aUsage;
      }

      return a.localeCompare(b);
    });
  }

  // Commodity methods with enhanced type safety
  getCommodities(): CommodityCode[] {
    return this.data ? Array.from(this.data.commodities) : [];
  }

  getCommoditiesByUsage(): CommodityCode[] {
    if (!this.data) return [];

    return Array.from(this.data.commodities).sort((a, b) => {
      const aUsage = this.data!.commodityUsage.get(a) ?? 0;
      const bUsage = this.data!.commodityUsage.get(b) ?? 0;

      if (aUsage !== bUsage) {
        return bUsage - aUsage;
      }

      return a.localeCompare(b);
    });
  }

  getDefaultCommodity(): CommodityCode | null {
    return this.data?.defaultCommodity ?? null;
  }

  // Date methods
  getLastDate(): string | null {
    return this.data?.lastDate ?? null;
  }

  // Alias methods with enhanced type safety
  getAliases(): ReadonlyMap<AccountName, AccountName> {
    return this.data?.aliases ?? new Map();
  }

  // Payee-account history for import resolution
  getPayeeAccountHistory(): {
    payeeAccounts: ReadonlyMap<PayeeName, ReadonlySet<AccountName>>;
    pairUsage: ReadonlyMap<string, UsageCount>;
  } | null {
    if (!this.data) {
      return null;
    }
    return {
      payeeAccounts: this.data.payeeAccounts,
      pairUsage: this.data.payeeAccountPairUsage,
    };
  }

  // Transaction templates for autocomplete
  getTransactionTemplates(): ReadonlyMap<
    PayeeName,
    ReadonlyMap<TemplateKey, TransactionTemplate>
  > | null {
    return this.data?.transactionTemplates ?? null;
  }

  /**
   * Gets all templates for a specific payee, sorted by recent usage (highest first).
   * Falls back to total usage count when recent usage is equal.
   * Returns empty array if no templates exist for the payee.
   */
  getTemplatesForPayee(payee: PayeeName): TransactionTemplate[] {
    const templates = this.data?.transactionTemplates?.get(payee);
    if (!templates) return [];

    const recentList = this.data?.payeeRecentTemplates?.get(payee) ?? [];

    // Count recent usage for each template
    const recentCounts = new Map<TemplateKey, number>();
    for (const key of recentList) {
      recentCounts.set(key, (recentCounts.get(key) ?? 0) + 1);
    }

    return Array.from(templates.entries())
      .map(([key, template]) => ({ key, template }))
      .sort((a, b) => {
        const aRecent = recentCounts.get(a.key) ?? 0;
        const bRecent = recentCounts.get(b.key) ?? 0;
        // Sort by recent usage first, fall back to total usage
        if (aRecent !== bRecent) return bRecent - aRecent;
        return b.template.usageCount - a.template.usageCount;
      })
      .map(({ template }) => template);
  }

  /**
   * Gets recent usage count for a template (occurrences in last 50 transactions).
   * Used for displaying recent vs total usage in completions.
   */
  getRecentTemplateUsage(payee: PayeeName, templateKey: TemplateKey): number {
    const recentList = this.data?.payeeRecentTemplates?.get(payee);
    if (!recentList) return 0;
    return recentList.filter((key) => key === templateKey).length;
  }

  /**
   * Gets all payees that have transaction templates.
   * Returns payees sorted by recent transaction count, falling back to total usage.
   */
  getPayeesWithTemplates(): PayeeName[] {
    if (!this.data?.transactionTemplates) return [];

    return Array.from(this.data.transactionTemplates.keys()).sort((a, b) => {
      // Sort by recent transactions count first
      const aRecent = this.data!.payeeRecentTemplates?.get(a)?.length ?? 0;
      const bRecent = this.data!.payeeRecentTemplates?.get(b)?.length ?? 0;
      if (aRecent !== bRecent) return bRecent - aRecent;

      // Fall back to total usage
      const aTemplates = this.data!.transactionTemplates.get(a);
      const bTemplates = this.data!.transactionTemplates.get(b);
      const aTotal = aTemplates
        ? Array.from(aTemplates.values()).reduce(
            (sum, t) => sum + t.usageCount,
            0,
          )
        : 0;
      const bTotal = bTemplates
        ? Array.from(bTemplates.values()).reduce(
            (sum, t) => sum + t.usageCount,
            0,
          )
        : 0;
      return bTotal - aTotal;
    });
  }

  // Context detection for completion
  getCompletionContext(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): CompletionContext {
    const line = document.lineAt(position).text;
    const beforeCursor = line.substring(0, position.character);

    // Custom query extraction for hierarchical account names
    // Use Unicode-aware regex to extract full account paths like "Assets:Cash"
    const query = this.extractHierarchicalQuery(beforeCursor);

    // Check if we're in a comment
    if (beforeCursor.includes(";") || beforeCursor.includes("#")) {
      // Look for tag patterns in comments
      if (HLedgerConfig.PATTERNS.TAG_IN_COMMENT.test(beforeCursor)) {
        return { type: "tag", query };
      }
      return { type: "tag", query: "" };
    }

    // Check for date context FIRST - at beginning of line with numeric input
    const lineStart = beforeCursor.trimStart();
    if (
      this.isDateContext(
        lineStart,
        position.character - (beforeCursor.length - lineStart.length),
      )
    ) {
      return { type: "date", query: lineStart }; // Use lineStart as query for better matching
    }

    // Check for payee context BEFORE commodity (after date in transaction line)
    if (this.isPayeePosition(line, position.character)) {
      return { type: "payee", query };
    }

    // Check for hledger keywords at beginning of line (but not if it looks like a date)
    if (
      HLedgerConfig.PATTERNS.KEYWORD_CONTEXT.test(beforeCursor) &&
      position.character < 20 &&
      !HLedgerConfig.PATTERNS.NUMERIC_START.test(lineStart)
    ) {
      return { type: "keyword", query };
    }

    // Check for account context (indented lines or after account keyword)
    if (
      HLedgerConfig.PATTERNS.INDENTED_LINE.test(beforeCursor) &&
      !this.isInAmountPosition(line, position.character)
    ) {
      return { type: "account", query };
    }

    // Check for explicit commodity context (after commodity keyword)
    if (beforeCursor.includes("commodity ")) {
      return { type: "commodity", query };
    }

    // Check for commodity context ONLY in posting lines (after numbers/amounts)
    if (this.isInAmountPosition(line, position.character)) {
      return { type: "commodity", query };
    }

    // Check for account directive context
    if (beforeCursor.includes("account ")) {
      return { type: "account", query };
    }

    // Default to account completion for indented lines
    if (HLedgerConfig.PATTERNS.INDENTED_LINE.test(beforeCursor)) {
      return { type: "account", query };
    }

    // Default to keyword completion for line start
    return { type: "keyword", query };
  }

  /**
   * Extract hierarchical query for account names and other completion contexts.
   * Uses Unicode-aware regex to properly handle account paths like "Assets:Cash".
   * This replaces VS Code's getWordRangeAtPosition which splits on colons.
   */
  private extractHierarchicalQuery(beforeCursor: string): string {
    // Unicode-aware regex pattern to extract hierarchical account names
    // \p{L} matches any Unicode letter, \p{N} matches any Unicode number
    // This supports international characters in account names
    const hierarchicalPattern = /[\p{L}][\p{L}\p{N}:_-]*$/u;

    // Try to extract a hierarchical name (like "Assets:Cash")
    const hierarchicalMatch = beforeCursor.match(hierarchicalPattern);
    if (hierarchicalMatch) {
      return hierarchicalMatch[0];
    }

    // Fallback to a simpler pattern for other cases
    // This handles basic words, tags, and commodity codes
    const simplePattern = /[\p{L}\p{N}_-]+$/u;
    const simpleMatch = beforeCursor.match(simplePattern);
    if (simpleMatch) {
      return simpleMatch[0];
    }

    // If no match found, return empty string
    return "";
  }

  private isDateContext(lineStart: string, positionInTrimmed: number): boolean {
    // Check if we're at the beginning of a line typing a date
    // Be very permissive - any digits at line start could be a date

    // First check: any numeric input at line start (for progressive typing)
    const isNumericStart = HLedgerConfig.PATTERNS.NUMERIC_START.test(lineStart);

    // Second check: partial date patterns
    const isPartialDate = HLedgerConfig.PATTERNS.PARTIAL_DATE.test(lineStart);

    // Third check: complete date formats
    const isFullDate = HLedgerConfig.PATTERNS.FULL_DATE.test(lineStart);
    const isShortDate = HLedgerConfig.PATTERNS.SHORT_DATE.test(lineStart);

    // Accept any of these patterns
    const isValidPattern =
      isNumericStart || isPartialDate || isFullDate || isShortDate;

    // Be generous with position - allow up to 12 characters for date entry
    return isValidPattern && positionInTrimmed <= 12;
  }

  private isInAmountPosition(line: string, position: number): boolean {
    // Amount position detection - ONLY for posting lines (indented)
    const beforeCursor = line.substring(0, position);

    // Critical: Only check for amounts in posting lines (indented lines)
    // This prevents false positives on transaction lines with dates
    if (!HLedgerConfig.PATTERNS.INDENTED_LINE.test(line)) {
      return false;
    }

    // Check if we're after a number (with optional whitespace) in a posting line
    if (HLedgerConfig.PATTERNS.AFTER_NUMBER.test(beforeCursor)) {
      // Make sure we're past the account name part
      const accountMatch = beforeCursor.match(
        HLedgerConfig.PATTERNS.ACCOUNT_END,
      );
      if (accountMatch && position > accountMatch[0].length) {
        return true;
      }
    }

    // Check if we're between currency symbols and numbers
    if (HLedgerConfig.PATTERNS.CURRENCY_CONTEXT.test(beforeCursor)) {
      return true;
    }

    return false;
  }

  private isPayeePosition(line: string, position: number): boolean {
    // Payee comes after date and optional status in transaction lines
    const beforeCursor = line.substring(0, position);
    const dateMatch = beforeCursor.match(
      HLedgerConfig.PATTERNS.DATE_IN_TRANSACTION,
    );

    // Fixed: Use >= instead of > to handle cursor at end of date match
    // This covers cases like "2024-08-23 |" where cursor is right after the space
    return !!dateMatch && position >= dateMatch[0].length;
  }

  // Note: isKeywordContext method was inlined to use pre-compiled patterns directly

  /**
   * Clear both parsed data and cache completely.
   * Use when cache must be invalidated entirely (e.g., configuration change).
   * For file changes, prefer resetData() to preserve cache for mtimeMs validation.
   */
  clearCache(): void {
    this.cache.clear();
    this.data = null;
    this.lastWorkspacePath = null;
  }

  /**
   * Reset parsed data without clearing cache.
   * Cache entries will be validated by mtimeMs check on next access.
   * Use when files may have changed but cache should be preserved for validation.
   * This enables incremental updates - only modified files will be reparsed.
   */
  resetData(): void {
    this.data = null;
    this.lastWorkspacePath = null;
    // Cache is NOT cleared - SimpleProjectCache.get() will validate mtimeMs on next use
  }

  // Direct access to usage maps with enhanced type safety
  get accountUsage(): ReadonlyMap<AccountName, UsageCount> {
    return this.data?.accountUsage ?? new Map();
  }

  get payeeUsage(): ReadonlyMap<PayeeName, UsageCount> {
    return this.data?.payeeUsage ?? new Map();
  }

  get tagUsage(): ReadonlyMap<TagName, UsageCount> {
    return this.data?.tagUsage ?? new Map();
  }

  get commodityUsage(): ReadonlyMap<CommodityCode, UsageCount> {
    return this.data?.commodityUsage ?? new Map();
  }

  // Tag value methods with enhanced type safety
  getTagValuesFor(tagName: TagName): TagValue[] {
    if (!this.data?.tagValues) return [];
    const values = this.data.tagValues.get(tagName);
    return values ? Array.from(values) : [];
  }

  getTagValuesByUsageFor(tagName: TagName): TagValue[] {
    const values = this.getTagValuesFor(tagName);

    if (!this.data?.tagValueUsage) return values;

    return values.sort((a, b) => {
      const keyA = `${tagName}:${a}`;
      const keyB = `${tagName}:${b}`;
      const aUsage = this.data!.tagValueUsage.get(keyA) ?? 0;
      const bUsage = this.data!.tagValueUsage.get(keyB) ?? 0;

      if (aUsage !== bUsage) {
        return bUsage - aUsage;
      }

      return a.localeCompare(b);
    });
  }

  get tagValueUsage(): ReadonlyMap<string, UsageCount> {
    return this.data?.tagValueUsage ?? new Map();
  }

  // Backward compatibility methods for tests
  parseContent(content: string, basePath?: string): void {
    const parsedData = this.parser.parseContent(content, basePath);
    if (this.data) {
      this.mergeCurrentData(parsedData);
    } else {
      this.data = parsedData;
    }

    // For tests: also update the cache with the parsed data
    // This ensures getConfigForDocument() doesn't overwrite test data
    if (basePath) {
      const cacheKey = createCacheKey(basePath);
      this.cache.set(cacheKey, this.data);
      this.lastWorkspacePath = basePath;
    }
  }

  parseFile(filePath: string): void {
    this.data = this.parser.parseFile(filePath);
  }

  scanWorkspace(workspacePath: string): void {
    this.data = this.parser.parseWorkspace(workspacePath);
    this.lastWorkspacePath = workspacePath;
  }

  // Legacy property access for backward compatibility
  get defaultCommodity(): CommodityCode | null {
    return this.getDefaultCommodity();
  }

  getUndefinedAccounts(): AccountName[] {
    // Return accounts that are used but not defined (including parent accounts)
    const defined = new Set(this.getDefinedAccounts());
    return this.getUsedAccounts().filter(
      (account) => !this.isAccountDefinedOrHasDefinedParent(account, defined),
    );
  }

  /**
   * Checks if an account is defined or has a defined parent account.
   * For example, if 'Assets' is defined, then 'Assets:Bank:Cash' is considered valid.
   */
  private isAccountDefinedOrHasDefinedParent(
    accountName: AccountName,
    definedAccounts: ReadonlySet<AccountName>,
  ): boolean {
    // Check exact match first
    if (definedAccounts.has(accountName)) {
      return true;
    }

    // Check if any parent account is defined
    // For 'Assets:Bank:Cash', check 'Assets:Bank' and 'Assets'
    const parts = accountName.split(":");
    for (let i = parts.length - 1; i > 0; i--) {
      const parentAccount = parts.slice(0, i).join(":") as AccountName;
      if (definedAccounts.has(parentAccount)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Cleanup method to prevent memory leaks.
   * Clears all cached data and resets internal state.
   */
  dispose(): void {
    this.clearCache();
    this.data = null;
    this.lastWorkspacePath = null;
  }
}
