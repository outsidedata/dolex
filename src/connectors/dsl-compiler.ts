/**
 * DSL-to-SQL Compiler
 *
 * Translates the declarative query DSL into SQL.
 * Targets SQLite dialect (works for CSV-in-SQLite and SQLite sources).
 * Postgres differences are minimal and handled via dialect parameter.
 *
 * Supports JOIN clauses with dot-notation field references (table.field).
 */

import type { DslAggregateField, DslQuery, DslGroupByField, DslFilter, DslWindowField } from '../types.js';
import { isDslAggregateField, isDslWindowField } from '../types.js';

const MAX_LIMIT = 10000;

/**
 * Quote a field reference. Handles both plain "field" and "table.field" dot notation.
 */
function quoteField(field: string): string {
  if (field.includes('.')) {
    const [table, col] = field.split('.', 2);
    return `"${table}"."${col}"`;
  }
  return `"${field}"`;
}

/** Check if a DSL query contains aggregate functions that need JS post-processing on SQLite/MySQL. */
export function hasJsAggregates(query: DslQuery): boolean {
  return query.select.some(
    f => isDslAggregateField(f) && (f.aggregate === 'median' || f.aggregate === 'p25' || f.aggregate === 'p75' || f.aggregate === 'stddev' || f.aggregate === 'percentile')
  );
}

/** Check if a DSL query contains window function fields. */
export function hasWindowFunctions(query: DslQuery): boolean {
  return query.select.some(f => isDslWindowField(f));
}

/** @deprecated Use hasJsAggregates instead */
export const hasPercentileAggregates = hasJsAggregates;

/** Compile a DSL query into a SQL string. */
export function compileDsl(
  table: string,
  query: DslQuery,
  dialect: 'sqlite' | 'postgres' | 'mysql' = 'sqlite',
  options?: { skipLimit?: boolean }
): string {
  if (hasWindowFunctions(query)) {
    return compileDslWithWindows(table, query, dialect, options);
  }
  return compileDslBase(table, query, dialect, options);
}

