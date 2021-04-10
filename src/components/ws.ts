import * as vscode from 'vscode';
import { Disposable, workspace } from 'vscode';
import { Dove } from './dove';
import { createAutocompleteServerClient, createLanguageServerClient } from './client';
import { assert, isMoveEditor, log } from './util';
import { activateTaskProvider } from './tasks';
import { ExtensionSettings } from './settings';

export class ClientWorkspaceFactory implements Disposable {
    /**
     * Tracks the most current VSCode workspace as opened by the user. Used by the
     * commands to know in which workspace these should be executed.
     */
    activeWorkspace: ClientWorkspace | null = null;

    // Don't use URI as it's unreliable the same path might not become the same URI.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    private readonly workspaces: Map<vscode.WorkspaceFolder, ClientWorkspace>;

    constructor(
        private readonly extensionContext: vscode.ExtensionContext,
        private readonly settings: ExtensionSettings,
        private readonly doveExecutable: string,
        private readonly languageServerExecutable: string
    ) {
        this.workspaces = new Map();
    }

    async initClientWorkspace(editor: vscode.TextEditor | undefined) {
        if (!editor || !editor.document) return;

        const folder = workspace.getWorkspaceFolder(editor.document.uri);
        if (!folder) return;

        let ws = this.workspaces.get(folder);
        if (!ws && isMoveEditor(editor)) {
            ws = new ClientWorkspace(
                folder,
                this.extensionContext,
                this.settings,
                this.languageServerExecutable
            );
            const dove = new Dove(this.doveExecutable, this.settings.traceExtension);
            await ws.start(dove);
        }
        if (ws) {
            this.activeWorkspace = ws;
        }
    }

    dispose() {
        return Promise.all([...this.workspaces.values()].map((ws) => ws.dispose()));
    }
}

// We run a single server/client pair per workspace folder.
// This class contains all the per-client and per-workspace stuff.
export class ClientWorkspace implements Disposable {
    private readonly disposables: Disposable[];

    constructor(
        readonly folder: vscode.WorkspaceFolder,
        private readonly extensionContext: vscode.ExtensionContext,
        private readonly settings: ExtensionSettings,
        private readonly languageServerPath: string
    ) {
        this.disposables = [];
    }

    async start(dove: Dove | undefined) {
        if (this.settings.traceExtension)
            log.debug(
                `Starting new ClientWorkspace instance at ${this.folder.uri.toString()}`
            );
        assert(dove !== undefined, 'Dove could not be available, not yet implemented');

        const metadata = await dove.metadata(this.folder);
        if (!metadata) return;

        const client = createLanguageServerClient(
            this.languageServerPath,
            this.folder,
            metadata
        );
        this.disposables.push(client.start());

        const autocompleteClient = createAutocompleteServerClient(
            this.extensionContext.extensionUri,
            this.folder,
            metadata
        );
        this.disposables.push(autocompleteClient.start());

        if (dove) {
            this.disposables.push(activateTaskProvider(this.folder, dove.executable));
        }
    }

    dispose(): any {
        if (this.settings.traceExtension)
            log.debug(`Stopping ClientWorkspace instance at ${this.folder.uri.toString()}`);

        this.disposables.forEach((d) => void d.dispose());
    }
}
