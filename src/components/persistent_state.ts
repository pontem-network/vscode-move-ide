import * as vscode from 'vscode';

export class PersistentState {
    constructor(private readonly globalState: vscode.Memento) {}

    /**
     * Github authorization token.
     * This is used for API requests against the Github API.
     */
    get githubToken(): string | undefined {
        return this.globalState.get('githubToken');
    }
    async updateGithubToken(value: string | undefined) {
        await this.globalState.update('githubToken', value);
    }
}
