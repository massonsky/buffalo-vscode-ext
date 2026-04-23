import * as vscode from "vscode";
import * as cp from "child_process";
import * as path from "path";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
  Executable,
} from "vscode-languageclient/node";

let client: LanguageClient | undefined;
let outputChannel: vscode.OutputChannel;
let statusBarItem: vscode.StatusBarItem;

// Status bar states
enum ServerStatus {
  Starting = "starting",
  Running = "running",
  Stopped = "stopped",
  Error = "error",
  NotInstalled = "not_installed",
  Disabled = "disabled",
}

interface BuffaloVersion {
  version: string;
  commit: string;
  go: string;
  platform: string;
}

function updateStatusBar(status: ServerStatus, details?: string): void {
  switch (status) {
    case ServerStatus.Starting:
      statusBarItem.text = "$(loading~spin) Buffalo";
      statusBarItem.tooltip = new vscode.MarkdownString(
        "$(loading~spin) **Buffalo LSP** is starting...\n\nClick to show output logs",
      );
      statusBarItem.backgroundColor = undefined;
      break;
    case ServerStatus.Running:
      statusBarItem.text = "$(check) Buffalo";
      const runningTooltip = new vscode.MarkdownString();
      runningTooltip.appendMarkdown("$(check) **Buffalo LSP** is running\n\n");
      if (details) {
        runningTooltip.appendMarkdown(`Version: \`${details}\`\n\n`);
      }
      runningTooltip.appendMarkdown("---\n");
      runningTooltip.appendMarkdown("$(terminal) Click to show output\n\n");
      runningTooltip.appendMarkdown(
        "$(refresh) `Buffalo: Restart Server` to restart",
      );
      statusBarItem.tooltip = runningTooltip;
      statusBarItem.backgroundColor = undefined;
      break;
    case ServerStatus.Stopped:
      statusBarItem.text = "$(circle-slash) Buffalo";
      statusBarItem.tooltip = new vscode.MarkdownString(
        "$(circle-slash) **Buffalo LSP** is stopped\n\nClick to show output logs",
      );
      statusBarItem.backgroundColor = new vscode.ThemeColor(
        "statusBarItem.warningBackground",
      );
      break;
    case ServerStatus.Error:
      statusBarItem.text = "$(error) Buffalo";
      const errorTooltip = new vscode.MarkdownString();
      errorTooltip.appendMarkdown(
        "$(error) **Buffalo LSP** failed to start\n\n",
      );
      if (details) {
        errorTooltip.appendMarkdown(`Error: ${details}\n\n`);
      }
      errorTooltip.appendMarkdown("---\n");
      errorTooltip.appendMarkdown("$(refresh) Click to restart or show logs");
      statusBarItem.tooltip = errorTooltip;
      statusBarItem.backgroundColor = new vscode.ThemeColor(
        "statusBarItem.errorBackground",
      );
      break;
    case ServerStatus.NotInstalled:
      statusBarItem.text = "$(warning) Buffalo";
      const notInstalledTooltip = new vscode.MarkdownString();
      notInstalledTooltip.appendMarkdown(
        "$(warning) **Buffalo** is not installed\n\n",
      );
      notInstalledTooltip.appendMarkdown(
        "Click to see installation instructions",
      );
      statusBarItem.tooltip = notInstalledTooltip;
      statusBarItem.backgroundColor = new vscode.ThemeColor(
        "statusBarItem.warningBackground",
      );
      statusBarItem.command = "buffalo.showInstallGuide";
      break;
    case ServerStatus.Disabled:
      statusBarItem.text = "$(circle-slash) Buffalo";
      statusBarItem.tooltip = new vscode.MarkdownString(
        "$(circle-slash) **Buffalo LSP** is disabled\n\nEnable in settings: `buffalo.lsp.enabled`",
      );
      statusBarItem.backgroundColor = undefined;
      break;
  }
  statusBarItem.show();
}

