import { SCC, Graph } from "../src/graph";


it("Connected Component", () => {
    const G = new Graph<number>();
    G.addEdge(1, 2);
    G.addEdge(2, 3);
    G.addEdge(3, 1);

    G.addEdge(4, 5);
    G.addEdge(5, 4);

    G.addEdge(5, 1);

    G.addNode(6);

    const scc = SCC(G);

    expect(scc.get(1) === scc.get(2) && scc.get(1) === scc.get(3)).toBe(true); // 1, 2, 3 in a connected component
    expect(scc.get(4) === scc.get(5) && scc.get(1) !== scc.get(5)).toBe(true); // 4, 5 in a connected component
    expect(scc.get(6) !== scc.get(1) && scc.get(6) !== scc.get(5)).toBe(true); // 6 in a connected component
});
