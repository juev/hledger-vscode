# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## **MANDATORY: Expert Usage Requirements**

**CRITICAL**: For ALL tasks in this repository, you MUST use specialized Task tool agents. Never work directly without expert consultation.

### Required Expert Usage Pattern

1. **Always assess task complexity** - Identify which specialized agent(s) are needed
2. **Launch appropriate experts concurrently** when possible for maximum performance
3. **Use multiple agents for complex tasks** - break down into specialized subtasks
4. **Never bypass expert consultation** - even for "simple" tasks

### Available Experts for This Codebase

- `typescript-expert` - For TypeScript development, type system, generics
- `code-reviewer` - For code quality, security, maintainability review
- `test-automator` - For test creation, test fixes, coverage improvement
- `performance-engineer` - For optimization, profiling, benchmarking
- `debugger` - For error diagnosis, runtime issues, unexpected behavior
- `backend-architect` - For extension architecture, API design
- `general-purpose` - For research, file analysis, complex searches

## **MANDATORY: Task Execution Workflows**

**ALL tasks must follow this 6-step process:**

### 1. Analysis Phase

- Use appropriate expert agents to analyze the current state
- Identify components, dependencies, and requirements
- Understand existing patterns and architecture

### 2. Plan Creation

- Expert agents create detailed implementation plan
- Break down complex tasks into manageable steps
- Identify risks, dependencies, and success criteria

### 3. User Agreement

- Present plan to user for approval
- Explain approach, timeline, and expected outcomes
- Allow for plan modifications based on feedback

### 4. Plan Refinement

- Incorporate user feedback into plan
- Adjust approach, scope, or timeline as needed
- Ensure alignment with user expectations

### 5. Plan Documentation

- Document final approved plan in TodoWrite
- Create trackable tasks with clear completion criteria
- Establish progress monitoring framework

### 6. Execution with Context Management

- Clear context before each major step to maintain focus
- Execute plan systematically using expert agents
- Track progress and update todos in real-time

## Project Overview

This is a Visual Studio Code extension for hledger journal files (plain text accounting). It provides syntax highlighting, IntelliSense features (account/date/commodity/tag value completion), and language support for `.journal`, `.hledger`, and `.ledger` files.

**Current Version**: 0.2.1 (fully functional implementation with critical tag completion fix - all 200 tests passing)

### **hledger Syntax Reference**

**Primary source of truth for hledger syntax**: https://hledger.org/1.50/hledger.html

When questions arise about correct behavior or syntax implementation, always refer to the official hledger documentation at the above URL to ensure compliance with the specification. This documentation is the authoritative reference for:

- Journal syntax rules
- Directive specifications  
- Transaction format requirements
- Account naming conventions
- Commodity and number format specifications
- Comment and tag syntax
- All other hledger language features

### **Major Development Milestone: Tag Completion System Fixed**

**Achievement**: Successfully resolved critical tag completion issue where multiple completion providers were incorrectly activating simultaneously instead of only tag value completions. This fix:

- **Enables proper tag value completion** in comment contexts (e.g., after "category:" in comments)  
- **Supports international number formats** in lines with tag completions
- **Maintains position-based completion integrity** across all completion types
- **Achieves 100% test success rate** with all 200 tests now passing
- **Preserves Unicode support** for international users
- **Prevents completion provider interference** through proper suppression logic

**Key Technical Achievement**: The fix in `CompletionSuppressor.ts` ensures that completion suppression logic NEVER interferes with tag value completions in comment contexts, maintaining the strict position-based completion architecture while enabling proper tag functionality.

## Development Commands

**NOTE**: Always use expert agents to execute and validate these commands.

```bash
# Install dependencies
npm install

# Compile TypeScript to JavaScript
npm run compile

# Watch mode for development
npm run watch

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Package extension (creates .vsix file)
vsce package

# Lint code (if available)
npm run lint
```

**Expert Usage for Development:**

- Use `debugger` agent for test failures or build issues
- Use `typescript-expert` for TypeScript compilation problems
- Use `performance-engineer` for optimization tasks
- Use `test-automator` for test creation or fixes

## Completion System - Strict Position-Based Algorithm

### Trigger Configuration

