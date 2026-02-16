# Change Log

## [0.5.5] - 2026-02-16

### Added
- feat(core): add Logger, StatusBarItem, CommandPalette conditions, error context, walkthrough, and remove dead code

### Fixed
- fix(lsp): address code review findings for LSPManager


## [0.5.4] - 2026-02-16

### Added
- feat(lsp): add streaming download with retry, timeout, and stall detection

### Fixed
- fix(lsp): address code review findings for download resilience


## [0.5.3] - 2026-02-13

### Changed
- refactor(types): remove dead code after LSP migration

### Fixed
- docs(review): fix inaccuracies across README, user guide, and troubleshooting

### Other
- chore(deps): bump qs from 6.14.1 to 6.14.2


## [0.5.2] - 2026-02-11

### Added
- feat(lsp): add inlineCompletion, codeLens, maxResults, includeNotes settings
- feat(editor): add Tab alignment command via LSP onTypeFormatting

### Changed
- refactor(formatting): add formatOnType default, remove dead code, add activation test
- refactor(formatting): remove extension-level Smart Enter/Tab in favor of LSP onTypeFormatting

### Fixed
- fix(deps): remove pngquant-bin and sharp to resolve CVE-2022-33987


## [0.5.1] - 2026-02-09

### Fixed
- fix(inline): suppress ghost text when suggest widget is active


## [0.5.0] - 2026-02-06

### Added
- feat(import): integrate hledger-lsp payeeAccountHistory for CSV import
- feat: add context menu with CLI reports submenu
- feat: add LSP configuration settings with backward compatibility
- feat: add LSP startup checker with install/update notifications
- feat: migrate to LSP-based architecture

### Changed
- docs(lsp): correct TextMate fallback behavior and update architecture
- refactor(highlighting): remove TextMate grammar, use standard semantic scopes
- refactor: remove unused configuration options and add CLI enabled check
- refactor: simplify inline completion to use LSP textDocument/inlineCompletion
- Revert "refactor: simplify inline completion to use LSP directly"
- refactor: simplify inline completion to use LSP directly

### Fixed
- fix(lsp): address remaining code review findings
- fix(lsp): address final S4 nits from code review
- fix(lsp): resolve code review findings from debate system
- fix(lsp): address code review findings and restore TextMate fallback
- fix(lsp): correct balanceTolerance range and progress reporting
- fix(lsp): resolve code review findings (S2-S4)
- fix(lsp,import): resolve code review findings (S1-S4)
- fix(lsp,security): address all code review findings (S1-S4)
- fix(lsp,import): address code review findings (S3/S4)
- fix(lsp,import): implement all code review security and validation fixes
- fix(import,lsp,test): address final code review feedback (S2-S4)
- fix(import,lsp,test): resolve all code review findings (S1-S4)
- fix(import,lsp): address S1 blocker and S2 critical security issues
- fix: eliminate semantic token flickering by using theme colors
- fix: handle null responses from LSP completion requests
- fix: consolidate LSP commands and fix binary download naming
- fix: enable semantic highlighting by default and add superType inheritance
- fix: add optional chaining for strict TypeScript compliance


## [0.4.15] - 2026-02-03

### Fixed
- fix: correct diagnostic position for undefined accounts

### Other
- chore: translate comment to English


## [0.4.14] - 2026-01-23

### Fixed
- fix: correctly parse date/date2 tags with space after colon


## [0.4.13] - 2026-01-17

### Fixed
- fix: prevent posting pattern from greedy matching amount digits
- fix: unify commodity patterns in balance assertion and price assignment
- fix: prevent multi-char letter commodities from greedy matching digits


## [0.4.12] - 2026-01-10

### Added
- feat: add incremental transaction caching for improved validation performance
- feat: add transaction balance validation on save
- feat: add automatic amount formatting by commodity directives

### Changed
- refactor: extract magic numbers to named constants and improve code clarity
- refactor: improve code quality and add configurable balance tolerance
- refactor: switch to Format on Save for commodity formatting

### Fixed
- fix: invalidate transaction cache when commodity format context changes
- fix: address code review issues for balance validation
- fix: preserve user alignment for balance assertion lines in DocumentFormatter
- fix: skip formatting for lines with balance assertions
- fix: validate format match before parsing amounts in AmountFormatterService
- fix: use explicit commodity format for number parsing in AmountFormatterService
- fix: use commodity format context for number parsing in balance validation
- fix: support multi-commodity transactions with inferred amounts
- fix: address code review issues in balance module
- fix: address code review feedback for balance module
- fix: use spread syntax for optional cost in test helper
- fix: resolve TypeScript strict mode errors in balance module
- fix: address code review issues in AmountFormatterService
- fix: add debounced formatting for snippet tabstops
- fix: initialize config before formatting amounts
- fix: align amounts to configured column on Enter and cursor leave


