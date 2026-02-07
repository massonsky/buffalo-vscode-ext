# Buffalo LSP - VS Code Extension

Language Server Protocol support for Protocol Buffers with the Buffalo build system.

![Buffalo LSP](https://img.shields.io/badge/Buffalo-LSP-blue)
![VS Code](https://img.shields.io/badge/VS%20Code-1.85+-blue)
![License](https://img.shields.io/badge/License-MIT-green)

## Features

### Syntax Highlighting
- Full Proto3 syntax highlighting
- Support for messages, enums, services, and RPC methods
- Buffalo-specific annotation highlighting

### IntelliSense
- **Autocomplete** for Proto keywords, types, and Buffalo annotations
- **Hover information** for types, keywords, and validation rules
- **Go to Definition** for message types and imported files
- **Document Symbols** for navigation
- **Signature Help** for RPC methods

### Diagnostics
- Real-time syntax error detection
- Field number validation (reserved ranges, duplicates)
- Naming convention hints (snake_case for fields, PascalCase for messages)
- Buffalo validation rule conflict detection
- Import resolution validation

### Buffalo Integration
- **Validation annotations** - Full support for `buffalo.validate.rules`
- **Permissions annotations** - Support for `buffalo.permissions.*`
- **Code generation** - Generate Go, Python, Rust, or C++ code directly
- **Dependency graph** - Visualize proto dependencies

### Code Actions
- Format document
- Organize imports
- Quick fixes for common issues

## Requirements

- [Buffalo](https://github.com/massonsky/buffalo) must be installed and available in your PATH
- VS Code 1.85.0 or higher

## Installation

### From VS Code Marketplace
1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "Buffalo LSP"
4. Click Install

### From VSIX
1. Download the `.vsix` file from [releases](https://github.com/massonsky/buffalo-vscode/releases)
2. In VS Code, go to Extensions
3. Click the "..." menu and select "Install from VSIX..."
4. Select the downloaded file

### Build from Source
```bash
git clone https://github.com/massonsky/buffalo-vscode.git
cd buffalo-vscode
npm install
npm run compile
npm run package
```

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `buffalo.lsp.enabled` | `true` | Enable/disable Buffalo LSP |
| `buffalo.lsp.path` | `"buffalo"` | Path to the buffalo executable |
| `buffalo.lsp.trace.server` | `"off"` | Trace communication with the LSP server |
| `buffalo.validation.enabled` | `true` | Enable validation diagnostics |
| `buffalo.format.onSave` | `false` | Format proto files on save |
| `buffalo.permissions.enabled` | `true` | Enable Buffalo permissions analysis |

## Commands

| Command | Description |
|---------|-------------|
| `Buffalo: Restart Language Server` | Restart the LSP server |
| `Buffalo: Show Output Channel` | Show the output channel for debugging |
| `Buffalo: Format Document` | Format the current proto file |
| `Buffalo: Generate Code from Proto` | Generate code for selected language |
| `Buffalo: Show Dependency Graph` | Display proto dependency graph |

## Snippets

| Prefix | Description |
|--------|-------------|
| `proto3` | Proto3 file boilerplate |
| `proto3f` | Full proto3 file with message and service |
| `msg` | Message definition |
| `enum` | Enum definition |
| `svc` | Service definition |
| `rpc` | RPC method |
| `fstr` | String field |
| `fint` | Int32 field |
| `frep` | Repeated field |
| `fmap` | Map field |
| `bvreq` | Buffalo validation: required |
| `bvemail` | Buffalo validation: email |
| `bppub` | Buffalo permissions: public |
| `bpres` | Buffalo permissions: resource |

## Usage Examples

### Basic Proto File
```protobuf
syntax = "proto3";

package myservice;

option go_package = "github.com/example/myservice";

message User {
  string id = 1;
  string name = 2;
  string email = 3;
}

service UserService {
  rpc GetUser(GetUserRequest) returns (User) {}
  rpc ListUsers(ListUsersRequest) returns (ListUsersResponse) {}
}
```

### With Buffalo Validation
```protobuf
import "buffalo/validate/validate.proto";

message CreateUserRequest {
  string name = 1 [(buffalo.validate.rules).string = { 
    min_len: 1, 
    max_len: 100 
  }];
  
  string email = 2 [(buffalo.validate.rules).string = { 
    email: true 
  }];
  
  int32 age = 3 [(buffalo.validate.rules).int32 = { 
    gte: 0, 
    lte: 150 
  }];
}
```

### With Buffalo Permissions
```protobuf
import "buffalo/permissions/permissions.proto";

service AdminService {
  option (buffalo.permissions.resource) = "admin";
  
  rpc DeleteUser(DeleteUserRequest) returns (Empty) {
    option (buffalo.permissions.action) = "delete";
    option (buffalo.permissions.roles) = ["admin", "superadmin"];
  }
}
```

## Troubleshooting

### LSP Server Not Starting
1. Verify Buffalo is installed: `buffalo version`
2. Check the path in settings: `buffalo.lsp.path`
3. View logs: `Buffalo: Show Output Channel`

### Missing Completions
1. Ensure the file has `.proto` extension
2. Check that LSP is enabled in settings
3. Restart the language server

### Performance Issues
1. Reduce trace level: set `buffalo.lsp.trace.server` to `"off"`
2. Exclude large directories from workspace

## Contributing

Contributions are welcome! Please see the [contributing guide](CONTRIBUTING.md).

## License

MIT License - see [LICENSE](LICENSE) for details.

## Related Projects

- [Buffalo](https://github.com/massonsky/buffalo) - The Buffalo build system
- [Protocol Buffers](https://developers.google.com/protocol-buffers) - Google's Protocol Buffers
