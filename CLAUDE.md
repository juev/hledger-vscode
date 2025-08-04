# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Visual Studio Code extension for hledger journal files (plain text accounting). It provides syntax highlighting, IntelliSense features (account/date/commodity completion), and language support for `.journal`, `.hledger`, and `.ledger` files.

## Improvement Plan

See `IMPROVEMENT_PLAN.md` for a detailed phased improvement plan for the extension. The plan includes 4 phases:
1. **Phase 1 (critical)**: Security vulnerability fixes and memory leak elimination
2. **Phase 2**: UX simplification and performance optimization  
3. **Phase 3**: Accessibility improvements and visual feedback
4. **Phase 4**: Advanced UX features and documentation

## Development Commands

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
npm run package

# Publish to VS Code marketplace
npm run publish
```

## Architecture (v0.3.0)

The extension has been completely refactored using modern software engineering principles with a modular, high-performance architecture. This version introduces significant improvements in type safety, dependency management, error handling, and architectural patterns.

### Core Architecture Components

#### 1. Central Management Layer

- **Main Extension Entry**: `src/extension/main.ts` - Service-based architecture with dependency injection container
- **Service Layer**: Modular service-based design with clear separation of concerns
  - `ExtensionService` - Core extension lifecycle management
  - `ConfigurationService` - Centralized configuration management
  - `DocumentService` - Document state and event handling
  - `CompletionService` - Completion provider coordination
- **OptimizationManager** (`src/extension/core/OptimizationManager.ts`) - Central controller with singleton pattern
- **DI Container** (`src/extension/core/DIContainer.ts`) - Dependency injection with automatic lifecycle management

#### 2. High-Performance Processing Layer

- **AsyncHLedgerParser** (`src/extension/parsing/AsyncHLedgerParser.ts`) - Non-blocking file parsing with chunked processing (90-98% performance improvement)
- **OptimizedFuzzyMatcher** (`src/extension/completion/base/OptimizedFuzzyMatcher.ts`) - High-performance fuzzy matching with pre-indexing (3-9x faster)
- **PerformanceProfiler** (`src/extension/performance/PerformanceProfiler.ts`) - High-precision timing and memory tracking

#### 3. Smart Caching System (Enhanced)

- **CacheManager** with 4 invalidation strategies (Partial, Cascade, Full, Smart)
- **Enhanced Map-based Caches** with TTL expiry and size limits for memory safety
- **File System Watchers** with debounced updates and batch processing
- **LRU Cache** with configurable limits and dependency tracking
- **Persistent Cache** with optional compression for cross-session performance
- **Cache Resource Management** with proper disposal patterns and memory cleanup

#### 4. Completion System Architecture (Enhanced Modular Design)

- **Base Classes** (Optimized):
  - `FuzzyMatcher` (`src/extension/completion/base/FuzzyMatcher.ts`) - Standard fuzzy matching with Unicode support
  - `OptimizedFuzzyMatcher` (`src/extension/completion/base/OptimizedFuzzyMatcher.ts`) - High-performance version with indexing
  - `CompletionItemFactory` (`src/extension/completion/base/CompletionItemFactory.ts`) - Standardized completion item creation
  - `BaseCompletionProvider` (`src/extension/completion/base/BaseCompletionProvider.ts`) - Abstract base class for all providers
- **Completion Providers** (Performance Enhanced):
  - `KeywordCompletionProvider` - hledger directives with optimized fuzzy matching
  - `AccountCompletionProvider` - Hierarchical account suggestions with frequency-based prioritization and smart caching
  - `CommodityCompletionProvider` - Currency symbols with frequency tracking and async loading
  - `DateCompletionProvider` - Smart date suggestions with caching and context awareness
  - `PayeeCompletionProvider` - Store/merchant completion with optimized search and frequency tracking
  - `TagCompletionProvider` - Tag/category completion with intelligent caching

#### 5. Supporting Infrastructure

- **Syntax Highlighting**: `syntaxes/hledger.tmLanguage.json` - Comprehensive TextMate grammar with customizable colors
- **Smart Indentation**: `HLedgerEnterCommand` and `HLedgerEnterKeyProvider` - Intelligent Enter key handling
- **BenchmarkSuite** (`src/extension/performance/BenchmarkSuite.ts`) - Comprehensive testing with 34 scenarios
- **Feature Flags**: Gradual rollout system with safe defaults and automatic fallback
- **Event System**: Event-driven architecture with typed event handling and component decoupling
- **Error Handling**: Comprehensive error types with context preservation and recovery strategies

### Important Design Patterns (v0.3.0)

#### 0. **Enhanced Type Safety & Domain Modeling**

- **Eliminated 'any' Types**: Complete replacement with proper TypeScript interfaces and branded types
- **Branded Types System**: Domain-safe types with compile-time guarantees
  - `AccountName` - Type-safe account identifiers
  - `CacheKey<T>` - Type-safe cache operations with payload validation
  - `FilePath` - File system path validation
  - `CompletionScore` - Numeric scoring with bounds checking
  - `UsageCount` - Frequency tracking with non-negative constraints
- **Type Guards**: Runtime type checking with comprehensive validation
  - `isValidAccountName()` - Account name format validation
  - `isValidCacheKey()` - Cache key structure validation
  - `isValidFilePath()` - File path existence and format checks
- **Interface-First Design**: Replaced all object shapes with proper interfaces
- **Generic Constraints**: Advanced TypeScript patterns for type safety and inference

#### 1. **SOLID Principles Implementation (Enhanced)**

- **Single Responsibility**: Each component has a focused purpose with service-based architecture
- **Open/Closed**: Extension system allows new optimizations without modifying existing code
- **Liskov Substitution**: Optimized components can replace standard ones seamlessly
- **Interface Segregation**: Clean interfaces for different concerns with typed contracts
- **Dependency Injection**: Full DI container with automatic lifecycle management and circular dependency detection

#### 2. **Smart Cache System with Advanced Invalidation (Enhanced)**

- **4 Invalidation Strategies**: Partial, Cascade, Full, and Smart invalidation with dependency tracking
- **Enhanced Memory Management**: TTL expiry and size limits for Map-based caches with automatic cleanup
- **LRU Eviction**: Memory-efficient cache management with configurable limits
- **File System Watchers**: Real-time monitoring with debounced updates and batch processing
- **Persistent Storage**: Optional cross-session cache with compression
- **Branded Types**: Type-safe cache operations (`CacheKey<T>`, `CacheValue<T>`)
- **Project Isolation**: Separate caches per workspace with automatic cleanup
- **Resource Disposal**: Proper cleanup patterns with disposable interfaces and automatic resource management

#### 3. **High-Performance Processing**

- **Async Parsing**: Non-blocking chunked processing with configurable yielding
- **Pre-indexing**: Character position maps and word boundaries for O(1) lookups
- **Result Caching**: LRU cache for frequently accessed data with intelligent eviction
- **Memory Pooling**: Reduced allocations through object reuse
- **Early Termination**: Character set validation before expensive operations

#### 4. **Enhanced Parsing with Frequency Intelligence**

- **Usage Tracking**: Maintains `Map<string, number>` for all completion types
- **Frequency-based Prioritization**: Most used items appear first in completion lists
- **Intelligent Scoring**: Multi-factor scoring (frequency, prefix match, word boundaries)
- **Unicode Support**: Full support including Cyrillic with optimized character handling
- **Unified Behavior**: Consistent filtering for automatic and manual completion

#### 5. **Feature Flag System**

- **Gradual Rollout**: Progressive enablement of optimizations
- **Automatic Fallback**: Graceful degradation on errors with comprehensive logging
- **Safe Defaults**: All optimizations disabled by default for stability
- **Configuration Validation**: Type-safe configuration with runtime validation

#### 6. **Performance Monitoring & Benchmarking**

- **Real-time Metrics**: Parse time, completion latency, cache hit rates, memory usage
- **Performance Budgets**: Automated threshold enforcement with alerting
- **Regression Detection**: Continuous performance validation
- **Export Capabilities**: JSON export for analysis and tuning

#### 7. **Modular Architecture with Dependency Injection (Enhanced)**

- **Service-based Architecture**: Complete refactor from monolithic to service-based design
- **DI Container**: Full dependency injection container with automatic lifecycle management
- **Component Separation**: Clear boundaries between parsing, caching, matching, and optimization
- **Testable Design**: All components can be tested in isolation with mock injection
- **Interface-based Design**: Components depend on abstractions, not implementations
- **Configuration-driven**: Behavior controlled through VS Code settings
- **Error Boundaries**: Robust error handling with context preservation and specific error types
- **Circular Dependency Detection**: Runtime detection and prevention of circular dependencies

#### 8. **Advanced Error Handling & Recovery**

- **Specific Error Types**: Replaced generic Error with domain-specific error classes
  - `CacheError` - Cache operation failures with recovery strategies
  - `ParseError` - File parsing issues with line/column information
  - `ConfigurationError` - Settings validation with helpful messages
  - `DependencyError` - DI container issues with resolution paths
- **Error Context**: Rich error information with stack traces and component state
- **Recovery Strategies**: Automatic fallback mechanisms with graceful degradation
- **Error Propagation**: Typed error handling with proper error boundaries

#### 9. **Event-Driven Architecture**

- **Typed Events**: Strongly-typed event system with compile-time validation
- **Component Decoupling**: Events eliminate direct dependencies between components
- **Event Handlers**: Async event handling with proper error boundaries
- **Event Aggregation**: Central event bus with filtering and subscription management
- **Performance Events**: Real-time performance metrics via event system

#### 10. **Singleton Pattern & Global State Management**

- **Proper Singleton Implementation**: Thread-safe singleton pattern with lazy initialization
- **Global State Elimination**: Replaced global variables with dependency-injected services
- **State Isolation**: Clear ownership and lifecycle management for shared state
- **Resource Management**: Automatic cleanup and disposal of singleton resources

### File Parsing

The `HLedgerConfig` class handles parsing of hledger files to extract:

- Account definitions (`account` directives) with usage frequency tracking
- Used accounts (from transactions) with usage frequency tracking
- Commodity definitions with usage frequency tracking
- Include directives for modular files
- Transaction dates
- Payees/merchants from transaction descriptions with usage frequency tracking
- Tags/categories from comments (`tag:value` format) with usage frequency tracking
- **Usage counters**: Maintains `Map<string, number>` for accounts, payees, tags, and commodities
- **Frequency-based methods**: `getAccountsByUsage()`, `getPayeesByUsage()`, `getTagsByUsage()`, `getCommoditiesByUsage()`

## Testing

Testing infrastructure uses Jest with TypeScript support:

```bash
# Run all tests
npm test

