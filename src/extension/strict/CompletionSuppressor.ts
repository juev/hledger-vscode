import { StrictCompletionContext, LineContext } from './StrictPositionAnalyzer';
import { CompletionType } from '../types';
import { NumberFormatService } from '../services/NumberFormatService';

export class CompletionSuppressor {
  private readonly numberFormatService: NumberFormatService;

  constructor(numberFormatService?: NumberFormatService) {
    this.numberFormatService = numberFormatService || new NumberFormatService();
  }

  shouldSuppressAll(context: StrictCompletionContext): boolean {
    // Explicit suppression
    if (context.suppressAll) {
      return true;
    }

    // Suppression in forbidden zones
    if (this.isInForbiddenZone(context)) {
      return true;
    }

    // Suppression after amount + two spaces
    if (this.isAfterAmount(context)) {
      return true;
    }

    // Suppression in middle of word
    if (this.isInMiddleOfWord(context)) {
      return true;
    }

    return false;
  }

  filterAllowedTypes(context: StrictCompletionContext): CompletionType[] {
    if (this.shouldSuppressAll(context)) {
      return [];
    }

    // Return only allowed types for this context
    return context.allowedTypes.filter((type) => this.isTypeAllowed(type, context));
  }

  private isInForbiddenZone(context: StrictCompletionContext): boolean {
    return context.lineContext === LineContext.Forbidden;
  }

  private isAfterAmount(context: StrictCompletionContext): boolean {
    // CRITICAL: Trust the context analyzer completely
    // If we're in comment contexts, NEVER suppress regardless of amount patterns
    if (
      context.lineContext === LineContext.InComment ||
      context.lineContext === LineContext.InTagValue
    ) {
      return false;
    }

    // Don't suppress if already in a forbidden zone context
    // The context analyzer already handles this
    if (context.lineContext === LineContext.Forbidden) {
      return false; // Let the context analyzer handle forbidden zones
    }

    const beforeCursor = context.position.beforeCursor;

    // Only check for forbidden zone patterns in non-comment contexts
    // This method should only suppress in posting contexts where we have amount + 2+ spaces

    // Create individual amount patterns for each format and combine them for context matching
    // We need to match amounts within text, not as standalone strings
    const formatPatterns = this.numberFormatService.getSupportedFormats().map((format) => {
      const { decimalMark, groupSeparator, useGrouping } = format;

      // Escape regex characters
      const escapedDecimalMark = decimalMark.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const escapedGroupSeparator =
        useGrouping && groupSeparator ? groupSeparator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '';

      // Create pattern for amounts in context (not anchored to start/end of string)
      if (useGrouping && groupSeparator) {
        // Pattern for grouped numbers: 1,234.56 or 1 234,56
        return `\\p{N}{1,3}(?:${escapedGroupSeparator}\\p{N}{3})*(?:${escapedDecimalMark}\\p{N}{1,12})?`;
      } else {
        // Pattern for simple numbers: 1234.56 or 1234,56
        return `\\p{N}+(?:${escapedDecimalMark}\\p{N}{1,12})?`;
      }
    });

    // Combine all format patterns
    const combinedAmountPattern = `(?:${formatPatterns.join('|')})`;

    // Standard forbidden zone pattern: amount + 2+ spaces
    const forbiddenZonePattern = new RegExp(`${combinedAmountPattern}\\s{2,}`, 'u');

    return forbiddenZonePattern.test(beforeCursor);
  }

  private isInMiddleOfWord(context: StrictCompletionContext): boolean {
    // Don't suppress in comment contexts - allow completions for tags
    if (
      context.lineContext === LineContext.InComment ||
      context.lineContext === LineContext.InTagValue
    ) {
      return false;
    }

    const { beforeCursor, afterCursor } = context.position;

    // Check if we are in the middle of a word using Unicode-aware patterns
    // \p{L} matches any Unicode letter, \p{N} matches any Unicode number
    const beforeEndsWithWord = /[\p{L}\p{N}]$/u.test(beforeCursor);
    const afterStartsWithWord = /^[\p{L}\p{N}]/u.test(afterCursor);

    return beforeEndsWithWord && afterStartsWithWord;
  }

  private isTypeAllowed(type: CompletionType, context: StrictCompletionContext): boolean {
    switch (context.lineContext) {
      case LineContext.LineStart:
        // Only dates allowed at line beginning
        return type === 'date';

      case LineContext.InPosting:
        // Only accounts allowed on indented lines
        return type === 'account';

      case LineContext.AfterAmount:
        // Only currencies allowed after amounts
        return type === 'commodity';

      case LineContext.AfterDate:
        // Only payee completions allowed after date + space
        return type === 'payee';

      case LineContext.InComment:
        // Only tag name completions allowed in comments
        return type === 'tag';

      case LineContext.InTagValue:
        // Only tag value completions allowed after tag name and colon
        return type === 'tag_value';

      case LineContext.Forbidden:
        // Nothing allowed in forbidden zones
        return false;

      default:
        return false;
    }
  }
}
