# Change Log

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
