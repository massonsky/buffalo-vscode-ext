import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');

    test('Extension should be present', () => {
        assert.ok(vscode.extensions.getExtension('massonsky.buffalo-lsp'));
    });

    test('Extension should activate on proto file', async () => {
        const ext = vscode.extensions.getExtension('massonsky.buffalo-lsp');
        assert.ok(ext);
        
        // Create a proto document to trigger activation
        const doc = await vscode.workspace.openTextDocument({
            language: 'proto',
            content: 'syntax = "proto3";'
        });
        
        // Wait for activation
        await ext.activate();
        assert.ok(ext.isActive);
    });

    test('Commands should be registered', async () => {
        const commands = await vscode.commands.getCommands(true);
        
        assert.ok(commands.includes('buffalo.restartServer'));
        assert.ok(commands.includes('buffalo.showOutput'));
        assert.ok(commands.includes('buffalo.formatDocument'));
        assert.ok(commands.includes('buffalo.generateCode'));
        assert.ok(commands.includes('buffalo.showDependencyGraph'));
    });

    test('Configuration should have default values', () => {
        const config = vscode.workspace.getConfiguration('buffalo');
        
        assert.strictEqual(config.get('lsp.enabled'), true);
        assert.strictEqual(config.get('lsp.path'), 'buffalo');
        assert.strictEqual(config.get('lsp.trace.server'), 'off');
        assert.strictEqual(config.get('validation.enabled'), true);
        assert.strictEqual(config.get('format.onSave'), false);
        assert.strictEqual(config.get('permissions.enabled'), true);
    });
});
