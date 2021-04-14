import * as vscode from 'vscode';
import { commands, Uri, window, workspace } from 'vscode';
import { PersistentState } from './components/persistent_state';
import { bootstrap } from './components/bootstrap';
import { log } from './components/util';
import { ClientWorkspaceFactory } from './components/ws';
import { ExtensionSettings } from './components/settings';

export const EXTENSION_SETTINGS_ROOT_SECTION = 'move';

export async function activate(context: vscode.ExtensionContext) {
    // VS Code doesn't show a notification when an extension fails to activate
    // so we do it ourselves.
    await tryActivate(context).catch((err) => {
        vscode.window.showErrorMessage(`Cannot activate vscode-move-ide: ${err.message}`);
        throw err;
    });
}

/*
 * Activate extension: register commands, attach handlers
 */
async function tryActivate(context: vscode.ExtensionContext) {
    log.setEnabled(ExtensionSettings.logTrace);

    const state = new PersistentState(context.globalState);

    log.debug(`Directory for extension binaries is ${context.globalStorageUri}`);
    await workspace.fs.createDirectory(context.globalStorageUri);

    const [languageServerPath, doveExecutablePath] = await bootstrap(context, state);
    const clientWorkspaceFactory = new ClientWorkspaceFactory(
        context,
        doveExecutablePath,
        languageServerPath
    );
    context.subscriptions.push(clientWorkspaceFactory);
    context.subscriptions.push(
        window.onDidChangeActiveTextEditor(async (editor) => {
            await clientWorkspaceFactory.initClientWorkspace(editor);
        })
    );
    // Manually trigger the first event to start up server instance if necessary,
    // since VSCode doesn't do that on startup by itself.
    await clientWorkspaceFactory.initClientWorkspace(window.activeTextEditor);

    // Reloading is inspired by @DanTup maneuver: https://github.com/microsoft/vscode/issues/45774#issuecomment-373423895
    context.subscriptions.push(
        commands.registerCommand('move.reload', () => {
            void vscode.window.showInformationMessage('Reloading Move IDE...');
            deactivate();
            while (context.subscriptions.length > 0) {
                try {
                    // unregisters command
                    context.subscriptions.pop()!.dispose();
                } catch (err) {
                    log.error('Dispose error:', err);
                }
            }
            activate(context).catch(log.error);
        })
    );

    context.subscriptions.push(
        workspace.onDidChangeConfiguration(async (e) => {
            if (e.affectsConfiguration(EXTENSION_SETTINGS_ROOT_SECTION)) {
                await commands.executeCommand('move.reload');
            }
        }),
        workspace.onDidChangeTextDocument(async (e) => {
            if (e.document.uri.fsPath.endsWith('Dove.toml')) {
                const folder = workspace.getWorkspaceFolder(e.document.uri);
                if (folder && e.document.uri === Uri.joinPath(folder.uri, 'Dove.toml')) {
                    await commands.executeCommand('move.reload');
                }
            }
        })
    );
}

// this method is called when your extension is deactivated
export async function deactivate() {}
