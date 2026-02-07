import * as path from 'path';
import * as vscode from 'vscode';
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind,
    Executable
} from 'vscode-languageclient/node';

let client: LanguageClient | undefined;
let outputChannel: vscode.OutputChannel;
let statusBarItem: vscode.StatusBarItem;

export async function activate(context: vscode.ExtensionContext) {
    outputChannel = vscode.window.createOutputChannel('Buffalo LSP');
    outputChannel.appendLine('Buffalo LSP extension is activating...');

    // Create status bar item
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = '$(sync~spin) Buffalo';
    statusBarItem.tooltip = 'Buffalo LSP is starting...';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    // Check if LSP is enabled
    const config = vscode.workspace.getConfiguration('buffalo');
    if (!config.get<boolean>('lsp.enabled', true)) {
        outputChannel.appendLine('Buffalo LSP is disabled in settings');
        statusBarItem.text = '$(circle-slash) Buffalo';
        statusBarItem.tooltip = 'Buffalo LSP is disabled';
        return;
    }

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('buffalo.restartServer', restartServer),
        vscode.commands.registerCommand('buffalo.showOutput', () => outputChannel.show()),
        vscode.commands.registerCommand('buffalo.formatDocument', formatDocument),
        vscode.commands.registerCommand('buffalo.generateCode', generateCode),
        vscode.commands.registerCommand('buffalo.showDependencyGraph', showDependencyGraph)
    );

    // Start the language server
    await startServer(context);

    // Watch for configuration changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(async (e) => {
            if (e.affectsConfiguration('buffalo')) {
                outputChannel.appendLine('Configuration changed, restarting server...');
                await restartServer();
            }
        })
    );

    outputChannel.appendLine('Buffalo LSP extension activated');
}

async function startServer(context: vscode.ExtensionContext): Promise<void> {
    const config = vscode.workspace.getConfiguration('buffalo');
    const buffaloPath = config.get<string>('lsp.path', 'buffalo');
    const traceLevel = config.get<string>('lsp.trace.server', 'off');

    outputChannel.appendLine(`Starting Buffalo LSP server: ${buffaloPath} lsp`);

    // Define server options
    const serverExecutable: Executable = {
        command: buffaloPath,
        args: ['lsp', '--stdio'],
        transport: TransportKind.stdio,
        options: {
            env: {
                ...process.env,
                BUFFALO_LSP_LOG_LEVEL: traceLevel === 'verbose' ? 'debug' : 'info'
            }
        }
    };

    const serverOptions: ServerOptions = {
        run: serverExecutable,
        debug: {
            ...serverExecutable,
            args: ['lsp', '--stdio', '--debug']
        }
    };

    // Define client options
    const clientOptions: LanguageClientOptions = {
        documentSelector: [
            { scheme: 'file', language: 'proto' },
            { scheme: 'file', pattern: '**/*.proto' },
            { scheme: 'untitled', language: 'proto' }
        ],
        synchronize: {
            fileEvents: [
                vscode.workspace.createFileSystemWatcher('**/*.proto'),
                vscode.workspace.createFileSystemWatcher('**/buffalo.yaml'),
                vscode.workspace.createFileSystemWatcher('**/buf.yaml')
            ]
        },
        outputChannel: outputChannel,
        traceOutputChannel: outputChannel,
        initializationOptions: {
            settings: {
                validation: config.get<boolean>('validation.enabled', true),
                permissions: config.get<boolean>('permissions.enabled', true),
                formatOnSave: config.get<boolean>('format.onSave', false)
            }
        },
        middleware: {
            workspace: {
                configuration: async (params, token, next) => {
                    const result = await next(params, token);
                    return result;
                }
            }
        }
    };

    // Create the language client
    client = new LanguageClient(
        'buffaloLsp',
        'Buffalo Language Server',
        serverOptions,
        clientOptions
    );

    // Start the client
    try {
        await client.start();
        statusBarItem.text = '$(check) Buffalo';
        statusBarItem.tooltip = 'Buffalo LSP is running';
        statusBarItem.color = undefined;
        outputChannel.appendLine('Buffalo LSP server started successfully');
    } catch (error) {
        statusBarItem.text = '$(error) Buffalo';
        statusBarItem.tooltip = `Buffalo LSP failed to start: ${error}`;
        statusBarItem.color = new vscode.ThemeColor('errorForeground');
        outputChannel.appendLine(`Failed to start Buffalo LSP server: ${error}`);
        
        vscode.window.showErrorMessage(
            `Failed to start Buffalo LSP server. Make sure 'buffalo' is installed and available in PATH.`,
            'Install Buffalo',
            'Show Output'
        ).then(selection => {
            if (selection === 'Install Buffalo') {
                vscode.env.openExternal(vscode.Uri.parse('https://github.com/massonsky/buffalo#installation'));
            } else if (selection === 'Show Output') {
                outputChannel.show();
            }
        });
    }

    context.subscriptions.push(client);
}