async function checkBuffaloInstalled(
  buffaloPath: string,
): Promise<BuffaloVersion | null> {
  return new Promise((resolve) => {
    const parseVersionOutput = (stdout: string): BuffaloVersion | null => {
      const lines = stdout
        .trim()
        .split("\n")
        .map((l) => l.trim());

      // Supports both:
      // 1) "Buffalo version 1.10.1" (or "dev")
      // 2) "Version:    1.10.1" from `buffalo version`
      const firstLineMatch = lines[0]?.match(/^Buffalo version\s+(.+)$/i);
      const tableMatch = lines
        .find((l) => /^Version\s*:/i.test(l))
        ?.match(/^Version\s*:\s*(.+)$/i);

      const version =
        firstLineMatch?.[1]?.trim() || tableMatch?.[1]?.trim() || "";
      if (!version) {
        return null;
      }

      const commitMatch = lines
        .find((l) => l.startsWith("Commit:"))
        ?.replace("Commit:", "")
        .trim();
      const goMatch =
        lines
          .find((l) => l.startsWith("Go:"))
          ?.replace("Go:", "")
          .trim() ||
        lines
          .find((l) => l.startsWith("Go Version:"))
          ?.replace("Go Version:", "")
          .trim();
      const platformMatch =
        lines
          .find((l) => l.startsWith("Platform:"))
          ?.replace("Platform:", "")
          .trim() || "unknown";

      return {
        version,
        commit: commitMatch || "unknown",
        go: goMatch || "unknown",
        platform: platformMatch,
      };
    };

    cp.execFile(
      buffaloPath,
      ["--version"],
      { timeout: 5000 },
      (error, stdout) => {
        if (!error) {
          resolve(parseVersionOutput(stdout));
          return;
        }

        // Fallback for builds where only `buffalo version` is available
        cp.execFile(
          buffaloPath,
          ["version"],
          { timeout: 5000 },
          (fallbackError, fallbackStdout) => {
            if (fallbackError) {
              resolve(null);
              return;
            }
            resolve(parseVersionOutput(fallbackStdout));
          },
        );
      },
    );
  });
}

async function checkLspSupport(buffaloPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    cp.execFile(buffaloPath, ["lsp", "--help"], { timeout: 5000 }, (error) => {
      resolve(!error);
    });
  });
}

async function showInstallGuide(): Promise<void> {
  const panel = vscode.window.createWebviewPanel(
    "buffaloInstall",
    "Install Buffalo",
    vscode.ViewColumn.One,
    { enableScripts: true },
  );

  panel.webview.html = getInstallGuideHtml();
}

function getInstallGuideHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Install Buffalo</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            line-height: 1.6;
        }
        h1 { color: var(--vscode-textLink-foreground); border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 10px; }
        h2 { color: var(--vscode-textLink-activeForeground); margin-top: 30px; }
        code {
            background-color: var(--vscode-textCodeBlock-background);
            padding: 2px 6px;
            border-radius: 3px;
            font-family: var(--vscode-editor-font-family);
        }
        pre {
            background-color: var(--vscode-textCodeBlock-background);
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
            border: 1px solid var(--vscode-panel-border);
        }
        .method {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            padding: 20px;
            border-radius: 8px;
            margin: 15px 0;
            border-left: 4px solid var(--vscode-textLink-foreground);
        }
        .warning {
            background-color: var(--vscode-inputValidation-warningBackground);
            padding: 15px;
            border-radius: 5px;
            margin: 15px 0;
            border-left: 4px solid var(--vscode-inputValidation-warningBorder);
        }
        .success {
            background-color: var(--vscode-inputValidation-infoBackground);
            padding: 15px;
            border-radius: 5px;
            margin: 15px 0;
            border-left: 4px solid var(--vscode-inputValidation-infoBorder);
        }
        a { color: var(--vscode-textLink-foreground); }
        ul { padding-left: 20px; }
        li { margin: 8px 0; }
    </style>
