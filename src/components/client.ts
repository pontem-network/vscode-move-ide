import * as lc from 'vscode-languageclient/node';
import {
    LanguageClient,
    NodeModule,
    ServerOptions,
    TransportKind,
} from 'vscode-languageclient/node';
import * as vscode from 'vscode';
import { Uri } from 'vscode';
import { Metadata } from './metadata';

export interface MoveLanguageServerInitOpts {
    dialect: string;
    modules_folders: string[];
    stdlib_folder: string | undefined | null;
    sender_address: string | undefined | null;
}

function getServerInitOpts(metadata: Metadata): MoveLanguageServerInitOpts {
    const module_folders: string[] = [];
    for (const local_dep of metadata.package.local_dependencies) {
        module_folders.push(local_dep.path);
    }
    module_folders.push(metadata.layout.module_dir);

    return {
        dialect: 'libra',
        modules_folders: module_folders,
        sender_address: metadata.package.account_address,
        stdlib_folder: null,
    };
}

export function createLanguageServerClient(
    languageServerPath: string,
    folder: vscode.WorkspaceFolder,
    metadata: Metadata
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
    const traceOutputChannel = vscode.window.createOutputChannel('move-language-server');

    const clientOptions: lc.LanguageClientOptions = {
        documentSelector: [
            {
                scheme: 'file',
                language: 'move',
                pattern: projectRoot + '/**/*',
            },
        ],
        outputChannel: traceOutputChannel,
        initializationOptions: getServerInitOpts(metadata),
        workspaceFolder: folder,
    };
    return new lc.LanguageClient(
        'move-language-server',
        'Move Language Server',
        serverOptions,
        clientOptions
    );
}

export function createAutocompleteServerClient(
    extensionUri: Uri,
    folder: vscode.WorkspaceFolder,
    metadata: Metadata
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
        outputChannel: traceOutputChannel,
        synchronize: {},
        initializationOptions: Object.assign(getServerInitOpts(metadata), {
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
