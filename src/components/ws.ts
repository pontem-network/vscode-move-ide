import * as vscode from 'vscode';
import { Disposable, Uri, workspace } from 'vscode';
import * as lc from 'vscode-languageclient/node';
import { Dove, getServerInitOptsFromMetadata } from './dove';
import { createAutocompleteServerClient, createLanguageServerClient } from './client';
import { isMoveEditor, log, uriExists } from './util';
import { activateTaskProvider } from './tasks';
import { ExtensionSettings } from './settings';
import { bootstrap } from './bootstrap';
import { PersistentState } from './persistent_state';

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
    private doveExecutable: string | null = null;
    private languageServerExecutable: string | null = null;

    constructor(
        private readonly extensionContext: vscode.ExtensionContext,
        private readonly state: PersistentState
    ) {}

    async initClientWorkspace(editor: vscode.TextEditor | undefined) {
        if (!editor || !editor.document) return;

        const folder = workspace.getWorkspaceFolder(editor.document.uri);
        if (!folder) return;

        if (!(await isDoveInitializedProject(folder))) {
            log.debug(`Not a Dove project root: ${folder.uri.fsPath}`);
            return;
        }

        if (this.doveExecutable == null || this.languageServerExecutable == null) {
            const execs = await bootstrap(this.extensionContext, this.state);

            this.doveExecutable = execs.doveExecutablePath;
            log.debug(`Set ClientWorkspaceFactory.doveExecutable to ${this.doveExecutable}`);

            this.languageServerExecutable = execs.languageServerPath;
            log.debug(
                `Set ClientWorkspaceFactory.languageServerExecutable to ${this.languageServerExecutable}`
            );
        }

        log.debug(`initClientWorkspace called inside ${folder.uri.fsPath}`);
        let ws = this.workspaces.get(folder);
        if (!ws && isMoveEditor(editor)) {
            ws = new ClientWorkspace(
                folder,
                this.extensionContext,
                this.languageServerExecutable
            );
            this.workspaces.set(folder, ws);

            const dove = new Dove(this.doveExecutable);
            // let dove: Dove | undefined = undefined;
            // if (await isDoveInitializedProject(folder)) {
            //     dove = new Dove(this.doveExecutable, ExtensionSettings.logTrace);
            // }
            await ws.start(dove);
        }
        if (ws) {
            this.activeWorkspace = ws;
        }
    }

    dispose() {
        log.debug('Disposing ClientWorkspaceFactory');
        return Promise.all([...this.workspaces.values()].map((ws) => ws.stop()));
    }
}

// We run a single server/client pair per workspace folder.
// This class contains all the per-client and per-workspace stuff.
export class ClientWorkspace {
    private readonly disposables: Disposable[] = [];
    private readonly languageClients: lc.LanguageClient[] = [];

    constructor(
        readonly folder: vscode.WorkspaceFolder,
        private readonly extensionContext: vscode.ExtensionContext,
        private readonly languageServerPath: string
    ) {}

    async start(dove: Dove) {
        log.debug(`Starting new ClientWorkspace instance at ${this.folder.uri.toString()}`);

        const metadata = await dove.metadata(this.folder);
        if (!metadata) return;

        // if (dove !== undefined) {
        // } else {
        //     serverInitOpts = {
        //         dialect: ExtensionSettings.blockchainDialect,
        //         modules_folders: ExtensionSettings.modulePaths,
        //         sender_address: ExtensionSettings.accountAddress,
        //         stdlib_folder: null,
        //     };
        // }

        const serverInitOpts = getServerInitOptsFromMetadata(metadata);
        const client = createLanguageServerClient(
            this.languageServerPath,
            this.folder,
            serverInitOpts
        );
        this.languageClients.push(client);
        this.disposables.push(client.start());

        if (ExtensionSettings.autocomplete) {
            const autocompleteClient = createAutocompleteServerClient(
                this.extensionContext.extensionUri,
                this.folder,
                serverInitOpts
            );
            this.languageClients.push(autocompleteClient);
            this.disposables.push(autocompleteClient.start());
        }

        this.disposables.push(activateTaskProvider(this.folder, dove.executable));
        // if (dove !== undefined) {
        //     this.disposables.push(activateTaskProvider(this.folder, dove.executable));
        // }
    }

    async stop(): Promise<any> {
        log.debug(`Stopping language clients for "${this.folder.uri.toString()}"`);
        for (const client of this.languageClients) {
            await client.stop();
        }

        log.debug(`Disposing ClientWorkspace for "${this.folder.uri.toString()}"`);
        this.disposables.forEach((d) => void d.dispose());
    }
}
