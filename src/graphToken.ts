import ts from "typescript";

import { Token } from "./token";
import { Graph } from "./graph";


/**
 * provide a wrapper to the Graph
 * allow to add dependency between file path from symbole
 */
export class GraphToken {
    private symbolToToken: Map<ts.Symbol, Token<ts.Symbol>>;
    private readonly G: Graph<string, Token<ts.Symbol>>;

    constructor() {
        this.symbolToToken = new Map();
        this.G = new Graph();
    }

    /** save the fact that a token have been imported in a module */
    public addTokenToFile(
        tokenName: string,
        tokenIsLibrary: boolean,
        tokenIsExcluded: boolean,
        tokenIsUsed: boolean,
        tokenDeclarationPath: string,
        tokenSymbol: ts.Symbol,
        /** path of the module where this token is used */ absoluteFilePath: string): void {
        let token: Token<ts.Symbol>;
        if (this.symbolToToken.has(tokenSymbol)) {
            token = this.symbolToToken.get(tokenSymbol);
            token.isUsed = token.isUsed || tokenIsUsed;
        }
        else {
            token = new Token(
                tokenName,
                tokenIsLibrary,
                tokenIsExcluded,
                tokenIsUsed,
                tokenDeclarationPath,
                tokenSymbol
            );
            this.symbolToToken.set(tokenSymbol, token);
        }
        this.G.addEdge(absoluteFilePath, tokenDeclarationPath, token);
    }

    /**
     * tokens that are imported (may not be used)
     */
    public getImportedTokenByModule(absoluteFilePath: string): Set<Token<ts.Symbol>> {
        return this.G.getEdgeDataFromNode(absoluteFilePath);
    }

    /**
     * paths of local module that import symbols
     */
    public getLocalModulesPath(): string[] {
        return Array.from(this.G.getNodes()).filter(path => !path.includes("node_modules"));
    }

    /**
     * graph from dependent to dependency, with token used as data on edges
     */
    public getGraph(): Graph<string, Token<ts.Symbol>> {
        return this.G.clone();
    }
}
