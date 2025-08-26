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

This is a Visual Studio Code extension for hledger journal files (plain text accounting). It provides syntax highlighting, IntelliSense features (account/date/commodity completion), and language support for `.journal`, `.hledger`, and `.ledger` files.

**Current Version**: 0.2.1 (basic, functional implementation)

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
- **HLedgerParser** (`src/extension/HLedgerParser.ts`) - Synchronous file parsing for hledger syntax
- **SimpleProjectCache** (`src/extension/SimpleProjectCache.ts`) - Basic Map-based caching with workspace isolation

#### 3. Completion System (Modular Design)

- **Unified Provider**: `HLedgerCompletionProvider.ts` - Main completion coordinator
- **Specialized Completers**:
  - `AccountCompleter.ts` - Account name suggestions with frequency tracking
  - `PayeeCompleter.ts` - Transaction payee/description completion
  - `CommodityCompleter.ts` - Currency/commodity symbol completion
  - `DateCompleter.ts` - Smart date suggestions
  - `TagCompleter.ts` - Tag/category completion from comments
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

### File Parsing System

**Use `general-purpose` expert for parsing logic analysis and `typescript-expert` for implementation.**

The `HLedgerParser` class handles parsing of hledger files to extract:

- **Account definitions** (`account` directives) with usage frequency tracking
- **Used accounts** (from transactions) with usage frequency tracking  
- **Commodity definitions** with usage frequency tracking
- **Include directives** for modular files
- **Transaction dates** for date completion
- **Payees/merchants** from transaction descriptions with usage frequency tracking
- **Tags/categories** from comments (`tag:value` format) with usage frequency tracking

**Frequency Intelligence**:

- **Usage counters**: Maintains `Map<string, number>` for accounts, payees, tags, and commodities
- **Frequency-based methods**: `getAccountsByUsage()`, `getPayeesByUsage()`, `getTagsByUsage()`, `getCommoditiesByUsage()`
- **Smart prioritization**: Most frequently used items appear first in completion lists

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
- **Test Status**: Currently has TypeScript configuration issues requiring fixes

**Current Test Coverage**:

- **Completion Providers**: Basic tests for all completion types
- **Type Safety**: Branded types and type guard validation
- **Fuzzy Matching**: SimpleFuzzyMatcher functionality
- **Parser Tests**: File parsing and data extraction
- **Cache Tests**: SimpleProjectCache functionality
- **Configuration Tests**: Settings and configuration management

**Known Issues**:

- 11/13 test suites currently failing due to TypeScript strictness
- Tests need configuration updates to match current TypeScript setup
- Manual testing required until test configuration is fixed

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

#### Integration with Development Workflow

**When to Update Test Files**:

- After adding new syntax highlighting features
- When updating to newer hledger specifications  
- After modifying completion provider logic
- When adding support for new languages/scripts

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

### Performance & Caching

1. **Simple Caching**: Map-based project cache with workspace isolation
2. **Synchronous Processing**: Direct file operations with immediate results
3. **Memory Management**: Basic cleanup patterns
4. **Frequency Intelligence**: Usage-based completion prioritization

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