</head>
<body>
    <h1>🦬 Installing Buffalo</h1>
    
    <p>Buffalo is a Protocol Buffers build system and language server. Choose one of the installation methods below:</p>

    <h2>📦 Method 1: Go Install (Recommended)</h2>
    <div class="method">
        <p>If you have Go 1.21+ installed:</p>
        <pre>go install github.com/massonsky/buffalo/cmd/buffalo@latest</pre>
        <p>Make sure <code>$GOPATH/bin</code> (usually <code>~/go/bin</code>) is in your PATH.</p>
    </div>

    <h2>📥 Method 2: Download Binary</h2>
    <div class="method">
        <p>Download pre-built binaries from GitHub Releases:</p>
        <pre># Linux (amd64)
curl -sSL https://github.com/massonsky/buffalo/releases/latest/download/buffalo_linux_amd64.tar.gz | tar xz
sudo mv buffalo /usr/local/bin/

# macOS (arm64)
curl -sSL https://github.com/massonsky/buffalo/releases/latest/download/buffalo_darwin_arm64.tar.gz | tar xz
sudo mv buffalo /usr/local/bin/

# Windows (PowerShell)
Invoke-WebRequest -Uri https://github.com/massonsky/buffalo/releases/latest/download/buffalo_windows_amd64.zip -OutFile buffalo.zip
Expand-Archive buffalo.zip -DestinationPath C:\\buffalo
# Add C:\\buffalo to your PATH</pre>
    </div>

    <h2>🔧 Method 3: Build from Source</h2>
    <div class="method">
        <pre>git clone https://github.com/massonsky/buffalo.git
cd buffalo
go build -o buffalo ./cmd/buffalo
sudo mv buffalo /usr/local/bin/</pre>
    </div>

    <h2>✅ Verify Installation</h2>
    <div class="success">
        <p>After installation, verify Buffalo is working:</p>
        <pre>buffalo --version
buffalo lsp --help</pre>
        <p>Then restart VS Code or run <strong>Buffalo: Restart Language Server</strong> command.</p>
    </div>

    <h2>⚙️ Custom Path</h2>
    <div class="warning">
        <p>If Buffalo is installed in a non-standard location, configure the path in VS Code settings:</p>
        <pre>{
    "buffalo.lsp.path": "/path/to/buffalo"
}</pre>
    </div>

    <h2>🔗 Links</h2>
    <ul>
        <li><a href="https://github.com/massonsky/buffalo">GitHub Repository</a></li>
        <li><a href="https://github.com/massonsky/buffalo/releases">Releases</a></li>
        <li><a href="https://github.com/massonsky/buffalo#installation">Full Installation Guide</a></li>
    </ul>
</body>
</html>`;
}

async function showNotInstalledError(buffaloPath: string): Promise<void> {
  const selection = await vscode.window.showErrorMessage(
    `Buffalo executable not found at '${buffaloPath}'. The LSP features require Buffalo to be installed.`,
    "Install Buffalo",
    "Set Custom Path",
    "Show Output",
    "Disable LSP",
  );

  if (selection === "Install Buffalo") {
    showInstallGuide();
  } else if (selection === "Set Custom Path") {
    const path = await vscode.window.showInputBox({
      prompt: "Enter the full path to the buffalo executable",
      placeHolder: "/usr/local/bin/buffalo or C:\\buffalo\\buffalo.exe",
      validateInput: (value) => {
        if (!value || value.trim() === "") {
          return "Path cannot be empty";
        }
        return null;
      },
    });
    if (path) {
      const config = vscode.workspace.getConfiguration("buffalo");
      await config.update("lsp.path", path, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage(
        `Buffalo path set to: ${path}. Restarting server...`,
      );
      vscode.commands.executeCommand("buffalo.restartServer");
    }
  } else if (selection === "Show Output") {
    outputChannel.show();
  } else if (selection === "Disable LSP") {
    const config = vscode.workspace.getConfiguration("buffalo");
    await config.update(
      "lsp.enabled",
      false,
      vscode.ConfigurationTarget.Global,
    );
    updateStatusBar(ServerStatus.Disabled);
  }
}

async function showLspNotSupportedError(
  version: BuffaloVersion,
): Promise<void> {
  const selection = await vscode.window.showWarningMessage(
    `Buffalo ${version.version} doesn't support LSP. Please update to the latest version.`,
    "Update Buffalo",
    "Show Output",
  );

  if (selection === "Update Buffalo") {
    const terminal = vscode.window.createTerminal("Buffalo Update");
    terminal.show();
    terminal.sendText(
      "go install github.com/massonsky/buffalo/cmd/buffalo@latest",
    );
    vscode.window.showInformationMessage(
      'Updating Buffalo... Run "Buffalo: Restart Server" after update completes.',
    );
  } else if (selection === "Show Output") {
    outputChannel.show();
  }
}

