import ts from "typescript";
import paths from "path";

import { readFileSync, writeFileSync, unlinkSync, existsSync } from "fs";

import { GraphToken } from "../graphToken";
import { aTopologicalOrder } from "../graph";
import { basename } from "path";
import { EOL } from "os";

import { toPosixPath } from "../utils";
import { IImport } from "../parse";
import { info } from "../log";


/**
 * relative path of `to` from the point of view of `from`
 * @param from absolute path of a module
 * @param to absolut path from the imported module
 */
function relative(from: string, to: string) {
    if (paths.isAbsolute(to)) {
        const toFile = paths.parse(to).name;
        to = toPosixPath(paths.dirname(to));
        from = toPosixPath(paths.dirname(from));
        const res = paths.posix.join(paths.posix.relative(from, to), toFile);
        return res[0] === "." ? res : `./${res}`;
    }
    return toPosixPath(to);
}

const formatCodeSettings: ts.FormatCodeSettings = {
    baseIndentSize: 0,
    indentSize: 4,
    tabSize: 4,
    indentStyle: ts.IndentStyle.Block,
    newLineCharacter: EOL,
    convertTabsToSpaces: true,
    insertSpaceAfterCommaDelimiter: true,
    insertSpaceAfterSemicolonInForStatements: true,
    insertSpaceBeforeAndAfterBinaryOperators: true,
    insertSpaceAfterConstructor: false,
    insertSpaceAfterKeywordsInControlFlowStatements: true,
    insertSpaceAfterFunctionKeywordForAnonymousFunctions: false,
    insertSpaceAfterOpeningAndBeforeClosingNonemptyParenthesis: false,
    insertSpaceAfterOpeningAndBeforeClosingNonemptyBrackets: false,
    insertSpaceAfterOpeningAndBeforeClosingNonemptyBraces: true,
    insertSpaceAfterOpeningAndBeforeClosingTemplateStringBraces: false,
    insertSpaceAfterOpeningAndBeforeClosingJsxExpressionBraces: false,
    insertSpaceAfterTypeAssertion: false,
    insertSpaceBeforeFunctionParenthesis: false,
    placeOpenBraceOnNewLineForFunctions: false,
    placeOpenBraceOnNewLineForControlBlocks: false,
    insertSpaceBeforeTypeAnnotation: false
};

class LanguageServiceHost implements ts.LanguageServiceHost {
    files: ts.MapLike<ts.IScriptSnapshot> = { };
    addFile(fileName: string, text: string) {
        this.files[fileName] = ts.ScriptSnapshot.fromString(text);
    }

    // for ts.LanguageServiceHost

    getCompilationSettings = () => ts.getDefaultCompilerOptions();
    getScriptFileNames = () => Object.keys(this.files);
    getScriptVersion = () => "0";
    getScriptSnapshot = (fileName: string) => this.files[fileName];
    getCurrentDirectory = () => process.cwd();
    getDefaultLibFileName = (options: ts.CompilerOptions) => ts.getDefaultLibFilePath(options);
    readFile = (path: string): string | undefined => {
        try {
            return readFileSync(path).toString();
        }
        catch {
            return undefined;
        }
    };
    fileExists = existsSync;

}
function replace(text: string, inText: string, start: number, end: number) {
    const head = inText.slice(0, start);
    const tail = inText.slice(end);
    return `${head}${text}${tail}`;
}

function format(fileName: string, text: string, options = formatCodeSettings): string {
    const host = new LanguageServiceHost();
    host.addFile(fileName, text);

    const languageService = ts.createLanguageService(host);
    const edits = languageService.getFormattingEditsForDocument(fileName, options);
    edits
        .sort((a, b) => a.span.start - b.span.start)
        .reverse()
        .forEach(edit => {
            text = replace(edit.newText, text, edit.span.start, edit.span.start + edit.span.length);
        });

    return text;
}

export class RewriteImport {
    constructor(
        private graphTokenHardDependency: GraphToken,
        private graphTokenAllDependency: GraphToken,
        private filesToImportsNodes: Map<string, IImport[]>,
        private globalNamespacePath: string,
        private formatImport: boolean = false,
        private addLogsLoaded: boolean = false
    ) { }

