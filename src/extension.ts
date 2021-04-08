import * as vscode from 'vscode';
import { workspace } from 'vscode';
import { ExtensionSettings } from './components/settings';
import { PersistentState } from './components/persistent_state';
import { bootstrapDoveExecutable, bootstrapLanguageServer } from './components/bootstrap';
import * as util from './components/util';
import { log } from './components/util';
import * as lc from 'vscode-languageclient/node';
import * as lsp from 'vscode-languageclient/node';
import { createLanguageClient } from './commands/client';
import { Dove } from './components/dove';
import { Ctx } from './commands/ctx';
import { buildCommand } from './commands/dove/build';
import { Metadata } from './components/metadata';
import { testCommand } from './commands/dove/test';
import { runCommand } from './commands/dove/run';

// @ts-ignore
export const EXTENSION_PATH = vscode.extensions.getExtension('PontemNetwork.move-language')
    .extensionPath;

type WorkspaceClients = Map<vscode.WorkspaceFolder, lsp.LanguageClient>;

const mlsWorkspaceClients: WorkspaceClients = new Map();
const autocompleteWorkspaceClients: WorkspaceClients = new Map();

export async function activate(context: vscode.ExtensionContext) {
    // VS Code doesn't show a notification when an extension fails to activate
    // so we do it ourselves.
    await tryActivate(context).catch((err) => {
        void vscode.window.showErrorMessage(`Cannot activate vscode-move-ide: ${err.message}`);
        throw err;
    });
}

function startLanguageClientOnVisibleMoveFile(
    existingClients: Map<vscode.WorkspaceFolder, lc.LanguageClient>,
    handler: (document: vscode.TextDocument) => void
) {
    const filteredHandler = async (document: vscode.TextDocument) => {
        if (!util.isMoveDocument(document)) {
            return;
        }
        await handler(document);
    };

    workspace.onDidOpenTextDocument(filteredHandler);
    workspace.textDocuments.forEach(filteredHandler);
    workspace.onDidChangeWorkspaceFolders(async (event) => {
        for (const folder of event.removed) {
            const client = existingClients.get(folder);
            if (client) {
                existingClients.delete(folder);
                await client.stop();
            }
        }
    });
}

/*
 * Activate extension: register commands, attach handlers
 */
async function tryActivate(context: vscode.ExtensionContext) {
    // Somewhy on Win32 process.platform is detected incorrectly when run from
    // npm postinstall script. So on Win32, on activate event, extension will
    // check whether /bin has .exe files; if there are - action skipped; and if
    // not - then download-binaries script is run again;
    // I hope there is a better fix for this or proper way to do it. :confused:
    // const files = fs.readdirSync(path.join(context.extensionPath, 'bin'));
    // if (files.length < 3) {
    //     console.log('No binaries found, downloading...');
    //     await downloadBinaries(context.extensionPath);
    // }

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
    const dove = new Dove(doveExecutablePath, settings.traceExtension);

    const ctx = new Ctx(context, settings, dove);
    // Reloading is inspired by @DanTup maneuver: https://github.com/microsoft/vscode/issues/45774#issuecomment-373423895
    ctx.registerCommand('reload', (_) => async () => {
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

    ctx.registerCommand('build', buildCommand);
    ctx.registerCommand('run', runCommand);
    ctx.registerCommand('test', testCommand);

    // const ctx = new Ctx(settings, context);
    // Reloading is inspired by @DanTup maneuver: https://github.com/microsoft/vscode/issues/45774#issuecomment-373423895
    // context.subscriptions.push(
    //     vscode.commands.registerCommand('move.compile', () =>
    //         compileCommand().catch(console.error)
    //     ),
    //     vscode.commands.registerCommand('move.run', () => runScriptCommand().catch(console.error))
    // );

    // Run Move languageServer on first opened .move file
    // const handler = mlsDidOpenTextDocument.bind(null, languageServerPath);
    startLanguageClientOnVisibleMoveFile(
        mlsWorkspaceClients,
        async (document: vscode.TextDocument) => {
            const folder = workspace.getWorkspaceFolder(document.uri);
            if (folder === undefined || mlsWorkspaceClients.has(folder)) {
                return;
            }
            const metadata = await dove.metadata(folder);
            if (!metadata) return;

            const client = createLanguageClient(languageServerPath, folder.uri, metadata);
            mlsWorkspaceClients.set(folder, client);
        }
    );

    // workspace.onDidOpenTextDocument(handler);
    // workspace.textDocuments.forEach(handler);
    // workspace.onDidChangeWorkspaceFolders((event) => {
    //     for (const folder of event.removed) {
    //         const client = mlsWorkspaceClients.get(folder);
    //         if (client) {
    //             mlsWorkspaceClients.delete(folder);
    //             client.stop();
    //         }
    //     }
    // });

    // Do the same for autocompletion server
    // workspace.onDidOpenTextDocument(autocompleteDidOpenTextDocument);
    // workspace.textDocuments.forEach(autocompleteDidOpenTextDocument);
    // workspace.onDidChangeWorkspaceFolders((event) => {
    //     for (const folder of event.removed) {
    //         const client = autocompleteWorkspaceClients.get(folder);
    //         if (client) {
    //             autocompleteWorkspaceClients.delete(folder);
    //             client.stop();
    //         }
    //     }
    // });
}

// this method is called when your extension is deactivated
export async function deactivate() {
    const clients = [
        ...mlsWorkspaceClients.values(),
        ...autocompleteWorkspaceClients.values(),
    ];
    for (const client of clients) {
        await client.stop();
    }
    // return Promise.all([
    //     Array.from(mlsWorkspaceClients.entries())
    //         .map(([, client]) => client.stop())
    //         .reduce((chain, prom) => chain.then(() => prom), Promise.resolve()),
    //
    //     Array.from(autocompleteWorkspaceClients.entries())
    //         .map(([, client]) => client.stop())
    //         .reduce((chain, prom) => chain.then(() => prom), Promise.resolve()),
    // ]);
}
