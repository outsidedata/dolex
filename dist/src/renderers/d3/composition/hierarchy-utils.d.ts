/**
 * Shared hierarchy utilities for composition renderers
 * (treemap, sunburst, circle-pack, icicle).
 *
 * Consolidates duplicated hierarchy-building, ancestor-traversal,
 * and color-derivation logic.
 */
/**
 * Creates a clamping function that ensures tiny positive values stay visible.
 * Values below 2% of the max are bumped up to the threshold.
 */
export declare function createMinVisibleClamp(data: Record<string, any>[], valueField: string, threshold?: number): (v: number) => number;
export interface BuildHierarchyOptions {
    /** Flat data rows */
    data: Record<string, any>[];
    /** The numeric value field */
    valueField?: string;
    /** Single category field (flat hierarchy) */
    categoryField?: string;
    /** Parent grouping field (2-level hierarchy) */
    parentField?: string;
    /** Child field within parent groups */
    childField?: string;
    /** Multi-level fields for nested hierarchy (overrides parent/child) */
    levelFields?: string[];
    /** Whether to sort children descending by value (default: true) */
    sort?: boolean;
}
/**
 * Unified hierarchy builder that handles:
 * - levelFields: multi-level nested hierarchy
 * - parentField + childField: two-level parent/child grouping
 * - parentField only: two-level with fallback child naming
 * - categoryField only: flat single-level
 *
 * All modes apply min-visible clamping and attach `_data` to leaf nodes.
 * Returns a d3.hierarchy with `.sum()` and optionally `.sort()` applied.
 */
export declare function buildHierarchy(opts: BuildHierarchyOptions): any;
/**
 * Walks up to the root's direct child (top-level ancestor).
 * For a depth-1 node, returns itself.
 */
export declare function getTopAncestor(d: any): any;
/**
 * Builds a breadcrumb path string like "A > B > C" from root to node.
 * Skips the root itself (depth 0).
 */
export declare function getAncestorPath(d: any): string;
/**
 * Returns a Set of all ancestor nodes (excluding root, excluding self).
 * Useful for highlight chains on hover.
 */
export declare function getAncestorChain(d: any): Set<any>;
/**
 * Derives a node's color from its top-level ancestor, lightening for deeper nodes.
 *
 * @param d          — hierarchy node
 * @param colorScale — d3 color scale keyed on ancestor name
 * @param lightenStep — lightening per depth level (default 0.12)
 * @param maxLighten  — cap on total lightening (default 0.4)
 */
export declare function getNodeColor(d: any, colorScale: any, lightenStep?: number, maxLighten?: number): string;