## [0.4.11] - 2026-01-09

### Added
- feat: do not update CHANGELOG.md
- feat: separate amount and commodity in template tabstops
- docs: add commodity validation to diagnostics documentation
- feat: add defined commodities support and validation in HLedger processing
- feat: enhance commodity directive handling and add tests for include functionality

### Changed
- refactor: extract amount parsing utilities to shared module

### Fixed
- fix: handle prefix commodity symbols and escape regex metacharacters
- fix: preserve space between amount and commodity in transaction templates


## [0.4.10] - 2026-01-06

### Added
- feat: enhance amount tokenization in grammar tests and update regex patterns
- feat: update grammar syntax for currency

### Fixed
- fix: exclude some dev files


## [0.4.9] - 2026-01-04

### Added
- feat: add config options for align amount
- feat: add full user-guide
- feat: update CLAUDE.md file


## [0.4.8] - 2026-01-03

### Added
- feat: implement formatting profile for transaction templates
- feat: add inline ghost text feature and update troubleshooting guide

### Fixed
- fix: use escaped account length for alignment calculation
- fix: preserve maxAccountNameLength in createMutableData

### Other
- revert: use displayed account length for alignment
- chore(deps): bump qs from 6.14.0 to 6.14.1


## [0.4.7] - 2025-12-25

### Added
- feat: enhance inline completion with SnippetString support
- feat: enhance recent template tracking and sorting logic
- feat: implement recent template usage tracking for improved sorting
- feat: add cursor positioning command after template insertion
- feat: enhance inline suggestion handling in Hledger
- feat: add inline completion support for payees and templates
- feat: merge transaction templates in HLedgerParser
- feat: enhance transaction template functionality and add tests
- feat: add transaction template support for autocomplete

### Changed
- refactor: enhance scoring mechanism in SimpleFuzzyMatcher
- refactor: improve inline completion handling for transaction templates
- refactor: implement gap-based fuzzy matching algorithm in SimpleFuzzyMatcher

### Fixed
- fix: ensure safe access to completion items in TransactionTemplateCompleter tests


## [0.4.6] - 2025-12-15

### Changed
- refactor: implement code review fixes (High + Medium priority)

### Other
- docs: document completion filtering for cache pollution prevention


## [0.4.5] - 2025-12-14

### Fixed
- fix: filter out incomplete typed text from account completions

### Other
- docs: streamline CLAUDE.md and document gopls completion sorting hack


## [0.4.4] - 2025-12-14

### Fixed
- fix: exclude current line from completion parsing to prevent incomplete data
- fix: force VS Code to respect frequency-based completion order
- fix: cap completion score to prevent negative sortText values
- fix: use index-based sortText to override VS Code sorting
- fix: improve account completion filtering and frequency sorting


## [0.4.3] - 2025-12-13

### Added
- feat: improve error handling and validation in import processing
- feat: enhance security and performance in data processing
- feat: improve error handling and caching in HLedgerImportCommands and AccountResolver
- feat: enhance usage merging with overflow protection
- feat: enhance account resolution with journal history tracking
- feat: enhance document handling in HLedgerConfig
- feat: implement partial match caching in AccountResolver
- feat: enhance regex validation for merchant patterns
- feat: add CSV/TSV import subsystem and example files
- feat: preserve original line numbers in TabularDataParser
- feat: implement CSV/TSV import functionality for hledger
- Add tests for amount validation with trailing comments
- Fix PR #44 review issues and add diagnostics toggle
- Improves amount format validation - Add posting comment detection - Support quoted commodities in front - Support Indian numbering - Improve regex strictness (unicode decimals, prevents matching of e.g. 1,2,3,4) - Added capture groups for amount prefix/suffix - Dedicated balance assertion pattern and cost notation support

### Changed
- refactor: clean up TransactionGenerator and improve test assertions

### Fixed
- fix: set default date format in HLedgerImportCommands
- Fix code review issues: performance and documentation

### Other
- chore(deps): bump jws from 3.2.2 to 3.2.3


## [0.4.2] - 2025-12-01

### Added
- Add support for commodity completion after virtual postings
- Add commodity completion after balance assertion amounts
- Add full hledger amount format support for completion context
- Add balance assertion context suppression to StrictPositionAnalyzer

### Changed
- Enhance amount validation in HLedgerDiagnosticsProvider to support explicit positive signs
- Enhance amount validation in HLedgerDiagnosticsProvider and expand test coverage
- Enhance hledger documentation with critical syntax rules and clarifications
- Enhance hledger documentation and validation logic
- Enhance CLAUDE.md documentation with comprehensive project details

### Fixed
- Fix negative amounts not triggering commodity completion
- Fix code review issues: tab separator, regex validation, docs
- Fix balance assertion detection for virtual postings


