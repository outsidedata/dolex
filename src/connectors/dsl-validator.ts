/**
 * DSL Validator
 *
 * Validates a DslQuery against a table schema before compilation.
 * Returns helpful error messages with fuzzy suggestions for typos.
 */

import type { DataTable, DataSchema, DslAggregateField, DslQuery, DslWindowField } from '../types.js';
import { isDslAggregateField, isDslWindowField } from '../types.js';

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

/** Validate a DSL query against a table's column schema. */
export function validateDsl(table: DataTable, query: DslQuery): ValidationResult {
  const colNames = table.columns.map(c => c.name);
  const colMap = new Map(table.columns.map(c => [c.name, c]));

  const baseOutputNames = computeBaseOutputNames(query);

  // Validate select fields
  for (const field of query.select) {
    if (isDslWindowField(field)) {
      const wErr = validateWindowField(field, baseOutputNames);
      if (wErr) return wErr;
      continue;
    }

    const fieldName = typeof field === 'string' ? field : field.field;
    const err = validateFieldExists(fieldName, colNames);
    if (err) return err;

    if (isDslAggregateField(field)) {
      const col = colMap.get(field.field)!;
      const aggErr = validateAggregate(field.aggregate, col);
      if (aggErr) return aggErr;

      if (field.aggregate === 'percentile') {
        const pErr = validatePercentileParam(field.percentile);
        if (pErr) return pErr;
      }
    }
  }

  // Validate groupBy fields
  if (query.groupBy) {
    for (const g of query.groupBy) {
      const fieldName = typeof g === 'string' ? g : g.field;
      const err = validateFieldExists(fieldName, colNames);
      if (err) return err;

      if (typeof g !== 'string' && g.bucket) {
        const col = colMap.get(g.field)!;
        if (col.type !== 'date') {
          return {
            ok: false,
            error: `Cannot apply time bucket "${g.bucket}" to non-date field "${g.field}" (type: ${col.type}). Only date columns support time bucketing.`,
          };
        }
      }
    }
  }

  // Validate filter fields
  if (query.filter) {
    for (const f of query.filter) {
      const err = validateFieldExists(f.field, colNames);
      if (err) return err;
    }
  }

  // Validate having fields — must reference aggregate aliases
  if (query.having) {
    const aliases = query.select
      .filter(isDslAggregateField)
      .map(s => s.as);
    for (const h of query.having) {
      if (!aliases.includes(h.field)) {
        return {
          ok: false,
          error: `Having field "${h.field}" must reference an aggregate alias. Available aliases: ${aliases.join(', ')}`,
        };
      }
    }
  }

  // Validate orderBy fields — can reference column names, aggregate/window aliases, and bucket aliases
  if (query.orderBy) {
    const selectAliases = query.select
      .filter((s): s is DslAggregateField | DslWindowField => typeof s !== 'string')
      .map(s => s.as);
    const bucketAliases = computeBucketAliases(query);
    const validNames = [...colNames, ...selectAliases, ...bucketAliases];

    for (const o of query.orderBy) {
      if (!validNames.includes(o.field)) {
        const suggestion = findClosest(o.field, validNames);
        return {
          ok: false,
          error: `Unknown field "${o.field}" in orderBy.${suggestion ? ` Did you mean "${suggestion}"?` : ''} Available: ${validNames.join(', ')}`,
        };
      }
    }
  }

  return { ok: true };
}

/**
 * Validate a DSL query with join support.
 * Takes the full schema so it can look up joined tables.
 */