The extension uses explicit triggers for VS Code completion activation:

**Required Triggers** (registered in `main.ts`):

- **'0'-'9'** - Activates date completion at line start
- **' ' (space)** - Activates payee/account/commodity completions based on context
- **':'** - Activates account hierarchy completion (e.g., `Assets:Cash`)
- **'@'** - Activates commodity/currency completion
- **';'** - Reserved for future comment completion

### Completion Logic by Position

The strict position-based algorithm (`StrictPositionAnalyzer`) determines completion type:

1. **Date Completion**
   - **Position**: Beginning of line when typing any digit
   - **Pattern**: `/^\d/`
   - **Example**: `2024-01-15` or `01/15`

2. **Payee Completion**
   - **Position**: After date + space(s)
   - **Pattern**: `/^\d{4}[-/]\d{1,2}[-/]\d{1,2}\s+/` and variants
   - **Example**: `2024-01-15 Amazon`

3. **Account Completion**
   - **Position**: Indented lines (expense/income categories)
   - **Pattern**: `/^\s+/` (line starts with spaces/tabs)
   - **Example**: `Assets:Checking`

4. **Commodity/Currency Completion**
   - **Position**: After amount + single space
   - **Pattern**: Dynamic patterns based on detected number formats (e.g., `/\d+([.,]\d+)?\s[A-Z]*$/u`)
   - **Examples**: `100.00 USD`, `100,50 EUR`, `1 000,00 RUB`

5. **Forbidden Zone**
   - **Position**: After amount + two or more spaces
   - **Pattern**: Dynamic patterns based on detected number formats (e.g., `/\d+([.,]\d+)?\s{2,}/u`)
   - **No completions allowed**

### Implementation Components

- **StrictPositionAnalyzer**: Determines context based on cursor position with international number format support
- **StrictPositionValidator**: Validates if position allows specific completion
- **CompletionSuppressor**: Blocks completions in forbidden zones (CRITICAL FIX: preserves tag completions in comment contexts)
- **StrictCompletionProvider**: Main provider coordinating all completions
- **NumberFormatService**: Provides format-aware regex patterns for international number formats

## Current Architecture (v0.2.1)

**IMPORTANT**: Use `backend-architect` expert for all architecture analysis and modifications.

This is a straightforward, functional VS Code extension with a modular but simple architecture. The design prioritizes maintainability and clarity over complex patterns.

### Core Architecture Components

#### 1. Extension Entry Point

- **Main Extension Entry**: `src/extension/main.ts` (~190 lines)
  - Simple activation function with global state management
  - Registers completion providers and commands
  - Creates shared configuration instance

#### 2. Configuration & Parsing Layer

- **HLedgerConfig** (`src/extension/HLedgerConfig.ts`) - Configuration management and data coordination
- **HLedgerParser** (`src/extension/HLedgerParser.ts`) - Synchronous file parsing for hledger syntax with international number format support
- **NumberFormatService** (`src/extension/NumberFormatService.ts`) - International number format detection and parsing service
- **SimpleProjectCache** (`src/extension/SimpleProjectCache.ts`) - Basic Map-based caching with workspace isolation

#### 3. Completion System (Modular Design)

- **Unified Provider**: `HLedgerCompletionProvider.ts` - Main completion coordinator
- **Specialized Completers**:
  - `AccountCompleter.ts` - Account name suggestions with frequency tracking
  - `PayeeCompleter.ts` - Transaction payee/description completion
  - `CommodityCompleter.ts` - Currency/commodity symbol completion
  - `DateCompleter.ts` - Smart date suggestions
  - `TagCompleter.ts` - Tag value completion for comment tags (e.g., after "category:" suggests "groceries", "dining")
- **Fuzzy Matching**: `SimpleFuzzyMatcher.ts` - Basic fuzzy search with Unicode support

#### 4. Type Safety & Domain Modeling

- **Type Definitions** (`src/extension/types.ts`):
  - Branded types for domain safety (`AccountName`, `FilePath`, etc.)
  - Type guards for runtime validation
  - Interface definitions for data structures

#### 5. Supporting Infrastructure

