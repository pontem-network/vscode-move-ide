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

interface DoveTaskDefinition extends vscode.TaskDefinition {
    subcommand: string;
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
            const task = await buildDoveTask(
                this.doveExecutable,
                this.target,
                {
                    type: TASK_TYPE,
                    subcommand: defn.command,
                },
                `dove ${defn.command}`
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

async function buildDoveTask(
    doveExecutable: string,
    target: vscode.WorkspaceFolder,
    definition: DoveTaskDefinition,
    label: string
): Promise<vscode.Task> {
    const execution = new vscode.ShellExecution(doveExecutable, [definition.subcommand], {
        cwd: target.uri.fsPath,
    });
    const task = new vscode.Task(definition, target, label, TASK_SOURCE, execution);
    return task;
}
