# Agent Guidelines for hledger-vscode

## Build/Test Commands
- `npm test` - Run all tests
- `npm run test:watch` - Run tests in watch mode  
- `npm run test:coverage` - Run tests with coverage
- `npm run compile` - Compile TypeScript
- `npm run watch` - Compile in watch mode
- `npm run package` - Create .vsix extension package

## Code Style Guidelines
- **TypeScript**: Use strict mode, branded types, and readonly collections
- **Imports**: Use ES6 imports, no default exports for classes
- **Naming**: PascalCase for classes, camelCase for variables, UPPER_CASE for constants
- **Error Handling**: Use try-catch blocks with proper error logging
- **Comments**: Write all comments in English only
- **Testing**: Place test files in `src/extension/__tests__/`, test data in `testdata/`
- **Unicode**: Use `\p{L}` regex patterns and `toLocaleLowerCase()` for international support