# Run tests in watch mode  
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

### Test Structure (v0.3.0)

- **Unit Tests**: Located in `src/extension/__tests__/` with comprehensive component coverage
- **Test Configuration**: `jest.config.js` with ts-jest preset and performance testing support
- **Mock VSCode API**: Enhanced `src/__mocks__/vscode.ts` for comprehensive testing
- **Test Coverage**: Comprehensive coverage including all new architecture improvements
- **Enhanced Test Suite**: 200+ test cases covering all major functionality
  - **Core Components**: OptimizationManager, AsyncParser, CacheManager, DI Container
  - **Service Architecture**: ExtensionService, ConfigurationService, DocumentService, CompletionService
  - **Type Safety Tests**: Branded types, type guards, interface validation
  - **Error Handling Tests**: Specific error types, recovery strategies, error boundaries
  - **Event System Tests**: Event-driven architecture, typed events, component decoupling
  - **Performance Tests**: BenchmarkSuite, PerformanceProfiler testing
  - **Cache Tests**: All invalidation strategies, TTL expiry, size limits, resource disposal
  - **Integration Tests**: End-to-end testing with real HLedger files
  - **Regression Tests**: Performance benchmarking and validation
  - **Dependency Injection Tests**: DI container, circular dependency detection, lifecycle management
