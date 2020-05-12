'use strict';

const fs     = require('fs');
const path   = require('path');
const vscode = require('vscode');
const cp     = require('child_process');
const lsp 	 = require('vscode-languageclient');

let extensionPath;

const workspace = vscode.workspace;
const workspaceClients = new Map();

/**
 * Activate extension: register commands, attach handlers
 * @param {vscode.ExtensionContext} context
 */
async function activate(context) {

	context.subscriptions.push(
		vscode.commands.registerCommand('extension.compile', (...args) => compileCommand(...args).catch(console.error))
	);

	extensionPath = context.extensionPath;
	const outputChannel = vscode.window.createOutputChannel('move-language-server');

	function didOpenTextDocument(document) {

		if (document.languageId !== 'move' || (document.uri.scheme !== 'file' && document.uri.scheme !== 'untitled')) {
			return;
		}

		const folder  = workspace.getWorkspaceFolder(document.uri);

		if (workspaceClients.has(folder)) {
			console.log('LANGUAGE SERVER ALREADY STARTED');
			return;
		}

		const executable    = (process.platform === 'win32') ? 'move-ls.exe' : 'move-ls';
		const binaryPath    = path.join(extensionPath, 'bin', executable);
		const lspExecutable = {
			command: binaryPath,
			options: { env: { RUST_LOG: 'info' } },
		};

		const serverOptions = {
			run:   lspExecutable,
			debug: lspExecutable,
		};

		const config = loadConfig(document);
		const clientOptions = {
			outputChannel,
			workspaceFolder: folder,
			documentSelector: [{ scheme: 'file', language: 'move', pattern: folder.uri.fsPath + '/**/*' }],
			initializationOptions: configToLsOptions(config)
		};

		console.log('RUNNING SERVER FOR %s', folder.uri.path);

		const client = new lsp.LanguageClient('move-language-server', 'Move Language Server', serverOptions, clientOptions);

		client.start();

		workspaceClients.set(folder, client);
	}

	workspace.onDidOpenTextDocument(didOpenTextDocument);
	workspace.textDocuments.forEach(didOpenTextDocument);
	workspace.onDidChangeWorkspaceFolders((event) => {
		for (let folder  of event.removed) {
			let client = clients.get(folder.uri.toString());
			if (client) {
				clients.delete(folder.uri.toString());
				client.stop();
			}
		}
	});

	// subscribe to .mvconfig.json changes
	vscode.workspace.onDidSaveTextDocument((document) => {

		if (document.languageId !== 'json' || (document.uri.scheme !== 'file' && document.uri.scheme !== 'untitled')) {
			return;
		}

		const config = workspace.getConfiguration('move', document.uri);
		const file   = config.get('configPath');

		if (!document.fileName.includes(file)) {
			return;
		}

		try {
			JSON.parse(document.getText()); // check if file is valid JSON
		} catch (e) {
			return;
		}

		const folder = workspace.getWorkspaceFolder(document.uri);
		const client = workspaceClients.get(folder);

		if (!client || client.constructor !== lsp.LanguageClient) {
			return;
		}

		const finConfig = loadConfig(document);

		client.sendNotification('workspace/didChangeConfiguration', { settings: "" });
		client.onRequest('workspace/configuration', () => configToLsOptions(finConfig));
	});
}

function configToLsOptions(config) {
	const modules_folders = [];

	if (config.modulesPath) {
		modules_folders.push(config.modulesPath);
	}

	return {
		modules_folders,
		dialect: config.network,
		stdlib_folder: config.stdlibPath,
		sender_address:  config.defaultAccount,
	};
}

/**
 * Command: Move: Compile file
 *
 * @return {Promise}
 */
async function compileCommand() {

	if (!['mvir', 'move'].includes(vscode.window.activeTextEditor.document.languageId)) {
		return vscode.window.showErrorMessage('Only .move and .mvir files are supported');
	}

	const active = vscode.window.activeTextEditor.document;
	const config = loadConfig(active);
	let account  = config.defaultAccount || null;

	// check if account has been preset
	if (account === null) {
		const input = vscode.window.createInputBox();
		input.title = 'Enter account from which you\'re going to deploy this script (or set it in config)';
		input.show();
		input.onDidAccept(() => (account = input.value) && input.hide());
	}

	const currPath  = currentPath();
	const outFolder = path.join(currPath.folder, config.compilerDir);
	const text      = vscode.window.activeTextEditor.document.getText();

	checkCreateOutDir(outFolder);

	switch (config.network) {
		case 'dfinance': return compileDfinance(account, text, currPath, config);
		case 'libra': 	 return compileLibra(account, text, currPath, config);
		default: vscode.window.showErrorMessage('Unknown Move network in config: only libra and dfinance supported');
	}
}

