import * as vscode from 'vscode';
import { log } from './util';
import { spawn } from 'child_process';
import { MoveLanguageServerInitOpts } from './client';

export type MoveDialect = 'diem' | 'dfinance' | 'pont';

interface LayoutInfo {
    module_dir: string;
    script_dir: string;
    tests_dir: string;
    module_output: string;
    packages_output: string;
    script_output: string;
    transaction_output: string;
    target_deps: string;
    target: string;
    index: string;
}

interface PackageInfo {
    name: string;
    account_address: string;
    authors: string[];
    blockchain_api: string | null;
    local_dependencies: string[];
    git_dependencies: string[];
    dialect: MoveDialect;
}

export interface Metadata {
    package: PackageInfo;
    layout: LayoutInfo;
}

export function getServerInitOptsFromMetadata(metadata: Metadata): MoveLanguageServerInitOpts {
    const module_folders: string[] = [];
    for (const local_dep of metadata.package.local_dependencies) {
        module_folders.push(local_dep);
    }
    module_folders.push(metadata.layout.module_dir);

    return {
        dialect: metadata.package.dialect,
        modules_folders: module_folders,
        sender_address: metadata.package.account_address,
        stdlib_folder: null,
    };
}

export class Dove {
    constructor(readonly executable: string) {
        log.debug(`Create Dove object with executable ${executable}`);
    }

    async metadata(folder: vscode.WorkspaceFolder): Promise<[Metadata | undefined, string]> {
        let [metadata_json, errors] = await this.runCommand('metadata', [], folder.uri.fsPath);
        if (!metadata_json) {
            log.debug(`"dove metadata" failed at ${folder.uri.fsPath}`);
            return [undefined, errors];
        }

        metadata_json = metadata_json.trim();
        log.debug(`Fetched project metadata ${metadata_json}`);

        return [JSON.parse(metadata_json), errors];
    }

    async metadataWithErrorMessage(
        folder: vscode.WorkspaceFolder
    ): Promise<Metadata | undefined> {
        let [metadata, errors] = await this.metadata(folder);
        if (!metadata) {
            vscode.window.showErrorMessage(`Dove.toml is invalid: ${errors}`);
            return undefined;
        }
        return metadata;
    }

    async init(folder: vscode.WorkspaceFolder): Promise<void> {
        await this.runCommand('init', [], folder.uri.fsPath);
    }

    private async runCommand(
        command: string,
        args: string[],
        cwd: string
    ): Promise<[string, string]> {
        log.debug(`Running dove command ${JSON.stringify([command, ...args])}`);

        let stdout = '';
        let stderr = '';
        await new Promise((resolve) => {
            const process = spawn(this.executable, [command, ...args], { cwd });
            process.stdout.on('data', (data) => {
                stdout += data;
            });
            process.stderr.on('data', (data) => {
                stderr += data;
            });
            process.on('close', (code) => {
                resolve(code);
            });
        });
        log.debug(`finishing stdout: ${stdout}`);

        let fullCommand = [this.executable, command, ...args].join(' ');
        log.warn(`Error running command: ${fullCommand}\n${stderr}`);

        return [stdout, stderr];
    }
}