- **Performance Validation**: Automated benchmarks with 34 test scenarios
- **99.5+ Success Rate**: Highly reliable test suite with comprehensive coverage

### Manual Testing

Uses `testdata/test.journal` file which demonstrates:

- Multi-language support (Cyrillic characters)
- Various transaction formats  
- Account aliases and commodity definitions

## GitHub Actions

- **CI**: Runs on all branches, tests Node.js 18.x and 20.x
- **Release**: Triggers on version tags (e.g., `v1.0.0`)

## Important Notes (v0.3.0)

### Core Features

1. **Main source**: TypeScript (`src/extension/main.ts`) with service-based architecture and dependency injection
2. **Type Safety**: Complete elimination of 'any' types with branded types and comprehensive interfaces
3. **Activation event**: `onLanguage:hledger`
4. **File associations**: `.journal`, `.hledger`, `.ledger`
5. **Dependencies**: No external dependencies for core functionality (uses built-in Node.js APIs)
6. **Syntax highlighting**: Enhanced TextMate grammar with comprehensive scopes and customizable colors
7. **hledger Compliance**: Follows hledger 1.43 specification with full feature support

### Performance & Optimization (Enhanced)

1. **Performance Optimizations**: All disabled by default - enable via `hledger.optimization.*` settings
2. **Enhanced Cache System**: Smart invalidation with TTL expiry and size limits via `hledger.cache.*` settings
3. **Async Processing**: Non-blocking file operations for files > 1MB (configurable)
4. **Memory Management**: Automatic resource disposal and cleanup patterns
5. **Monitoring**: Built-in performance monitoring with metrics collection and export
6. **Benchmarking**: Comprehensive testing suite with 34 scenarios and regression detection

