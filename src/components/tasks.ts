import * as vscode from 'vscode';
import { Disposable, tasks } from 'vscode';

export const TASK_TYPE = 'dove';
export const TASK_SOURCE = 'dove';

export function activateTaskProvider(
    target: vscode.WorkspaceFolder,
    doveExecutable: string
): Disposable {
    const provider = new DoveTaskProvider(target, doveExecutable);
    return tasks.registerTaskProvider(TASK_TYPE, provider);
}

class DoveTaskProvider implements vscode.TaskProvider {
    constructor(
        private readonly target: vscode.WorkspaceFolder,
        private readonly doveExecutable: string
    ) {}

    async provideTasks(): Promise<vscode.Task[]> {
        const defs = [
            { command: 'build', group: vscode.TaskGroup.Build },
            { command: 'test', group: vscode.TaskGroup.Test },
        ];

        const tasks: vscode.Task[] = [];
        for (const defn of defs) {
            const execution = new vscode.ShellExecution(this.doveExecutable, [defn.command], {
                cwd: this.target.uri.fsPath,
            });
            const task = new vscode.Task(
                { type: TASK_TYPE, subcommand: defn.command },
                this.target,
                `dove ${defn.command}`,
                TASK_SOURCE,
                execution
            );
            task.group = defn.group;
            tasks.push(task);
        }
        return tasks;
    }

    async resolveTask(task: vscode.Task): Promise<vscode.Task | undefined> {
        return undefined;
    }
}
