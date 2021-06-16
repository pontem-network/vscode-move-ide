import * as vscode from 'vscode';
import { TextDocument, Uri, workspace } from 'vscode';
import { strict as nativeAssert } from 'assert';
import { spawnSync } from 'child_process';
import { inspect } from 'util';

export function assert(condition: boolean, explanation: string): asserts condition {
    try {
        nativeAssert(condition, explanation);
    } catch (err) {
        log.error(`Assertion failed:`, explanation);
        throw err;
    }
}

export const log = new (class {
    private enabled = true;
    private readonly output = vscode.window.createOutputChannel('move IDE trace');

    setEnabled(yes: boolean): void {
        log.enabled = yes;
    }

    // Hint: the type [T, ...T[]] means a non-empty array
    debug(...msg: [unknown, ...unknown[]]): void {
        if (!log.enabled) return;
        log.write('DEBUG', ...msg);
    }

    info(...msg: [unknown, ...unknown[]]): void {
        log.write('INFO', ...msg);
    }

    warn(...msg: [unknown, ...unknown[]]): void {
        log.write('WARN', ...msg);
    }

    error(...msg: [unknown, ...unknown[]]): void {
        debugger;
        log.write('ERROR', ...msg);
        log.output.show(true);
    }

    private write(label: string, ...messageParts: unknown[]): void {
        const message = messageParts.map(log.stringify).join(' ');
        const dateTime = new Date().toLocaleString();
        log.output.appendLine(`${label} [${dateTime}]: ${message}`);
    }

    private stringify(val: unknown): string {
        if (typeof val === 'string') return val;
        return inspect(val, {
            colors: false,
            depth: 6, // heuristic
        });
    }
})();

export type MoveDocument = vscode.TextDocument & { languageId: 'move' };
export type MoveEditor = vscode.TextEditor & { document: MoveDocument };

export function isMoveDocument(document: vscode.TextDocument): document is MoveDocument {
    // Prevent corrupted text (particularly via inlay hints) in diff views
    // by allowing only `file` schemes
    // unfortunately extensions that use diff views not always set this
    // to something different than 'file' (see ongoing bug: #4608)
    return document.languageId === 'move' && document.uri.scheme === 'file';
}

export function isMoveEditor(text_document: TextDocument): text_document is MoveDocument {
    return isMoveDocument(text_document);
}

export function isValidExecutable(path: string): boolean {
    log.debug('Checking availability of a binary at', path);

    const res = spawnSync(path, ['--version'], { encoding: 'utf8' });

    const printOutput =
        res.error && (res.error as any).code !== 'ENOENT' ? log.warn : log.debug;
    printOutput(path, '--version:', res);

    return res.status === 0;
}

export async function uriExists(uri: Uri): Promise<boolean> {
    return workspace.fs.stat(uri).then(
        () => true,
        () => false
    );
}
