# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.1] - 2025-01-06

### 🐛 Bug Fixes
- Fixed Effect generator usage in batch.ts (yield* → yield for Effect types)
- Fixed test mocking setup for KintoneApiClient in batch tests
- Fixed generator function binding issue in batch commands
- Resolved "BUG: yieldWrapGet" error in Effect generator functions

### 🔧 Internal
- Improved test mock configuration using vi.hoisted
- Refactored generateSingleApp method to properly handle Effect generators

## [0.3.0] - 2025-01-05

### ✨ Features
- Added AST Builder for bidirectional query conversion
- Added CLI batch generator for multiple apps
- Added configuration file support for CLI
- Added support for complex query structures

### 📚 Documentation
- Updated README with new features
- Added Japanese documentation (README.ja.md)

## [0.2.0] - Previous releases

### ✨ Features
- Initial query builder implementation
- TypeScript support
- Basic CLI functionality

## [0.1.0] - Initial Release

### ✨ Features
- Core query parsing functionality
- Type-safe query builder
- Basic kintone query support

[0.3.1]: https://github.com/Kensei-Kimoto/kintone-functional-query/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/Kensei-Kimoto/kintone-functional-query/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/Kensei-Kimoto/kintone-functional-query/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Kensei-Kimoto/kintone-functional-query/releases/tag/v0.1.0