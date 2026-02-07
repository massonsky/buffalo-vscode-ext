# Contributing to Buffalo LSP for VS Code

Thank you for your interest in contributing to Buffalo LSP!

## Development Setup

### Prerequisites
- Node.js 18+ 
- npm 9+
- VS Code 1.85+
- [Buffalo](https://github.com/massonsky/buffalo) installed

### Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/massonsky/buffalo-vscode.git
   cd buffalo-vscode
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Compile the extension:
   ```bash
   npm run compile
   ```

4. Open in VS Code:
   ```bash
   code .
   ```

5. Press F5 to launch the Extension Development Host

### Project Structure

```
buffalo-vscode/
├── src/
│   ├── extension.ts      # Main extension entry point
│   └── test/             # Test files
├── syntaxes/
│   └── proto.tmLanguage.json  # Syntax highlighting
├── snippets/
│   └── proto.json        # Code snippets
├── language-configuration.json
├── package.json
└── tsconfig.json
```

## Development Workflow

### Running in Development
1. Press F5 in VS Code to start debugging
2. A new VS Code window opens with the extension loaded
3. Make changes and reload (Ctrl+R) to test

### Building
```bash
npm run compile    # Compile TypeScript
npm run watch      # Watch mode
npm run lint       # Run ESLint
npm run test       # Run tests
```

### Creating a VSIX Package
```bash
npm run package
```

## Code Style

- Use TypeScript strict mode
- Follow ESLint rules (run `npm run lint`)
- Use meaningful variable and function names
- Add JSDoc comments for public APIs

## Testing

### Running Tests
```bash
npm run test
```

### Writing Tests
- Place test files in `src/test/`
- Name test files with `.test.ts` suffix
- Use Mocha for test framework

## Pull Request Process

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Run tests: `npm run test`
5. Run linter: `npm run lint`
6. Commit with clear message
7. Push and create a Pull Request

## Reporting Issues

- Use GitHub Issues
- Include VS Code version
- Include Buffalo version
- Provide steps to reproduce
- Include relevant logs from Output panel

## Feature Requests

- Open a GitHub Issue with "Feature Request" label
- Describe the use case
- Explain expected behavior

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
