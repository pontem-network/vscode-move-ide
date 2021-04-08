import { Cmd, Ctx } from '../ctx';
import { workspace } from 'vscode';

export function runCommand(ctx: Ctx): Cmd {
    return async () => {
        const editor = ctx.activeMoveEditor;
        if (!editor) return;

        const document = editor.document;
        const folder = workspace.getWorkspaceFolder(document.uri);
        if (!folder) return;

        await ctx.dove.run(folder, document.uri.fsPath, '');
    };
}
