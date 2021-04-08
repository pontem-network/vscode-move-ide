import * as Parser from 'web-tree-sitter';

export enum Location {
    StructField = 'StructField',
    StructGeneric = 'StructGeneric',
    StructDefinition = 'StructDefinition',

    Module = 'Module',
    Script = 'Script',
    Import = 'Import',

    FunctionDefinition = 'FunctionDefinition',
    FunctionArguments = 'FunctionArguments',
    FunctionBody = 'FunctionBody',
}

export function getScopeAt(parser: Parser, text: string, position: Parser.Point) {
    let cursorNode = parser.parse(text).rootNode.descendantForPosition(position);

    const parentship: Location[] = [];
    let mod: string | null = null;

    while (cursorNode.parent) {
        switch (cursorNode.type) {
            case 'field_annotation':
                if (cursorNode.parent.type !== 'struct_def_fields') {
                    break;
                }
            case 'struct_def_fields':
                parentship.push(Location.StructField);
                break;

            case 'struct_definition':
                parentship.push(Location.StructDefinition);
                break;

            case 'module_body':
                parentship.push(Location.Module);
                break;

            case 'script_block':
                parentship.push(Location.Script);
                break;

            case 'module_definition':
                let walk = cursorNode.walk();
                walk.gotoFirstChild();

                while (walk.gotoNextSibling()) {
                    if (walk.nodeType === 'module_identifier') {
                        mod = walk.nodeText;
                        break;
                    }
                }
                break;

            case 'use_decl':
                parentship.push(Location.Import);
                break;

            case 'block':
                if (cursorNode.parent.type === 'usual_function_definition') {
                    parentship.push(Location.FunctionBody);
                }
                break;

            case 'func_params':
                if (cursorNode.parent.type === 'usual_function_definition') {
                    parentship.push(Location.FunctionArguments);
                }

            case 'type_parameters':
                if (cursorNode.parent.type === 'struct_definition') {
                    parentship.push(Location.StructGeneric);
                }
                break;
        }

        cursorNode = cursorNode.parent;
    }

    return {
        module: mod,
        location: parentship,
    };
}