export async function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel("Buffalo LSP", {
    log: true,
  });
  outputChannel.appendLine("Buffalo LSP extension is activating...");

  // Create status bar item
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100,
  );
  statusBarItem.command = "buffalo.showOutput";
  context.subscriptions.push(statusBarItem);
  updateStatusBar(ServerStatus.Starting);

  // Register commands FIRST - before any async operations
  context.subscriptions.push(
    vscode.commands.registerCommand("buffalo.restartServer", () =>
      restartServer(context),
    ),
    vscode.commands.registerCommand("buffalo.showOutput", () =>
      outputChannel.show(),
    ),
    vscode.commands.registerCommand("buffalo.formatDocument", formatDocument),
    vscode.commands.registerCommand("buffalo.generateCode", generateCode),
    vscode.commands.registerCommand(
      "buffalo.showDependencyGraph",
      showDependencyGraph,
    ),
    vscode.commands.registerCommand(
      "buffalo.showInstallGuide",
      showInstallGuide,
    ),
    vscode.commands.registerCommand("buffalo.checkHealth", () =>
      checkHealth(context),
    ),
    vscode.commands.registerCommand("buffalo.showServerInfo", showServerInfo),
  );

  outputChannel.appendLine("Commands registered");

  // Check if LSP is enabled
  const config = vscode.workspace.getConfiguration("buffalo");
  if (!config.get<boolean>("lsp.enabled", true)) {
    outputChannel.appendLine("Buffalo LSP is disabled in settings");
    updateStatusBar(ServerStatus.Disabled);
    vscode.window.showInformationMessage(
      "Buffalo LSP is disabled. Enable it in settings: buffalo.lsp.enabled",
    );
    return;
  }

  // Try to start the language server
  try {
    await startServer(context);
  } catch (error) {
    outputChannel.appendLine(`Failed to start LSP: ${error}`);
    updateStatusBar(ServerStatus.Error, String(error));
  }

  // Watch for configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (e) => {
      if (e.affectsConfiguration("buffalo")) {
        outputChannel.appendLine("Configuration changed, restarting server...");
        vscode.window.showInformationMessage(
          "Buffalo configuration changed. Restarting server...",
        );
        await restartServer(context);
      }
    }),
  );

  outputChannel.appendLine("Buffalo LSP extension activated");
}

