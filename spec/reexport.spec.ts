import { basename } from "path";
import { createParser } from "./utils";


it("reexport", () => {
    const parser = createParser("reexport/tsconfig.json");
    const graphToken = parser.getAllDependencies();
    // expect all symbols since all symbols are used
    const dependencies: [string, string][] =
        Array.from(graphToken.getGraph().edgeList())
        .map(([u, v]) => [basename(u), basename(v)] as [string, string])
        .sort();
    expect(dependencies).toEqual([
        ["index.ts", "d1.ts"]
    ]);
});
