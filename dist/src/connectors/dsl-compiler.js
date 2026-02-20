/**
 * DSL-to-SQL Compiler
 *
 * Translates the declarative query DSL into SQL targeting SQLite dialect.
 * Supports JOIN clauses with dot-notation field references (table.field).
 */
import { isDslAggregateField, isDslWindowField } from '../types.js';
const MAX_LIMIT = 10000;
/**
 * Convert dot-notation field to a flat alias: "table.col" → "table_col", plain fields unchanged.
 */
export function fieldAlias(field) {
    return field.includes('.') ? field.replace('.', '_') : field;
}
/**
 * Quote a field reference. Handles both plain "field" and "table.field" dot notation.
 */
function quoteField(field) {
    if (field.includes('.')) {
        const [table, col] = field.split('.', 2);
        return `"${table}"."${col}"`;
    }
    return `"${field}"`;
}
/** Check if a DSL query contains aggregate functions that need JS post-processing on SQLite. */
export function hasJsAggregates(query) {
    return query.select.some(f => isDslAggregateField(f) && (f.aggregate === 'median' || f.aggregate === 'p25' || f.aggregate === 'p75' || f.aggregate === 'stddev' || f.aggregate === 'percentile'));
}
/** Check if a DSL query contains window function fields. */
export function hasWindowFunctions(query) {
    return query.select.some(f => isDslWindowField(f));
}
/** @deprecated Use hasJsAggregates instead */
export const hasPercentileAggregates = hasJsAggregates;
/** Compile a DSL query into a SQL string. */
export function compileDsl(table, query, dialect = 'sqlite', options) {
    if (hasWindowFunctions(query)) {
        return compileDslWithWindows(table, query, options);
    }
    return compileDslBase(table, query, options);
}
function compileDslBase(table, query, options) {
    const parts = [];
    // SELECT — window fields are handled separately in compileDslWithWindows
    const baseFields = query.select.filter((f) => !isDslWindowField(f));
    // Build map of bucketed groupBy fields → { expr, alias }
    const bucketMap = new Map();
    if (query.groupBy) {
        for (const g of query.groupBy) {
            if (typeof g !== 'string' && g.bucket) {
                const alias = `${g.field.replace('.', '_')}_${g.bucket}`;
                const bucketExpr = compileBucket(g.field, g.bucket);
                bucketMap.set(g.field, { expr: bucketExpr, alias });
            }
        }
    }
    // Compile select fields, replacing raw fields with their bucket expression
    const emittedBuckets = new Set();
    const selectClauses = baseFields.map(f => {
        if (typeof f === 'string') {
            const bucket = bucketMap.get(f);
            if (bucket) {
                emittedBuckets.add(f);
                return `${bucket.expr} AS "${bucket.alias}"`;
            }
        }
        return compileSelectField(f);
    });
    // Auto-include any bucketed columns not already emitted via replacement
    const autoIncludeBuckets = [];
    for (const [field, bucket] of bucketMap) {
        if (!emittedBuckets.has(field)) {
            autoIncludeBuckets.push(`${bucket.expr} AS "${bucket.alias}"`);
        }
    }
    parts.push(`SELECT ${[...autoIncludeBuckets, ...selectClauses].join(', ')}`);
    // FROM
    parts.push(`FROM "${table}"`);
    // JOIN
    if (query.join && query.join.length > 0) {
        for (const join of query.join) {
            const joinType = (join.type ?? 'left').toUpperCase();
            const leftField = join.on.left.includes('.')
                ? quoteField(join.on.left)
                : `"${table}"."${join.on.left}"`;
            const rightField = `"${join.table}"."${join.on.right}"`;
            parts.push(`${joinType} JOIN "${join.table}" ON ${leftField} = ${rightField}`);
        }
    }
    // WHERE
    if (query.filter && query.filter.length > 0) {
        const conditions = query.filter.map(f => compileFilter(f));
        parts.push(`WHERE ${conditions.join(' AND ')}`);
    }
    // GROUP BY
    if (query.groupBy && query.groupBy.length > 0) {
        const groupClauses = query.groupBy.map(g => compileGroupBy(g));
        parts.push(`GROUP BY ${groupClauses.join(', ')}`);
    }
    // HAVING
    if (query.having && query.having.length > 0) {
        const havingConditions = query.having.map(f => compileHavingFilter(f, query));
        parts.push(`HAVING ${havingConditions.join(' AND ')}`);
    }
    // ORDER BY
    if (query.orderBy && query.orderBy.length > 0) {
        const orderClauses = query.orderBy.map(o => `${quoteField(o.field)} ${o.direction.toUpperCase()}`);
        parts.push(`ORDER BY ${orderClauses.join(', ')}`);
    }
    // LIMIT
    if (!options?.skipLimit) {
        const limit = Math.min(query.limit ?? MAX_LIMIT, MAX_LIMIT);
        parts.push(`LIMIT ${limit}`);
    }
    return parts.join('\n');
}
function compileDslWithWindows(table, query, options) {
    const windowFields = query.select.filter(isDslWindowField);
    const baseFields = query.select.filter(f => !isDslWindowField(f));
    const baseQuery = {
        join: query.join,
        select: baseFields,
        groupBy: query.groupBy,
        filter: query.filter,
        having: query.having,
    };
    const cteSql = compileDslBase(table, baseQuery, { skipLimit: true });
    const outerParts = [];
    const windowExprs = windowFields.map(w => compileWindowExpression(w));
    outerParts.push(`WITH _base AS (\n${cteSql}\n)`);
    outerParts.push(`SELECT _base.*, ${windowExprs.join(', ')}`);
    outerParts.push('FROM _base');
    if (query.orderBy && query.orderBy.length > 0) {
        const orderClauses = query.orderBy.map(o => `"${fieldAlias(o.field)}" ${o.direction.toUpperCase()}`);
        outerParts.push(`ORDER BY ${orderClauses.join(', ')}`);
    }
    if (!options?.skipLimit) {
        const limit = Math.min(query.limit ?? MAX_LIMIT, MAX_LIMIT);
        outerParts.push(`LIMIT ${limit}`);
    }
    return outerParts.join('\n');
}
function compileWindowExpression(w) {
    const partitionClause = w.partitionBy && w.partitionBy.length > 0
        ? `PARTITION BY ${w.partitionBy.map(f => `"${fieldAlias(f)}"`).join(', ')}`
        : '';
    const orderClause = w.orderBy && w.orderBy.length > 0
        ? `ORDER BY ${w.orderBy.map(o => `"${fieldAlias(o.field)}" ${o.direction.toUpperCase()}`).join(', ')}`
        : '';
    const overParts = [partitionClause, orderClause].filter(Boolean).join(' ');
    const field = w.field ? `"${fieldAlias(w.field)}"` : '';
    const offset = w.offset ?? 1;
    const defaultVal = w.default !== undefined ? `, ${escapeValue(w.default)}` : '';
    let expr;
    switch (w.window) {
        case 'lag':
            expr = `LAG(${field}, ${offset}${defaultVal}) OVER (${overParts})`;
            break;
        case 'lead':
            expr = `LEAD(${field}, ${offset}${defaultVal}) OVER (${overParts})`;
            break;
        case 'rank':
            expr = `RANK() OVER (${overParts})`;
            break;
        case 'dense_rank':
            expr = `DENSE_RANK() OVER (${overParts})`;
            break;
        case 'row_number':
            expr = `ROW_NUMBER() OVER (${overParts})`;
            break;
        case 'running_sum':
            expr = `SUM(${field}) OVER (${overParts} ROWS UNBOUNDED PRECEDING)`;
            break;
        case 'running_avg':
            expr = `AVG(${field}) OVER (${overParts} ROWS UNBOUNDED PRECEDING)`;
            break;
        case 'pct_of_total': {
            const pctOver = partitionClause || '';
            expr = `CAST(${field} AS REAL) / SUM(${field}) OVER (${pctOver})`;
            break;
        }
        default:
            expr = 'NULL';
    }
    return `${expr} AS "${w.as}"`;
}
function compileSelectField(field) {
    if (typeof field === 'string') {
        if (field.includes('.')) {
            return `${quoteField(field)} AS "${fieldAlias(field)}"`;
        }
        return quoteField(field);
    }
    const aggFn = compileAggregate(field.aggregate, field.field, field.percentile);
    return `${aggFn} AS "${field.as}"`;
}
function compileAggregate(aggregate, field, percentileValue) {
    const quoted = quoteField(field);
    const numField = `CAST(${quoted} AS REAL)`;
    switch (aggregate) {
        case 'sum': return `SUM(${numField})`;
        case 'avg': return `AVG(${numField})`;
        case 'min': return `MIN(${numField})`;
        case 'max': return `MAX(${numField})`;
        case 'count': return `COUNT(${quoted})`;
        case 'count_distinct': return `COUNT(DISTINCT ${quoted})`;
        case 'stddev': return `NULL`;
        case 'median': return `NULL`;
        case 'p25': return `NULL`;
        case 'p75': return `NULL`;
        case 'percentile': return `NULL`;
        default: return quoted;
    }
}
function compileFilter(filter) {
    const rawField = quoteField(filter.field);
    // CAST to REAL for numeric comparisons (handles TEXT columns from CSV)
    const isNumericComparison = typeof filter.value === 'number' ||
        (Array.isArray(filter.value) && filter.value.length > 0 && typeof filter.value[0] === 'number');
    const field = isNumericComparison ? `CAST(${rawField} AS REAL)` : rawField;
    switch (filter.op) {
        case '=':
        case '!=':
        case '>':
        case '>=':
        case '<':
        case '<=':
            return `${field} ${filter.op} ${escapeValue(filter.value)}`;
        case 'in':
            return `${field} IN (${filter.value.map(escapeValue).join(', ')})`;
        case 'not_in':
            return `${field} NOT IN (${filter.value.map(escapeValue).join(', ')})`;
        case 'between':
            return `${field} BETWEEN ${escapeValue(filter.value[0])} AND ${escapeValue(filter.value[1])}`;
        case 'is_null':
            return `${rawField} IS NULL`;
        case 'is_not_null':
            return `${rawField} IS NOT NULL`;
        default:
            return `${field} = ${escapeValue(filter.value)}`;
    }
}
function compileHavingFilter(filter, query) {
    const field = quoteField(filter.field);
    const isNumericComparison = typeof filter.value === 'number' ||
        (Array.isArray(filter.value) && filter.value.length > 0 && typeof filter.value[0] === 'number');
    const ref = isNumericComparison ? `CAST(${field} AS REAL)` : field;
    switch (filter.op) {
        case '=':
        case '!=':
        case '>':
        case '>=':
        case '<':
        case '<=':
            return `${ref} ${filter.op} ${escapeValue(filter.value)}`;
        case 'in':
            return `${ref} IN (${filter.value.map(escapeValue).join(', ')})`;
        case 'not_in':
            return `${ref} NOT IN (${filter.value.map(escapeValue).join(', ')})`;
        case 'between':
            return `${ref} BETWEEN ${escapeValue(filter.value[0])} AND ${escapeValue(filter.value[1])}`;
        case 'is_null':
            return `${field} IS NULL`;
        case 'is_not_null':
            return `${field} IS NOT NULL`;
        default:
            return `${ref} = ${escapeValue(filter.value)}`;
    }
}
function compileGroupBy(field) {
    if (typeof field === 'string') {
        return quoteField(field);
    }
    return compileBucket(field.field, field.bucket);
}
/**
 * Wrap a SQLite field reference so bare year-integers (e.g. 2013) are
 * normalised to ISO date strings before strftime() is called.
 * Without this, strftime('%Y', 2013) interprets 2013 as a Julian Day and returns "-4707".
 */