function compileLibra(account, text, {file, folder}, config) {

	if (vscode.window.activeTextEditor.document.languageId !== 'move') {
		return vscode.window.showErrorMessage('Only Move is supported for Libra compiler');
	}

	const bin  = path.join(extensionPath, 'bin', 'move-build');
	const args = [
		,
		'--out-dir', path.join(folder, config.compilerDir),
		'--source-files', file,
		'--sender', account
	];

	if (config.stdlibPath) {
		args.push('--dependencies', config.stdlibPath + '/*',);
	}

	const successMsg = 'File successfully compiled and saved in directory: ' + config.compilerDir;

	return exec(bin + args.join(' '))
		.then(() => vscode.window.showInformationMessage(successMsg, {modal: true}))
		.catch((stderr) => vscode.window.showErrorMessage(stderr, {modal: config.showModal || false}));
}

function compileDfinance(account, text, {file, folder}, config) {

	const targetName = path.basename(file).split('.').slice(0, -1).join('.') + '.mv.json';
	const targetPath = path.join(folder, config.compilerDir, targetName);
	const isModule   = /module\s+[A-Za-z0-9_]+[\s\n]+\{/mg.test(text); // same regexp is used in grammar

	// finally prepare cmd for execution
	const cmd  = isModule ? 'compile-module' : 'compile-script';
	const args = [
		cmd, file, account,
		'--to-file', targetPath,
		'--compiler', config.compiler
	];

	return exec('dncli query vm ' + args.join(' '))
		.then((stdout)  => vscode.window.showInformationMessage(stdout, {modal: config.showModal || false}))
		.catch((stderr) => vscode.window.showErrorMessage(stderr, {modal: config.showModal || false}));
}

// this method is called when your extension is deactivated
function deactivate() {
	return [...workspaceClients]
		.map((client) => client.stop())
		.reduce((chain, prom) => chain.then(prom), Promise.resolve());
}

/**
 * Get absolute path to current file and workspace folder
 *
 * @return    {Object}  path
 * @property  {String}  path.file    Absolute path to current file
 * @property  {String}  path.folder  Absolute path to current workdir
 */
function currentPath() {
	const file   = vscode.window.activeTextEditor.document.fileName;
	const folder = workspace.workspaceFolders
		.map(({uri}) => uri.fsPath)
		.find((path) => file.includes(path));

	return {file, folder};
}

/**
 * Try to load local config. If non existent - use VSCode settings for this
 * extension.
 *
 * @param  {TextDocument} document File for which to load configuration
 * @return {Object}  			   Configuration object
 */
function loadConfig(document) {

	// quick hack to make it extensible. church!
	const cfg 	    = Object.assign({}, workspace.getConfiguration('move', document.uri));
	const folder    = workspace.getWorkspaceFolder(document.uri).uri.path;
	const localPath = path.join(folder, cfg.configPath);

	// check if local config exists
	if (fs.existsSync(localPath)) {
		try {
			Object.assign(cfg, JSON.parse(fs.readFileSync(localPath)))
		} catch (e) {
			console.error('Unable to read local config file - check JSON validity: ', e);
		}
	}

	switch (true) {
		case cfg.stdlibPath === undefined:
			cfg.stdlibPath = path.join(extensionPath, 'stdlib', cfg.network);
			break;

		case cfg.stdlibPath === null:
			break;

		case !path.isAbsolute(cfg.stdlibPath):
			cfg.stdlibPath = path.join(folder, cfg.stdlibPath);
	}

	switch (true) {
		// same here: null, undefined and string // careful
		case cfg.modulesPath === undefined:
			cfg.modulesPath = path.join(folder, 'modules');
			break;

		case cfg.modulesPath === null:
			break;

		case !path.isAbsolute(cfg.modulesPath):
			cfg.modulesPath = path.join(folder, cfg.modulesPath);
	}

	return cfg;
}

/**
 * Check whether compiler output directory exists: create if not, error when it's a
 *
 * @param   {String}  outDir  Output directory as set in config
 * @throws  {Error} 		  Throw Error when ourDir path exists and is not directory
 */
function checkCreateOutDir(outDir) {
	const outDirPath = path.resolve(outDir);

	if (fs.existsSync(outDirPath)) {
		if (!fs.statSync(outDirPath).isDirectory()) {
			throw new Error('Can\'t create dir under move.compilerDir path - file exists');
		}
	} else {
		fs.mkdirSync(outDirPath);
	}
}

/**
 * Execute cli command, get Promise in return
 *
 * @param   {String}  cmd  Command to execute
 * @return  {Promise}      Promise with command result
 */
function exec(cmd) {

	console.log('Executing command:', cmd);

	return new Promise((resolve, reject) => {
		return cp.exec(cmd, function onExec(error, stdout, stderr) {
			return (error !== null || stderr) ? reject(stderr) : resolve(stdout);
		});
	})
}

module.exports = {
	activate,
	deactivate
};
