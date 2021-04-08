import { ExtensionSettings } from '../components/settings';
import { Metadata } from '../components/metadata';
import * as vscode from 'vscode';
import { commands } from 'vscode';
import { isMoveEditor, MoveEditor } from '../components/util';
import { Dove } from '../components/dove';

export type Cmd = (...args: any[]) => unknown;

export interface Disposable {
    dispose(): void;
}

export class Ctx {
    constructor(
        readonly extensionContext: vscode.ExtensionContext,
        readonly settings: ExtensionSettings,
        readonly dove: Dove
    ) {}

    get activeMoveEditor(): MoveEditor | undefined {
        const editor = vscode.window.activeTextEditor;
        return editor && isMoveEditor(editor) ? editor : undefined;
    }

    registerCommand(name: string, factory: (ctx: Ctx) => Cmd) {
        const fullname = `move.${name}`;
        const cmd = factory(this);
        const d = commands.registerCommand(fullname, cmd);
        this.pushCleanup(d);
    }

    get subscriptions(): Disposable[] {
        return this.extensionContext.subscriptions;
    }

    pushCleanup(d: Disposable) {
        this.extensionContext.subscriptions.push(d);
    }
}

// export class Ctx {
//     private constructor(
//         readonly config: ExtensionSettings,
//         private readonly extCtx: vscode.ExtensionContext,
//         readonly client: lc.LanguageClient,
//         readonly serverPath: string,
//         readonly statusBar: vscode.StatusBarItem
//     ) {}
//
//     static async create(
//         config: ExtensionSettings,
//         extCtx: vscode.ExtensionContext,
//         serverPath: string,
//         projectRoot: string,
//     ): Promise<Ctx> {
//         const client = createClient(serverPath, projectRoot);
//
//         const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
//         extCtx.subscriptions.push(statusBar);
//         statusBar.text = "rust-analyzer";
//         statusBar.tooltip = "ready";
//         statusBar.show();
//
//         const res = new Ctx(config, extCtx, client, serverPath, statusBar);
//
//         res.pushCleanup(client.start());
//         await client.onReady();
//         client.onNotification(ra.serverStatus, (params) => res.setServerStatus(params));
//         return res;
//     }
//
//     registerCommand(name: string, factory: (ctx: Ctx) => Cmd) {
//         const fullName = `rust-analyzer.${name}`;
//         const cmd = factory(this);
//         const d = vscode.commands.registerCommand(fullName, cmd);
//         this.pushCleanup(d);
//     }
//
//     pushCleanup(d: Disposable) {
//         this.extCtx.subscriptions.push(d);
//     }
// }
//
// export interface Disposable {
//     dispose(): void;
// }
// export type Cmd = (...args: any[]) => unknown;
