import { isCyclic, Graph } from "../src/graph";

describe("used", () => {
    it("is cyclic", () => {
        const G = new Graph<number, string>();
        G.addEdge(1, 2);
        G.addEdge(2, 1);
        expect(isCyclic(G)).toBe(true);
    });

    it("is self loop", () => {
        const G = new Graph<number, string>(true);
        G.addEdge(1, 1);
        expect(isCyclic(G)).toBe(true);
    });

    it("is not cyclic", () => {
        const G = new Graph<number, string>();
        G.addEdge(1, 2);
        G.addEdge(2, 3);
        G.addEdge(2, 4);
        expect(isCyclic(G)).toBe(false);
    });
});
