/**
 * Shared types for Dolex - Visualization MCP + Query Engine
 */
/** Type guard: check if a spec is a CompoundVisualizationSpec */
export function isCompoundSpec(spec) {
    return 'compound' in spec && spec.compound === true;
}
//# sourceMappingURL=types.js.map