function compileDslBase(
  table: string,
  query: DslQuery,
  dialect: 'sqlite' | 'postgres' | 'mysql',
  options?: { skipLimit?: boolean }
): string {
  const parts: string[] = [];

  // SELECT — window fields are handled separately in compileDslWithWindows
  const baseFields = query.select.filter(
    (f): f is string | DslAggregateField => !isDslWindowField(f)
  );
  const selectClauses = baseFields.map(f => compileSelectField(f, dialect));
  // If there are time-bucketed groupBy fields, add them to SELECT if not already present
  const groupByBucketSelects: string[] = [];
  if (query.groupBy) {
    for (const g of query.groupBy) {
      if (typeof g !== 'string' && g.bucket) {
        const alias = `${g.field.replace('.', '_')}_${g.bucket}`;
        const bucketExpr = compileBucket(g.field, g.bucket, dialect);
        const alreadySelected = query.select.some(s =>
          isDslAggregateField(s) && s.field === g.field
        );
        if (!alreadySelected) {
          groupByBucketSelects.push(`${bucketExpr} AS "${alias}"`);
        }
      }
    }
  }
  parts.push(`SELECT ${[...groupByBucketSelects, ...selectClauses].join(', ')}`);

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
    const groupClauses = query.groupBy.map(g => compileGroupBy(g, dialect));
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

function compileDslWithWindows(
  table: string,
  query: DslQuery,
  dialect: 'sqlite' | 'postgres' | 'mysql',
  options?: { skipLimit?: boolean }
): string {
  const windowFields = query.select.filter(isDslWindowField);
  const baseFields = query.select.filter(f => !isDslWindowField(f));

  const baseQuery: DslQuery = {
    join: query.join,
    select: baseFields,
    groupBy: query.groupBy,
    filter: query.filter,
    having: query.having,
  };

  const cteSql = compileDslBase(table, baseQuery, dialect, { skipLimit: true });

  const outerParts: string[] = [];

  const windowExprs = windowFields.map(w => compileWindowExpression(w, dialect));
  outerParts.push(`WITH _base AS (\n${cteSql}\n)`);
  outerParts.push(`SELECT _base.*, ${windowExprs.join(', ')}`);
  outerParts.push('FROM _base');

  if (query.orderBy && query.orderBy.length > 0) {
    const orderClauses = query.orderBy.map(o => `"${o.field}" ${o.direction.toUpperCase()}`);
    outerParts.push(`ORDER BY ${orderClauses.join(', ')}`);
  }

  if (!options?.skipLimit) {
    const limit = Math.min(query.limit ?? MAX_LIMIT, MAX_LIMIT);
    outerParts.push(`LIMIT ${limit}`);
  }

  return outerParts.join('\n');
}

function compileWindowExpression(w: DslWindowField, dialect: 'sqlite' | 'postgres' | 'mysql'): string {
  const partitionClause = w.partitionBy && w.partitionBy.length > 0
    ? `PARTITION BY ${w.partitionBy.map(f => `"${f}"`).join(', ')}`
    : '';
  const orderClause = w.orderBy && w.orderBy.length > 0
    ? `ORDER BY ${w.orderBy.map(o => `"${o.field}" ${o.direction.toUpperCase()}`).join(', ')}`
    : '';
  const overParts = [partitionClause, orderClause].filter(Boolean).join(' ');
  const field = w.field ? `"${w.field}"` : '';
  const offset = w.offset ?? 1;
  const defaultVal = w.default !== undefined ? `, ${escapeValue(w.default)}` : '';

  let expr: string;
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

function compileSelectField(field: string | DslAggregateField, dialect: 'sqlite' | 'postgres' | 'mysql'): string {
  if (typeof field === 'string') {
    return quoteField(field);
  }
  const aggFn = compileAggregate(field.aggregate, field.field, dialect, field.percentile);
  return `${aggFn} AS "${field.as}"`;
}

function compileAggregate(aggregate: string, field: string, dialect: 'sqlite' | 'postgres' | 'mysql', percentileValue?: number): string {
  const quoted = quoteField(field);
  const numField = `CAST(${quoted} AS REAL)`;
  switch (aggregate) {
    case 'sum': return `SUM(${numField})`;
    case 'avg': return `AVG(${numField})`;
    case 'min': return `MIN(${numField})`;
    case 'max': return `MAX(${numField})`;
    case 'count': return `COUNT(${quoted})`;
    case 'count_distinct': return `COUNT(DISTINCT ${quoted})`;
    case 'stddev':
      if (dialect === 'postgres') return `STDDEV_POP(${numField})`;
      if (dialect === 'mysql') return `STDDEV_POP(${numField})`;
      return `NULL`;
    case 'median':
      if (dialect === 'postgres') {
        return `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ${numField})`;
      }
      return `NULL`;
    case 'p25':
      if (dialect === 'postgres') {
        return `PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY ${numField})`;
      }
      return `NULL`;
    case 'p75':
      if (dialect === 'postgres') {
        return `PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY ${numField})`;
      }
      return `NULL`;
    case 'percentile': {
      const p = percentileValue ?? 0.5;
      if (dialect === 'postgres') {
        return `PERCENTILE_CONT(${p}) WITHIN GROUP (ORDER BY ${numField})`;
      }
      return `NULL`;
    }
    default: return quoted;
  }
}

function compileFilter(filter: DslFilter): string {
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
      return `${field} IN (${(filter.value as any[]).map(escapeValue).join(', ')})`;
    case 'not_in':
      return `${field} NOT IN (${(filter.value as any[]).map(escapeValue).join(', ')})`;
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

function compileHavingFilter(filter: DslFilter, query: DslQuery): string {
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
      return `${ref} IN (${(filter.value as any[]).map(escapeValue).join(', ')})`;
    case 'not_in':
      return `${ref} NOT IN (${(filter.value as any[]).map(escapeValue).join(', ')})`;
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

function compileGroupBy(field: DslGroupByField, dialect: 'sqlite' | 'postgres' | 'mysql'): string {
  if (typeof field === 'string') {
    return quoteField(field);
  }
  return compileBucket(field.field, field.bucket, dialect);
}

function compileBucket(field: string, bucket: string, dialect: 'sqlite' | 'postgres' | 'mysql'): string {
  const quoted = quoteField(field);
  if (dialect === 'postgres') {
    return `DATE_TRUNC('${bucket}', ${quoted})`;
  }

  if (dialect === 'mysql') {
    switch (bucket) {
      case 'day': return `DATE_FORMAT(${quoted}, '%Y-%m-%d')`;
      case 'week': return `DATE_FORMAT(${quoted}, '%x-W%v')`;
      case 'month': return `DATE_FORMAT(${quoted}, '%Y-%m')`;
      case 'quarter': return `CONCAT(YEAR(${quoted}), '-Q', QUARTER(${quoted}))`;
      case 'year': return `YEAR(${quoted})`;
      default: return quoted;
    }
  }

  // SQLite strftime
  switch (bucket) {
    case 'day': return `strftime('%Y-%m-%d', ${quoted})`;
    case 'week': return `strftime('%Y-W%W', ${quoted})`;
    case 'month': return `strftime('%Y-%m', ${quoted})`;
    case 'quarter': return `(strftime('%Y', ${quoted}) || '-Q' || ((CAST(strftime('%m', ${quoted}) AS INTEGER) - 1) / 3 + 1))`;
    case 'year': return `strftime('%Y', ${quoted})`;
    default: return quoted;
  }
}

function escapeValue(value: any): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? '1' : '0';
  // String — escape single quotes
  return `'${String(value).replace(/'/g, "''")}'`;
}
