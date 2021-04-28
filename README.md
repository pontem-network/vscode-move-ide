# Move Language extension for VSCode

Built by developers for developers, this extension will simplify your Move development and will make your first
experience with Move less painful.

-   [Move Language Documentation](https://developers.diem.com/docs/move/overview)
-   [Move Whitepaper](https://developers.diem.com/main/docs/move-paper)

Supports:

-   Syntax highlighting
-   On-the-fly compiler checks via [Move Language Server]()
-   Compile, run and test Move code via integration with [Dove]()

Install extension from
the [marketplace](https://marketplace.visualstudio.com/items?itemName=PontemNetwork.move-language) to start.

## Setup

Out-of-box the extension only supports syntax highlighting.

To get advanced features like checking code for compiler errors in the editor, you need to initialize your Dove project:

1. Run `Initialize Dove project` command from Command Palette
2. This will create following directory structure in the root of your project:

```
    /scripts
    /modules
    /tests
    Dove.toml
```

For more information of Dove and Dove.toml file
see [https://docs.pontem.network/03.-move-vm/compiler_and_toolset#dove](https://docs.pontem.network/03.-move-vm/compiler_and_toolset#dove)

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