    private static formatImport(importText: string): string {
        return importText.trim()
            .replace(/\r?\n/g, "")
            .replace(/\s+/g, " ")
            .replace(/^import\s?{/, "import{###")
            .replace(/(?<!,)}\s?(?=from[^}]*$)/, ",}")
            .replace(/,/g, ",###")
            .replace(/###/g, EOL)
            .replace(/'/g, '"');
    }

    /**
     * add replace import of a file with formatted import
     * @param imports imports to add to this file (both library and not library)
     * @param fullSource source text
     * @param localModulePath path to the source file
     */
    private replaceImports(imports: IImport[], fullSource: string, localModulePath: string): string {
        let insertImportsStart = imports.reduce((acc, i) => Math.min(acc, i.start), Number.MAX_SAFE_INTEGER);
        let insertImportsEnd = imports.reduce((acc, i) => Math.max(acc, i.end), Number.MIN_SAFE_INTEGER);
        if (insertImportsStart === Number.MAX_SAFE_INTEGER) {
            insertImportsStart = 0;
            insertImportsEnd = 0;
        }
        // include blank line
        const match = /^\s*/.exec(fullSource.substring(insertImportsEnd));
        if (match !== null) {
            insertImportsEnd += match[0].length;
        }
        let importsText: string[] = [];
        const libraryImports = imports.filter(i => i.isLibrary).sort((a, b) => a.path.localeCompare(b.path));
        importsText = importsText.concat(libraryImports.map((i) => RewriteImport.formatImport(i.text)));

        const localImports = Array.from(
            this.graphTokenAllDependency.getImportedTokenByModule(localModulePath).values()
        ).filter(i => !i.isLibrary);
        if (localImports.length > 0) {
            const indent = "    ";
            importsText.push("/*!--empty-line--!*/");
            importsText.push("import {");
            const localImportsFormatted = localImports
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((t) => indent + t.name + ",");
            // remove last "," in imports
            const iLast = localImportsFormatted.length - 1;
            const lastImport = localImportsFormatted[iLast];
            localImportsFormatted[iLast] = lastImport.substring(0, lastImport.length - 1);

            importsText = importsText.concat(localImportsFormatted);
            importsText.push(`} from "${relative(localModulePath, this.globalNamespacePath)}";`);
        }

        if (libraryImports.length > 0 || localImports.length > 0) {
            importsText.push("/*!--empty-line--!*/");
            importsText.push("/*!--empty-line--!*/");
        }

        const importsTextFormatted = format(localModulePath, importsText.join(EOL)) + EOL;
        return replace(importsTextFormatted, fullSource, insertImportsStart, insertImportsEnd)
            .replace(/\/\*!--empty-line--!\*\//g, "");
    }

    private rewriteImportInAllModules(): void {
        const localModulesPath = this.graphTokenAllDependency.getLocalModulesPath();
        // let i = 1;
        for (const localModulePath of localModulesPath) {
            if (this.graphTokenAllDependency.getImportedTokenByModule(localModulePath).size !== 0) {
                // process.stdout.clearLine(0);
                // process.stdout.cursorTo(0);
                // log(`writing import (${i} / ${localModulesPath.length}) ` + localModulePath);
                let sourceText = readFileSync(localModulePath).toString();
                sourceText = this.replaceImports(this.filesToImportsNodes.get(localModulePath), sourceText, localModulePath);
                if (this.addLogsLoaded) {
                    const append = "console.log(\"" + basename(localModulePath) + " loaded\");";
                    sourceText.trimEnd();
                    sourceText = sourceText.replace(new RegExp(append + '$'), '');
                    sourceText += EOL + append;
                }
                sourceText.trimEnd();

                writeFileSync(localModulePath, sourceText + EOL);
            }
            // ++i;
        }
    }

    private writeGlobalNamespace(): void {
        info(`writing globalNamespace` + EOL);
        const sourcefile = ts.createSourceFile(
            basename(this.globalNamespacePath),
            "",
            ts.ScriptTarget.ES2020,
            /* setParentNodes */ false,
            ts.ScriptKind.TS
        );

        // write the hard dependency with a correct order
        const exportsHard: ts.ExportDeclaration[] = [];
        const hardDependencyOrder = aTopologicalOrder(this.graphTokenHardDependency.getGraph());
        for (const modulePath of hardDependencyOrder
            .filter(m => !m.includes("node_modules"))
            .filter(m => m !== this.globalNamespacePath)
        ) {
            exportsHard.push(this.createExport(modulePath));
        }
        if (exportsHard.length > 0) {
            ts.addSyntheticLeadingComment(
                exportsHard[0],
                ts.SyntaxKind.MultiLineCommentTrivia,
                " Hard dependencies ",
                true
            );
        }

        // write the every other module in any order
        const exportsSoft: ts.ExportDeclaration[] = [];
        const hardDependency = new Set(hardDependencyOrder);
        const softDependencyOrder = this.graphTokenAllDependency.getLocalModulesPath().sort();
        for (const modulePath of softDependencyOrder
            .filter(m => !m.includes("node_modules"))
            .filter(m => m !== this.globalNamespacePath)
            .filter(m => !hardDependency.has(m))
        ) {
            exportsSoft.push(this.createExport(modulePath));
        }
        if (exportsSoft.length > 0) {
            ts.addSyntheticLeadingComment(
                exportsSoft[0],
                ts.SyntaxKind.MultiLineCommentTrivia,
                " Other dependencies ",
                true
            );
        }

        const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
        // tslint:disable: no-bitwise
        const result = printer.printList(
            ts.ListFormat.MultiLine,
            ts.factory.createNodeArray(exportsHard.concat(exportsSoft), false),
            sourcefile
        );
        writeFileSync(this.globalNamespacePath, result);
    }

    private createExport(modulePath: string): ts.ExportDeclaration {
        return ts.factory.createExportDeclaration(
            [],
            false,
            undefined,
            ts.factory.createStringLiteral(relative(this.globalNamespacePath, modulePath))
        );
    }

    public execute(): void {
        if (this.formatImport) {
            this.rewriteImportInAllModules();
        }
        if (existsSync(this.globalNamespacePath)) {
            unlinkSync(this.globalNamespacePath);
        }
        this.writeGlobalNamespace();
    }
}
