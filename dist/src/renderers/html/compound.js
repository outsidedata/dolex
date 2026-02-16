/**
 * Compound visualization logic.
 *
 * Decides whether to wrap a chart spec with companion views (table, etc.)
 * and builds the CompoundVisualizationSpec.
 */
/** Patterns where a companion table doesn't add value */
const SKIP_TABLE_PATTERNS = new Set([
    'sankey', 'alluvial', 'chord', // flow patterns — data is relational, not tabular
    'choropleth', 'proportional-symbol', // geo — data is geographic
    'sunburst', 'treemap', // hierarchical — table doesn't capture structure
]);
/** Maximum row count for auto-compounding (large tables overwhelm the view) */
const MAX_COMPOUND_ROWS = 500;
/**
 * Decide whether a chart should be wrapped in a compound visualization.
 */
export function shouldCompound(spec, options) {
    // Explicit opt-out
    if (options?.compound === false)
        return false;
    // Skip patterns where table doesn't help
    if (SKIP_TABLE_PATTERNS.has(spec.pattern))
        return false;
    // Skip if too many rows
    if (spec.data.length > MAX_COMPOUND_ROWS)
        return false;
    // Skip if no data
    if (!spec.data.length)
        return false;
    return true;
}
/**
 * Build a CompoundVisualizationSpec wrapping a chart with a data table.
 */
export function buildCompoundSpec(spec, columns) {
    // Figure out the interaction field — prefer the categorical x-axis
    const interactionField = findInteractionField(spec);
    // Build table columns — lead with encoding fields
    const tableColumns = buildTableColumns(spec, columns);
    return {
        compound: true,
        title: spec.title,
        data: spec.data,
        views: [
            {
                id: 'chart',
                type: 'chart',
                chart: {
                    pattern: spec.pattern,
                    title: spec.title,
                    encoding: spec.encoding,
                    config: spec.config,
                },
            },
            {
                id: 'table',
                type: 'table',
                table: {
                    columns: tableColumns,
                    sort: interactionField
                        ? { field: interactionField, direction: 'asc' }
                        : undefined,
                    pageSize: 100,
                },
            },
        ],
        layout: { type: 'rows', sizes: [3, 2] },
        interactions: interactionField
            ? [{ type: 'highlight', field: interactionField }]
            : [],
    };
}
/**
 * Find the best field to use for interaction highlighting.
 * Prefers the categorical axis field.
 */
function findInteractionField(spec) {
    const enc = spec.encoding;
    // Prefer x-axis categorical field
    if (enc.x && (enc.x.type === 'nominal' || enc.x.type === 'ordinal')) {
        return enc.x.field;
    }
    // Fall back to color field
    if (enc.color?.field) {
        return enc.color.field;
    }
    // Fall back to y-axis categorical
    if (enc.y && (enc.y.type === 'nominal' || enc.y.type === 'ordinal')) {
        return enc.y.field;
    }
    // Fall back to first field in data
    if (spec.data.length > 0) {
        return Object.keys(spec.data[0])[0];
    }
    return undefined;
}
/**
 * Build table column definitions, leading with fields used in the chart encoding.
 */
function buildTableColumns(spec, dataColumns) {
    if (!spec.data.length)
        return [];
    const allFields = Object.keys(spec.data[0]);
    const encodingFields = new Set();
    // Collect fields used in encoding
    if (spec.encoding.x?.field)
        encodingFields.add(spec.encoding.x.field);
    if (spec.encoding.y?.field)
        encodingFields.add(spec.encoding.y.field);
    if (spec.encoding.color?.field)
        encodingFields.add(spec.encoding.color.field);
    if (spec.encoding.size?.field)
        encodingFields.add(spec.encoding.size.field);
    // Order: encoding fields first, then the rest
    const ordered = [
        ...allFields.filter(f => encodingFields.has(f)),
        ...allFields.filter(f => !encodingFields.has(f)),
    ];
    // Detect numeric fields
    const numericFields = new Set();
    if (dataColumns) {
        dataColumns.forEach(c => { if (c.type === 'numeric')
            numericFields.add(c.name); });
    }
    else {
        ordered.forEach(field => {
            const sample = spec.data.slice(0, 10).map(d => d[field]);
            const numCount = sample.filter(v => v != null && (typeof v === 'number' || (typeof v === 'string' && v !== '' && !isNaN(Number(v))))).length;
            if (numCount > sample.length * 0.7)
                numericFields.add(field);
        });
    }
    return ordered.map(field => {
        const col = {
            field,
            title: prettifyFieldName(field),
            align: numericFields.has(field) ? 'right' : 'left',
        };
        return col;
    });
}
/** Convert snake_case / camelCase field names to title case */
function prettifyFieldName(name) {
    return name
        .replace(/_/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/\b\w/g, c => c.toUpperCase());
}
//# sourceMappingURL=compound.js.map