- **Syntax Highlighting**: `syntaxes/hledger.tmLanguage.json` - Comprehensive TextMate grammar
- **Smart Indentation**: `HLedgerEnterCommand.ts` and related providers
- **Color Configuration**: Extensive customization via VS Code settings

### Current Design Patterns (v0.2.1)

**NOTE**: Use `backend-architect` expert for pattern analysis and `code-reviewer` for pattern validation.

#### 1. **Type Safety & Domain Modeling**

- **Branded Types System**: Domain-safe types implemented in `types.ts`
  - `AccountName` - Type-safe account identifiers
  - `FilePath` - File system path validation
  - `CompletionScore` - Numeric scoring with bounds
  - `UsageCount` - Frequency tracking
- **Type Guards**: Runtime validation functions
  - `isValidAccountName()` - Account format validation
  - `isValidFilePath()` - Path validation
- **Interface-Based Design**: Clear interfaces for data structures

#### 2. **Modular Completion Architecture**

- **Single Responsibility**: Each completer handles one completion type
- **Unified Provider**: `HLedgerCompletionProvider` coordinates all completers
- **Consistent Interface**: All completers follow the same contract
- **Frequency Tracking**: Usage-based prioritization with `Map<string, number>`

#### 3. **Simple Caching Strategy**

- **Project-based Caching**: `SimpleProjectCache` with workspace isolation
- **Map-based Storage**: Direct Map usage for simplicity
- **Manual Invalidation**: Explicit cache clearing when needed
- **Memory Management**: Basic cleanup patterns

#### 4. **Configuration-Driven Behavior**

- **VS Code Settings Integration**: All behavior controlled via settings
- **Runtime Configuration**: Dynamic setting updates
- **Type-safe Configuration**: Settings validated at runtime

#### 5. **Fuzzy Matching with Unicode Support**

- **SimpleFuzzyMatcher**: Basic but effective fuzzy search
- **Unicode Awareness**: Proper handling of international characters
- **Scoring Algorithm**: Simple but effective relevance scoring

#### 6. **File System Integration**

- **Synchronous Parsing**: Direct file reading and parsing
- **Include File Support**: Recursive parsing of included files
- **File Watching**: Basic change detection

#### 7. **International Number Format Support**

- **NumberFormatService**: Service for detecting and parsing international number formats
- **Format Detection**: Automatic detection of decimal separators (comma/period) and group separators
- **Dynamic Pattern Generation**: Format-aware regex patterns for position analysis
- **Commodity Format Directives**: Support for `commodity 1 000,00 EUR` format specifications
- **Decimal Mark Directives**: Support for `decimal-mark ,` file-level settings
- **Format Inheritance**: Format settings cascade from file-level to transaction-level

### File Parsing System

**Use `general-purpose` expert for parsing logic analysis and `typescript-expert` for implementation.**

The `HLedgerParser` class handles parsing of hledger files to extract:

- **Account definitions** (`account` directives) with usage frequency tracking
- **Used accounts** (from transactions) with usage frequency tracking  
- **Commodity definitions** with usage frequency tracking
- **Commodity format directives** (`commodity 1 000,00 EUR`) with international format specifications
- **Decimal mark directives** (`decimal-mark ,`) for file-level number format settings
- **Include directives** for modular files
- **Transaction dates** for date completion
- **Payees/merchants** from transaction descriptions with usage frequency tracking
- **Tags/categories** from comments (`tag:value` format) with usage frequency tracking
- **Tag value pairs** (mapping tag names to their used values) for tag value completion
- **International number formats** detected from transaction amounts and format directives

**Frequency Intelligence**:

- **Usage counters**: Maintains `Map<string, number>` for accounts, payees, tags, commodities, and tag values
- **Frequency-based methods**: `getAccountsByUsage()`, `getPayeesByUsage()`, `getTagsByUsage()`, `getCommoditiesByUsage()`, `getTagValuesByUsageFor()`
- **Smart prioritization**: Most frequently used items appear first in completion lists
- **Tag value mapping**: Stores `Map<TagName, Set<TagValue>>` for efficient tag value lookups

**International Number Format Intelligence**:

