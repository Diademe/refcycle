import ts, { ScriptTarget } from "typescript";
import paths from "path";

import { readFileSync, writeFileSync, unlinkSync, existsSync } from "fs";

import { GraphToken } from "../graphToken";
import { aTopologicalOrder } from "../graph";
import { basename } from "path";
import { EOL } from "os";

import { toPosixPath } from "../utils";
import { IImport } from "../parse";
import { info, error } from "../log";
import { Token } from "../token";
import { exclusion } from "../exclusion";
import { exit } from "process";


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

/** replace text[start...end] by inText, trim text[0...start] */
function replaceTrim(text: string, inText: string, start: number, end: number) {
    const head = inText.slice(0, start).trimEnd();
    const tail = inText.slice(end);
    const result: string[] = [];
    if (head.length > 0) {
        result.push(head);
        result.push(""); // add a new line under copyright
    }
    if (text.length > 0) result.push(text);
    if (tail.length > 0) result.push(tail);
    return result.join(EOL);
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

    private static readonly singleLineMaxLength: number = 80;

    /** read import, using AST, and format them */
    private static travers(node: ts.Node, indent: string): string {
        if (ts.isImportDeclaration(node) && node.importClause) {
            const file = node.moduleSpecifier.getText();
            const importClause = node.importClause.name?.getText() ?? null; // import uuid from "uuid"

            const namedBinding = node.importClause.namedBindings;
            const namespaceImport = namedBinding && ts.isNamespaceImport(namedBinding) ? namedBinding.name.getText() : null; // import * as uuid from "uuid"
            const bindings: string[] = [];
            if (namedBinding && ts.isNamedImports(namedBinding)) { // import { A1, A2 } from "./file";
                for (const elt of namedBinding.elements) {
                    let imp = elt.name.getText();
                    if (elt.propertyName) { // import { A3 as A3Alias } from "./file";
                        imp = `${elt.propertyName.getText()} as ${imp}`;
                    }
                    bindings.push(imp);
                }
            }
            const renderImport = (multiLine: boolean): string => {
                // do not add the import if no token is imported
                // this case may occurs if every token are removed from global namespace
                if (importClause || namespaceImport || bindings.length > 0) {
                    if (!importClause && !namespaceImport)
                    {
                        if (multiLine) {
                            return [
                                "import",
                                "{",
                                    bindings.map(b => indent + b).join("," + EOL),
                                `} from ${file};`
                            ].join(EOL);
                        }
                        else {
                            return "import { " + bindings.join(", ") + ` } from ${file};`;
                        }
                    }
                    else {
                        const result: string[] = [];
                        if (importClause !== null) {
                            result.push((multiLine ? indent : "") + importClause);
                        }
                        if (namespaceImport !== null) {
                            result.push((multiLine ? indent : "") + namespaceImport);
                        }
                        if (bindings.length > 0) {
                            result.push(...[
                                indent + "{",
                                bindings.map(b =>  indent + indent + b).join("," + EOL),
                                indent + "}"
                            ]);
                        }
                        if (multiLine) {
                            return [
                                "import",
                                result.join(EOL),
                                `from ${file};`
                            ].join(EOL);
                        }
                        else {
                            return "import " + result.join(", ") + ` from ${file};`;
                        }
                    }
                }
                else {
                    return "";
                }
            };
            const singleLine = renderImport(false);
            return singleLine.length > RewriteImport.singleLineMaxLength ? renderImport(true) : singleLine;
        }
        if (ts.isImportDeclaration(node) && !node.importClause) { // import "filename";
            const identifier = node.moduleSpecifier.getText();
            return `import ${identifier};`;
        }
        else if (ts.isImportEqualsDeclaration(node)) {
            const identifier = node.name.getText();
            const required = node.moduleReference.getText();
            return `import ${identifier} = ${required};`;
        }
        else {
            error(`import error : '${node.getText()}'` + EOL);
            exit();
        }
    }
    private static formatImport(importText: string, indent: string, target: ScriptTarget): string {
        const sourceFile = ts.createSourceFile(
            "fileName",
            importText,
            target,
            /* setParentNodes */ true
        );
        return this.travers(sourceFile.statements[0], indent);
    }

    /**
     * add replace import of a file with formatted import
     * @param imports imports to add to this file (both library and not library)
     * @param fullSource source text
     * @param localModulePath path to the source file
     */
    private replaceImports(imports: IImport[], fullSource: string, localModulePath: string, target: ScriptTarget): string {
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
        const indent = "    ";
        const importsText: string[] = [];
        const libraryImports = imports.filter(i => i.isLibrary).sort((a, b) => a.path.localeCompare(b.path));
        importsText.push(...libraryImports.map((i) => RewriteImport.formatImport(i.text, indent, target)));

        const emptyLineMarker = "/*!--empty-line--!*/";
        const emptyLineRegexp = /\/\*!--empty-line--!\*\//g;

        const excludedImports = Array.from(
            this.graphTokenAllDependency.getImportedTokenByModule(localModulePath).values()
        ).filter(i => !i.isLibrary && i.isExcluded);
        if (excludedImports.length > 0) {
            const groupByPath = new Map<string, Token<ts.Symbol>[]>(excludedImports.map(e => [e.declarationPath, []]));
            for (const e of excludedImports)
            {
                groupByPath.get(e.declarationPath)!.push(e);
            }
            importsText.push(emptyLineMarker);

            for (const [path, tokens] of groupByPath)
            {
                const excludedImportsFormatted = tokens
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map(e => e.name)
                        .join(", ");
                const relativePath = relative(localModulePath, path);
                const importText = `import { ${excludedImportsFormatted} } from "${relativePath}";`;
                importsText.push(importText);
            }
        }

        const localImports = Array.from(
            this.graphTokenAllDependency.getImportedTokenByModule(localModulePath).values()
        ).filter(i => !i.isLibrary && !i.isExcluded);
        if (localImports.length > 0) {
            importsText.push(emptyLineMarker);
            const currentLocalImport: string[] = [];
            currentLocalImport.push("import { ");
            const localImportsFormatted = localImports
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((t) => indent + t.name + ",");
            // remove last "," in imports
            const iLast = localImportsFormatted.length - 1;
            const lastImport = localImportsFormatted[iLast];
            localImportsFormatted[iLast] = lastImport.substring(0, lastImport.length - 1);

            currentLocalImport.push(...localImportsFormatted);
            currentLocalImport.push(`} from "${relative(localModulePath, this.globalNamespacePath)}";`);
            importsText.push(RewriteImport.formatImport(currentLocalImport.join(" "), indent, target));
        }

        if (libraryImports.length + excludedImports.length + localImports.length > 0) {
            importsText.push(emptyLineMarker, emptyLineMarker);
        }

        return replaceTrim(importsText.join(EOL), fullSource, insertImportsStart, insertImportsEnd)
            .replace(emptyLineRegexp, "");
    }

    private rewriteImportInAllModules(target: ScriptTarget): void {
        const localModulesPath = this.graphTokenAllDependency.getLocalModulesPath();
        // let i = 1;
        for (const localModulePath of localModulesPath) {
            const tokenInFile = this.graphTokenAllDependency.getImportedTokenByModule(localModulePath);
            if (tokenInFile.size !== 0) {
                // process.stdout.clearLine(0);
                // process.stdout.cursorTo(0);
                // log(`writing import (${i} / ${localModulesPath.length}) ` + localModulePath);
                let sourceText = readFileSync(localModulePath).toString();
                sourceText = this.replaceImports(this.filesToImportsNodes.get(localModulePath)!, sourceText, localModulePath, target);
                if (this.addLogsLoaded) {
                    const append = "console.log(\"" + basename(localModulePath) + " loaded\");";
                    sourceText = sourceText.trimEnd();
                    sourceText = sourceText.replace(new RegExp(append + '$'), '');
                    sourceText += EOL + append;
                }
                sourceText = sourceText.trimEnd();

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
            .filter(m => !exclusion(m))
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
            .filter(m => !exclusion(m))
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

    public execute(target: ScriptTarget): void {
        if (this.formatImport) {
            this.rewriteImportInAllModules(target);
        }
        if (existsSync(this.globalNamespacePath)) {
            unlinkSync(this.globalNamespacePath);
        }
        this.writeGlobalNamespace();
    }
}
