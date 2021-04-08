import * as vscode from 'vscode';
import { Uri, workspace } from 'vscode';
import { PersistentState } from './persistent_state';
import { assert, isValidExecutable, log } from './util';
import { ExtensionSettings } from './settings';
import * as os from 'os';
import { download, downloadWithRetryDialog, fetchRelease } from './net';

function getPlatformLabel(name: NodeJS.Platform): string | undefined {
    if (name === 'win32') return 'win';
    if (name == 'linux') return 'linux';
    if (name == 'darwin') return 'mac';
    return undefined;
}

export async function bootstrapLanguageServer(
    config: ExtensionSettings,
    state: PersistentState
): Promise<string> {
    const path = await getBinaryPathEnsureExists(
        config,
        state,
        'move-language-server',
        'languageServerPath'
    );
    log.info('Using language server binary at', path);

    return path;
}

export async function bootstrapDoveExecutable(
    config: ExtensionSettings,
    state: PersistentState
): Promise<string> {
    const path = await getBinaryPathEnsureExists(config, state, 'dove', 'doveExecutablePath');
    log.info('Using dove binary at', path);

    if (!isValidExecutable(path)) {
        throw new Error(`Failed to execute ${path} --version`);
    }

    return path;
}

async function getBinaryPathEnsureExists(
    config: ExtensionSettings,
    state: PersistentState,
    binaryName: string,
    configPath: string | null
): Promise<string> {
    if (configPath) {
        const explicitPath = config.get<string>(configPath);
        if (explicitPath) {
            if (explicitPath.startsWith('~/')) {
                return os.homedir() + explicitPath.slice('~'.length);
            }
            return explicitPath;
        }
    }

    const platformLabel = getPlatformLabel(process.platform);
    if (platformLabel === undefined) {
        await vscode.window.showErrorMessage(
            "Unfortunately we don't ship binaries for your platform yet. "
        );
        throw new Error(`${binaryName} executable is not available.`);
    }
    const ext = platformLabel === 'win32' ? '.exe' : '';
    const releaseTag = '1.0.0';
    const fname = `${binaryName}-${releaseTag}-${platformLabel}${ext}`;
    const dest = Uri.joinPath(config.globalStorageUri, fname);
    const exists = await workspace.fs.stat(dest).then(
        () => true,
        () => false
    );
    if (exists) {
        return dest.fsPath;
    }

    const release = await downloadWithRetryDialog(state, async () => {
        return await fetchRelease(releaseTag, state.githubToken);
    });
    const asset = release.assets.find(
        ({ browser_download_url, name }) =>
            name.startsWith(binaryName) && name.includes(platformLabel)
    );
    assert(!!asset, `Bad release: ${JSON.stringify(release)}`);

    await downloadWithRetryDialog(state, async () => {
        await download({
            url: asset.browser_download_url,
            dest: dest.fsPath,
            progressTitle: `Downloading "${binaryName}"`,
            mode: 0o755,
        });
    });

    return dest.fsPath;
}
