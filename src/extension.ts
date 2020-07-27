import * as fs from 'fs';
import * as cp from 'child_process';
import * as path from 'path';

import {
    ExtensionContext,
    commands,
    workspace,
    TextDocument
} from 'vscode';

import * as lsp from 'vscode-languageclient';

import {loadConfig} from './components/config';
import {compileCommand} from './commands/compile';
import {runScriptCommand} from './commands/run.script';

import {
    didOpenTextDocument,
    workspaceClients,
    configToLsOptions
} from './components/mls';

// @ts-ignore
export const EXTENSION_PATH = vscode.extensions.getExtension('damirka.move-ide').extensionPath;

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

	// subscribe to .mvconfig.json changes
	workspace.onDidSaveTextDocument(function onDidSaveConfiguration(document: TextDocument) {

		if (!checkDocumentLanguage(document, 'json')) {
			return;
		}

		const config = workspace.getConfiguration('move', document.uri);
		const file   = config.get<string>('configPath') || '.mvconfig.json';

		if (!document.fileName.includes(file)) {
			return;
		}

		try {
			JSON.parse(document.getText()); // check if file is valid JSON
		} catch (e) {
			return;
		}

		const folder = workspace.getWorkspaceFolder(document.uri);
		// @ts-ignore
		const client = workspaceClients.get(folder);

		if (!client || client.constructor !== lsp.LanguageClient) {
			return;
		}

		const finConfig = loadConfig(document);

		client.sendNotification('workspace/didChangeConfiguration', { settings: "" });
		client.onRequest('workspace/configuration', () => configToLsOptions(finConfig));
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
