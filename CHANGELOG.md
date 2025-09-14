# Change Log

## [0.3.3] - 2025-09-14

### Fixed
- fix: update .gitignore to include test.sh and improve hledger tag matching regex


## [0.3.2] - 2025-09-14

### Added
- feat: update hledger syntax highlighting rules to use standard TextMate scope names and enhance validation requirements


## [0.3.1] - 2025-09-12

### Added
- feat: streamline hledger syntax by removing redundant patterns and enhancing structure
- feat: enhance hledger syntax with new lot and price assignment patterns, and refine existing matches
- feat: remove common patterns from hledger syntax and refine tag and balance assertion matches
- feat: enhance hledger syntax for quoted commodities with new test journal
- feat: add comprehensive test journal for grammar improvements and edge cases
- feat: update CLAUDE.md for version 0.3.0 with enhanced syntax highlighting, URL support, and improved comment processing
- feat: add URL pattern to hledger syntax for improved link handling
- feat: add additional comment examples with URLs in test comments journal file
- feat: enhance hledger syntax with additional patterns for timeclock and csv, and improve comment handling
- feat: add test comments journal file for example usage
- Add hledger syntax reference section with official documentation link

### Changed
- refactor: simplify hledger syntax patterns and enhance comment handling


## [0.3.0] - 2025-08-29

### Added
- feat: enhance international number format support in CLAUDE.md
- feat: enhance HLedgerParser and StrictCompletionProvider with number formatting support
- feat: enhance StrictCompletionProvider and StrictPositionAnalyzer for improved tag context detection
- feat: implement tag value completion and enhance related components
- feat: add tag completion support in StrictCompletionProvider and related components
- feat: implement dual-phase tag completion system with enhanced type safety
- feat: enhance HLedgerParser with tag value support and improved extraction logic
- feat: enhance StrictPositionAnalyzer with comment and tag value context detection
- feat: extend hledger types and completion context with tag values
- feat: enhance hledger syntax highlighting with new directives and comment patterns
- docs: update README.md to streamline feature descriptions and enhance clarity
- feat: introduce MockTextDocument for testing and enhance vscode mock interfaces
- feat: enhance HLedgerParser and SimpleFuzzyMatcher for Unicode support
- feat: enhance completion logic with hierarchical query extraction
- feat: enhance strict completion system with detailed position-based logic
- feat: implement strict completion provider and enhance completion logic
- feat: enhance date and completion logic in HLedgerConfig
- feat: enhance Jest configuration and add test-specific TypeScript settings
- feat: add TODO
- feat: achieve 100% test pass rate with parser fixes
- feat: implement branded types system for domain safety

### Changed
- refactor: remove HLedgerCompletionProvider and streamline completion logic
- refactor: improve error handling and safe destructuring in NumberFormatService
- test: update expectations for commodity symbols in HLedgerConfig tests
- refactor: clean up whitespace and improve code consistency in HLedgerParser
- refactor: remove debug logging from StrictCompletionProvider and StrictPositionAnalyzer
- refactor: update line context detection in StrictPositionAnalyzer
- refactor: clean up whitespace and improve code readability in HLedgerParser and StrictCompletionProvider
- refactor: streamline hledger syntax highlighting and remove deprecated patterns
- docs: update CLAUDE.md with critical completion system requirements
- refactor: clean up whitespace and improve code formatting in HLedgerParser
- refactor: update main.ts architecture and improve path handling
- refactor: improve data merging and usage counting logic
- refactor: enhance type safety and performance optimizations
- chore: update project structure and clean up files
- refactor: modularize completion logic and enhance type safety
- docs: update architecture documentation with all v0.3.0 improvements
- refactor: complete architecture improvements - all tasks implemented
- refactor: split main.ts into service-based architecture
- refactor: replace global state with proper singleton pattern
- refactor: replace all 'any' types with proper TypeScript interfaces

### Fixed
- fix: enhance tag extraction logic in HLedgerParser
- fix: update regex patterns in NumberFormatService for Unicode support
- fix: resolve critical tag completion issue in comment contexts
- fix: resolve tag completion regression showing inappropriate suggestions
- fix: update regex patterns for hledger syntax highlighting
- fix: improve tag name extraction logic in TagCompleter
- fix: update tests for CompletionSuppressor and StrictPositionAnalyzer
- fix: improve strict completion logic and validation checks
- fix: improve comment extraction logic in HLedgerParser
- fix: improve conditional checks for parsing logic
- fix(syntax): correct comment syntax highlighting
- fix: resolve all TypeScript errors and achieve 96.9% test pass rate
- fix: resolve typescript compilation errors and test issues

### Removed
- chore: remove deprecated files and benchmark data

### Other
- chore(deps-dev): bump tmp from 0.2.3 to 0.2.4