export function validateDslWithJoins(
  schema: DataSchema,
  baseTableName: string,
  query: DslQuery
): ValidationResult {
  const baseTable = schema.tables.find(t => t.name === baseTableName);
  if (!baseTable) {
    const available = schema.tables.map(t => t.name).join(', ');
    return { ok: false, error: `Table "${baseTableName}" not found in source. Available tables: ${available}` };
  }

  // If no joins, delegate to the simple validator
  if (!query.join || query.join.length === 0) {
    return validateDsl(baseTable, query);
  }

  // Build a map of all tables in the join scope: base table + each joined table
  const tableMap = new Map<string, DataTable>();
  tableMap.set(baseTableName, baseTable);

  // Validate each join clause
  for (const join of query.join) {
    const joinedTable = schema.tables.find(t => t.name === join.table);
    if (!joinedTable) {
      const available = schema.tables.map(t => t.name).join(', ');
      return { ok: false, error: `Table "${join.table}" not found in source. Available tables: ${available}` };
    }

    // Validate on.left — resolve against base table or previously-joined table
    const leftErr = validateJoinField(join.on.left, baseTableName, tableMap);
    if (leftErr) return leftErr;

    // Validate on.right — must be in the joined table
    const rightCols = joinedTable.columns.map(c => c.name);
    if (!rightCols.includes(join.on.right)) {
      const suggestion = findClosest(join.on.right, rightCols);
      return {
        ok: false,
        error: `Field "${join.on.right}" not found in table "${join.table}".${suggestion ? ` Did you mean "${suggestion}"?` : ''} Available fields: ${rightCols.join(', ')}`,
      };
    }

    tableMap.set(join.table, joinedTable);
  }

  const baseOutputNames = computeBaseOutputNames(query);

  // Validate field references in select, groupBy, filter, orderBy
  const aliases: string[] = [];

  for (const field of query.select) {
    if (isDslWindowField(field)) {
      aliases.push(field.as);
      const wErr = validateWindowField(field, baseOutputNames);
      if (wErr) return wErr;
      continue;
    }

    const fieldName = typeof field === 'string' ? field : field.field;
    const err = validateFieldRef(fieldName, tableMap);
    if (err) return err;

    if (isDslAggregateField(field)) {
      aliases.push(field.as);
      const resolved = resolveField(field.field, tableMap);
      if (resolved) {
        const aggErr = validateAggregate(field.aggregate, resolved.col);
        if (aggErr) return aggErr;
      }

      if (field.aggregate === 'percentile') {
        const pErr = validatePercentileParam(field.percentile);
        if (pErr) return pErr;
      }
    }
  }

  if (query.groupBy) {
    for (const g of query.groupBy) {
      const fieldName = typeof g === 'string' ? g : g.field;
      const err = validateFieldRef(fieldName, tableMap);
      if (err) return err;

      if (typeof g !== 'string' && g.bucket) {
        const resolved = resolveField(g.field, tableMap);
        if (resolved && resolved.col.type !== 'date') {
          return {
            ok: false,
            error: `Cannot apply time bucket "${g.bucket}" to non-date field "${g.field}" (type: ${resolved.col.type}). Only date columns support time bucketing.`,
          };
        }
      }
    }
  }

  if (query.filter) {
    for (const f of query.filter) {
      const err = validateFieldRef(f.field, tableMap);
      if (err) return err;
    }
  }

  if (query.having) {
    for (const h of query.having) {
      if (!aliases.includes(h.field)) {
        return {
          ok: false,
          error: `Having field "${h.field}" must reference an aggregate alias. Available aliases: ${aliases.join(', ')}`,
        };
      }
    }
  }

  if (query.orderBy) {
    const bucketAliases = computeBucketAliases(query);
    for (const o of query.orderBy) {
      // orderBy can reference aliases, bucket aliases, or table fields
      if (aliases.includes(o.field)) continue;
      if (bucketAliases.includes(o.field)) continue;
      const err = validateFieldRef(o.field, tableMap);
      if (err) return err;
    }
  }

  return { ok: true };
}

/** Validate a field used in a join ON clause */
function validateJoinField(
  field: string,
  baseTableName: string,
  tableMap: Map<string, DataTable>
): ValidationResult | null {
  if (field.includes('.')) {
    const [tableName, colName] = field.split('.', 2);
    const table = tableMap.get(tableName);
    if (!table) {
      return { ok: false, error: `Table "${tableName}" referenced in join ON clause is not in scope. Available: ${[...tableMap.keys()].join(', ')}` };
    }
    const cols = table.columns.map(c => c.name);
    if (!cols.includes(colName)) {
      const suggestion = findClosest(colName, cols);
      return { ok: false, error: `Field "${colName}" not found in table "${tableName}".${suggestion ? ` Did you mean "${suggestion}"?` : ''} Available: ${cols.join(', ')}` };
    }
    return null;
  }

  // Unqualified — must exist in the base table
  const base = tableMap.get(baseTableName)!;
  const cols = base.columns.map(c => c.name);
  if (!cols.includes(field)) {
    const suggestion = findClosest(field, cols);
    return { ok: false, error: `Field "${field}" not found in table "${baseTableName}".${suggestion ? ` Did you mean "${suggestion}"?` : ''} Available: ${cols.join(', ')}` };
  }
  return null;
}

