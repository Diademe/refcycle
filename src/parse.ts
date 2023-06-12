import ts from "typescript";
import { EOL } from "os";

import { GraphToken } from "./graphToken";
import { AstTraversal } from "./astTraversal";
import { trimQuote } from "./utils";
import { error, debug } from "./log";
import { info } from "console";
import { normalize } from "path";
import { exclusion } from "./exclusion";

export interface IImport {
    isLibrary: boolean;
    path: string;
    text: string;
    start: number;
    end: number;
}

/** Generate documentation for all classes in a set of .ts files */
export class ParseProject extends AstTraversal {
    private checker: ts.TypeChecker;

    /**
     * @param fileNames an array of root files from which the program start
     * @param compilerOptions the option specified in tsconfig.json
     */
    constructor(
        fileNames: string[],
        compilerOptions: ts.CompilerOptions
    ) {
        super(fileNames, compilerOptions);
        // Get the checker, we will use it to find more about classes
        this.checker = this.program.getTypeChecker();
    }

    private static getImportPath(node: ts.ImportDeclaration | ts.ImportEqualsDeclaration): string {
        if (ts.isImportDeclaration(node)) {
            return trimQuote(node.moduleSpecifier.getText());
        }
        else if (ts.isExternalModuleReference(node.moduleReference)) {
            return trimQuote(node.moduleReference.expression.getText());
        }
        else throw Error(`import not supported ${node.getText()}`);
    }

    /**
     * get the name of the module from which the symbol is exported (no recursion in case of re export)
     */
    private static getModuleNameFromImportedSymbolDeclaration(declarations: ts.Declaration[]): string {
        let parent: ts.Node = declarations[0];
        while (!(ts.isImportDeclaration(parent) || ts.isImportEqualsDeclaration(parent))) {
            parent = parent.parent;
        }
        return ParseProject.getImportPath(parent);
    }


    /**
     * test if the symbole is exported from another module
     * @param symbol
     */
    private static isImported(symbol: ts.Symbol | undefined): boolean {
        return !!symbol?.declarations?.find(node =>
            ts.isNamespaceImport(node) ||
            ts.isImportClause(node) ||
            ts.isImportSpecifier(node) ||
            ts.isImportEqualsDeclaration(node));
    }

    /**
     * generate the graph of hard dependencies of the program
     */
    public getHardDependencies(): GraphToken {
        let sourceFile: ts.SourceFile;
        const DB = new GraphToken();
        const visit = (node: ts.Node) => {
            if (ts.isImportDeclaration(node)
            || ts.isInterfaceDeclaration(node)) {
                return;
            }
            if (ts.isCallExpression(node)) { // visit parameter of a function call
                node.arguments.forEach(visit);
                visit(node.expression);
                return;
            }
            if (ts.isClassDeclaration(node)) {
                const staticMembers = (node.members.filter(ts.canHaveModifiers) as ts.HasModifiers[])
                .filter(
                    m => (ts.getModifiers(m) ?? []).find((modifier) => modifier.kind === ts.SyntaxKind.StaticKeyword)
                        ?? false
                );
                staticMembers.forEach(visit);
            }
            if (ts.isFunctionDeclaration(node)
                || ts.isMethodDeclaration(node)
                || ts.isPropertyDeclaration(node)
                || ts.isParameter(node)
                || ts.isClassDeclaration(node)
                || ts.isAccessor(node)
                || ts.isParameter(node)
                || ts.isConstructorDeclaration(node)) {
                if (ts.canHaveDecorators(node)) {
                    (ts.getDecorators(node) ?? []).forEach(visit);
                }
            }
            if (ts.isFunctionDeclaration(node)
                || ts.isMethodDeclaration(node)
                || ts.isArrowFunction(node)
                || ts.isAccessor(node)) {
                return;
            }
            if (ts.isParameter(node)) {
                if (node.initializer) {
                    visit(node.initializer);
                }
                return;

            }
            if (ts.isPropertyDeclaration(node) && ts.canHaveModifiers(node)) {
                if (ParseProject.isStatic(node) && node.initializer) {
                    visit(node.initializer);
                }
                const decorators = (ts.getModifiers(node) ?? []).filter(ts.isDecorator);
                decorators.forEach(visit);
                return;
            }
            if (ts.isGetAccessorDeclaration(node)) {
                if (ParseProject.isStatic(node) && node.body) {
                    visit(node.body);
                }
                return;
            }
            if (ts.isConstructorDeclaration(node)) {
                node.parameters.forEach(visit);
                return;
            }
            this.addDependencyIfNodeValide(node, sourceFile, DB, true);
            ts.forEachChild(node, visit);
        };
        // Visit every sourceFile in the program
        const sourceFiles = this.program.getSourceFiles();
        let i = 1;
        for (sourceFile of sourceFiles) {
            if (!sourceFile.isDeclarationFile) { // avoid d.ts file
                debug(`parsing file (Hard dependencies) (${i} / ${sourceFiles.length}) ` + sourceFile.fileName);
                // Walk the tree to search for classes
                ts.forEachChild(sourceFile, visit);
            }
            ++i;
        }
        info("parsing file (Hard dependencies): done" + EOL);
        return DB;
    }

    private static isStatic(node: ts.Declaration) {
        return ts.canHaveModifiers(node)
            && (ts.getModifiers(node) ?? []).find((modifier) => modifier.kind === ts.SyntaxKind.StaticKeyword);
    }