function ensureDateLiteral(quoted) {
    return `CASE WHEN typeof(${quoted}) = 'integer' AND ${quoted} BETWEEN 1800 AND 2200 THEN ${quoted} || '-01-01' ELSE ${quoted} END`;
}
function compileBucket(field, bucket) {
    const quoted = quoteField(field);
    const safe = ensureDateLiteral(quoted);
    switch (bucket) {
        case 'year': return `CASE WHEN typeof(${quoted}) = 'integer' AND ${quoted} BETWEEN 1800 AND 2200 THEN CAST(${quoted} AS TEXT) ELSE strftime('%Y', ${quoted}) END`;
        case 'day': return `strftime('%Y-%m-%d', ${safe})`;
        case 'week': return `strftime('%Y-W%W', ${safe})`;
        case 'month': return `strftime('%Y-%m', ${safe})`;
        case 'quarter': return `(strftime('%Y', ${safe}) || '-Q' || ((CAST(strftime('%m', ${safe}) AS INTEGER) - 1) / 3 + 1))`;
        default: return quoted;
    }
}
function escapeValue(value) {
    if (value === null || value === undefined)
        return 'NULL';
    if (typeof value === 'number')
        return String(value);
    if (typeof value === 'boolean')
        return value ? '1' : '0';
    // String — escape single quotes
    return `'${String(value).replace(/'/g, "''")}'`;
}
//# sourceMappingURL=dsl-compiler.js.map