### Configuration Options

1. **Color Customization**: Extensive customization through `hledger.colors.*` settings
2. **Smart Indentation**: Configurable via `hledger.smartIndent.enabled` setting
3. **Completion Behavior**: Unified automatic/manual completion with configurable limits
4. **Optimization Settings**: 9 new `hledger.optimization.*` settings for performance tuning
5. **Cache Settings**: 14 new `hledger.cache.*` settings for cache management

### New Commands (v0.3.0)

1. **Performance Commands**:
    - `HLedger: Run Performance Benchmark` - Execute comprehensive performance tests
    - `HLedger: Export Performance Data` - Generate detailed performance reports
    - `HLedger: Reset Performance Metrics` - Clear accumulated statistics
2. **Cache Commands**:
    - `HLedger: Invalidate All Caches` - Force complete cache refresh
    - `HLedger: Invalidate Project Cache` - Clear current project cache
    - `HLedger: Show Cache Diagnostics` - View cache status and statistics
    - `HLedger: Export Cache Metrics` - Export cache performance data
3. **Diagnostic Commands** (NEW):
    - `HLedger: Show Type Safety Report` - Display type safety and branded types status
    - `HLedger: Show Dependency Graph` - Visualize DI container dependencies
    - `HLedger: Show Error Statistics` - Display error handling and recovery metrics

### Architecture Notes

1. **Service-based Architecture**: Complete refactor from monolithic to service-based design with DI container
2. **Enhanced Type Safety**: Complete elimination of 'any' types with branded types and comprehensive interfaces
3. **Advanced Error Handling**: Specific error types with recovery strategies and proper error boundaries
4. **Event-Driven Design**: Typed event system for component decoupling and reactive programming
5. **Resource Management**: Proper disposal patterns with TTL expiry and size limits for memory safety
6. **Singleton Pattern**: Thread-safe singleton implementation with proper lifecycle management
7. **Feature Flags**: Gradual rollout system with safe defaults and backward compatibility
8. **Backward Compatibility**: 100% compatibility with existing configurations and workflows

### Architecture Benefits (v0.3.0)

The enhanced architecture provides several key benefits:

1. **Type Safety**: Compile-time guarantees with branded types eliminate runtime type errors
2. **Maintainability**: Service-based design with clear boundaries makes code easier to understand and modify
3. **Testability**: DI container allows comprehensive testing with proper mocking and isolation
4. **Performance**: Enhanced caching with TTL and size limits prevents memory leaks
5. **Reliability**: Specific error types and recovery strategies improve error handling
6. **Scalability**: Event-driven architecture allows adding new features without coupling
7. **Memory Safety**: Proper resource disposal prevents memory leaks and improves performance
8. **Developer Experience**: Comprehensive type definitions improve IDE support and development speed
