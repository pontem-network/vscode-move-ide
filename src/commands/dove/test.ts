import { Cmd, Ctx } from '../ctx';
import { workspace } from 'vscode';

export function testCommand(ctx: Ctx): Cmd {
    return async () => {
        const editor = ctx.activeMoveEditor;
        if (!editor) return;

        const folder = workspace.getWorkspaceFolder(editor.document.uri);
        if (!folder) return;

        await ctx.dove.test(folder, null);
    };
}
