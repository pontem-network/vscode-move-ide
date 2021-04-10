import * as vscode from 'vscode';
import { log } from './util';
import { spawn } from 'child_process';
import { Metadata } from './metadata';

export class Dove {
    constructor(readonly executable: string, private readonly traceExtension: boolean) {}

    async build(folder: vscode.WorkspaceFolder) {
        await this.runCommand('build', [], folder.uri.fsPath);
    }

    async run(folder: vscode.WorkspaceFolder, scriptFileName: string, scriptArgs: string) {
        const args: string[] = [];
        if (scriptArgs) {
            args.push('--args', `"${scriptArgs}"`);
        }
        args.push(scriptFileName);
        await this.runCommand('run', args, folder.uri.fsPath);
    }

    async test(folder: vscode.WorkspaceFolder, pattern: string | null) {
        const args: string[] = [];
        if (pattern) {
            args.push('-k', pattern);
        }
        await this.runCommand('test', args, folder.uri.fsPath);
    }

    async metadata(folder: vscode.WorkspaceFolder): Promise<Metadata | undefined> {
        let metadata_json = await this.runCommand('metadata', ['--json'], folder.uri.fsPath);
        if (!metadata_json) return undefined;

        metadata_json = metadata_json.trim();
        if (this.traceExtension) {
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
