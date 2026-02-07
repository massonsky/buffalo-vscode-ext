# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2024-02-07

### Added
- Initial release of Buffalo LSP for VS Code
- Proto3 syntax highlighting with TextMate grammar
- Language Server Protocol integration with Buffalo LSP
- Real-time diagnostics for:
  - Syntax errors
  - Field number validation
  - Naming convention hints
  - Buffalo validation rule conflicts
  - Import resolution
- Autocompletion for:
  - Proto keywords and types
  - Buffalo validation annotations
  - Buffalo permissions annotations
  - Message and enum references
- Hover information for:
  - Scalar types documentation
  - Keyword descriptions
  - Validation rule explanations
- Go to Definition for:
  - Message type references
  - Imported proto files
  - Embedded Buffalo protos
- Document symbols for navigation
- Code formatting
- Folding ranges for messages, enums, and services
- Code snippets for common patterns
- Commands:
  - Restart Language Server
  - Show Output Channel
  - Format Document
  - Generate Code from Proto
  - Show Dependency Graph
- Configuration options for customization
- Status bar indicator for server status

### Dependencies
- vscode-languageclient ^9.0.1
- Buffalo (external) for LSP server
