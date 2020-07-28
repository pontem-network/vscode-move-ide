import * as Parser from 'web-tree-sitter';

export interface MoveModule {
    name: string,
    types: string[],
    address: string|null,
    consts: string[],
    imports: MoveImport[],
    methods: MoveFunction[],
}

export interface MoveImport {
    address: string,
    module: string,
    members: string[],
    code: string
}

export interface MoveFunction {
    name: string,
    generics: string,
    isPublic: boolean,
    isNative: boolean,
    arguments: string,
    signature: string,
    returns: string,
    acquires: string
}

export class MoveFile {

    parser: Parser;
    uri: string;

    constructor(parser: Parser, uri: string) {
        this.parser = parser;
        this.uri = uri;
    }

    parse(parser: Parser, text: string): MoveModule[] {

        if (!text) {
            return [];
        }

        const tree = parser.parse(text);

        let address: string = '';
        let modules: MoveModule[] = [];

        (function iterate(node: Parser.SyntaxNode, padding = 1): void {
            for (let i = 0; i < node?.childCount; i++) {
                const child = node.child(i);
                const type  = child?.type;

                if (child === null) {
                    continue;
                }

                if (type === 'address') {
                    const peek = node.child(i + 1);

                    if (peek !== null && peek.type == 'address_literal') {
                        console.log(peek.text)
                        address = peek.text;
                    }
                }

                console.log(''.padEnd(padding, '-'), type);

                if (type === 'module_definition') {
                    console.log('whaat?')
                    modules.push(parseModule(child, address));
                    continue;
                }

                iterate(child, padding + 1);
            }
        })(tree.rootNode);

        return modules;
    }

}

function parseModule(node: Parser.SyntaxNode, address: string | null): MoveModule {

    const mod: MoveModule = {
        name: '',
        address,
        imports: [],
        methods: [],
        consts: [],
        types: []
    };

    let walk = node.walk();

    walk.gotoFirstChild();
    walk.gotoNextSibling();

    if (walk.nodeType === 'module_identifier') {
        mod.name = walk.nodeText;
    }


    (function iterate(node: Parser.SyntaxNode) {
        for (let i = 0; i < node?.childCount; i++) {
            const child = node.child(i);
            const type  = child?.type;

            if (child === null) {
                continue;
            }

            switch (type) {
                case 'constant':          mod.consts.push(child.text);  break;
                case 'use_decl':          mod.imports.push(parseImport(child)); break;
                case 'struct_definition': mod.types.push(child.text);   break;

                case 'usual_function_definition':  mod.methods.push(parseFunction(child));       break;
                case 'native_function_definition': mod.methods.push(parseNativeFunction(child)); break;
            }

            iterate(child);
        }
    })(node);

    return mod;
}

function parseImport(node: Parser.SyntaxNode): MoveImport {

    let walk = node.walk();

    let imp : MoveImport = {
        address: '',
        module: '',
        members: [],
        code: walk.nodeText
    };

    while (walk.gotoNextSibling() || walk.gotoFirstChild() || walk.gotoNextSibling()) {
        switch (walk.nodeType) {
            case 'address_literal': imp.address = walk.nodeText; break;
            case 'module_identifier': imp.module = walk.nodeText; break;
            case 'use_member': imp.members.push(walk.nodeText); break;
        }
    }

    return imp;
}

function parseNativeFunction(node: Parser.SyntaxNode): MoveFunction {

    let walk = node.walk();

    let fun: MoveFunction = {
        name: '',
        generics: '',
        isNative: true,
        isPublic: false,
        arguments: '',
        signature: walk.nodeText,
        returns: '',
        acquires: ''
    }

    while (walk.gotoFirstChild()) {
        while (walk.gotoNextSibling()) {
            switch (walk.nodeType) {
                case 'public': fun.isPublic = true; break;
                case 'native': fun.isNative = true; break;
                case 'function_identifier': fun.name = walk.nodeText; break;
                case 'func_params': fun.arguments = walk.nodeText;    break;
                case 'type_parameters': fun.generics = walk.nodeText; break;
                case 'apply_type': fun.returns = walk.nodeText; break;
                case 'tuple_type': fun.returns = walk.nodeText; break;
                case 'resource_accquires': fun.acquires = walk.nodeText; break;
            }
        }
    }

    return fun;
}

function parseFunction(node: Parser.SyntaxNode): MoveFunction {

    let walk = node.walk();

    // cut node to '{' symbol, trim to remove trailing whitespace
    let signature = walk.nodeText.slice(0, walk.nodeText.indexOf('{') || -1).trim();

    let fun: MoveFunction = {
        name: '',
        generics: '',
        isNative: true,
        isPublic: false,
        arguments: '',
        signature: signature,
        returns: '',
        acquires: ''
    }

    while (walk.gotoFirstChild()) {
        switch (walk.nodeType) {
            case 'public': fun.isPublic = true; break;
        }

        while (walk.gotoNextSibling()) {
            switch (walk.nodeType) {
                case 'function_identifier': fun.name = walk.nodeText; break;
                case 'func_params': fun.arguments = walk.nodeText; break;
                case 'type_parameters': fun.generics = walk.nodeText; break;
                case 'apply_type': fun.returns = walk.nodeText; break;
                case 'tuple_type': fun.returns = walk.nodeText; break;
                case 'resource_accquires': fun.acquires = walk.nodeText.replace('acquires', '').trim(); break;
            }
        }
    }

    return fun;
}