- **Format detection**: Automatic detection of decimal separators (comma vs period) from transaction amounts
- **Format directives**: Parsing of `commodity` and `decimal-mark` directives for explicit format specifications
- **Context-aware patterns**: Dynamic regex generation based on detected or specified number formats
- **Format inheritance**: File-level format settings applied to all transactions unless overridden by commodity-specific formats

## Testing

**MANDATORY**: Use `test-automator` expert for all testing tasks and `debugger` expert for test failures.

Testing infrastructure uses Jest with TypeScript support:

```bash
# Run all tests
npm test

# Run tests in watch mode  
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

### Current Test Structure (v0.2.1)

- **Unit Tests**: Located in `src/extension/__tests__/` with 13 test files
- **Test Configuration**: `jest.config.js` with ts-jest preset
- **Mock VSCode API**: Basic `src/__mocks__/vscode.ts` for testing
- **Test Status**: All 200 tests now passing after critical tag completion fix

**Current Test Coverage**:

- **Completion Providers**: Comprehensive tests for all completion types including tag value completion
- **Type Safety**: Branded types and type guard validation
- **Fuzzy Matching**: SimpleFuzzyMatcher functionality
- **Parser Tests**: File parsing and data extraction
- **Cache Tests**: SimpleProjectCache functionality
- **Configuration Tests**: Settings and configuration management
- **Position Analysis**: StrictPositionAnalyzer and context detection
- **Suppression Logic**: CompletionSuppressor with tag completion fix

### Manual Testing & Test Data Files

**MANDATORY**: All test data files MUST be placed ONLY in the `testdata/` directory.

#### Test Data Directory Structure (`testdata/`)

The `testdata/` directory contains realistic hledger journal files used exclusively for manual testing, feature validation, and development reference. These files are NOT used in automated tests but serve as comprehensive examples of extension functionality.

**Current Test Files**:

1. **`test.journal`** - Main comprehensive test file (PRIMARY)
   - **Purpose**: Primary manual testing with comprehensive feature coverage
   - **Features**: Multi-language support (Cyrillic), various transaction formats, account aliases, commodity definitions
   - **Usage**: Referenced in manual testing workflows, syntax highlighting validation

2. **`syntax-demo.journal`** - Advanced syntax demonstration
   - **Purpose**: Showcase complex hledger syntax and edge cases  
   - **Features**: Multiple date formats, cryptocurrencies, precious metals, complex postings
   - **Usage**: Validate advanced parsing and syntax highlighting features

3. **`syntax-test.journal`** - Basic syntax validation
   - **Purpose**: Minimal test file for basic syntax validation
   - **Features**: Simple Cyrillic transactions, basic posting structure

4. **`test-indent.journal`** - Indentation behavior testing
   - **Purpose**: Test smart indentation features (`HLedgerEnterCommand`)
   - **Features**: Transaction starts without postings to test auto-indentation

5. **`test_frequency.journal`** - Frequency-based completion testing
   - **Purpose**: Test usage tracking and frequency-based prioritization
   - **Features**: Repeated payees (Amazon: 3x, Walmart: 2x) for frequency sorting validation

6. **`test-tags.journal`** - Tag value completion testing
   - **Purpose**: Test tag value completion functionality with Unicode support
   - **Features**: Tag:value pairs in comments, Unicode tags (категория:подарки), spaces in values (project:web development)
   - **Usage**: Validate tag value completion, frequency-based tag value sorting

7. **`test-international-numbers.journal`** - International number format testing
   - **Purpose**: Test international number format support and completion functionality
   - **Features**: Various number formats (comma/period decimal separators, different group separators), commodity format directives, decimal-mark directives
   - **Usage**: Validate international number parsing, format-aware completion patterns, commodity completion with various formats

#### Test File Requirements & Guidelines

**CRITICAL RULES**:

- **Location**: ALL test files MUST be in `testdata/` directory only
- **Format**: All files must be valid hledger journal files (`.journal` extension)
- **Naming**: Use consistent hyphen-based naming: `test-[feature].journal`
- **Content**: Must cover edge cases, multi-language support, and complex scenarios

**File Naming Conventions**:

- `test.journal` - Main comprehensive test file
- `test-[feature].journal` - Feature-specific test files (e.g., `test-indent.journal`)
- `[feature]-demo.journal` - Demonstration/showcase files (e.g., `syntax-demo.journal`)

**Maintenance Requirements**:

- Keep updated with latest hledger specification features
- Include realistic transaction patterns for frequency testing
- Maintain multi-language examples for internationalization
- Cover edge cases and complex scenarios

#### Manual Testing Workflow

**Expert-Assisted Testing Process**:

1. **Use `test-automator` expert** to validate test file structure and coverage
2. **Use `debugger` expert** to diagnose test configuration issues  
3. **Use `typescript-expert` expert** for TypeScript-related test problems
4. **Use `code-reviewer` expert** to validate test quality and completeness

**Manual Validation Steps**:

1. Open test files in VS Code with extension enabled
2. Validate syntax highlighting across all language features
3. Test completion providers (accounts, dates, commodities, payees, tags)
4. Verify frequency-based sorting using `test_frequency.journal`
5. Test indentation behavior with `test-indent.journal`
6. Validate multi-language support with Cyrillic content
7. Test international number formats using `test-international-numbers.journal`

#### Integration with Development Workflow

**When to Update Test Files**:

- After adding new syntax highlighting features
- When updating to newer hledger specifications  
- After modifying completion provider logic
- When adding support for new languages/scripts
- After updating international number format support

**Expert Usage for Test Data**:

- **Use `general-purpose` expert** for analyzing test file coverage
- **Use `test-automator` expert** for creating new test scenarios
- **Use `performance-engineer` expert** for testing with large files

## GitHub Actions

- **CI**: Runs on all branches, tests Node.js 18.x and 20.x
- **Release**: Triggers on version tags (e.g., `v1.0.0`)

## Important Notes (v0.2.1)

### Core Features

1. **Main source**: TypeScript (`src/extension/main.ts`) with simple, clear architecture
2. **Type Safety**: Branded types system with runtime validation
3. **Activation event**: `onLanguage:hledger`
4. **File associations**: `.journal`, `.hledger`, `.ledger`
5. **Dependencies**: No external dependencies for core functionality
6. **Syntax highlighting**: Comprehensive TextMate grammar with customizable colors
7. **hledger Compliance**: Follows hledger specification with core feature support
8. **International Format Support**: Support for various decimal separators and group separators in number formats

### Performance & Caching

1. **Simple Caching**: Map-based project cache with workspace isolation
2. **Synchronous Processing**: Direct file operations with immediate results
3. **Memory Management**: Basic cleanup patterns
4. **Frequency Intelligence**: Usage-based completion prioritization
5. **International Number Formats**: Support for comma and period decimal separators with various group separators

### Available Configuration

**Real Settings (from package.json)**:

- `hledger.autoCompletion.enabled` - Enable/disable completion
- `hledger.autoCompletion.maxResults` - Limit completion results
- `hledger.autoCompletion.maxAccountResults` - Limit account completions
- `hledger.smartIndent.enabled` - Smart indentation on Enter key
- `hledger.colors.*` - 9 color customization settings

### Available Commands

**Real Commands (from package.json)**:

- `hledger.onEnter` - Smart Enter key handling for proper indentation

### Architecture Benefits (v0.2.1)

The current architecture provides these benefits:

1. **Simplicity**: Easy to understand and maintain
2. **Reliability**: Straightforward code paths reduce bugs
3. **Performance**: Direct operations without complex abstractions
4. **Type Safety**: Branded types prevent common errors
5. **Modularity**: Clear separation between completion types
6. **Extensibility**: Easy to add new completion providers
7. **Testability**: Simple structure allows focused testing
8. **International Support**: Built-in support for international number formats and Unicode text

## **CRITICAL: Completion System Integrity Requirements**

**WARNING**: The completion system underwent major fixes for Unicode support, international number format support, and strict position-based logic. These requirements prevent critical regressions that break international user experience.

## **CRITICAL: International Number Format Support Requirements**

**NEVER break international number format support - this causes regressions for users worldwide**

### **MANDATORY: Number Format Pattern Requirements**

- **MANDATORY**: Use `NumberFormatService` for all amount-related regex pattern generation
- **MANDATORY**: Support both comma (`,`) and period (`.`) as decimal separators
- **MANDATORY**: Support various group separators (space, comma, period, apostrophe)
- **MANDATORY**: Parse `commodity` format directives (e.g., `commodity 1 000,00 EUR`)
- **MANDATORY**: Parse `decimal-mark` directives (e.g., `decimal-mark ,`)
- **MANDATORY**: Include `/u` flag in all number format regex patterns

### **Forbidden Number Format Patterns (Cause International Regressions)**

- **FORBIDDEN**: Hard-coded period (`.`) as only decimal separator
- **FORBIDDEN**: Ignoring commodity format directives
- **FORBIDDEN**: Fixed regex patterns for amounts (use `NumberFormatService.getAmountPattern()`)
- **FORBIDDEN**: Assuming US number format (1,234.56) as default

### **International Number Format Validation Requirements**

- **ALL amount regex patterns** must be generated using `NumberFormatService`
- **ALL number parsing** must support detected formats from file analysis
- **ALL completion logic** must work with comma decimal separators (European format)
- **Expert Usage**: Use `typescript-expert` for all number format pattern changes

### **Required Number Format Test Scenarios**

```typescript
// These test patterns are MANDATORY for any number format changes:
describe('International Number Format Support', () => {
  it('handles comma decimal separator (1 234,56)', () => { /* ... */ });
  it('handles period decimal separator (1,234.56)', () => { /* ... */ });
  it('parses commodity format directives', () => { /* ... */ });
  it('respects decimal-mark directives', () => { /* ... */ });
  it('generates format-aware regex patterns', () => { /* ... */ });
});
```

### **MANDATORY: Unicode Support Requirements**

**NEVER break Unicode support - this causes international user regressions**

#### Required Unicode Patterns

- **MANDATORY**: Use `\p{L}` instead of `[A-Za-z]` for all letter matching
- **MANDATORY**: Use `toLocaleLowerCase()` instead of `toLowerCase()` for international characters  
- **MANDATORY**: Use `localeCompare()` instead of basic string comparison
- **MANDATORY**: Test with Cyrillic, Arabic, Chinese characters before any regex changes
- **MANDATORY**: Include `/u` flag in all regex patterns that match text

#### Forbidden Patterns (Cause Unicode Regressions)

- **FORBIDDEN**: `[A-Za-z]` patterns (use `[\p{L}]` with `/u` flag)
- **FORBIDDEN**: `toLowerCase()` (use `toLocaleLowerCase()`)
- **FORBIDDEN**: `a > b` string comparison (use `localeCompare()`)
- **FORBIDDEN**: Splitting account names on `:` character (breaks hierarchical names)

#### Unicode Validation Requirements

- **ALL regex patterns** must be tested with `testdata/test.journal` (contains Cyrillic)
- **ALL string operations** must support Unicode normalization
- **ALL fuzzy matching** must handle international characters correctly
- **Expert Usage**: Use `typescript-expert` for all regex pattern changes

### **CRITICAL: Completion System Architecture Constraints**

#### Position-Based Completion Rules (NEVER violate)

**These rules were fixed in major completion system overhaul - breaking them causes completion failures:**

1. **Date Completion**: ONLY at line start when typing digits
2. **Payee Completion**: ONLY after date + space(s) - context `AfterDate` must exist
3. **Account Completion**: ONLY on indented lines or after `:` trigger  
4. **Commodity Completion**: ONLY after amount + single space
5. **Forbidden Zone**: NO completions after amount + two or more spaces
6. **Tag Value Completion**: ONLY after tag name and colon in comments (e.g., "category:") - context `InTagValue`

### **CRITICAL TAG COMPLETION FIX (2024) - NEVER REGRESS**

**Major Issue Fixed**: Tag completions were being incorrectly suppressed by `CompletionSuppressor.isAfterAmount()` method, causing multiple completion providers to activate simultaneously instead of only tag value completions.

**Root Cause**: The suppression logic incorrectly blocked ALL completions in comment contexts, even when tag value completions should be allowed in lines like:

```
    Расходы:Продукты                111,99      ; category:
