import * as lc from 'vscode-languageclient/node';
import * as vscode from 'vscode';
import { Uri, workspace } from 'vscode';
import { Metadata } from '../components/metadata';

export interface MoveLanguageServerInitOpts {
    dialect: string;
    modules_folders: string[];
    stdlib_folder: string | undefined | null;
    sender_address: string | undefined | null;
}

function metadataToInitializationOptions(metadata: Metadata): MoveLanguageServerInitOpts {
    const module_folders: string[] = [];
    for (const local_dep of metadata.package.local_dependencies) {
        module_folders.push(local_dep.path);
    }
    module_folders.push(metadata.layout.module_dir);

    return {
        dialect: 'libra',
        modules_folders: module_folders,
        sender_address: '0x2',
        stdlib_folder: null,
    };
}

export function createLanguageClient(
    languageServerPath: string,
    projectRoot: Uri,
    metadata: Metadata
): lc.LanguageClient {
    const serverExecutable: lc.Executable = {
        command: languageServerPath,
        options: { cwd: projectRoot.fsPath, env: { RUST_LOG: 'info' } },
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
                pattern: projectRoot.fsPath + '/**/*',
            },
        ],
        outputChannel: traceOutputChannel,
        initializationOptions: metadataToInitializationOptions(metadata),
        workspaceFolder: workspace.getWorkspaceFolder(projectRoot),
    };
    const client = new lc.LanguageClient(
        'move-language-server',
        'Move Language Server',
        serverOptions,
        clientOptions
    );
    client.start();
    return client;
}
