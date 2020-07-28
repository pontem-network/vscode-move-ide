/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import {
	createConnection,
	TextDocuments,
	Diagnostic,
	DiagnosticSeverity,
    ProposedFeatures,
    Proposed,
	InitializeParams,
	DidChangeConfigurationNotification,
	CompletionItem,
	CompletionItemKind,
	TextDocumentPositionParams,
	TextDocumentSyncKind,
	InitializeResult,
    DidChangeTextDocumentParams,
    HoverParams,
    ServerRequestHandler,
    CancellationToken,
    Hover
} from 'vscode-languageserver';

import {
    TextDocument,
    DocumentUri
} from 'vscode-languageserver-textdocument';

import {  } from 'vscode';

import * as Parser from 'web-tree-sitter';
import { parse } from 'path';

import {
    MoveFile,
    MoveImport,
    MoveFunction,
    MoveModule
} from './parser'
import { connect } from 'http2';

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
let connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
let documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability: boolean = false;
let hasWorkspaceFolderCapability: boolean = false;
let hasDiagnosticRelatedInformationCapability: boolean = false;

let parser: Parser;

connection.onInitialize(async (params: InitializeParams) => {
	let capabilities = params.capabilities;

	// Does the client support the `workspace/configuration` request?
	// If not, we fall back using global settings.
	hasConfigurationCapability = !!(
		capabilities.workspace && !!capabilities.workspace.configuration
	);

    hasWorkspaceFolderCapability = !!(
		capabilities.workspace && !!capabilities.workspace.workspaceFolders
    );

	hasDiagnosticRelatedInformationCapability = !!(
		capabilities.textDocument &&
		capabilities.textDocument.publishDiagnostics &&
		capabilities.textDocument.publishDiagnostics.relatedInformation
    );

	const result: InitializeResult = {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Incremental,
			// Tell the client that this server supports code completion.
			completionProvider: {
				resolveProvider: true
            }
            // hoverProvider : true
		}
	};
	if (hasWorkspaceFolderCapability) {
		result.capabilities.workspace = {
			workspaceFolders: {
				supported: true
			}
		};
    }

    await Parser.init()
        .then(() => Parser.Language.load('/Users/damn/projects/dfinance/move/vscode-move-ide/parsers/tree-sitter-move.wasm'))
        .then((Move) => {
            parser = new Parser();
            connection.console.log('PARSER READY');
            return parser.setLanguage(Move)
        });

	return result;
});

connection.onInitialized(() => {

    connection.console.log('INITIALIZED');

	if (hasConfigurationCapability) {
		// Register for all configuration changes.
		connection.client.register(DidChangeConfigurationNotification.type, undefined);
	}
	if (hasWorkspaceFolderCapability) {
		connection.workspace.onDidChangeWorkspaceFolders(_event => {
			connection.console.log('Workspace folder change event received.');
		});
	}
});

// The example settings
interface ExampleSettings {
	maxNumberOfProblems: number;
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings: ExampleSettings = { maxNumberOfProblems: 1000 };
let globalSettings: ExampleSettings = defaultSettings;

// Cache the settings of all open documents
let documentSettings: Map<string, Thenable<ExampleSettings>> = new Map();

connection.onDidChangeConfiguration(change => {
	if (hasConfigurationCapability) {
		// Reset all cached document settings
		documentSettings.clear();
	} else {
		globalSettings = <ExampleSettings>(
			(change.settings.languageServerExample || defaultSettings)
		);
	}

	// Revalidate all open text documents
	documents.all().forEach(validateTextDocument);
});

function getDocumentSettings(resource: string): Thenable<ExampleSettings> {
	if (!hasConfigurationCapability) {
		return Promise.resolve(globalSettings);
	}
	let result = documentSettings.get(resource);
	if (!result) {
		result = connection.workspace.getConfiguration({
			scopeUri: resource,
			section: 'move'
		});
		documentSettings.set(resource, result);
	}
	return result;
}

// Only keep settings for open documents
// documents.onDidClose(
//     ({document}) => {

//         connection.console.log('DOCUMENT HAS BEEN CLOSED');

//         documentSettings.delete(document.uri);
//     }
// );

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(
    ({document}) => {

        connection.console.log('CHANGE: ' + document.uri);
        connection.console.log('LIST: ' + JSON.stringify([...trackedFiles.keys()]));

        connection.console.log(document.getText());

        let parsed = trackedFiles.get(document.uri)?.parse(parser, document.getText());

        if (parsed) {
            connection.console.log('SUCCESS!     \n' + parsed.length);
        } else {
            connection.console.log('UNABLE TO PARSE????')
        }

        connection.console.log('RESULT: ' + JSON.stringify(parsed));
    }
);

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
	// In this simple example we get the settings for every validate run.
	// let settings = await getDocumentSettings(textDocument.uri);