## [0.4.1] - 2025-11-29

### Changed
- chore: update .vscodeignore to include documentation directory


## [0.4.0] - 2025-11-29

### Added
- Add comprehensive hledger journal format reference documentation
- Implement payee extraction from date lines in StrictCompletionProvider
- Enhance completion system with advanced features and validation
- Add critical security fixes: path traversal and command injection prevention
- Add esbuild target parameter for Node.js 20 and update CLAUDE.md documentation

### Changed
- Remove unused isZeroDateStart method from StrictPositionValidator to streamline code and improve maintainability.
- Improve tag validation: enforce value requirement for date and date2 tags, update tests
- Enhance account validation: consider parent accounts for undefined accounts
- Phase 2: Architecture & Documentation improvements (v0.4.1)
- Update src/extension/__tests__/grammar.test.ts
- Update CLAUDE.md

### Fixed
- Fix PR #36 review comments: cache validation, Windows paths, unused imports
- Fix ESLint module warning and glob security vulnerability
- Fix HLedgerDiagnosticsProvider tests - cache key alignment

### Removed
- Remove unused assertTokenScopes function and TokenAssertion/GrammarTestCase interfaces

### Other
- Make ExtensionServices explicitly extend vscode.Disposable
- Initial plan
- Initial plan
- Enable TypeScript strict mode for production builds
- Initial plan
- Initial plan
- tests: grammar tests


## [0.3.15] - 2025-11-21

### Added
- Add comprehensive optimization results documentation in Russian
- Fix code review feedback: remove invalid PNG quality param and add entry point validation
- Add esbuild bundler and optimize icon for 72% size reduction

### Fixed
- Fix: correct CLI example to match original output format
- Fix: complete CLI integration example output

### Removed
- Remove optimization report files from version control

### Other
- Modernize README: concise, attractive, follows best practices
- Initial plan
- Initial analysis: Build system research for size optimization
- Initial plan


## [0.3.14] - 2025-11-21

### Added
- test: add integration tests for completion provider functionality
- test: add unit tests for HLedgerLexer functionality
- feat(error): implement comprehensive error handling system (hledger-vscode-dnk)
- feat(parser): implement complete file parsing in HLedgerFileProcessor (hledger-vscode-u2l)
- feat: complete HLedgerParser refactoring with modular architecture

### Changed
- refactor: enhance parser architecture and error handling, improve completion logic, and clean up tests
- refactor: implement incremental caching strategy for improved performance and file change handling
- refactor: enhance caching logic for test scenarios and improve completion provider tests
- refactor: improve completion logic and enhance account completer validation
- refactor: remove CompletionSuppressor and StrictPositionValidator tests and implementations
- refactor: clean up legacy code and improve public API exports
- refactor: enhance completion provider to support commodity extraction after amounts
- refactor(lexer): remove redundant empty string check
- refactor(lexer): remove unused variable in tokenizeIncludeDirective
- perf(processor): replace blocking fs.readFileSync with async I/O
- perf(regex): precompile patterns to eliminate hot path recompilation
- refactor(parser): integrate modular architecture into production (hledger-vscode-n3o)

### Fixed
- fix: improve optional chaining in completion context checks
- fix: use only node 20
- fix: security tests files
- fix: update .vscodeignore to exclude .beads and coverage directories
- fix: lint warnings
- fix: tests in security
- fix(ci): remove invalid cache: false parameter from setup-node action
- fix: disable cache and update dependencies
- fix(ci): resolve CI test failures by updating dependencies
- fix: all ts warnings
- fix: some logic
- fix: check undefined
- fix(lexer): support multi-character commodity codes
- fix(lifecycle): implement comprehensive resource cleanup
- fix(ast): remove unsafe null assertion operators (hledger-vscode-q0r)
- security(traversal): fix path traversal vulnerability (hledger-vscode-rou)
- fix(types): remove unsafe type assertions in cleanup (hledger-vscode-tv4)
- fix(memory): resolve RegexCache memory leak with disposal chain (hledger-vscode-249)
- fix(lexer): strengthen transaction status regex validation (hledger-vscode-zsk)
- fix(config): sync development TypeScript config with production strict checks (hledger-vscode-6u7)
- fix: resolve TypeScript exactOptionalPropertyTypes violations
- fix: resolve critical memory leaks and type safety violations

### Removed
- test: remove problematic strict-positioning-alignment test

### Other
- chore(deps): bump glob
- chore(deps): bump js-yaml


## [0.3.13] - 2025-11-08

### Added
- feat: add hledger cli integrations

