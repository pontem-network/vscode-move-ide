interface GitDependency {
    git: string;
}

interface LocalDependency {
    path: string;
}

interface LayoutInfo {
    module_dir: string;
    script_dir: string;
    tests_dir: string;
    module_output: string;
    script_output: string;
    target_deps: string;
    target: string;
    index: string;
}

interface PackageInfo {
    name: string;
    account_address: string;
    authors: string[];
    local_dependencies: LocalDependency[];
    git_dependencies: GitDependency[];
    blockchain_api: string | null;
}

export interface Metadata {
    package: PackageInfo;
    layout: LayoutInfo;
}
