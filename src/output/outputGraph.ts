import { basename } from "path";
import { EOL } from "os";
import { writeFileSync } from "fs";

import { Graph } from "../graph";
import { Token } from "../token";
import { getAColor } from "../utils";


/**
 * print the graph in a .gml, each strongly connected component with its own color
 * @param G the graph to print
 * @param path the path of the file where to print the graph
 * @param scc
 * @param reverseScc
 */
export function graph2gml<N extends { toString: () => string}, T>(G: Graph<N, Token<T>>, path: string, scc: Map<N, number>, reverseScc: Map<number, Set<N>>): void {
    const res: string[] = [];
    const colorMap = new Map<N, number>();
    const sccIndexToSccColor = new Map<number, number>();
    const colorIndexForUnitScc = 1; // skip back color
    let colorIndex = colorIndexForUnitScc + 1;
    for (const [node, sccIndex] of scc) {
        const sizeScc = reverseScc.get(sccIndex)!.size;
        if (sizeScc > 1) {
            if (sccIndexToSccColor.has(sccIndex)) {
                // already seen scc, find it's color
                colorMap.set(node, sccIndexToSccColor.get(sccIndex)!);
            }
            else {
                // new scc, new colorIndex
                sccIndexToSccColor.set(sccIndex, colorIndex);
                colorMap.set(node, colorIndex);
                colorIndex++;
            }
        }
        else {
            colorMap.set(node, colorIndexForUnitScc);
        }
    }
    // header
    res.push("graph [");
    res.push("  label \"Graph dependence\"");
    res.push("  directed 1");
    res.push("  id 0");
    // nodes
    let i = 1;
    const int2node: Map<N, number> = new Map();
    for (const node of G.getNodes()) {
        res.push("  node [");
        int2node.set(node, i);
        res.push(`    id ${i}`);
        res.push(`    label "${basename(node.toString()).replace(/\.[^.]*$/, "")}"`);
        res.push("    graphics [");
        res.push(`      fill "${getAColor(colorMap.get(node)!)}"`);
        res.push("    ]");
        res.push("  ]");
        i++;
    }
    // edges
    for (const [from, to] of G.edgeList()) {
        /* skip builtin type : they were not imported */
        if (int2node.has(from) && int2node.has(to)) {
            const label = Array.from(G.getDataFromEdge(from, to).values())
                .map(token => token.name)
                .join(", ");
            res.push("  edge [");
            res.push(`    source ${int2node.get(from)}`);
            res.push(`    target ${int2node.get(to)}`);
            res.push(`    label "${label}"`);
            res.push("    graphics [");
            res.push('      targetArrow "standard"');
            if (scc.get(from) === scc.get(to)) {
                res.push(`      fill "${getAColor(colorMap.get(from)!)}"`);
            }
            res.push("    ]");
            res.push("  ]");
        }
    }
    // footer
    res.push("]");

    writeFileSync(path, res.join(EOL));
}
