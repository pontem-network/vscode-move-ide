# Move Language extension for VSCode

Built by developers for developers, this extension will simplify your Move development and will make your first
experience with Move less painful.

-   [Move Language Documentation](https://developers.diem.com/docs/move/overview)
-   [Move Whitepaper](https://developers.diem.com/main/docs/move-paper)

Supports:

-   Syntax highlighting
-   On-the-fly compiler checks via [Move Language Server](https://github.com/pontem-network/move-tools)
-   Compile, run and test Move code via integration with [Dove](https://github.com/pontem-network/move-tools)

Install extension from
the [marketplace](https://marketplace.visualstudio.com/items?itemName=PontemNetwork.move-language) to start.

## Setup

1. Download and install [Dove](https://docs.pontem.network/03.-move-vm/compiler_and_toolset#installation) locally.
2. Create [new project](https://docs.pontem.network/03.-move-vm/compiler_and_toolset#dove).
3. Open project directory into VSCode and see following structure in the root of your project:

```
    /scripts
    /modules
    /tests
    Dove.toml
```

**Additional configuration options:**

-   doveExecutablePath - custom path to [Dove executable](https://github.com/dfinance/move-tools#dove).
-   languageServerPath - custom path
    to [Move Language Server executable](https://github.com/dfinance/move-tools#language-server).

## Previous version

Previously developed by [Dfinance](https://dfinance.co) team and published under another publisher
as [Move IDE](https://marketplace.visualstudio.com/items?itemName=damirka.move-ide).

Supported by [Pontem Network](https://pontem.network).

## Contribution

Feel free to ask any questions or report
bugs [by opening new issue](https://github.com/pontem-network/vscode-move-ide/issues).
