# Contributing to Grok CLI

Thank you for your interest in contributing to Grok CLI! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Pull Request Process](#pull-request-process)
- [Reporting Issues](#reporting-issues)

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for all contributors.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR-USERNAME/grok-cli.git`
3. Add upstream remote: `git remote add upstream https://github.com/original/grok-cli.git`
4. Create a feature branch: `git checkout -b feature/your-feature-name`

## Development Setup

### Prerequisites

- Node.js >= 18.0.0
- npm or bun package manager
- API Key for xAI's Grok API

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env and add your GROK_API_KEY

# Run in development mode
npm run dev

# Build the project
npm run build

# Run tests
npm test
```

### Available Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm run dev` - Run development server with hot reload
- `npm run lint` - Run ESLint
- `npm run typecheck` - Type-check without emitting files
- `npm test` - Run test suite
- `npm run test:coverage` - Run tests with coverage report

## Project Structure

```
grok-cli/
├── src/
│   ├── agent/          # Core agent logic
│   ├── grok/           # Grok API client and tools
│   ├── mcp/            # Model Context Protocol integration
│   ├── tools/          # Tool implementations (bash, text-editor, etc.)
│   ├── types/          # TypeScript type definitions and custom errors
│   ├── ui/             # Terminal UI components (Ink)
│   ├── utils/          # Utility functions
│   └── index.ts        # Entry point
├── dist/               # Compiled JavaScript (gitignored)
├── tests/              # Test files
└── .grok/              # Configuration directory
```

## Coding Standards

### TypeScript

- Use TypeScript for all new code
- Enable strict mode gradually (see [Strict Mode Migration](#strict-mode-migration))
- Avoid `any` types - use `unknown` and type guards instead
- Document public APIs with JSDoc comments

### Style Guide

- Follow the existing code style
- Use 2 spaces for indentation
- Maximum line length: 100 characters
- Use meaningful variable and function names
- Prefer `const` over `let`, avoid `var`

### Error Handling

- Use custom error types from `src/types/errors.ts`
- Always provide context in error messages
- Example:

```typescript
import { ToolExecutionError } from '../types/errors.js';

try {
  // ... operation
} catch (error) {
  throw new ToolExecutionError(
    'myTool',
    error as Error,
    'Failed to process file'
  );
}
```

### Security

- **Never** execute user input without validation
- Use `validateCommand()` from `command-validator.ts` for bash commands
- Sanitize file paths before operations
- Rate-limit expensive operations

## Testing Guidelines

### Writing Tests

- Place tests in `tests/` directory mirroring `src/` structure
- Use Vitest as the test framework
- Aim for 60%+ code coverage

### Test Structure

```typescript
import { describe, it, expect, beforeEach } from 'vitest';

describe('MyComponent', () => {
  beforeEach(() => {
    // Setup
  });

  it('should do something', () => {
    // Arrange
    const input = 'test';

    // Act
    const result = myFunction(input);

    // Assert
    expect(result).toBe('expected');
  });
});
```

### Critical Areas to Test

1. **Tool Execution** - All tools should have unit tests
2. **Command Validation** - Test dangerous command detection
3. **Token Counting** - Verify accuracy
4. **Diff Generation** - Test edge cases
5. **MCP Integration** - Mock MCP servers

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test path/to/test.spec.ts

# Run with UI
npm run test:ui
```

## Pull Request Process

1. **Create a feature branch** from `main`
2. **Make your changes**:
   - Write tests for new functionality
   - Update documentation if needed
   - Follow coding standards
3. **Run checks locally**:
   ```bash
   npm run lint
   npm run typecheck
   npm test
   ```
4. **Commit your changes**:
   - Use conventional commit messages:
     - `feat: add new feature`
     - `fix: resolve bug`
     - `docs: update readme`
     - `test: add tests for X`
     - `refactor: improve code structure`
5. **Push to your fork** and create a pull request
6. **Fill out the PR template** with:
   - Description of changes
   - Related issue numbers
   - Testing performed
   - Screenshots (if UI changes)

### PR Checklist

- [ ] Tests pass locally
- [ ] Code follows style guidelines
- [ ] Documentation updated
- [ ] No linting errors
- [ ] Commit messages are clear
- [ ] PR description is complete

## Reporting Issues

### Bug Reports

When reporting bugs, include:

1. **Description**: Clear description of the issue
2. **Steps to Reproduce**:
   ```
   1. Run command X
   2. Provide input Y
   3. Observe error Z
   ```
3. **Expected Behavior**: What should happen
4. **Actual Behavior**: What actually happens
5. **Environment**:
   - OS and version
   - Node.js version
   - Grok CLI version (`grok --version`)
6. **Logs**: Relevant error messages or stack traces

### Feature Requests

For feature requests, include:

1. **Use Case**: Why this feature would be useful
2. **Proposed Solution**: How you envision it working
3. **Alternatives Considered**: Other approaches you've thought about
4. **Additional Context**: Screenshots, examples, etc.

## Development Tips

### Debugging

```bash
# Enable debug logging
DEBUG=grok:* npm run dev

# Use Node debugger
node --inspect dist/index.js
```

### Testing Command Validation

```bash
# Test dangerous command detection
npm test -- command-validator.spec.ts
```

### Working with MCP Servers

```bash
# List installed MCP servers
grok /mcp list

# Test MCP connection
grok /mcp test server-name
```

## Strict Mode Migration

We're gradually enabling TypeScript strict mode. When contributing:

1. Enable `strict: true` for your new files if possible
2. Fix type errors incrementally
3. Use `// @ts-expect-error` with comments for legitimate edge cases
4. Document why strict mode is disabled if you can't fix it

## Architecture Decisions

For significant changes, please:

1. Open an issue first to discuss the approach
2. Consider creating an Architecture Decision Record (ADR)
3. Get feedback before implementing

## Questions?

- Open an issue with the `question` label
- Check existing issues and discussions
- Read the documentation in `/docs` directory

## License

By contributing, you agree that your contributions will be licensed under the project's MIT License.

---

Thank you for contributing to Grok CLI! 🚀
