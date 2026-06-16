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
/**
 * Position a column of nodes vertically: scale by value, enforce min height, compress if needed.
 * Shared between sankey and alluvial layouts.
 */
export declare function layoutColumnY(nodes: Array<{
    value: number;
    y0: number;
    y1: number;
}>, height: number, padding: number): void;