/**
 * Validate a field reference (select/groupBy/filter/orderBy) across joined tables.
 * Handles dot-notation and ambiguity detection.
 */
function validateFieldRef(
  field: string,
  tableMap: Map<string, DataTable>
): ValidationResult | null {
  if (field.includes('.')) {
    const [tableName, colName] = field.split('.', 2);
    const table = tableMap.get(tableName);
    if (!table) {
      return { ok: false, error: `Table "${tableName}" is not in scope. Joined tables: ${[...tableMap.keys()].join(', ')}` };
    }
    const cols = table.columns.map(c => c.name);
    if (!cols.includes(colName)) {
      const suggestion = findClosest(colName, cols);
      return { ok: false, error: `Field "${colName}" not found in table "${tableName}".${suggestion ? ` Did you mean "${suggestion}"?` : ''} Available: ${cols.join(', ')}` };
    }
    return null;
  }

  // Unqualified — check for ambiguity across all joined tables
  const matchingTables: string[] = [];
  for (const [tName, tSchema] of tableMap) {
    if (tSchema.columns.some(c => c.name === field)) {
      matchingTables.push(tName);
    }
  }

  if (matchingTables.length === 0) {
    const allCols = [...new Set([...tableMap.values()].flatMap(t => t.columns.map(c => c.name)))];
    const suggestion = findClosest(field, allCols);
    return { ok: false, error: `Unknown field "${field}".${suggestion ? ` Did you mean "${suggestion}"?` : ''} Available columns: ${allCols.join(', ')}` };
  }

  if (matchingTables.length > 1) {
    return {
      ok: false,
      error: `Field "${field}" is ambiguous — it exists in both ${matchingTables.map(t => `"${t}"`).join(' and ')}. Use "${matchingTables[0]}.${field}" or "${matchingTables[1]}.${field}".`,
    };
  }

  return null;
}

/** Resolve a field reference to its table and column */
function resolveField(
  field: string,
  tableMap: Map<string, DataTable>
): { table: DataTable; col: { name: string; type: string } } | null {
  if (field.includes('.')) {
    const [tableName, colName] = field.split('.', 2);
    const table = tableMap.get(tableName);
    if (!table) return null;
    const col = table.columns.find(c => c.name === colName);
    return col ? { table, col } : null;
  }
  for (const [, tSchema] of tableMap) {
    const col = tSchema.columns.find(c => c.name === field);
    if (col) return { table: tSchema, col };
  }
  return null;
}

// ─── BUCKET ALIAS HELPERS ────────────────────────────────────────────────────

function computeBucketAliases(query: DslQuery): string[] {
  const aliases: string[] = [];
  if (query.groupBy) {
    for (const g of query.groupBy) {
      if (typeof g !== 'string' && g.bucket) {
        aliases.push(`${g.field.replace('.', '_')}_${g.bucket}`);
      }
    }
  }
  return aliases;
}

// ─── WINDOW FUNCTION VALIDATION ──────────────────────────────────────────────

const WINDOW_NEEDS_FIELD = new Set(['lag', 'lead', 'running_sum', 'running_avg', 'pct_of_total']);
const WINDOW_NEEDS_ORDER_BY = new Set(['lag', 'lead', 'rank', 'dense_rank', 'row_number', 'running_sum', 'running_avg']);

function computeBaseOutputNames(query: DslQuery): string[] {
  const names: string[] = [];
  for (const s of query.select) {
    if (typeof s === 'string') {
      const unqualified = s.includes('.') ? s.split('.', 2)[1] : s;
      names.push(unqualified);
      // Also track dot-notation form so window fields can reference either
      if (s.includes('.') && !names.includes(s)) {
        names.push(s);
      }
    } else if (isDslAggregateField(s)) {
      names.push(s.as);
    }
  }
  if (query.groupBy) {
    for (const g of query.groupBy) {
      if (typeof g !== 'string' && g.bucket) {
        names.push(`${g.field.replace('.', '_')}_${g.bucket}`);
      }
    }
  }
  return names;
}