async function startServer(context: vscode.ExtensionContext): Promise<void> {
  const config = vscode.workspace.getConfiguration("buffalo");
  const buffaloPath = config.get<string>("lsp.path", "buffalo");
  const traceLevel = config.get<string>("lsp.trace.server", "off");

  outputChannel.appendLine(`Checking Buffalo installation at: ${buffaloPath}`);
  updateStatusBar(ServerStatus.Starting);

  // Check if Buffalo is installed
  const version = await checkBuffaloInstalled(buffaloPath);
  if (!version) {
    outputChannel.appendLine(`Buffalo executable not found at: ${buffaloPath}`);
    updateStatusBar(ServerStatus.NotInstalled);
    await showNotInstalledError(buffaloPath);
    return;
  }

  outputChannel.appendLine(
    `Found Buffalo ${version.version} (${version.platform})`,
  );

  // Check if LSP is supported
  const hasLsp = await checkLspSupport(buffaloPath);
  if (!hasLsp) {
    outputChannel.appendLine(
      "Buffalo LSP command not available - update required",
    );
    updateStatusBar(ServerStatus.Error, "LSP not supported");
    await showLspNotSupportedError(version);
    return;
  }

  outputChannel.appendLine(
    `Starting Buffalo LSP server: ${buffaloPath} lsp --stdio`,
  );

  // Define server options
  const serverExecutable: Executable = {
    command: buffaloPath,
    args: ["lsp", "--stdio"],
    transport: TransportKind.stdio,
    options: {
      env: {
        ...process.env,
        BUFFALO_LSP_LOG_LEVEL: traceLevel === "verbose" ? "debug" : "info",
      },
    },
  };

  const serverOptions: ServerOptions = {
    run: serverExecutable,
    debug: {
      ...serverExecutable,
      args: ["lsp", "--stdio", "--debug"],
    },
  };

  // Define client options
  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { scheme: "file", language: "proto" },
      { scheme: "file", pattern: "**/*.proto" },
      { scheme: "untitled", language: "proto" },
    ],
    synchronize: {
      fileEvents: [
        vscode.workspace.createFileSystemWatcher("**/*.proto"),
        vscode.workspace.createFileSystemWatcher("**/buffalo.yaml"),
        vscode.workspace.createFileSystemWatcher("**/buf.yaml"),
      ],
    },
    outputChannel: outputChannel,
    traceOutputChannel: outputChannel,
    initializationOptions: {
      settings: {
        validation: config.get<boolean>("validation.enabled", true),
        permissions: config.get<boolean>("permissions.enabled", true),
        formatOnSave: config.get<boolean>("format.onSave", false),
      },
    },
  };

  // Create the language client
  client = new LanguageClient(
    "buffaloLsp",
    "Buffalo Language Server",
    serverOptions,
    clientOptions,
  );

  // Set up client event handlers
  client.onDidChangeState((event) => {
    outputChannel.appendLine(
      `Client state changed: ${event.oldState} -> ${event.newState}`,
    );
  });

  // Set up diagnostics collection for basic syntax checks
  const diagnosticsCollection =
    vscode.languages.createDiagnosticCollection("proto");
  context.subscriptions.push(diagnosticsCollection);

  // Simple syntax validation as fallback
  const validateDocument = (document: vscode.TextDocument) => {
    if (document.languageId !== "proto") return;

    const diagnostics: vscode.Diagnostic[] = [];
    const text = document.getText();
    const lines = text.split("\n");

    lines.forEach((line, lineIndex) => {
      // Check for invalid unicode characters
      const invalidChars = line.match(/[А-Яа-яЁё]/g);
      if (invalidChars) {
        const match = line.match(/[А-Яа-яЁё]/);
        if (match && match.index !== undefined) {
          const diagnostic = new vscode.Diagnostic(
            new vscode.Range(
              lineIndex,
              match.index,
              lineIndex,
              match.index + match[0].length,
            ),
            `Invalid character '${match[0]}' in protobuf file. Only ASCII characters are allowed.`,
            vscode.DiagnosticSeverity.Error,
          );
          diagnostics.push(diagnostic);
        }
      }

      // Check for missing semicolons in field declarations
      if (
        /^\s*(optional|required|repeated)?\s*\w+\s+\w+\s*=\s*\d+\s*$/.test(
          line,
        ) &&
        !line.trim().startsWith("//")
      ) {
        const diagnostic = new vscode.Diagnostic(
          new vscode.Range(lineIndex, 0, lineIndex, line.length),
          "Field declaration is missing semicolon",
          vscode.DiagnosticSeverity.Error,
        );
        diagnostics.push(diagnostic);
      }
    });

    diagnosticsCollection.set(document.uri, diagnostics);
  };

  // Validate on open and change
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(validateDocument),
    vscode.workspace.onDidChangeTextDocument((e) =>
      validateDocument(e.document),
    ),
    vscode.workspace.onDidCloseTextDocument((doc) =>
      diagnosticsCollection.delete(doc.uri),
    ),
  );

  // Validate all open documents
  vscode.workspace.textDocuments.forEach(validateDocument);

  // Start the client
  try {
    await client.start();
    updateStatusBar(ServerStatus.Running, version.version);
    outputChannel.appendLine("Buffalo LSP server started successfully");

    // Show success notification only on first start
    const hasShownStartup = context.globalState.get<boolean>(
      "buffalo.hasShownStartup",
    );
    if (!hasShownStartup) {
      vscode.window.showInformationMessage(
        `Buffalo LSP ${version.version} is now active! Enjoy enhanced proto editing.`,
        "Got it",
      );
      context.globalState.update("buffalo.hasShownStartup", true);
    }
  } catch (error) {
    updateStatusBar(ServerStatus.Error, String(error));
    outputChannel.appendLine(`Failed to start Buffalo LSP server: ${error}`);

    const selection = await vscode.window.showErrorMessage(
      `Failed to start Buffalo LSP server. Check the output for details.`,
      "Show Output",
      "Restart Server",
      "Check Health",
    );

    if (selection === "Show Output") {
      outputChannel.show();
    } else if (selection === "Restart Server") {
      await restartServer(context);
    } else if (selection === "Check Health") {
      await checkHealth(context);
    }
  }

  context.subscriptions.push(client);
}

