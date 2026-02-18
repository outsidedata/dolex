/**
 * Shared Zod schemas for the query DSL.
 * Used by both query_source and visualize_from_source tools.
 */
import { z } from 'zod';
// ─── INPUT NORMALIZATION ─────────────────────────────────────────────────────
// Accepts common LLM-generated aliases and shorthand forms, normalizing them
// to canonical schema before Zod validation. This reduces round-trips caused
// by avoidable validation errors.
const FILTER_SHORTHAND_OPS = {
    equals: '=',
    not_equals: '!=',
    gt: '>',
    gte: '>=',
    lt: '<',
    lte: '<=',
};
const AGGREGATE_NAMES = new Set([
    'sum', 'avg', 'min', 'max', 'count', 'count_distinct',
    'median', 'p25', 'p75', 'stddev', 'percentile',
]);
/** Normalize "column" → "field" alias on an object (mutates). */
function normalizeFieldAlias(obj) {
    if (!obj.field && obj.column) {
        obj.field = obj.column;
        delete obj.column;
    }
}
function normalizeFilterInput(raw) {
    if (!raw || typeof raw !== 'object')
        return raw;
    const obj = { ...raw };
    normalizeFieldAlias(obj);
    // Alias: "operator" → "op"
    if (!obj.op && obj.operator) {
        obj.op = obj.operator;
        delete obj.operator;
    }
    if (obj.op)
        return obj;
    for (const [key, op] of Object.entries(FILTER_SHORTHAND_OPS)) {
        if (key in obj) {
            return { field: obj.field, op, value: obj[key] };
        }
    }
    return obj;
}
function normalizeOrderByInput(raw) {
    // Bare string → ascending sort
    if (typeof raw === 'string') {
        return { field: raw, direction: 'asc' };
    }
    if (!raw || typeof raw !== 'object')
        return raw;
    const obj = { ...raw };
    normalizeFieldAlias(obj);
    return obj;
}
function normalizeSelectInput(raw) {
    if (typeof raw === 'string' || !raw || typeof raw !== 'object')
        return raw;
    const obj = { ...raw };
    normalizeFieldAlias(obj);
    // Already canonical aggregate or window
    if (obj.aggregate || obj.window)
        return obj;
    // Shorthand: { count: "X", as: "Y" } → { field: "X", aggregate: "count", as: "Y" }
    for (const agg of AGGREGATE_NAMES) {
        if (agg in obj) {
            return { field: obj[agg], aggregate: agg, as: obj.as };
        }
    }
    return obj;
}
function normalizeGroupByInput(raw) {
    if (typeof raw === 'string' || !raw || typeof raw !== 'object')
        return raw;
    const obj = { ...raw };
    normalizeFieldAlias(obj);
    return obj;
}
function normalizeArrayOrSingle(val, normalizeItem) {
    if (val === undefined || val === null)
        return val;
    const arr = Array.isArray(val) ? val : [val];
    return normalizeItem ? arr.map(normalizeItem) : arr;
}
export function normalizeDslQueryInput(raw) {
    if (!raw || typeof raw !== 'object')
        return raw;
    const obj = raw;
    const result = { ...obj };
    if (result.filter !== undefined) {
        result.filter = normalizeArrayOrSingle(result.filter, normalizeFilterInput);
    }
    if (result.having !== undefined) {
        result.having = normalizeArrayOrSingle(result.having, normalizeFilterInput);
    }
    if (result.orderBy !== undefined) {
        result.orderBy = normalizeArrayOrSingle(result.orderBy, normalizeOrderByInput);
    }
    if (result.select !== undefined && Array.isArray(result.select)) {
        result.select = result.select.map(normalizeSelectInput);
    }
    if (result.groupBy !== undefined && Array.isArray(result.groupBy)) {
        result.groupBy = result.groupBy.map(normalizeGroupByInput);
    }
    return result;
}
// ─── SCHEMAS ───────────────────────────────────────────────────────────────
export const dslJoinSchema = z.object({
    table: z.string().describe('Table name to join within the same source'),
    on: z.object({
        left: z.string().describe('Field from the current/left table (supports table.field dot notation for chained joins)'),
        right: z.string().describe('Field from the joined table'),
    }),
    type: z.enum(['inner', 'left']).optional().describe('Join type. Default: left'),
});
export const dslAggregateFieldSchema = z.object({
    field: z.string().describe('Field to aggregate'),
    aggregate: z.enum(['sum', 'avg', 'min', 'max', 'count', 'count_distinct', 'median', 'p25', 'p75', 'stddev', 'percentile']).describe('Aggregation function'),
    as: z.string().describe('Output column name'),
    percentile: z.number().min(0).max(1).optional().describe('For aggregate "percentile": the percentile value (0–1), e.g. 0.95 for p95, 0.99 for p99'),
}).describe('Aggregated field — e.g. { field: "revenue", aggregate: "sum", as: "total_revenue" }');
export const dslWindowFieldSchema = z.object({
    window: z.enum(['lag', 'lead', 'rank', 'dense_rank', 'row_number', 'running_sum', 'running_avg', 'pct_of_total']).describe('Window function. lag/lead: compare to previous/next row. rank/dense_rank/row_number: ranking. running_sum/running_avg: cumulative. pct_of_total: fraction of partition total.'),
    field: z.string().optional().describe('Base query output column to operate on. Required for lag, lead, running_sum, running_avg, pct_of_total. Must reference an alias or pass-through field from the same select.'),
    as: z.string().describe('Output column name for the window result'),
    partitionBy: z.array(z.string()).optional().describe('Partition columns — window resets per group. Omit for whole-result-set partition. Must reference base query output columns.'),
    orderBy: z.array(z.object({
        field: z.string(),
        direction: z.enum(['asc', 'desc']),
    })).optional().describe('Sort order within the window. Required for lag, lead, rank, dense_rank, row_number, running_sum, running_avg. Must reference base query output columns.'),
    offset: z.number().optional().describe('Row offset for lag/lead (default: 1)'),
    default: z.any().optional().describe('Default value when lag/lead offset is out of range'),
}).describe('Window function — e.g. { window: "lag", field: "monthly_revenue", offset: 1, as: "prev_month", orderBy: [{ field: "month", direction: "asc" }] }');
export const dslSelectFieldSchema = z.union([
    z.string().describe('Plain field name (e.g. "region") or dot-notation for joined tables (e.g. "products.category")'),
    dslAggregateFieldSchema,
    dslWindowFieldSchema,
]);
export const dslGroupByFieldSchema = z.union([
    z.string().describe('Field to group by'),
    z.object({
        field: z.string().describe('Date/time field to bucket'),
        bucket: z.enum(['day', 'week', 'month', 'quarter', 'year']).describe('Time bucket size'),
    }).describe('Time-bucketed group — e.g. { field: "order_date", bucket: "month" }'),
]);
export const dslFilterSchema = z.object({
    field: z.string().describe('Field to filter on'),
    op: z.enum(['=', '!=', '>', '>=', '<', '<=', 'in', 'not_in', 'between', 'is_null', 'is_not_null']).describe('Comparison operator'),
    value: z.any().optional().describe('Filter value. For "in"/"not_in": use an array. For "between": use [min, max]. For "is_null"/"is_not_null": omit.'),
});
const dslQueryInnerSchema = z.object({
    join: z.array(dslJoinSchema).optional().describe('Tables to join within the same source. Example: [{ table: "products", on: { left: "product_id", right: "id" } }]'),
    select: z.array(dslSelectFieldSchema).describe('Fields to return. Mix plain fields and aggregates. Examples: ["region", { field: "revenue", aggregate: "sum", as: "total" }]'),
    groupBy: z.array(dslGroupByFieldSchema).optional().describe('Group rows before aggregating. Supports time bucketing. Examples: ["region"], [{ field: "order_date", bucket: "month" }]'),
    filter: z.array(dslFilterSchema).optional().describe('Row filters (before aggregation). Array or single object. Shorthand: { field, equals: value } or { field, gt/gte/lt/lte: value }. Canonical: { field, op, value }.'),
    having: z.array(dslFilterSchema).optional().describe('Post-aggregation filters — reference aggregate aliases. Array or single object. Same shorthand as filter.'),
    orderBy: z.array(z.object({
        field: z.string(),
        direction: z.enum(['asc', 'desc']),
    })).optional().describe('Sort order. Array or single object. Example: { field: "total", direction: "desc" }'),
    limit: z.number().optional().describe('Max rows to return'),
});
export const dslQuerySchema = z.preprocess(normalizeDslQueryInput, dslQueryInnerSchema);
// ─── DASHBOARD SCHEMAS ──────────────────────────────────────────────────────
export const ALL_PALETTE_NAMES = [
    'categorical', 'blue', 'green', 'purple', 'warm',
    'blueRed', 'greenPurple', 'tealOrange', 'redGreen',
    'traffic-light', 'profit-loss', 'temperature',
];
export const dashboardViewSchema = z.object({
    id: z.string().describe('Stable view identifier (e.g., "revenue-trend", "sales-by-region")'),
    title: z.string().describe('View title displayed above the chart'),
    intent: z.string().describe('What this view shows — drives pattern selection (e.g., "compare revenue by region")'),
    query: dslQuerySchema.describe('Per-view DSL query for this view\'s data'),
    pattern: z.string().optional().describe('Pattern override (e.g., "bar", "line"). Auto-selected if omitted.'),
    colorPreferences: z.object({
        palette: z.enum(ALL_PALETTE_NAMES).optional(),
        highlight: z.object({
            values: z.array(z.any()),
            color: z.union([z.string(), z.array(z.string())]).optional(),
            mutedColor: z.string().optional(),
            mutedOpacity: z.number().optional(),
        }).optional(),
        colorField: z.string().optional(),
    }).optional().describe('Color preferences for this view'),
    config: z.record(z.any()).optional().describe('Pattern-specific config overrides'),
});
export const dashboardFilterSchema = z.object({
    field: z.string().describe('Data field to filter on'),
    label: z.string().optional().describe('Display label (defaults to field name)'),
    type: z.enum(['select', 'multi-select', 'range', 'date-range']).describe('Filter control type'),
    values: z.array(z.any()).optional().describe('Allowed values (auto-populated from data if omitted)'),
    currentValue: z.any().optional().describe('Initial filter value'),
});
export const dashboardLayoutSchema = z.object({
    columns: z.number().min(1).max(4).describe('Grid columns (1-4)'),
    viewSizes: z.record(z.object({
        colSpan: z.number().optional(),
        rowSpan: z.number().optional(),
    })).optional().describe('Per-view size overrides keyed by view ID'),
});
export const dashboardInteractionSchema = z.object({
    type: z.enum(['crossfilter', 'highlight']).describe('Interaction type'),
    field: z.string().describe('Data field to link on'),
    views: z.array(z.string()).optional().describe('Participating view IDs (all if omitted)'),
});
export const createDashboardInputSchema = z.object({
    sourceId: z.string().describe('Source ID from add_source'),
    table: z.string().describe('Base table within the source'),
    title: z.string().optional().describe('Dashboard title'),
    description: z.string().optional().describe('Dashboard description'),
    views: z.array(dashboardViewSchema).min(1).describe('Dashboard views — each with its own query and intent'),
    globalFilters: z.array(dashboardFilterSchema).optional().describe('Global filter controls'),
    layout: dashboardLayoutSchema.optional().describe('Grid layout (auto-calculated if omitted)'),
    interactions: z.array(dashboardInteractionSchema).optional().describe('Cross-view interactions'),
    theme: z.enum(['dark', 'light']).optional().describe('Color theme (default: dark)'),
});
export const refineDashboardInputSchema = z.object({
    currentSpec: z.object({
        dashboard: z.literal(true),
        id: z.string(),
        title: z.string(),
        description: z.string().optional(),
        sourceId: z.string(),
        table: z.string(),
        views: z.array(z.any()),
        globalFilters: z.array(z.any()).optional(),
        layout: z.any(),
        interactions: z.array(z.any()).optional(),
        theme: z.enum(['dark', 'light']).optional(),
    }).describe('The current dashboard spec to refine'),
    refinement: z.string().describe('What to change — e.g., "add a chart showing revenue by month", "remove the trend chart", "make it 3 columns", "add a region filter"'),
});
//# sourceMappingURL=dsl-schemas.js.map