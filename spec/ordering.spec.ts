import { createParser } from "./utils";
import { aTopologicalOrder, isCyclic } from "../src/graph";
import { basename } from "path";

it("order possible", () => {
    const parser = createParser("order-possible/tsconfig.json");
    const graph = parser.getHardDependencies().getGraph();
    expect(
        aTopologicalOrder(graph)
            .filter(m => !m.includes("node_modules"))
            .map((m) => basename(m))
    ).toEqual([
        "b.ts",
        "a.ts",
        "index.ts"
    ]);
    expect(isCyclic(graph)).toBe(false);

});

it("no order", () => {
    const parser = createParser("no-order/tsconfig.json");
    const graph = parser.getHardDependencies().getGraph();
    expect(isCyclic(graph)).toBe(true);
});