### Changed
- refactor: enhance hledger path resolution by validating candidates for improved reliability
- refactor: enhance initialization logic in HLedgerCliService to support forced reinitialization and version tracking
- refactor: enhance hledger CLI availability check by consolidating logic into ensureCliAvailable method
- refactor: trim whitespace in custom hledger path configuration for improved validation
- refactor: implement disposable pattern in HLedgerCliService for configuration change handling
- refactor: update command handling in HLedgerCliCommands to use shorthand command names for improved clarity
- refactor: improve initialization logic in HLedgerCliService for better error handling and asynchronous path resolution
- refactor: remove unused HLedgerCliService.ts file reference and clean up comments
- refactor: update executeCommand to accept subcommands and arguments for improved flexibility

### Fixed
- fix: improve hledger path resolution for cross-platform compatibility


## [0.3.12] - 2025-10-31

### Fixed
- fix: update completion item provider triggers to exclude space for account and currency completions


## [0.3.11] - 2025-10-30

### Added
- feat: enhance tab alignment logic to support accounts ending with a colon or space and add related tests
- feat: improve tab alignment logic to exclude comments and invalid account patterns
- feat: enhance tab handling for account names with spaces and add corresponding tests


## [0.3.10] - 2025-10-11

### Added
- feat: add smart tab functionality for amount alignment in posting lines
- feat: update default setting for semantic highlighting to false for better performance
- feat: add semantic highlighting support and improve tokenization performance

### Changed
- refactor: improve cache eviction strategy to remove 25% of entries
- refactor: simplify semantic token definitions and improve grammar structure

### Fixed
- fix: remove outdated Open VSX downloads badge from README
- fix: update amount and commodity patterns for improved syntax highlighting


## [0.3.9] - 2025-10-09

### Added
- feat: replace custom color settings with standard semantic tokens
- chore: add documentation files to gitignore
- feat: simplify settings and improve regex parsing
- feat(cache): invalidate config cache on journal file changes via FS watcher
- feat(completion): support EU numbers and spaced accounts; fix analyzer regex
- feat(activation+enter): add activationEvents; fix multi-cursor Enter handling
- feat(semantics): align legend and provider with all token types; fix PR #21 review note
- feat(colors): expand semantic tokens and settings to cover all TextMate scopes
- feat(colors): add semantic tokens with user-configurable colors
- feat(theme): apply token colors to the scope where settings change
- feat(theme): add command to manually apply theme colors
- feat(theme): wire ThemeManager in activation and config change handler
- feat(theme): introduce ThemeManager to generate/apply TextMate rules
- feat(theme): add hledger.theme.* settings and remove static color defaults

### Changed
- Update package.json
- docs: update README with semantic token color customization
- refactor: remove ThemeManager and simplify color handling
- refactor(theme): fix semantic token duplication and improve error handling

### Fixed
- fix(strict): allow arbitrary decimal precision for commodity detection
- fix(parser+tags): restrict alias directive to line start; correct async fallback; TagCompleter uses lastIndexOf for multi-tag lines
- fix(theme): use semanticTokenColorCustomizations.rules object with language scopes

### Removed
- chore(config): align @types/vscode with engines; remove duplicate ESLint config


## [0.3.8] - 2025-10-02

### Added
- feat: add eslint
- feat: use formaters
- feat: add debug messages
- feat: add DocumentFormater
- feat: remove debug messages
- feat: tab usage
- feat: change tab behaviour for amounts
- feat: add autoalign sum
- feat: update .gitignore
- feat: change agent settings

### Fixed
- fix: linter errors
- fix: lint errors
- fix: remove redundant settings
- fix: production build
- fix: performance
- fix: formating loop
- fix: format comments
- fix: format on save
- fix: documents and align
- fix: align postings with spaces
- fix: tests
- fix: tab align
- fix: align for all files
- fix: format all document

### Other
- chore(deps-dev): bump tar-fs from 2.1.3 to 2.1.4


## [0.3.7] - 2025-09-27

### Added
- feat: add ovsx dependency
- feat: add Open VSX publishing support


## [0.3.6] - 2025-09-21

### Added
- feat: add comprehensive syntax highlighting tests for account names and update hledger grammar
- feat: create AGENTS.md

### Fixed
- fix: correct regex pattern for account matching in hledger syntax


## [0.3.5] - 2025-09-15

### Added
- feat: enhance fuzzy matching to support component matching and improve sorting logic
- feat: add case sensitivity option to fuzzy matching and completion providers

### Changed
- test: update case-sensitive matching tests to reflect correct expected results
- refactor: update fuzzy matching logic to prioritize prefix matching over substring matching
- refactor: remove color customization references from documentation
- refactor: remove color synchronization and semantic token provider for hledger extension

### Fixed
- fix: update color settings for hledger syntax highlighting


## [0.3.4] - 2025-09-14

### Added
- feat: enhance completion logic with context-aware range handling for various completers


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
