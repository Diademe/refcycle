import { exit } from "process";
import { basename } from "path";
import { EOL } from "os";
import { existsSync } from "fs";

import { RewriteImport } from "./output/rewriteImport";
import { graph2gml } from "./output/outputGraph";
import { createParserFromTsconfig } from "./createParser";
import { isCyclic, SCC } from "./graph";
import { reverseMap, toPosixPath } from "./utils";
import { error, info, debug } from "./log";
import { regex } from "./exclusion";


const startingArgumentIndex = 2;

if (process.argv[startingArgumentIndex] === "--help" || process.argv.length - startingArgumentIndex < 3) {
    info(
`Ref cycle usage:
node ./dist/index.js <tsConfigPath> <globalNamespacePath> <format> [exclusion] [graphHardDependenciesPath]`
);
    exit();
}

const tsConfigPath = process.argv[startingArgumentIndex];
const globalNamespacePath = process.argv[startingArgumentIndex + 1];
const formatImport = process.argv[startingArgumentIndex + 2] === "true";

const exclusionArg = process.argv[startingArgumentIndex + 3];
if (exclusionArg && exclusionArg !== "null") regex.val = new RegExp(exclusionArg);
const graphHardDependenciesPath = process.argv[startingArgumentIndex + 4];

if (!existsSync(tsConfigPath)) {
    error("tsconfig dosent exist : " + tsConfigPath + EOL);
    exit();
}

const parser = createParserFromTsconfig(tsConfigPath);
// parse the hard dependencies
const hardDependencies = parser.getHardDependencies();
const hardDependenciesGraph = hardDependencies.getGraph();

// if the graph of hard dependencies is cyclic, display the scc, and exit as there is no topological ordering for parsing the project
if (isCyclic(hardDependenciesGraph)) {
    debug(EOL + "cycle detected in hard dependencies graph here are the connected connected component" + EOL);
    const scc = SCC(hardDependenciesGraph);
    const sccReverse = reverseMap(scc);
    // print each scc
    let sccIndex = 0;
    for (const sc of Array.from(sccReverse.values())) {
        if (sc.size > 1) {
            debug(
                `scc ${++sccIndex} (${sc.size}): ` +
                Array.from(sc.values()).map(
                    module => basename(module).replace(/\.[^.]*$/, "")
                ).join(", ") + EOL
            );
        }
    }

    debug(EOL);
    if (graphHardDependenciesPath) {
        info(`hard dependencies graph generated at ${graphHardDependenciesPath}` + EOL);
        graph2gml(hardDependenciesGraph, graphHardDependenciesPath, scc, sccReverse);
    }
    else {
        error("provide a path as third argument to generate the hard dependencies graph" + EOL);
    }
    exit();
}

// get all dependencies
const allDependencies = parser.getAllDependencies();
const importsNodes = parser.getImportsNodes(globalNamespacePath);
const rw = new RewriteImport(
    hardDependencies,
    allDependencies,
    importsNodes,
    toPosixPath(globalNamespacePath),
    formatImport
);
rw.execute();
