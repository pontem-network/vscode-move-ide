import * as vscode from 'vscode';
import { Disposable, Uri, workspace } from 'vscode';
import { Dove, getServerInitOptsFromMetadata } from './dove';
import {
    createAutocompleteServerClient,
    createLanguageServerClient,
    MoveLanguageServerInitOpts,
} from './client';
import { isMoveEditor, log, uriExists } from './util';
import { activateTaskProvider } from './tasks';
import { ExtensionSettings } from './settings';

async function isDoveInitializedProject(folder: vscode.WorkspaceFolder): Promise<boolean> {
    const tomlFileUri = Uri.joinPath(folder.uri, 'Dove.toml');
    return uriExists(tomlFileUri);
}

export class ClientWorkspaceFactory implements Disposable {
    /**
     * Tracks the most current VSCode workspace as opened by the user. Used by the
     * commands to know in which workspace these should be executed.
     */
    activeWorkspace: ClientWorkspace | null = null;

    // Don't use URI as it's unreliable the same path might not become the same URI.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    private readonly workspaces: Map<vscode.WorkspaceFolder, ClientWorkspace> = new Map();

    constructor(
        private readonly extensionContext: vscode.ExtensionContext,
        private readonly doveExecutable: string,
        private readonly languageServerExecutable: string
    ) {}

    async initClientWorkspace(editor: vscode.TextEditor | undefined) {
        if (!editor || !editor.document) return;

        const folder = workspace.getWorkspaceFolder(editor.document.uri);
        if (!folder) return;

        let ws = this.workspaces.get(folder);
        if (!ws && isMoveEditor(editor)) {
            ws = new ClientWorkspace(
                folder,
                this.extensionContext,
                this.languageServerExecutable
            );
            this.workspaces.set(folder, ws);

            let dove: Dove | undefined = undefined;
            if (await isDoveInitializedProject(folder)) {
                dove = new Dove(this.doveExecutable, ExtensionSettings.logTrace);
            }
            await ws.start(dove);
        }
        if (ws) {
            this.activeWorkspace = ws;
        }
    }

    dispose() {
        if (ExtensionSettings.logTrace) {
            log.debug('Disposing ClientWorkspaceFactory');
        }
        return Disposable.from(...this.workspaces.values()).dispose();
    }
}

// We run a single server/client pair per workspace folder.
// This class contains all the per-client and per-workspace stuff.
export class ClientWorkspace implements Disposable {
    private readonly disposables: Disposable[] = [];

    constructor(
        readonly folder: vscode.WorkspaceFolder,
        private readonly extensionContext: vscode.ExtensionContext,
        private readonly languageServerPath: string
    ) {}

    async start(dove: Dove | undefined) {
        if (ExtensionSettings.logTrace)
            log.debug(
                `Starting new ClientWorkspace instance at ${this.folder.uri.toString()}`
            );

        let serverInitOpts: MoveLanguageServerInitOpts;
        if (dove !== undefined) {
            const metadata = await dove.metadata(this.folder);
            if (!metadata) return;
            serverInitOpts = getServerInitOptsFromMetadata(metadata);
        } else {
            serverInitOpts = {
                dialect: ExtensionSettings.blockchainDialect,
                modules_folders: ExtensionSettings.modulePaths,
                sender_address: ExtensionSettings.accountAddress,
                stdlib_folder: null,
            };
        }

        const client = createLanguageServerClient(
            this.languageServerPath,
            this.folder,
            serverInitOpts
        );
        this.disposables.push(client.start());

        if (ExtensionSettings.autocomplete) {
            const autocompleteClient = createAutocompleteServerClient(
                this.extensionContext.extensionUri,
                this.folder,
                serverInitOpts
            );
            this.disposables.push(autocompleteClient.start());
        }

        if (dove !== undefined) {
            this.disposables.push(activateTaskProvider(this.folder, dove.executable));
        }
    }

    async dispose(): Promise<any> {
        if (ExtensionSettings.logTrace)
            log.debug(
                `Disposing ClientWorkspace instance for "${this.folder.uri.toString()}"`
            );

        return Disposable.from(...this.disposables).dispose();
    }
}
