import {MoveFile} from './completion/parser';
import * as fs from 'fs';
import * as Parser from 'web-tree-sitter';
// import { parse } from 'path';
import {getScopeAt} from './completion/scope';

(async () => {

    await Parser.init();
    const Move = await Parser.Language.load('/Users/damn/projects/dfinance/move/vscode-move-ide/parsers/tree-sitter-move.wasm');
    const parser = new Parser();
    parser.setLanguage(Move);

    // const dirPath = '/Users/damn/projects/dfinance/move/vscode-move-ide/stdlib/libra/';
    // let dir = fs.readdirSync(dirPath)
    //     .map((mod) => dirPath + mod)
    //     .map((file) => ['file://' + file, new MoveFile(parser, 'file://' + file).parse(fs.readFileSync(file).toString('utf-8'))]);

    let result = getScopeAt(
        parser,
        fs.readFileSync('/Users/damn/projects/dfinance/move/contracts/modules/test.move').toString('utf-8'),
        {row: 80, column: 8}
    );

    // // const file = fs.readFileSync('/Users/damn/projects/dfinance/move/contracts/modules/test.move').toString('utf-8');
    // const file = fs.readFileSync('/Users/damn/projects/dfinance/move/contracts/scripts/kek.move').toString('utf-8');

    // let time = Date.now();
    // let kek = new MoveFile(parser, '').parse(parser, file);
    // let end = Date.now();

    // console.log(end - time);
    // console.log(kek);
})();
