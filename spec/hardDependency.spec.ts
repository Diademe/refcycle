import { basename } from "path";
import { isCyclic } from "../src/graph";
import { createParser } from "./utils";

describe("hard dependencies", () => {
    it("get graph exemple 1: acyclic", () => {
        const parser = createParser("hard-dependencies/tsconfig.json");
        const result = parser.getHardDependencies().getGraph();
        // create edge list
        const edgeList = Array.from(result.edgeList()).map(([u, v]) => [basename(u), basename(v)] as [string, string]).sort();
        expect(edgeList).toEqual([
            ["g1.ts", "static.ts"],
            ["g2.ts", "a-string.ts"],
            ["g2.ts", "class-decorator.ts"],
            ["g2.ts", "g1.ts"],
            ["g2.ts", "member-decorator.ts"],
            ["g3.ts", "g2.ts"],
            ["index.ts", "g3.ts"]
        ]);
        expect(isCyclic(result)).toBe(false);
    });
    it("get graph exemple 2: cyclic", () => {
        const parser = createParser("cyclic/tsconfig.json");
        const result = parser.getHardDependencies().getGraph();
        // creat edge list
        const edgeList = Array.from(result.edgeList()).map(([u, v]) => [basename(u), basename(v)] as [string, string]).sort();
        expect(edgeList).toEqual([
            ["a2.ts", "a3.ts"],
            ["a3.ts", "index.ts"],
            ["index.ts", "a2.ts"]
        ]);
        expect(isCyclic(result)).toBe(true);
    });
});
