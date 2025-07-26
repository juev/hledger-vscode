# Change Log

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
