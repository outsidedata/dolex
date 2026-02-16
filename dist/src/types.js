/**
 * Shared types for Dolex - Visualization MCP + Query Engine
 */
/** Type guard: check if a select field is an aggregate field */
export function isDslAggregateField(field) {
    return typeof field !== 'string' && 'aggregate' in field;
}
/** Type guard: check if a select field is a window function field */
export function isDslWindowField(field) {
    return typeof field !== 'string' && 'window' in field;
}
/** Type guard: check if a spec is a CompoundVisualizationSpec */
export function isCompoundSpec(spec) {
    return 'compound' in spec && spec.compound === true;
}
/** Type guard: check if a spec is a DashboardSpec */
export function isDashboardSpec(spec) {
    return 'dashboard' in spec && spec.dashboard === true;
}
//# sourceMappingURL=types.js.map