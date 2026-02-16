/**
 * Simplified sankey layout computation.
 *
 * Assigns nodes to layers via topological ordering,
 * then positions nodes and links within available space.
 * Extracted from the sankey renderer for clarity.
 */
export interface SankeyNode {
    name: string;
    x0: number;
    x1: number;
    y0: number;
    y1: number;
    value: number;
    sourceLinks: SankeyLink[];
    targetLinks: SankeyLink[];
    layer: number;
}
export interface SankeyLink {
    source: SankeyNode;
    target: SankeyNode;
    value: number;
    width: number;
    y0: number;
    y1: number;
}
export declare function computeSankeyLayout(nodeNames: string[], linkData: {
    source: string;
    target: string;
    value: number;
}[], width: number, height: number, nodeWidth: number, nodePadding: number): {
    nodes: SankeyNode[];
    links: SankeyLink[];
};
//# sourceMappingURL=sankey-layout.d.ts.map