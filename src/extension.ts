import * as fs from 'fs';
import * as cp from 'child_process';
import * as path from 'path';

import {
    extensions,
    ExtensionContext,
    commands,
    workspace,
    TextDocument
} from 'vscode';

import {compileCommand} from './commands/compile';
import {runScriptCommand} from './commands/run.script';

import {
    didOpenTextDocument,
    workspaceClients
} from './components/autocomplete';

// @ts-ignore
export const EXTENSION_PATH = extensions.getExtension('damirka.move-ide').extensionPath;

/**
 * Activate extension: register commands, attach handlers
 * @param {vscode.ExtensionContext} context
 */
export async function activate(context: ExtensionContext) {

    // Somewhy on Win32 process.platform is detected incorrectly when run from
    // npm postinstall script. So on Win32, on activate event, extension will
    // check whether /bin has .exe files; if there are - action skipped; and if
    // not - then download-binaries script is run again;
    // I hope there is a better fix for this or proper way to do it. :confused:
    if (process.platform === 'win32') {
        let files = fs.readdirSync(path.join(context.extensionPath, 'bin'));
        if (files.filter((file) => file.endsWith('.exe')).length === 0) {
            cp.fork('download-binaries.js', [], {
                cwd: context.extensionPath,
                env: { PLATFORM: 'win32' }
            });
        }
    }

    context.subscriptions.push(
        commands.registerCommand('move.compile', () => compileCommand().catch(console.error)),
        commands.registerCommand('move.run',   () => runScriptCommand().catch(console.error))
    );

	workspace.onDidOpenTextDocument(didOpenTextDocument);
	workspace.textDocuments.forEach(didOpenTextDocument);
	workspace.onDidChangeWorkspaceFolders((event) => {
		for (const folder of event.removed) {
			const client = workspaceClients.get(folder);
			if (client) {
				workspaceClients.delete(folder);
				client.stop();
			}
		}
    });
}

// this method is called when your extension is deactivated
export function deactivate() {
	return Array.from(workspaceClients.entries())
		.map(([, client]) => client.stop())
		.reduce((chain, prom) => chain.then(() => prom), Promise.resolve());
}

export function checkDocumentLanguage(document: TextDocument, languageId: string) {
	if (document.languageId !== languageId || (document.uri.scheme !== 'file' && document.uri.scheme !== 'untitled')) {
		return false;
	}

	return true;
}