	// // The validator creates diagnostics for all uppercase words length 2 and more
	// let text = textDocument.getText();
	// let pattern = /\b[A-Z]{2,}\b/g;
	// let m: RegExpExecArray | null;

	// let problems = 0;
	// let diagnostics: Diagnostic[] = [];
	// while ((m = pattern.exec(text)) && problems < settings.maxNumberOfProblems) {
	// 	problems++;
	// 	let diagnostic: Diagnostic = {
	// 		severity: DiagnosticSeverity.Warning,
	// 		range: {
	// 			start: textDocument.positionAt(m.index),
	// 			end: textDocument.positionAt(m.index + m[0].length)
	// 		},
	// 		message: `${m[0]} is all uppercase.`,
	// 		source: 'ex'
	// 	};
	// 	if (hasDiagnosticRelatedInformationCapability) {
	// 		diagnostic.relatedInformation = [
	// 			{
	// 				location: {
	// 					uri: textDocument.uri,
	// 					range: Object.assign({}, diagnostic.range)
	// 				},
	// 				message: 'Spelling matters'
	// 			},
	// 			{
	// 				location: {
	// 					uri: textDocument.uri,
	// 					range: Object.assign({}, diagnostic.range)
	// 				},
	// 				message: 'Particularly for names'
	// 			}
	// 		];
	// 	}
	// 	diagnostics.push(diagnostic);
	// }

	// // Send the computed diagnostics to VSCode.
	// connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

connection.onDidChangeWatchedFiles(_change => {
	// Monitored files have change in VSCode
	connection.console.log('We received an file change event');
});

// This handler provides the initial list of the completion items.
connection.onCompletion(
	({textDocument, position}: TextDocumentPositionParams): CompletionItem[] => {

        const document = documents.get(textDocument.uri);
        const text     = document?.getText();

        if (!text) {
            return [];
        }

        // @ts-ignore
        // connection.console.log(
        //     JSON.stringify(
        //         parser.parse(text).rootNode.descendantForPosition({
        //             row: position.line,
        //             column: position.character
        //         }).toString()
        //     )
        // );


        // The pass parameter contains the position of the text document in
		// which code complete got requested. For the example we ignore this
		// info and always provide the same completion items.
		return [
			{
				label: 'TypeScript',
				kind: CompletionItemKind.Text,
				data: 1
			},
			{
				label: 'JavaScript',
				kind: CompletionItemKind.Text,
				data: 2
			}
		];
	}
);

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve(
	(item: CompletionItem): CompletionItem => {
		if (item.data === 1) {
			item.detail = 'TypeScript details';
			item.documentation = 'TypeScript documentation';
		} else if (item.data === 2) {
			item.detail = 'JavaScript details';
			item.documentation = 'JavaScript documentation';
		}
		return item;
	}
);

const trackedFiles: Map<string, MoveFile> = new Map();

documents.onDidOpen(
    ({document}) => {
        trackedFiles.set(document.uri, new MoveFile(parser, document.uri));
        connection.console.log('OPENED: ' + document.uri);
    }
);

documents.onDidClose(
    ({document}) => {
        trackedFiles.delete(document.uri);
        connection.console.log('CLOSED: ' + document.uri);
    }
);


// connection.onDidOpenTextDocument(
//     ({textDocument}) => {
//         // A text document got opened in VS Code.
//         // params.uri uniquely identifies the document. For documents store on disk this is a file URI.
//         // params.text the initial full content of the document.


//         connection.console.log('TEXT DOCUMENT OPENED  ' + textDocument.uri);
//         // here we'll parse files' inputs and create a source map.
//         // let's first parse use {} blocks and get address from them.
//         // if address matches
//         trackedFiles.set(textDocument.uri, new MoveFile(parser, textDocument.text));

//     }
// );

// connection.onDidChangeTextDocument(
//     ({textDocument, contentChanges}) => {
//         // The content of a text document did change in VS Code.
//         // params.uri uniquely identifies the document.
//         // params.contentChanges describe the content changes to the document.

//         connection.console.log('TEXT DOCUMENT CHANGED');

//         connection.console.log('REPARSING MODULE');

//         let parsed = trackedFiles.get(textDocument.uri)?.parse();

//         if (parsed) {
//             connection.console.log('SUCCESS!     \n' + JSON.stringify(parsed));
//         } else {
//             connection.console.log('UNABLE TO PARSE????')
//         }



//     }
// );

// connection.onDidCloseTextDocument(
//     ({textDocument}) => {
//         // A text document got closed in VS Code.
//         // params.uri uniquely identifies the document.

//         connection.console.log('TEXT DOCUMENT CLOSED');

//         trackedFiles.delete(textDocument.uri);
//         connection.console.log('TRACKED FILES: ' + trackedFiles.size);
//     }
// );

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
