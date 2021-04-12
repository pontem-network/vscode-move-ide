# Move Language extension for VSCode

Built by developer for developers, this extension will simplify your Move development and will make your first
experience with Move less painful.

-   [Jump to setup](#setup)
-   [Move Language Documentation](https://developers.diem.com/docs/move/overview)
-   [Move Whitepaper](https://developers.diem.com/main/docs/move-paper)

**What's inside**:

-   Move syntax highlighting + spec support

-   Code Completion for imported modules and built-ins

-   [Move Language Server](https://github.com/pontem-network/move-tools#language-server) and syntax error check!

-   Default `build` and `test` tasks based on Dove utility.

    https://github.com/dfinance/move-tools#dove

-   `{{sender}}` pattern support for address in your modules and scripts

Install extension from
the [marketplace](https://marketplace.visualstudio.com/items?itemName=PontemNetwork.move-language) to start.

## Syntax highlighting

![Move highlighting](https://raw.githubusercontent.com/pontem-network/vscode-move-ide/master/img/move.highlight.jpg)

<a name="setup"></a>

## Setup

### Recommended directory structure

I highly recommend you using following directory structure:

```text
modules/       - here you'll put your modules (module.move)
scripts/       - same here! scripts! (script.move)
out/           - compiler output directory (module.mv or module.mv.json)
```

**Comments:**

-   network: `diem` or `dfinance` (diem is default);
-   sender: account from which you're going to deploy/run scripts;
-   compilerDir: compiler output directory;

**Additional configuration options:**

-   doveExecutablePath - custom path to [Dove executable](https://github.com/dfinance/move-tools#dove).
-   languageServerPath - custom path
    to [Move Language Server executable](https://github.com/dfinance/move-tools#language-server).

## Previous version

Previously developed by [Dfinance](https://dfinance.co) team and published under another publisher
as [Move IDE](https://marketplace.visualstudio.com/items?itemName=damirka.move-ide).

Currently supported by [Pontem Network](https://pontem.network).

## Contribution

Feel free to ask any questions or report
bugs [by opening new issue](https://github.com/pontem-network/vscode-move-ide/issues).
