import * as lc from 'vscode-languageclient/node';
import {
    LanguageClient,
    NodeModule,
    ServerOptions,
    TransportKind,
} from 'vscode-languageclient/node';
import * as vscode from 'vscode';
import { Uri } from 'vscode';
import { ExtensionSettings } from './settings';
import { log } from './util';

export interface MoveLanguageServerInitOpts {
    dialect: 'polkadot' | 'libra' | 'dfinance';
    modules_folders: string[];
    stdlib_folder: string | undefined | null;
    sender_address: string | undefined | null;
}

export function createLanguageServerClient(
    languageServerPath: string,
    folder: vscode.WorkspaceFolder,
    serverInitOpts: MoveLanguageServerInitOpts
): lc.LanguageClient {
    const projectRoot = folder.uri.fsPath;
    const serverExecutable: lc.Executable = {
        command: languageServerPath,
        options: { cwd: projectRoot, env: { RUST_LOG: 'info' } },
    };
    const serverOptions: lc.ServerOptions = {
        run: serverExecutable,
        debug: serverExecutable,
    };
    if (ExtensionSettings.logTrace) {
        log.debug(
            `Starting language server with configuration: ${JSON.stringify(serverInitOpts)}`
        );
    }
    const clientOptions: lc.LanguageClientOptions = {
        documentSelector: [
            {
                scheme: 'file',
                language: 'move',
                pattern: projectRoot + '/**/*',
            },
        ],
        initializationOptions: serverInitOpts,
        workspaceFolder: folder,
    };
    return new lc.LanguageClient(
        'move-language-server',
        `Move LS: ${projectRoot}`,
        serverOptions,
        clientOptions
    );
}

export function createAutocompleteServerClient(
    extensionUri: Uri,
    folder: vscode.WorkspaceFolder,
    serverInitOpts: MoveLanguageServerInitOpts
) {
    const projectRoot = folder.uri.fsPath;
    const autocompleteServerUri = Uri.joinPath(
        extensionUri,
        'dist',
        'completion',
        'server.js'
    );
    const jsModule = autocompleteServerUri.fsPath;

    const serverOptions: ServerOptions = {
        run: <NodeModule>{ module: jsModule, transport: TransportKind.ipc },
        debug: <NodeModule>{
            module: jsModule,
            transport: TransportKind.ipc,
            options: { execArgv: ['--nolazy', '--inspect=6009'] },
        },
    };

    const traceOutputChannel = vscode.window.createOutputChannel('move-autocompletion-server');
    const clientOptions: lc.LanguageClientOptions = {
        documentSelector: [
            {
                scheme: 'file',
                language: 'move',
                pattern: projectRoot + '/**/*',
            },
        ],
        traceOutputChannel,
        synchronize: {},
        initializationOptions: Object.assign(serverInitOpts, {
            extensionPath: extensionUri.fsPath,
        }),
        workspaceFolder: folder,
    };
    return new LanguageClient(
        'move-autocompletion-server',
        'Move Autocompletion Server',
        serverOptions,
        clientOptions
    );
}
