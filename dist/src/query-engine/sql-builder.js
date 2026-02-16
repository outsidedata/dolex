/**
 * SQL Builder — Build SQL from LLMColumnSelection.
 *
 * Extracted from buildSQL() and findJoinColumn() in the POC.
 * Handles all query patterns: simple aggregation, filtering, multi-table joins,
 * window functions, percentages, multi-measure.
 *
 * The _schemaRef global from the POC is eliminated — schema is passed explicitly.
 */
/**
 * Find a shared column between two tables that can serve as a join key.
 *
 * Prefers ID columns (ending in "id") over other shared columns.
 * Schema is passed explicitly (no global state).
 */
export function findJoinColumn(table1, table2, schema) {
    const t1 = schema.tables.find(t => t.name === table1);
    const t2 = schema.tables.find(t => t.name === table2);
    if (!t1 || !t2)
        return null;
    const cols1 = t1.columns.map(c => c.name);
    const cols2 = t2.columns.map(c => c.name);
    const shared = cols1.filter(c => cols2.includes(c));
    // Prefer ID columns
    const idCol = shared.find(c => c.toLowerCase().endsWith('id'));
    return idCol || shared[0] || null;
}
/**
 * Build a SQL query from a validated LLMColumnSelection.
 *
 * Handles these query patterns:
 * - Scalar (no category)
 * - Single-dimensional grouping (category only)
 * - Two-dimensional grouping (category + series)
 * - Single-dimensional + two measures
 * - Two-dimensional + two measures
 * - Percentage computed metric
 * - Top N per group (window function with ROW_NUMBER)
 * - Multi-table JOINs
 * - WHERE filters (=, LIKE, IN)
 */
export function buildSQL(selection, schema) {
    const val = `"${selection.value_column.table}"."${selection.value_column.column}"`;
    const cat = selection.category_column
        ? `"${selection.category_column.table}"."${selection.category_column.column}"`
        : null;
    const series = selection.series_column
        ? `"${selection.series_column.table}"."${selection.series_column.column}"`
        : null;
    // Collect all referenced tables
    const tables = new Set();
    tables.add(selection.value_column.table);
    if (selection.category_column)
        tables.add(selection.category_column.table);
    if (selection.series_column)
        tables.add(selection.series_column.table);
    if (selection.value_column_2)
        tables.add(selection.value_column_2.table);
    for (const f of selection.filters || [])
        tables.add(f.table);
    // Build JOIN chain — connect all tables through shared columns
    const tableList = [...tables];
    let fromClause;
    if (tableList.length === 1) {
        fromClause = `"${tableList[0]}"`;
    }
    else {
        const joined = new Set([tableList[0]]);
        fromClause = `"${tableList[0]}"`;
        const remaining = tableList.slice(1);
        for (const table of remaining) {
            let connected = false;
            for (const jt of joined) {
                const sharedCol = findJoinColumn(jt, table, schema);
                if (sharedCol) {
                    fromClause += ` JOIN "${table}" ON "${jt}"."${sharedCol}" = "${table}"."${sharedCol}"`;
                    joined.add(table);
                    connected = true;
                    break;
                }
            }
            if (!connected) {
                // Cross join as fallback (comma-separated tables)
                fromClause += `, "${table}"`;
                joined.add(table);
            }
        }
    }
    // WHERE clause — handle IN operator
    const wheres = (selection.filters || []).map(f => {
        if (f.op === 'IN' || f.op === 'in') {
            const vals = f.value
                .split(',')
                .map((v) => `'${v.trim()}'`)
                .join(', ');
            return `"${f.table}"."${f.column}" IN (${vals})`;
        }
        return `"${f.table}"."${f.column}" ${f.op} '${f.value}'`;
    });
    const whereClause = wheres.length > 0 ? `WHERE ${wheres.join(' AND ')}` : '';
    // Aggregate expression for primary value
    const agg = selection.aggregate === 'count'
        ? `COUNT(${val})`
        : `${selection.aggregate.toUpperCase()}(CAST(${val} AS REAL))`;
    // Second aggregate if present
    const val2 = selection.value_column_2
        ? `"${selection.value_column_2.table}"."${selection.value_column_2.column}"`
        : null;
    const agg2 = val2 && selection.aggregate_2
        ? selection.aggregate_2 === 'count'
            ? `COUNT(${val2})`
            : `${selection.aggregate_2.toUpperCase()}(CAST(${val2} AS REAL))`
        : null;
    // Build query based on pattern
    if (selection.top_n_per_group && cat && series) {
        // Top N per group using window function
        const innerSelect = `SELECT ${cat} AS category, ${series} AS series, ${agg} AS value, ROW_NUMBER() OVER (PARTITION BY ${cat} ORDER BY ${agg} DESC) AS rn FROM ${fromClause} ${whereClause} GROUP BY ${cat}, ${series}`;
        return `SELECT category, series, value FROM (${innerSelect}) WHERE rn <= ${selection.top_n_per_group} ORDER BY category ${selection.sort}, value DESC LIMIT ${selection.limit || 100}`;
    }
    else if (selection.computed === 'percentage' && cat) {
        // Percentage: value as share of total
        const totalSubq = `(SELECT ${agg} FROM ${fromClause} ${whereClause})`;
        return `SELECT ${cat} AS category, ${series ? `${series} AS series,` : ''} ${agg} AS value, ROUND(CAST(${agg} AS REAL) * 100.0 / ${totalSubq}, 2) AS percentage FROM ${fromClause} ${whereClause} GROUP BY ${cat}${series ? `, ${series}` : ''} ORDER BY percentage ${selection.sort} LIMIT ${selection.limit || 50}`;
    }
    else if (cat && series && agg2) {
        // Two-dimensional + two measures
        return `SELECT ${cat} AS category, ${series} AS series, ${agg} AS value, ${agg2} AS value_2 FROM ${fromClause} ${whereClause} GROUP BY ${cat}, ${series} ORDER BY ${cat} ${selection.sort}, value DESC LIMIT ${selection.limit || 50}`;
    }
    else if (cat && agg2) {
        // Single-dimensional + two measures
        return `SELECT ${cat} AS category, ${agg} AS value, ${agg2} AS value_2 FROM ${fromClause} ${whereClause} GROUP BY ${cat} ORDER BY value ${selection.sort} LIMIT ${selection.limit || 20}`;
    }
    else if (cat && series) {
        // Two-dimensional grouping
        return `SELECT ${cat} AS category, ${series} AS series, ${agg} AS value FROM ${fromClause} ${whereClause} GROUP BY ${cat}, ${series} ORDER BY ${cat} ${selection.sort}, value DESC LIMIT ${selection.limit || 50}`;
    }
    else if (cat) {
        // Single-dimensional grouping
        return `SELECT ${cat} AS category, ${agg} AS value FROM ${fromClause} ${whereClause} GROUP BY ${cat} ORDER BY value ${selection.sort} LIMIT ${selection.limit || 20}`;
    }
    else {
        // Scalar
        return `SELECT ${agg} AS value FROM ${fromClause} ${whereClause}`;
    }
}
//# sourceMappingURL=sql-builder.js.map