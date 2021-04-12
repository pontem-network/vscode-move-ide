import * as vscode from 'vscode';
import { log } from './util';
import { spawn } from 'child_process';
import { MoveLanguageServerInitOpts } from './client';

interface LayoutInfo {
    module_dir: string;
    script_dir: string;
    tests_dir: string;
    module_output: string;
    script_output: string;
    target_deps: string;
    target: string;
    index: string;
}

interface PackageInfo {
    name: string;
    account_address: string;
    authors: string[];
    local_dependencies: string[];
    git_dependencies: string[];
    blockchain_api: string | null;
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
    // module_folders.push(metadata.layout.module_dir);

    return {
        dialect: 'dfinance',
        modules_folders: module_folders,
        sender_address: metadata.package.account_address,
        stdlib_folder: null,
    };
}

export class Dove {
    constructor(readonly executable: string, private readonly logTrace: boolean) {}

    async metadata(folder: vscode.WorkspaceFolder): Promise<Metadata | undefined> {
        let metadata_json = await this.runCommand('metadata', ['--json'], folder.uri.fsPath);
        if (!metadata_json) return undefined;

        metadata_json = metadata_json.trim();
        if (this.logTrace) {
            log.debug(`Fetched project metadata ${metadata_json}`);
        }

        return JSON.parse(metadata_json);
    }

    private async runCommand(
        command: string,
        args: string[],
        cwd: string
    ): Promise<string | undefined> {
        let stdout = '';

        let stderr = '';
        const execute = new Promise((resolve) => {
            const process = spawn(this.executable, [command, ...args], { cwd });
            process.stdout.on('data', (data) => {
                stdout += data;
            });
            process.stderr.on('data', (data) => {
                stderr += data;
            });
            process.on('close', (code) => {
                resolve(undefined);
            });
        });
        await execute;

        if (stderr) {
            const executed = [this.executable, command, ...args].join(' ');
            log.error(`Error running command: ${executed}\n${stderr}`);
            return undefined;
        }
        return stdout;
    }
}