async function restartServer(context: vscode.ExtensionContext): Promise<void> {
  outputChannel.appendLine("Restarting Buffalo LSP server...");
  updateStatusBar(ServerStatus.Starting);
  vscode.window.showInformationMessage("Restarting Buffalo LSP server...");

  if (client) {
    try {
      await client.stop();
      outputChannel.appendLine("Previous server instance stopped");
    } catch (e) {
      outputChannel.appendLine(`Error stopping client: ${e}`);
    }
    client = undefined;
  }

  await startServer(context);
}

async function checkHealth(context: vscode.ExtensionContext): Promise<void> {
  const config = vscode.workspace.getConfiguration("buffalo");
  const buffaloPath = config.get<string>("lsp.path", "buffalo");

  outputChannel.appendLine("=== Health Check ===");
  outputChannel.show();

  // Check 1: Buffalo executable
  const version = await checkBuffaloInstalled(buffaloPath);
  if (!version) {
    outputChannel.appendLine("❌ Buffalo executable: NOT FOUND");
    vscode.window
      .showErrorMessage(
        "Buffalo is not installed or not in PATH",
        "Install Guide",
      )
      .then((sel) => {
        if (sel === "Install Guide") {
          showInstallGuide();
        }
      });
    return;
  }
  outputChannel.appendLine(`✅ Buffalo executable: Found at ${buffaloPath}`);
  outputChannel.appendLine(`   Version: ${version.version}`);
  outputChannel.appendLine(`   Go: ${version.go}`);
  outputChannel.appendLine(`   Platform: ${version.platform}`);

  // Check 2: LSP support
  const hasLsp = await checkLspSupport(buffaloPath);
  if (!hasLsp) {
    outputChannel.appendLine("❌ LSP support: NOT AVAILABLE");
    vscode.window.showWarningMessage(
      "Buffalo LSP command not available. Please update Buffalo.",
    );
    return;
  }
  outputChannel.appendLine("✅ LSP support: Available");

  // Check 3: Client status
  if (client && client.isRunning()) {
    outputChannel.appendLine("✅ LSP client: Running");
  } else {
    outputChannel.appendLine("⚠️ LSP client: Not running");
  }

  // Check 4: Workspace
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders && workspaceFolders.length > 0) {
    outputChannel.appendLine(
      `✅ Workspace: ${workspaceFolders.map((f) => f.uri.fsPath).join(", ")}`,
    );
  } else {
    outputChannel.appendLine("⚠️ Workspace: No workspace folder open");
  }

  // Check 5: Proto files
  const protoFiles = await vscode.workspace.findFiles(
    "**/*.proto",
    "**/node_modules/**",
    10,
  );
  outputChannel.appendLine(`📁 Proto files found: ${protoFiles.length}`);

  outputChannel.appendLine("=== Health Check Complete ===");

  vscode.window
    .showInformationMessage(
      `Buffalo Health Check: OK (v${version.version})`,
      "Show Details",
    )
    .then((sel) => {
      if (sel === "Show Details") {
        outputChannel.show();
      }
    });
}

