import * as vscode from 'vscode';
import { EXTENSION_SETTINGS_ROOT_SECTION } from '../extension';

export class ExtensionSettings {
    // We don't do runtime config validation here for simplicity. More on stackoverflow:
    // https://stackoverflow.com/questions/60135780/what-is-the-best-way-to-type-check-the-configuration-for-vscode-extension
    private static config(): vscode.WorkspaceConfiguration {
        return vscode.workspace.getConfiguration(EXTENSION_SETTINGS_ROOT_SECTION);
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
    static get<T>(path: string): T {
        return ExtensionSettings.config().get<T>(path)!;
    }

    static get logTrace(): boolean {
        return this.get('trace.extension');
    }

    // static get autocomplete(): boolean {
    //     return this.get('autocomplete');
    // }

    // static get blockchainDialect(): any {
    //     return this.get('project.blockchain');
    // }

    // static get modulePaths(): string[] {
    //     return this.get('project.modulePaths');
    // }

    // static get accountAddress(): string {
    //     return this.get('project.account_address');
    // }
}
