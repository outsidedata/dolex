/**
 * Shared hierarchy utilities for composition renderers
 * (treemap, sunburst, circle-pack, icicle).
 *
 * Consolidates duplicated hierarchy-building, ancestor-traversal,
 * and color-derivation logic.
 */
// ─── Min-visible clamping ────────────────────────────────────────────────────
/**
 * Creates a clamping function that ensures tiny positive values stay visible.
 * Values below 2% of the max are bumped up to the threshold.
 */
export function createMinVisibleClamp(data, valueField, threshold = 0.02) {
    const allVals = data
        .map((d) => Number(d[valueField]) || 0)
        .filter((v) => v > 0);
    const maxVal = allVals.length > 0 ? Math.max(...allVals) : 0;
    const minVisible = maxVal * threshold;
    return (v) => (v > 0 && v < minVisible ? minVisible : v);
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
export function buildHierarchy(opts) {
    const { data, valueField, categoryField, parentField, childField, levelFields, sort = true, } = opts;
    // No value field or no data → empty hierarchy
    if (!valueField || data.length === 0) {
        return d3.hierarchy({ name: 'root', children: [] }).sum((d) => d.value || 0);
    }
    const clampVal = createMinVisibleClamp(data, valueField);
    let hierarchy;
    if (levelFields && levelFields.length > 0) {
        // Multi-level nested hierarchy
        if (levelFields.length === 1) {
            const field = levelFields[0];
            hierarchy = {
                name: 'root',
                children: data.map((d) => ({
                    name: String(d[field] ?? 'Unknown'),
                    value: clampVal(Math.max(0, Number(d[valueField]) || 0)),
                    _data: d,
                })),
            };
        }
        else {
            hierarchy = {
                name: 'root',
                children: buildNestedLevel(data, levelFields, valueField, 0, clampVal),
            };
        }
    }
    else if (parentField) {
        // Two-level parent/child
        const parents = [...new Set(data.map((d) => d[parentField]))];
        hierarchy = {
            name: 'root',
            children: parents.map((p) => {
                const items = data.filter((d) => d[parentField] === p);
                return {
                    name: p,
                    children: items.map((d, i) => ({
                        name: d[childField || categoryField || parentField] || `Item ${i}`,
                        value: clampVal(Number(d[valueField]) || 0),
                        _data: d,
                    })),
                };
            }),
        };
    }
    else {
        // Flat single-level
        const catField = categoryField || childField;
        hierarchy = {
            name: 'root',
            children: data.map((d) => ({
                name: d[catField] || 'Unknown',
                value: clampVal(Number(d[valueField]) || 0),
                _data: d,
            })),
        };
    }
    const root = d3.hierarchy(hierarchy).sum((d) => d.value);
    if (sort) {
        root.sort((a, b) => b.value - a.value);
    }
    return root;
}
/**
 * Recursively builds nested hierarchy children for multi-level fields.
 */
function buildNestedLevel(items, levelFields, valueField, depth, clampVal) {
    const field = levelFields[depth];
    // Last level → leaf nodes
    if (depth === levelFields.length - 1) {
        return items.map((d) => ({
            name: String(d[field] ?? 'Unknown'),
            value: clampVal(Math.max(0, Number(d[valueField]) || 0)),
            _data: d,
        }));
    }
    // Group by this level's field, recurse deeper
    const groups = new Map();
    for (const item of items) {
        const key = String(item[field] ?? 'Unknown');
        if (!groups.has(key))
            groups.set(key, []);
        groups.get(key).push(item);
    }
    const children = [];
    for (const [key, groupItems] of groups) {
        children.push({
            name: key,
            children: buildNestedLevel(groupItems, levelFields, valueField, depth + 1, clampVal),
        });
    }
    return children;
}
// ─── Ancestor traversal ─────────────────────────────────────────────────────
/**
 * Walks up to the root's direct child (top-level ancestor).
 * For a depth-1 node, returns itself.
 */
export function getTopAncestor(d) {
    let node = d;
    while (node.parent && node.parent.parent) {
        node = node.parent;
    }
    return node;
}
/**
 * Builds a breadcrumb path string like "A > B > C" from root to node.
 * Skips the root itself (depth 0).
 */
export function getAncestorPath(d) {
    const parts = [];
    let node = d;
    while (node && node.depth > 0) {
        parts.unshift(node.data.name);
        node = node.parent;
    }
    return parts.join(' \u203A ');
}
/**
 * Returns a Set of all ancestor nodes (excluding root, excluding self).
 * Useful for highlight chains on hover.
 */
export function getAncestorChain(d) {
    const chain = new Set();
    let node = d.parent;
    while (node && node.depth > 0) {
        chain.add(node);
        node = node.parent;
    }
    return chain;
}
// ─── Color derivation ───────────────────────────────────────────────────────
/**
 * Derives a node's color from its top-level ancestor, lightening for deeper nodes.
 *
 * @param d          — hierarchy node
 * @param colorScale — d3 color scale keyed on ancestor name
 * @param lightenStep — lightening per depth level (default 0.12)
 * @param maxLighten  — cap on total lightening (default 0.4)
 */
export function getNodeColor(d, colorScale, lightenStep = 0.12, maxLighten = 0.4) {
    const ancestor = getTopAncestor(d);
    const baseColor = colorScale(ancestor.data.name);
    if (d.depth > 1) {
        const lightenFactor = Math.min(d.depth * lightenStep, maxLighten);
        return d3.interpolateRgb(baseColor, '#ffffff')(lightenFactor);
    }
    return baseColor;
}