async function showServerInfo(): Promise<void> {
  const config = vscode.workspace.getConfiguration("buffalo");
  const buffaloPath = config.get<string>("lsp.path", "buffalo");
  const version = await checkBuffaloInstalled(buffaloPath);

  const items: vscode.QuickPickItem[] = [
    {
      label: "$(info) Version",
      description: version ? version.version : "Not installed",
      detail: version
        ? `Go: ${version.go}, Platform: ${version.platform}`
        : "Buffalo is not installed",
    },
    {
      label: "$(server) LSP Status",
      description: client && client.isRunning() ? "Running" : "Stopped",
      detail:
        client && client.isRunning()
          ? "Language server is active"
          : "Language server is not running",
    },
    {
      label: "$(gear) Configuration Path",
      description: buffaloPath,
      detail: "Path to buffalo executable",
    },
    {
      label: "$(folder) Workspace",
      description:
        vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || "No workspace",
      detail: `${vscode.workspace.workspaceFolders?.length || 0} folder(s) open`,
    },
  ];

  const selected = await vscode.window.showQuickPick(items, {
    title: "Buffalo LSP Server Information",
    placeHolder: "Select an item for more details",
  });

  if (selected?.label.includes("Version") && !version) {
    showInstallGuide();
  } else if (
    selected?.label.includes("LSP Status") &&
    (!client || !client.isRunning())
  ) {
    const action = await vscode.window.showQuickPick(
      ["Restart Server", "Show Output", "Check Health"],
      {
        placeHolder: "Server is not running. What would you like to do?",
      },
    );
    if (action === "Restart Server") {
      vscode.commands.executeCommand("buffalo.restartServer");
    } else if (action === "Show Output") {
      outputChannel.show();
    } else if (action === "Check Health") {
      vscode.commands.executeCommand("buffalo.checkHealth");
    }
  }
}

async function formatDocument(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== "proto") {
    vscode.window.showWarningMessage("Please open a .proto file to format");
    return;
  }

  if (!client || !client.isRunning()) {
    // Fallback: use basic formatting even without LSP
    vscode.window.showWarningMessage(
      "Buffalo LSP is not running. Using basic formatting.",
    );
  }

  try {
    await vscode.commands.executeCommand("editor.action.formatDocument");
    outputChannel.appendLine(`Formatted: ${editor.document.fileName}`);
  } catch (error) {
    outputChannel.appendLine(`Format error: ${error}`);
    vscode.window.showErrorMessage(`Failed to format document: ${error}`);
  }
}

async function generateCode(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== "proto") {
    vscode.window.showWarningMessage(
      "Please open a .proto file to generate code",
    );
    return;
  }

  const config = vscode.workspace.getConfiguration("buffalo");
  const buffaloPath = config.get<string>("lsp.path", "buffalo");

  // Show quick pick for language selection
  const language = await vscode.window.showQuickPick(
    ["go", "python", "rust", "cpp", "all"],
    {
      placeHolder: "Select target language for code generation",
      title: "Buffalo Code Generation",
    },
  );

  if (!language) {
    return;
  }

  const terminal = vscode.window.createTerminal("Buffalo Generate");
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(
    editor.document.uri,
  );
  const cwd =
    workspaceFolder?.uri.fsPath ||
    require("path").dirname(editor.document.fileName);

  terminal.show();

  if (language === "all") {
    terminal.sendText(`cd "${cwd}" && ${buffaloPath} build`);
  } else {
    terminal.sendText(`cd "${cwd}" && ${buffaloPath} build --lang ${language}`);
  }

  outputChannel.appendLine(
    `Generating ${language} code for: ${editor.document.fileName}`,
  );
}

async function showDependencyGraph(): Promise<void> {
  const config = vscode.workspace.getConfiguration("buffalo");
  const buffaloPath = config.get<string>("lsp.path", "buffalo");

  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode.window.showWarningMessage(
      "Please open a workspace to view dependency graph",
    );
    return;
  }

  const terminal = vscode.window.createTerminal("Buffalo Graph");
  terminal.show();
  terminal.sendText(
    `cd "${workspaceFolder.uri.fsPath}" && ${buffaloPath} graph --format dot`,
  );

  outputChannel.appendLine("Generating dependency graph...");
}

export async function deactivate(): Promise<void> {
  if (client) {
    await client.stop();
  }
}
