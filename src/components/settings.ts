import * as vscode from 'vscode';
import { log } from './util';
import { Uri } from 'vscode';

export class ExtensionSettings {
    readonly rootSection = 'move';

    readonly globalStorageUri: Uri;

    constructor(ctx: vscode.ExtensionContext) {
        this.globalStorageUri = ctx.globalStorageUri;

        this.refreshLogging();
    }

    private refreshLogging() {
        log.setEnabled(this.traceExtension);

        const cfg = Object.entries(this.config()).filter(
            ([_, val]) => !(val instanceof Function)
        );
        log.info('Using configuration', Object.fromEntries(cfg));
    }

    // We don't do runtime config validation here for simplicity. More on stackoverflow:
    // https://stackoverflow.com/questions/60135780/what-is-the-best-way-to-type-check-the-configuration-for-vscode-extension
    private config(): vscode.WorkspaceConfiguration {
        return vscode.workspace.getConfiguration(this.rootSection);
    }

    /**
     * Beware that postfix `!` operator erases both `null` and `undefined`.
     * This is why the following doesn't work as expected:
     *
     * ```ts
     * const nullableNum = vscode
     *  .workspace
     *  .getConfiguration
     *  .getConfiguration("rust-analyer")
     *  .get<number | null>(path)!;
     *
     * // What happens is that type of `nullableNum` is `number` but not `null | number`:
     * const fullFledgedNum: number = nullableNum;
     * ```
     * So this getter handles this quirk by not requiring the caller to use postfix `!`
     */
    get<T>(path: string): T {
        return this.config().get<T>(path)!;
    }

    get traceExtension() {
        return this.get<boolean>('trace.extension');
    }

    get autocomplete() {
        return this.get<boolean>('autocomplete');
    }
}