async function restartServer(): Promise<void> {
    outputChannel.appendLine('Restarting Buffalo LSP server...');
    statusBarItem.text = '$(sync~spin) Buffalo';
    statusBarItem.tooltip = 'Buffalo LSP is restarting...';

    if (client) {
        await client.stop();
        client = undefined;
    }

    // Get extension context and restart
    const ext = vscode.extensions.getExtension('massonsky.buffalo-lsp');
    if (ext) {
        await startServer(ext.exports.context);
    }
}

async function formatDocument(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'proto') {
        vscode.window.showWarningMessage('Please open a .proto file to format');
        return;
    }

    if (!client || !client.isRunning()) {
        vscode.window.showErrorMessage('Buffalo LSP server is not running');
        return;
    }

    try {
        await vscode.commands.executeCommand('editor.action.formatDocument');
        outputChannel.appendLine(`Formatted: ${editor.document.fileName}`);
    } catch (error) {
        outputChannel.appendLine(`Format error: ${error}`);
        vscode.window.showErrorMessage(`Failed to format document: ${error}`);
    }
}

async function generateCode(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'proto') {
        vscode.window.showWarningMessage('Please open a .proto file to generate code');
        return;
    }

    const config = vscode.workspace.getConfiguration('buffalo');
    const buffaloPath = config.get<string>('lsp.path', 'buffalo');

    // Show quick pick for language selection
    const language = await vscode.window.showQuickPick(
        ['go', 'python', 'rust', 'cpp', 'all'],
        {
            placeHolder: 'Select target language for code generation',
            title: 'Buffalo Code Generation'
        }
    );

    if (!language) {
        return;
    }

    const terminal = vscode.window.createTerminal('Buffalo Generate');
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
    const cwd = workspaceFolder?.uri.fsPath || path.dirname(editor.document.fileName);

    terminal.show();
    
    if (language === 'all') {
        terminal.sendText(`cd "${cwd}" && ${buffaloPath} build`);
    } else {
        terminal.sendText(`cd "${cwd}" && ${buffaloPath} build --lang ${language}`);
    }

    outputChannel.appendLine(`Generating ${language} code for: ${editor.document.fileName}`);
}

async function showDependencyGraph(): Promise<void> {
    const config = vscode.workspace.getConfiguration('buffalo');
    const buffaloPath = config.get<string>('lsp.path', 'buffalo');

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showWarningMessage('Please open a workspace to view dependency graph');
        return;
    }

    const terminal = vscode.window.createTerminal('Buffalo Graph');
    terminal.show();
    terminal.sendText(`cd "${workspaceFolder.uri.fsPath}" && ${buffaloPath} graph --format dot`);

    outputChannel.appendLine('Generating dependency graph...');
}

export async function deactivate(): Promise<void> {
    if (client) {
        await client.stop();
    }
}
