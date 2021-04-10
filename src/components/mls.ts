import * as vscode from 'vscode';
import * as lsp from 'vscode-languageclient/node';

import { AppConfig } from './config';

export const workspaceClients: Map<vscode.WorkspaceFolder, lsp.LanguageClient> = new Map();

export interface MlsConfig {
    dialect: string;
    modules_folders: string[];
    stdlib_folder: string | undefined | null;
    sender_address: string | undefined | null;
}

export function configToLsOptions(cfg: AppConfig): MlsConfig {
    const modules_folders: string[] = [];

    if (cfg.modulesPath) {
        modules_folders.push(cfg.modulesPath);
    }

    return {
        modules_folders,
        dialect: cfg.network || 'libra',
        stdlib_folder: cfg.stdlibPath,
        sender_address: cfg.sender,
    };
}
