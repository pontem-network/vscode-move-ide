import { Cmd, Ctx } from '../ctx';
import { workspace } from 'vscode';

export function buildCommand(ctx: Ctx): Cmd {
    return async () => {
        const editor = ctx.activeMoveEditor;
        if (!editor) return;

        const folder = workspace.getWorkspaceFolder(editor.document.uri);
        if (!folder) return;

        await ctx.dove.build(folder);
    };
}