    /**
     * all symboles that appear in an import statement
     */
    public getAllDependencies(): GraphToken {
        const graphToken = new GraphToken();
        let sourceFile: ts.SourceFile;
        const collectImportSymbol = (node: ts.Node) => {
            this.addDependencyIfNodeValide(node, sourceFile, graphToken, false);
            ts.forEachChild(node, collectImportSymbol);
        };
        const visit = (node: ts.Node) => {
            if (ts.isImportDeclaration(node) || ts.isImportEqualsDeclaration(node)) {
                collectImportSymbol(node);
                return;
            }
            this.addDependencyIfNodeValide(node, sourceFile, graphToken, true);
            ts.forEachChild(node, visit);
        };
        // Visit every sourceFile in the program
        const sourceFiles = this.program.getSourceFiles();
        let i = 1;
        for (sourceFile of sourceFiles) {
            if (!sourceFile.isDeclarationFile) { // avoid d.ts file
                // process.stdout.clearLine(0);
                // process.stdout.cursorTo(0);
                debug(`parsing file (Soft dependencies) (${i} / ${sourceFiles.length}) ` + sourceFile.fileName);
                ts.forEachChild(sourceFile, visit);
            }
            ++i;
        }
        debug(EOL + "parsing file (Soft dependencies): done" + EOL);
        return graphToken;
    }

    /**
     * all import statement in each file
     */
    public getImportsNodes(globalNamespace: string): Map<string, IImport[]> {
        const globalNamespaceNormalized = normalize(globalNamespace);
        const results = new Map<string, IImport[]>();
        let sourceFile: ts.SourceFile;
        let importOfCurrentFiles: IImport[];
        const visit = (node: ts.Node) => {
            if (ts.isImportDeclaration(node) || ts.isImportEqualsDeclaration(node)) {
                const moduleName = ParseProject.getImportPath(node);
                const moduleNameResolver = this.moduleNameResolver(
                    moduleName,
                    sourceFile.fileName
                );
                const isLibrary = moduleNameResolver.resolvedModule?.isExternalLibraryImport ?? false;
                const modulePath = moduleNameResolver.resolvedModule?.resolvedFileName ?? "";
                const isExcluded = exclusion(modulePath);

                if (!isLibrary && !isExcluded && globalNamespaceNormalized !== normalize(modulePath)) {
                    info(`[warning] ${modulePath} isn't imported from ${globalNamespace} in ${sourceFile.fileName}`);
                }
                importOfCurrentFiles.push({
                    start: node.getStart(),
                    end: node.getEnd(),
                    isLibrary,
                    text: node.getText(),
                    path: moduleName
                });
            }
        };
        // Visit every sourceFile in the program
        const sourceFiles = this.program.getSourceFiles();
        let i = 1;
        for (sourceFile of sourceFiles) {
            if (!sourceFile.isDeclarationFile) { // avoid d.ts file
                importOfCurrentFiles = [];
                debug(`parsing file (import) (${i} / ${sourceFiles.length}) ` + sourceFile.fileName + EOL);
                ts.forEachChild(sourceFile, visit);
                results.set(sourceFile.fileName, importOfCurrentFiles);
            }
            ++i;
        }
        info("parsing file (import): done" + EOL);
        return results;
    }

    /**
     * if `node` is an imported symbol, add a dependency between `sourceFile` and the declaration source file of the symbol
     * @param node from which the symbol is extracted
     * @param sourceFile file that depend on the `node`
     * @param graphToken dependency is stored inside
     * @param isUsed is the node actually used in the sourcefile (and not just imported)
     */
    private addDependencyIfNodeValide(node: ts.Node, sourceFile: ts.SourceFile, graphToken: GraphToken, isUsed: boolean) {
        const symbol = this.checker.getSymbolAtLocation(node);
        if (symbol && ParseProject.isImported(symbol)) { // if the symbol is used
            const exportedSymbol = this.realSymbol(symbol);
            const moduleNameResolver = this.moduleNameResolver(
                ParseProject.getModuleNameFromImportedSymbolDeclaration((symbol.declarations)!),
                sourceFile.fileName
            );
            const isLibrary = moduleNameResolver.resolvedModule?.isExternalLibraryImport ?? false;
            if (!this.checker.isUnknownSymbol(exportedSymbol)) {
                let exportedSymbolModulePath = moduleNameResolver.resolvedModule?.resolvedFileName ?? "";
                if (!isLibrary) {
                    const numberOfFilesDeclaration = new Set(exportedSymbol.getDeclarations()!.map(d => d.getSourceFile().fileName)).size;
                    if (numberOfFilesDeclaration === 0) {
                        throw new Error(`symbol ${symbol.getName()} alias ${exportedSymbol.getName()} as 0 declarations`);
                    }
                    // if multiple declaration in multiple sourceFile chose the first one
                    if (numberOfFilesDeclaration > 1) {
                        info(EOL + `symbol ${symbol.getName()} alias ${exportedSymbol.getName()} as ${numberOfFilesDeclaration} declarations file location` + EOL);
                    }
                    exportedSymbolModulePath = exportedSymbol.getDeclarations()![0].getSourceFile().fileName;
                }
                const isExcluded = exclusion(exportedSymbol.getDeclarations()![0].getSourceFile().fileName);
                graphToken.addTokenToFile(
                    exportedSymbol.getName(),
                    isLibrary,
                    isExcluded,
                    isUsed,
                    exportedSymbolModulePath,
                    exportedSymbol,
                    sourceFile.fileName
                );
            }
            else if (!isLibrary) {
                const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
                error(EOL + `can not parse ${symbol?.getName()} in file ${sourceFile.fileName}:${line}:${character}` + EOL);
            }
        }
    }

    /**
     * find the symbol that was exported first (some are reexported by `export * form "module"`)
     * @param symbol
     */
    private realSymbol(symbol: ts.Symbol): ts.Symbol {
        // eslint-disable-next-line no-bitwise
        return symbol.flags & ts.SymbolFlags.Alias ?
            this.checker.getAliasedSymbol(symbol) :
            symbol;
    }
}