```

**Critical Fix**: Modified `CompletionSuppressor.ts` (lines 52-54) with early return for comment contexts:

```typescript
// CRITICAL FIX for tag completion - NEVER remove this check
if (context.lineContext === LineContext.InComment || context.lineContext === LineContext.InTagValue) {
    return false; // NEVER suppress completions in comment contexts
}
```

**Impact**: This fix ensures tag completions work correctly in international number formats and prevents interference from other completion providers.

**Testing Requirements**: This fix enables all 200 tests to pass and must be validated with `testdata/test-tags.journal`.

#### Required Context Types (NEVER modify enum)

```typescript
enum LineContext {
    LineStart = 'line_start',     // Required: Date completion only
    AfterDate = 'after_date',     // CRITICAL: Must exist for payee completion
    InPosting = 'in_posting',     // Required: Account completion in postings  
    AfterAmount = 'after_amount', // Required: Commodity completion only
    InComment = 'in_comment',     // Required: General comment context
    InTagValue = 'in_tag_value',  // Required: Tag value completion after "tag:"
    Forbidden = 'forbidden'       // Required: Block all completions
}
```

#### Critical Context Detection Rules

- **AfterDate context**: Must match `/^\d{4}[-\/]\d{1,2}[-\/]\d{1,2}\s+(?:[*!]\s+)?[\p{L}]*$/u`
- **Account names**: Must support hierarchical extraction (`Assets:Cash:Checking`)
- **Query extraction**: NEVER split on `:` for account names - extract full hierarchical paths
- **Unicode patterns**: All context detection must use `\p{L}` for international characters
- **Amount patterns**: Must use `NumberFormatService` for format-aware pattern generation
- **Number format awareness**: Context detection must adapt to detected decimal separators and group separators

#### Expert Requirements for Architecture Changes

- **MANDATORY**: Use `backend-architect` for any architecture changes
- **MANDATORY**: Use `typescript-expert` for context detection logic
- **MANDATORY**: All changes must pass strict position validation tests

### **CRITICAL: Completion System Testing Requirements**

#### Pre-Commit Testing Checklist (MANDATORY)

**BEFORE any completion system changes:**

1. **Run all existing tests**: `npm test` must pass 100%
2. **Test Unicode scenarios**: Open `testdata/test.journal` and verify:
   - Russian account names complete correctly
   - Cyrillic payee names work after dates  
   - International characters in commodity names
3. **Test position scenarios**: Verify each completion type works only in correct positions
4. **Test forbidden zones**: Ensure NO completions after amount + 2+ spaces
5. **Test international number formats**: Open `testdata/test-international-numbers.journal` and verify:
   - Completion works with comma decimal separators
   - Completion works with various group separators
   - Commodity format directives are parsed correctly
   - Decimal-mark directives are respected

#### Required Test Scenarios (Prevent Critical Regressions)

```typescript
// These test patterns are MANDATORY for any completion changes:
describe('Critical Unicode Support', () => {
  it('handles Cyrillic account names without splitting', () => { /* ... */ });
  it('handles Russian payee names after dates', () => { /* ... */ });
  it('preserves hierarchical account structure with Unicode', () => { /* ... */ });
});

