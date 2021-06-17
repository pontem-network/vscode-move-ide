import * as vscode from 'vscode';
import { commands, Uri, window, workspace } from 'vscode';
import { PersistentState } from './components/persistent_state';
import { log } from './components/util';
import { ClientWorkspaceFactory } from './components/ws';
import { ExtensionSettings } from './components/settings';
import { Dove } from './components/dove';
import { bootstrap } from './components/bootstrap';

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
    log.debug('Activating the extension...');

    const state = new PersistentState(context.globalState);

    // const [languageServerPath, doveExecutablePath] = await bootstrap(context, state);
    const clientWorkspaceFactory = new ClientWorkspaceFactory(context, state);
    context.subscriptions.push(clientWorkspaceFactory);
    context.subscriptions.push(
        window.onDidChangeActiveTextEditor(async (editor) => {
            await clientWorkspaceFactory.initClientWorkspace(editor?.document);
        })
    );
    context.subscriptions.push(
        workspace.onDidSaveTextDocument(async (text_document) => {
            if (text_document.uri.fsPath.endsWith('Dove.toml')) {
                await clientWorkspaceFactory.initClientWorkspace(text_document);
            }
        })
    );
    // Manually trigger the first event to start up server instance if necessary,
    // since VSCode doesn't do that on startup by itself.
    await clientWorkspaceFactory.initClientWorkspace(window.activeTextEditor?.document);

    // Reloading is inspired by @DanTup maneuver: https://github.com/microsoft/vscode/issues/45774#issuecomment-373423895
    log.debug('Register command "move.reload"');
    context.subscriptions.push(
        commands.registerCommand('move.reload', () => {
            log.debug('"move.reload" called');
            void vscode.window.showInformationMessage('Move IDE has been reloaded');

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

    const onDidDoveTomlChanged = async (documentUri: Uri) => {
        if (documentUri.fsPath.endsWith('Dove.toml')) {
            const folder = workspace.getWorkspaceFolder(documentUri);
            if (folder === undefined) return;
            log.debug(`Dove.toml change recorded for "${folder.uri.fsPath}"`);

            // validate Dove.toml, and show notification if invalid
            const doveExecutable = (await bootstrap(context, state)).doveExecutablePath;
            const dove = new Dove(doveExecutable);

            const [metadata, errors] = await dove.metadata(folder);
            if (!metadata) {
                // invalid Dove.toml
                vscode.window.showErrorMessage(`Dove.toml is invalid: ${errors}`);
                return;
            }

            if (documentUri === Uri.joinPath(folder.uri, 'Dove.toml')) {
                commands.executeCommand('move.reload');
            }
        }
    };
    context.subscriptions.push(
        workspace.onDidChangeConfiguration(async (e) => {
            if (e.affectsConfiguration(EXTENSION_SETTINGS_ROOT_SECTION)) {
                log.debug('move section in settings.json changed');
                commands.executeCommand('move.reload');
            }
        }),
        workspace.onDidCreateFiles(async (e) => {
            for (const file of e.files) {
                await onDidDoveTomlChanged(file);
            }
        }),
        workspace.onDidDeleteFiles(async (e) => {
            for (const file of e.files) {
                await onDidDoveTomlChanged(file);
            }
        }),
        workspace.onDidSaveTextDocument(async (document) => {
            await onDidDoveTomlChanged(document.uri);
        })
    );
}

// this method is called when your extension is deactivated
export async function deactivate() {
    log.debug('Deactivating the extension...');
}