## [0.2.1] - 2025-08-25

### Fixed
- fix(syntax): correct comment syntax highlighting

## [0.2.0] - 2025-08-04

### Added
- feat(completion): refine keyword and completion provider logic for improved relevance and cache management
- feat: update .vscodeignore, package.json, and tsconfig files for improved build and development configuration
- feat: update package and lock files for version 0.2.0, add build scripts, and include rimraf for cleanup
- feat(caching): enhance cache invalidation strategies and update statistics tracking
- feat: Update docs for v0.2.0 release with performance improvements and new features
- feat(caching): implement central caching system with feature flags and configuration management
- feat: Introduce asynchronous parsing capabilities and performance profiling
- feat: Introduce UsageTracker for tracking usage frequency of accounts, payees, tags, and commodities

### Removed
- test: remove outdated completion provider tests


## [0.1.11] - 2025-08-03

### Added
- feat: enhance fuzzy matching with usage frequency scoring


## [0.1.10] - 2025-08-03

### Added
- Add completion providers for commodities, dates, payees, and tags
- Implement keyword and account completion providers with fuzzy matching
- feat: add configurable completion limits for keywords and accounts
- feat: update vscode engine version to ^1.75.0
- feat: update launch configurations for extension running and testing
- feat: add launch configuration for running and testing the extension

### Changed
- Enhance FuzzyMatcher and CompletionItemFactory for improved sorting and usage-based scoring


## [0.1.9] - 2025-08-02

### Added
- feat: implement custom color application command and update settings handling


## [0.1.8] - 2025-08-02

### Added
- feat: update amount parsing regex to support a wider range of currency formats
- feat: enhance amount parsing to support specific currency codes in hledger grammar
- feat: add initial syntax test journal and enhance hledger grammar for posting and amount parsing
- feat: refactor syntax highlighting and remove semantic token support


## [0.1.7] - 2025-07-27

### Added
- feat: implement frequency-based prioritization for completion providers and enhance parsing logic
- feat: update color scheme and improve readability for hledger syntax highlighting
- feat: add semantic highlighting option for hledger files in package.json
- feat: enhance completion providers with advanced fuzzy matching and substring support
- feat: enhance payee completion with advanced fuzzy matching and substring support
- feat: enhance README with semantic highlighting and smart indentation details
- feat: add CLAUDE.md for project guidance and development commands

### Changed
- refactor: simplify and enhance amount parsing logic in HLedgerSemanticTokensProvider
- refactor: rename hledger semantic token IDs for consistency


## [0.1.6] - 2025-07-27

### Added
- feat: improve indent behaviour
- feat: exclude chore generate changelog from CHANGELOG.md file

### Fixed
- fix: update extension search name in README

### Other
- tests: move test journal files to tests ditrectory


## [0.1.5] - 2025-07-26

### Added
- feat: add color customization
- feat: add CHANGELOG.md
- feat: update CHANGELOG.md
- feat: change color theme
- feat: auto-enable semanticHighlighting

### Fixed
- fix: add missing class mock


All notable changes to the "hledger" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.4] - 2025-07-26

### Added
- feat: generate changelog

## [0.1.3] - 2025-07-26

### Fixed
- fix: complete for commodities
- fix: color for customer with space
- fix: case-insensitive fuzze-matching, | as string

## [0.1.2] - 2025-07-25

### Added
- feat: implement fuzzy matching for payees and tags with comprehensive test cases
- feat: enhance onEnterRules for improved indentation and update journal file for consistent tag usage
- feat: remove Open VSX Registry publishing step from release workflow

### Changed
- refactor: clarify balance assertion descriptions in README and main.ts
- refactor: update onEnterRules to improve indentation handling and simplify conditions
- refactor: remove unused indentationRules and streamline onEnterRules for improved clarity
- refactor: update tag handling in comments to remove hashtags and standardize to tag:value format

## [0.1.1] - 2025-07-24

### Other
- Initial release improvements

## [0.1.0] - 2025-07-24

### Added
- Initial release of hledger Language Support extension
- Comprehensive syntax highlighting for hledger journal files (.journal, .hledger, .ledger)
- IntelliSense features including account, date, commodity, keyword, payee, and tag completion
- Semantic token highlighting for enhanced syntax coloring
- Project-based caching for optimal performance with large codebases
- Support for Unicode characters including Cyrillic
- Language configuration with proper comment and bracket handling
- File associations for common hledger file extensions
- Configurable auto-completion and semantic highlighting settings
- TypeScript support and refactored extension architecture
- GitHub Actions workflow for automated testing and publishing
- Extension icon and comprehensive documentation
- Support for periodic and auto postings syntax
- Fuzzy matching for payees and tags
- Enhanced release workflow with semantic version validation