describe('Position Validation (Prevents Completion Failures)', () => {
  it('prevents completions in forbidden zones', () => { /* ... */ });
  it('only allows date completion at line start', () => { /* ... */ });
  it('only allows payee completion after date + space', () => { /* ... */ });
});

describe('Critical Tag Completion Fix (NEVER REGRESS)', () => {
  it('allows tag completions in comment contexts', () => { /* ... */ });
  it('prevents suppression of tag value completions after amounts in comments', () => { /* ... */ });
  it('only activates tag completion provider in InTagValue context', () => { /* ... */ });
  it('works with international number formats in comment lines', () => { /* ... */ });
});

describe('International Number Format Support', () => {
  it('handles comma decimal separators in amounts', () => { /* ... */ });
  it('generates format-aware regex patterns', () => { /* ... */ });
  it('parses commodity format directives correctly', () => { /* ... */ });
  it('respects decimal-mark directives', () => { /* ... */ });
});
```

#### Expert Usage for Testing

- **MANDATORY**: Use `test-automator` for creating regression prevention tests
- **MANDATORY**: Use `debugger` for investigating Unicode-related test failures
- **MANDATORY**: All changes require code review with `code-reviewer`

### **CRITICAL: Code Review Requirements for Completion System**

#### Pre-Commit Validation Checklist (Enforceable)

**Code reviewer must verify these items:**

##### Unicode Compliance (Prevents International User Regressions)

- [ ] No `[A-Za-z]` patterns (must use `[\p{L}]` with `/u` flag)
- [ ] No `toLowerCase()` calls (must use `toLocaleLowerCase()`)  
- [ ] No basic string comparison (must use `localeCompare()`)
- [ ] Tested with Cyrillic characters in `testdata/test.journal`

##### International Number Format Compliance (Prevents Format Regressions)

- [ ] No hard-coded decimal separators (must use `NumberFormatService`)
- [ ] All amount patterns generated dynamically based on detected formats
- [ ] Commodity format directives parsed and applied correctly
- [ ] Decimal-mark directives respected in format detection
- [ ] Tested with international formats in `testdata/test-international-numbers.journal`

##### Architectural Integrity (Prevents Completion Failures)

- [ ] `LineContext.AfterDate` exists and handled correctly
- [ ] Position validation maintains strict rules
- [ ] No completions allowed in forbidden zones
- [ ] Hierarchical account names preserved (no splitting on `:`)

##### Critical Tag Completion Fix (Prevents Tag Completion Failures)

- [ ] `CompletionSuppressor` NEVER suppresses completions in `InComment` or `InTagValue` contexts
- [ ] Tag completion early return logic preserved in `CompletionSuppressor.ts` (lines 52-54)
- [ ] Tag value completions work after amounts in comment lines
- [ ] Only tag completion provider activates in tag value contexts
- [ ] Tested with `testdata/test-tags.journal` for international characters

##### Testing Coverage (Prevents Regressions)

- [ ] All existing tests pass: `npm test`
- [ ] New Unicode tests created for any regex changes
- [ ] Position validation tests updated if logic changed
- [ ] Manual testing completed with `testdata/*.journal` files

#### Automatic Rejection Criteria

**Automatically reject any PR that:**

1. Changes regex without Unicode support (`[A-Za-z]` patterns)
2. Modifies context detection without `backend-architect` consultation  
3. Alters position validation without comprehensive testing
4. Removes or modifies `LineContext.AfterDate` support
5. Breaks hierarchical account name handling
6. Fails existing Unicode tests
7. Hard-codes decimal separators without using `NumberFormatService`
8. Ignores commodity format or decimal-mark directives
9. Fails international number format tests
10. **CRITICAL**: Removes or modifies the tag completion fix in `CompletionSuppressor.ts` (lines 52-54)
11. **CRITICAL**: Allows suppression of completions in `InComment` or `InTagValue` contexts
12. **CRITICAL**: Breaks tag value completion functionality validated by 200 passing tests

### Development Notes

**CRITICAL - Expert Usage Required**:

- All code changes MUST use appropriate expert agents
- Complex tasks MUST follow the 6-step workflow
- Always use `code-reviewer` after making changes
- Use `typescript-expert` for TypeScript-related work
- Use `test-automator` for test creation/fixes
- Use `debugger` for issue diagnosis

**CRITICAL - Code Style and Comments**:

- **MANDATORY**: ALL comments MUST be in English only
- **NO EXCEPTIONS**: Never write comments in Russian or any other language
- **Professional Standards**: Use clear, concise technical English
- **Consistency**: Maintain consistent terminology across all files
- **JSDoc Format**: Follow JSDoc conventions for method documentation

**CRITICAL - Test Data File Management**:

- **MANDATORY**: ALL test data files MUST be placed ONLY in `testdata/` directory
- **NO EXCEPTIONS**: Never create test files in src/, root, or any other location
- **Validation Required**: Use `test-automator` expert to validate test file placement
- **Naming Standards**: Follow `test-[feature].journal` or `[feature]-demo.journal` conventions
- **Content Standards**: All test files must be valid hledger journal files with comprehensive coverage

**File Organization Rules**:

- `testdata/` - ONLY location for all test data files (.journal files)
- `src/extension/__tests__/` - ONLY location for automated unit test files (.test.ts files)
- `src/__mocks__/` - ONLY location for mock files (vscode.ts, etc.)
- Root directory - NO test files allowed
