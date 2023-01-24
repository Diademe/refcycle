import ts from "typescript";


/** Generate documentation for all classes in a set of .ts files */
export class AstTraversal {
    protected program: ts.Program;
    protected compilerOptions: ts.CompilerOptions;

    /**
     * @param fileNames an array of root files from which the program start
     * @param compilerOptions the option specified in tsconfig.json
     */
    constructor(
        fileNames: string[],
        compilerOptions: ts.CompilerOptions
    ) {
        // Build a program using the set of root file names in fileNames
        this.program = ts.createProgram(fileNames, compilerOptions);
        this.compilerOptions = compilerOptions;
    }

    /**
     * given a module and an import from this module, give the path of the imported module
     * @param moduleName the name of the module (ex: `import A from "./my_module"` gives `./my_module`)
     * @param containingFile the full path a the file from which the module is imported
     */
    protected moduleNameResolver(moduleName: string, containingFile: string): ts.ResolvedModuleWithFailedLookupLocations {
        return ts.resolveModuleName(moduleName, containingFile, this.compilerOptions, ts.sys);
    }
}
