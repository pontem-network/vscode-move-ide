import * as vscode from 'vscode';
import { commands, window, workspace } from 'vscode';
import { ExtensionSettings } from './components/settings';
import { PersistentState } from './components/persistent_state';
import { bootstrapDoveExecutable, bootstrapLanguageServer } from './components/bootstrap';
import { log } from './components/util';
import { ClientWorkspaceFactory } from './components/ws';

let clientWorkspaceFactory: ClientWorkspaceFactory | null = null;

export async function activate(context: vscode.ExtensionContext) {
    // VS Code doesn't show a notification when an extension fails to activate
    // so we do it ourselves.
    await tryActivate(context).catch((err) => {
        void vscode.window.showErrorMessage(`Cannot activate vscode-move-ide: ${err.message}`);
        throw err;
    });
}

/*
 * Activate extension: register commands, attach handlers
 */
async function tryActivate(context: vscode.ExtensionContext) {
    const settings = new ExtensionSettings(context);
    const state = new PersistentState(context.globalState);

    log.debug(`Directory for extension binaries is ${settings.globalStorageUri}`);
    await workspace.fs.createDirectory(settings.globalStorageUri);

    const handleError = (binary: string, err: any) => {
        let message = 'bootstrap error. ';

        if (err.code === 'EBUSY' || err.code === 'ETXTBSY' || err.code === 'EPERM') {
            message += `Other vscode windows might be using ${binary}, `;
            message += 'you should close them and reload this window to retry. ';
        }

        if (!settings.traceExtension) {
            message += 'To enable verbose logs use { "move.trace.extension": true }';
        }

        log.error('Bootstrap error', err);
        throw new Error(message);
    };

    const languageServerPath = await bootstrapLanguageServer(settings, state).catch(
        handleError.bind(null, 'move-language-server')
    );
    const doveExecutablePath = await bootstrapDoveExecutable(settings, state).catch(
        handleError.bind(null, 'dove')
    );
    clientWorkspaceFactory = new ClientWorkspaceFactory(
        context,
        settings,
        doveExecutablePath,
        languageServerPath
    );
    context.subscriptions.push(clientWorkspaceFactory);
    context.subscriptions.push(
        window.onDidChangeActiveTextEditor(clientWorkspaceFactory.initClientWorkspace)
    );
    // Manually trigger the first event to start up server instance if necessary,
    // since VSCode doesn't do that on startup by itself.
    await clientWorkspaceFactory.initClientWorkspace(window.activeTextEditor);

    // Reloading is inspired by @DanTup maneuver: https://github.com/microsoft/vscode/issues/45774#issuecomment-373423895
    commands.registerCommand('reload', async () => {
        void vscode.window.showInformationMessage('Reloading rust-analyzer...');
        await deactivate();
        while (context.subscriptions.length > 0) {
            try {
                // unregisters command
                context.subscriptions.pop()!.dispose();
            } catch (err) {
                log.error('Dispose error:', err);
            }
        }
        await activate(context).catch(log.error);
    });
}

// this method is called when your extension is deactivated
export async function deactivate() {}
