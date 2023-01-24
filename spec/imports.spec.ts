import { ParseProject } from "../src/parse";
import { basename } from "path";
import { createParser } from "./utils";
import { GraphToken } from "../src/graphToken";


let parser: ParseProject;

describe("symboles in uses", () => {
    beforeEach(() => {
        parser = createParser("import/tsconfig-used.json");
    });
    it("get used imported symbols", () => {
        const nbSymbolsImported = new Map<string, number>([
            ["index-used.ts", 9],
            ["a1.ts", 0],
            ["a2.ts", 0],
            ["a3.ts", 0],
            ["a4.ts", 0],
            ["a5.ts", 0],
            ["a6.ts", 0],
            ["a7.ts", 0],
            ["a8.ts", 0],
            ["a9.ts", 0]
        ]);
        const nbFilesImported = new Map<string, number>([
            ["index-used.ts", 7],
            ["a1.ts", 0],
            ["a2.ts", 0],
            ["a3.ts", 0],
            ["a4.ts", 0],
            ["a5.ts", 0],
            ["a6.ts", 0],
            ["a7.ts", 0],
            ["a8.ts", 0],
            ["a9.ts", 0]
        ]);
        // expect all symbols since all symbols are used
        const tokenGraph: GraphToken = parser.getAllDependencies();
        for (const localModulePath of tokenGraph.getLocalModulesPath()) {
            const tokens = Array.from(tokenGraph.getImportedTokenByModule(localModulePath));
            expect(tokens.length).toBe(nbSymbolsImported.get(basename(localModulePath)));
            expect(
                new Set(
                    tokens.map(t => t.declarationPath)
                ).size).toBe(nbFilesImported.get(basename(localModulePath)));
        }
    });
    it("get all symbol that may be unused", () => {
        const nbSymbolsImported = new Map<string, number>([
            ["index-used.ts", 9],
            ["a1.ts", 0],
            ["a2.ts", 0],
            ["a3.ts", 0],
            ["a4.ts", 0],
            ["a5.ts", 0],
            ["a6.ts", 0],
            ["a7.ts", 0],
            ["a8.ts", 0],
            ["a9.ts", 0]
        ]);
        const nbFilesImported = new Map<string, number>([
            ["index-used.ts", 7],
            ["a1.ts", 0],
            ["a2.ts", 0],
            ["a3.ts", 0],
            ["a4.ts", 0],
            ["a5.ts", 0],
            ["a6.ts", 0],
            ["a7.ts", 0],
            ["a8.ts", 0],
            ["a9.ts", 0]
        ]);
        // expect all symbols since all symbols are used
        const tokenGraph: GraphToken = parser.getAllDependencies();
        for (const localModulePath of tokenGraph.getLocalModulesPath()) {
            const tokens = Array.from(tokenGraph.getImportedTokenByModule(localModulePath));
            expect(tokens.filter(t => t.isUsed).length).toBe(nbSymbolsImported.get(basename(localModulePath)));
            expect(
                new Set(
                    tokens.filter(t => t.isUsed).map(t => t.declarationPath)
                ).size).toBe(nbFilesImported.get(basename(localModulePath)));
        }
    });
});

describe("symbole are unused", () => {
    beforeEach(() => {
        parser = createParser("import/tsconfig-not-used.json");
    });
    it("get used imported symbols", () => {
        const nbSymbolsImported = new Map<string, number>([
            ["index-not-used.ts", 0],
            ["a1.ts", 0],
            ["a2.ts", 0],
            ["a3.ts", 0],
            ["a4.ts", 0],
            ["a5.ts", 0],
            ["a6.ts", 0],
            ["a7.ts", 0],
            ["a8.ts", 0],
            ["a9.ts", 0]
        ]);
        const nbFilesImported = new Map<string, number>([
            ["index-not-used.ts", 0],
            ["a1.ts", 0],
            ["a2.ts", 0],
            ["a3.ts", 0],
            ["a4.ts", 0],
            ["a5.ts", 0],
            ["a6.ts", 0],
            ["a7.ts", 0],
            ["a8.ts", 0],
            ["a9.ts", 0]
        ]);
        // expect all symbols since all symbols are used
        const tokenGraph: GraphToken = parser.getAllDependencies();
        for (const localModulePath of tokenGraph.getLocalModulesPath()) {
            const tokens = Array.from(tokenGraph.getImportedTokenByModule(localModulePath));
            expect(tokens.filter(t => t.isUsed).length).toBe(nbSymbolsImported.get(basename(localModulePath)));
            expect(
                new Set(
                    tokens.filter(t => t.isUsed).map(t => t.declarationPath)
                ).size).toBe(nbFilesImported.get(basename(localModulePath)));
        }
    });
    it("get all symbols that may be unused", () => {
        const nbSymbolsImported = new Map<string, number>([
            ["index-not-used.ts", 9],
            ["a1.ts", 0],
            ["a2.ts", 0],
            ["a3.ts", 0],
            ["a4.ts", 0],
            ["a5.ts", 0],
            ["a6.ts", 0],
            ["a7.ts", 0],
            ["a8.ts", 0],
            ["a9.ts", 0]
        ]);
        const nbFilesImported = new Map<string, number>([
            ["index-not-used.ts", 7],
            ["a1.ts", 0],
            ["a2.ts", 0],
            ["a3.ts", 0],
            ["a4.ts", 0],
            ["a5.ts", 0],
            ["a6.ts", 0],
            ["a7.ts", 0],
            ["a8.ts", 0],
            ["a9.ts", 0]
        ]);
        // expect all symbols since all symbols are used
        const tokenGraph: GraphToken = parser.getAllDependencies();
        for (const localModulePath of tokenGraph.getLocalModulesPath()) {
            const tokens = Array.from(tokenGraph.getImportedTokenByModule(localModulePath));
            expect(tokens.length).toBe(nbSymbolsImported.get(basename(localModulePath)));
            expect(
                new Set(
                    tokens.map(t => t.declarationPath)
                ).size).toBe(nbFilesImported.get(basename(localModulePath)));
        }
    });
});
