export class Graph<T, D = unknown> {
    private edges: Map<T, Map<T, Set<D>>>;
    constructor(public selfLoop = false) {
        this.edges = new Map<T, Map<T, Set<D>>>();
        this.selfLoop = selfLoop;
    }

    public clone(): Graph<T, D> {
        const result = new Graph<T, D>();
        result.selfLoop = this.selfLoop;
        for (const [u, vData] of this.edges) {
            const resultVData = new Map<T, Set<D>>();
            for (const [v, data] of vData) {
                resultVData.set(v, new Set(data));
            }
            result.edges.set(u, resultVData);
        }
        return result;
    }

    /**
     * add the node `n`
     * @param n
     */
    public addNode(n: T): void {
        if (!this.edges.has(n)) {
            this.edges.set(n, new Map<T, Set<D>>());
        }
    }

    /**
     * add the nodes `from` and `to`
     *
     * add the edge (`from`, `to`)
     *
     * add `data` to the edge (`from`, `to`)
     * @param from starting node of the edge
     * @param to ending node of the edge
     * @param data add to the set of data of the edge (`from`, `to`)
     */
    public addEdge(from: T, to: T, data?: D): void {
        this.addNode(from);
        this.addNode(to);
        if (this.selfLoop || from !== to) {
            const u = this.edges.get(from)!;
            if (!u.has(to)) {
                u.set(to, new Set());
            }
            if (data !== undefined) {
                u.get(to)!.add(data);
            }
        }
    }

    /**
     * get data from the edge (`from`, `to`)
     * @param from
     * @param to
     */
    public getDataFromEdge(from: T, to: T): Set<D> {
        return this.edges.get(from)!.get(to)!;
    }

    /**
     * merge data of edge starting from the node `from`
     * @param from
     */
    public getEdgeDataFromNode(from: T): Set<D> {
        const res = new Set<D>();
        for (const dataSet of this.edges.get(from)!.values()) {
            for (const d of dataSet) {
                res.add(d);
            }
        }
        return res;
    }

    /**
     * get all nodes of the graph
     */
    public getNodes(): IterableIterator<T> {
        return this.edges.keys();
    }

    /**
     * get all the adjacent node of `n`
     * @param n
     */
    public getAdj(n: T): Set<T> {
        return new Set(this.edges.get(n)!.keys());
    }

    /**
     * return true if (`u`, `v`) is in graph
     */
    public edgeExist(u: T, v: T): boolean {
        return this.edges.get(u)!.has(v);
    }

    /**
     * number of edges in the graph
     */
    public edgeCount(): number {
        return this.edges.keys.length;
    }

    public *edgeList(): IterableIterator<[T, T]> {
        for (const u of this.getNodes()) {
            for (const v of this.getAdj(u)) {
                yield [u, v];
            }
        }
    }
}

export function transpose<T, D>(G: Graph<T, D>): Graph<T, D> {
    const res = new Graph<T, D>(true);
    for (const v of G.getNodes()) {
        res.addNode(v);
    }
    for (const v of G.getNodes()) {
        for (const w of G.getAdj(v)) {
            res.addEdge(w, v);
            for (const d of G.getDataFromEdge(v, w)) {
                res.addEdge(w, v, d);
            }
        }
    }
    return res;
}

/**
 * create a mapping from node to a zero indexe based strongly connected component
 * @param G
 */
export function SCC<T, D>(G: Graph<T, D>): Map<T, number> {
    const stack: T[] = [];
    const visited: Set<T> = new Set<T>();
    const result: Map<T, number> = new Map<T, number>();
    const transposedGraph: Graph<T, D> = transpose(G);
    let CCNumber: number = 0;

    function fillOrder(v: T) {
        visited.add(v);
        for (const w of G.getAdj(v)) {
            if (!visited.has(w)) {
                fillOrder(w);
            }
        }
        stack.push(v);
    }

    function DFSUtil(v: T): void {
        visited.add(v);
        result.set(v, CCNumber);
        for (const w of transposedGraph.getAdj(v)) {
            if (!visited.has(w)) {
                DFSUtil(w);
            }
        }
    }

    for (const v of G.getNodes()) {
        if (!visited.has(v)) {
            fillOrder(v);
        }
    }

    visited.clear();

    while (stack.length > 0) {
        const v: T = stack.pop()!;
        if (!visited.has(v)) {
            DFSUtil(v);
            CCNumber++;
        }
    }

    return result;
}

/**
 * make sure each edge goes both way
 * @param G
 */
export function undirectedGraph<T, D>(G: Graph<T, D>): Graph<T, D> {
    const res = new Graph<T, D>(G.selfLoop);
    for (const u of G.getNodes()) {
        res.addNode(u);
        for (const v of G.getAdj(u)) {
            res.addEdge(u, v);
            res.addEdge(v, u);
            for (const d of G.getDataFromEdge(u, v)) {
                res.addEdge(u, v, d);
            }
        }
    }
    return res;
}

export function topologicalSort<T, D>(G: Graph<T, D>): T[] {
    const stack: T[] = [];
    const nodes = G.getNodes();
    const visited: Set<T> = new Set<T>();

    function topologicalSortUtil(u: T): void {
        visited.add(u);
        for (const v of G.getAdj(u)) {
            if (!visited.has(v)) {
                topologicalSortUtil(v);
            }
        }
        stack.push(u);
    }

    for (const n of nodes) {
        if (!visited.has(n)) {
            topologicalSortUtil(n);
        }
    }

    return stack.reverse();
}

export function isCyclic<T, D>(G: Graph<T, D>): boolean {
    const nodes = G.getNodes();
    const visited: Set<T> = new Set<T>();
    const recursionStack: Set<T> = new Set<T>();

    function isCyclicUtil(v: T) {
        if (!visited.has(v)) {
            visited.add(v);
            recursionStack.add(v);
            for (const w of G.getAdj(v)) {
                if (!visited.has(w) && isCyclicUtil(w)) {
                    return true;
                }
                else if (recursionStack.has(w)) {
                    return true;
                }
            }
        }
        recursionStack.delete(v);
        return false;
    }

    for (const v of nodes) {
        if (isCyclicUtil(v)) {
            return true;
        }
    }
    return false;
}

export function aTopologicalOrder<T>(G: Graph<T>): T[] {
    return topologicalSort(transpose(G));
}