function validateWindowField(field: DslWindowField, baseOutputNames: string[]): ValidationResult | null {
  if (WINDOW_NEEDS_FIELD.has(field.window) && !field.field) {
    return {
      ok: false,
      error: `Window function "${field.window}" requires a "field" parameter.`,
    };
  }
  if (WINDOW_NEEDS_ORDER_BY.has(field.window) && (!field.orderBy || field.orderBy.length === 0)) {
    return {
      ok: false,
      error: `Window function "${field.window}" requires "orderBy" to define the window order.`,
    };
  }
  if (field.field) {
    if (!baseOutputNames.includes(field.field)) {
      const suggestion = findClosest(field.field, baseOutputNames);
      return {
        ok: false,
        error: `Window field "${field.field}" must reference a base query output column.${suggestion ? ` Did you mean "${suggestion}"?` : ''} Available: ${baseOutputNames.join(', ')}`,
      };
    }
  }
  if (field.orderBy) {
    for (const o of field.orderBy) {
      if (!baseOutputNames.includes(o.field)) {
        const suggestion = findClosest(o.field, baseOutputNames);
        return {
          ok: false,
          error: `Window orderBy field "${o.field}" must reference a base query output column.${suggestion ? ` Did you mean "${suggestion}"?` : ''} Available: ${baseOutputNames.join(', ')}`,
        };
      }
    }
  }
  if (field.partitionBy) {
    for (const p of field.partitionBy) {
      if (!baseOutputNames.includes(p)) {
        const suggestion = findClosest(p, baseOutputNames);
        return {
          ok: false,
          error: `Window partitionBy field "${p}" must reference a base query output column.${suggestion ? ` Did you mean "${suggestion}"?` : ''} Available: ${baseOutputNames.join(', ')}`,
        };
      }
    }
  }
  return null;
}

function validateFieldExists(field: string, colNames: string[]): ValidationResult | null {
  if (!colNames.includes(field)) {
    const suggestion = findClosest(field, colNames);
    return {
      ok: false,
      error: `Unknown field "${field}".${suggestion ? ` Did you mean "${suggestion}"?` : ''} Available columns: ${colNames.join(', ')}`,
    };
  }
  return null;
}

function validatePercentileParam(percentile: number | undefined): ValidationResult | null {
  if (percentile == null) {
    return { ok: false, error: 'Aggregate "percentile" requires a "percentile" parameter (0–1), e.g. 0.95 for p95.' };
  }
  if (typeof percentile !== 'number' || percentile < 0 || percentile > 1) {
    return { ok: false, error: `Percentile value must be a number between 0 and 1, got: ${percentile}` };
  }
  return null;
}

const NUMERIC_AGGREGATES = ['sum', 'avg', 'median', 'p25', 'p75', 'stddev', 'percentile'];
const ANY_TYPE_AGGREGATES = ['count', 'count_distinct', 'min', 'max'];

function validateAggregate(aggregate: string, col: { name: string; type: string }): ValidationResult | null {
  if (ANY_TYPE_AGGREGATES.includes(aggregate)) return null;
  if (NUMERIC_AGGREGATES.includes(aggregate) && col.type !== 'numeric') {
    return {
      ok: false,
      error: `Cannot apply "${aggregate}" to field "${col.name}" (type: ${col.type}). Numeric aggregates (${NUMERIC_AGGREGATES.join(', ')}) require numeric columns.`,
    };
  }
  return null;
}

/** Simple Levenshtein-based closest match */
function findClosest(input: string, candidates: string[]): string | null {
  let best: string | null = null;
  let bestDist = Infinity;
  const lower = input.toLowerCase();

  for (const c of candidates) {
    const dist = levenshtein(lower, c.toLowerCase());
    if (dist < bestDist && dist <= 3) {
      bestDist = dist;
      best = c;
    }
  }

  return best;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return dp[m][n];
}
