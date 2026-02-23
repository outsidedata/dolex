/**
 * Column-wise function implementations for the Dolex expression evaluator.
 *
 * These functions require access to all rows (not just the current row).
 * They are pre-computed before row-wise evaluation begins.
 */
import type { AstNode } from './types.js';
import type { PrecomputedStats } from './evaluator.js';

/** Names of all column-wise functions */
export const COLUMN_WISE_FUNCTIONS = new Set([
  'col_mean', 'col_sd', 'col_min', 'col_max', 'col_median',
  'zscore', 'center', 'rank', 'percentile_rank', 'ntile',
]);

/** Scalar aggregate functions that return one value per group */
const SCALAR_FUNCTIONS = new Set(['col_mean', 'col_sd', 'col_min', 'col_max', 'col_median']);

/** Scalar function dispatch: name -> computation over valid numeric values */
const SCALAR_DISPATCH: Record<string, (vals: number[]) => number> = {
  col_mean: mean,
  col_sd: sampleSd,
  col_min: arrayMin,
  col_max: arrayMax,
  col_median: median,
};

/** Extract all column-wise function calls from an AST */
export function findColumnWiseCalls(ast: AstNode): { name: string; columnName: string; extra?: number }[] {
  const results: { name: string; columnName: string; extra?: number }[] = [];
  walk(ast, results);
  return results;
}

function walk(node: AstNode, results: { name: string; columnName: string; extra?: number }[]): void {
  switch (node.type) {
    case 'call':
      if (COLUMN_WISE_FUNCTIONS.has(node.name)) {
        const colArg = node.args[0];
        if (colArg && colArg.type === 'column') {
          const extra = node.name === 'ntile' && node.args[1]?.type === 'number' ? node.args[1].value : undefined;
          results.push({ name: node.name, columnName: colArg.name, extra });
        }
      }
      for (const arg of node.args) walk(arg, results);
      break;
    case 'binary':
      walk(node.left, results);
      walk(node.right, results);
      break;
    case 'unary':
      walk(node.operand, results);
      break;
    case 'array':
      for (const el of node.elements) walk(el, results);
      break;
  }
}

/** Pre-compute all column-wise stats needed by an AST */
export function precompute(
  ast: AstNode,
  allRows: Record<string, any>[],
  partitionBy?: string
): PrecomputedStats {
  const calls = findColumnWiseCalls(ast);
  const scalars = new Map<string, number>();
  const perRow = new Map<string, Map<number, number>>();

  for (const { name, columnName, extra } of calls) {
    const key = extra !== undefined ? `${name}:${columnName}:${extra}` : `${name}:${columnName}`;

    if (partitionBy) {
      computePartitioned(name, columnName, extra, allRows, partitionBy, scalars, perRow, key);
    } else {
      computeGlobal(name, columnName, extra, allRows, scalars, perRow, key);
    }
  }

  return { scalars, perRow };
}

// ─── Value extraction ────────────────────────────────────────────────────────

/**
 * Coerce raw column values to numbers. CSV columns are stored as TEXT in
 * SQLite, so we attempt numeric conversion. Non-numeric values become null.
 */
function extractValues(rows: Record<string, any>[], columnName: string): (number | null)[] {
  return rows.map(r => {
    const raw = r[columnName];
    if (raw === null || raw === undefined || raw === '') return null;
    if (typeof raw === 'number') return raw;
    const n = Number(raw);
    return isNaN(n) ? null : n;
  });
}

/** Returns indices and values of non-null numeric entries */
function filterValid(values: (number | null)[]): { indices: number[]; nums: number[] } {
  const indices: number[] = [];
  const nums: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (values[i] !== null) {
      indices.push(i);
      nums.push(values[i]!);
    }
  }
  return { indices, nums };
}

/** Group row indices by the value of a partition column */
function groupRowIndices(rows: Record<string, any>[], partitionBy: string): Map<any, number[]> {
  const groups = new Map<any, number[]>();
  for (let i = 0; i < rows.length; i++) {
    const pVal = rows[i][partitionBy];
    if (!groups.has(pVal)) groups.set(pVal, []);
    groups.get(pVal)!.push(i);
  }
  return groups;
}

// ─── Global computation ──────────────────────────────────────────────────────

function computeGlobal(
  name: string,
  columnName: string,
  extra: number | undefined,
  allRows: Record<string, any>[],
  scalars: Map<string, number>,
  perRow: Map<string, Map<number, number>>,
  key: string
): void {
  const values = extractValues(allRows, columnName);
  const { indices: validIndices, nums: validValues } = filterValid(values);

  // Scalar aggregates: col_mean, col_sd, col_min, col_max, col_median
  const scalarFn = SCALAR_DISPATCH[name];
  if (scalarFn) {
    scalars.set(key, validValues.length > 0 ? scalarFn(validValues) : null as any);
    return;
  }

  // Per-row functions: zscore, center, rank, percentile_rank, ntile
  const map = new Map<number, number>();

  switch (name) {
    case 'zscore': {
      if (validValues.length > 0) {
        const m = mean(validValues);
        const sd = sampleSd(validValues);
        for (let i = 0; i < allRows.length; i++) {
          if (values[i] === null || sd === 0) {
            map.set(i, null as any);
          } else {
            map.set(i, (values[i]! - m) / sd);
          }
        }
      } else {
        for (let i = 0; i < allRows.length; i++) map.set(i, null as any);
      }
      break;
    }
    case 'center': {
      if (validValues.length > 0) {
        const m = mean(validValues);
        for (let i = 0; i < allRows.length; i++) {
          map.set(i, values[i] !== null ? values[i]! - m : null as any);
        }
      } else {
        for (let i = 0; i < allRows.length; i++) map.set(i, null as any);
      }
      break;
    }
    case 'rank': {
      const sorted = [...validValues].sort((a, b) => a - b);
      const denseRanks = new Map<number, number>();
      let rank = 1;
      for (let i = 0; i < sorted.length; i++) {
        if (!denseRanks.has(sorted[i])) {
          denseRanks.set(sorted[i], rank++);
        }
      }
      for (let i = 0; i < allRows.length; i++) {
        map.set(i, values[i] !== null ? denseRanks.get(values[i]!)! : null as any);
      }
      break;
    }
    case 'percentile_rank': {
      const sorted = [...validValues].sort((a, b) => a - b);
      for (let i = 0; i < allRows.length; i++) {
        if (values[i] === null) {
          map.set(i, null as any);
        } else {
          const below = lowerBound(sorted, values[i]!);
          map.set(i, validValues.length <= 1 ? 0 : below / (validValues.length - 1));
        }
      }
      break;
    }
    case 'ntile': {
      const n = extra ?? 4;
      const indexed = validIndices.map((rowIdx, j) => ({ rowIdx, val: validValues[j] }));
      indexed.sort((a, b) => a.val - b.val);
      for (let i = 0; i < indexed.length; i++) {
        const tile = Math.floor(i / (indexed.length / n)) + 1;
        map.set(indexed[i].rowIdx, Math.min(tile, n));
      }
      for (let i = 0; i < allRows.length; i++) {
        if (!map.has(i)) map.set(i, null as any);
      }
      break;
    }
  }

  perRow.set(key, map);
}

// ─── Partitioned computation ─────────────────────────────────────────────────

function computePartitioned(
  name: string,
  columnName: string,
  extra: number | undefined,
  allRows: Record<string, any>[],
  partitionBy: string,
  scalars: Map<string, number>,
  perRow: Map<string, Map<number, number>>,
  key: string
): void {
  const groups = groupRowIndices(allRows, partitionBy);
  const map = new Map<number, number>();

  if (SCALAR_FUNCTIONS.has(name)) {
    const scalarFn = SCALAR_DISPATCH[name];
    for (const [, indices] of groups) {
      const groupValues = extractValues(indices.map(i => allRows[i]), columnName)
        .filter((v): v is number => v !== null);

      const result = groupValues.length > 0 ? scalarFn(groupValues) : null;
      for (const i of indices) {
        map.set(i, result as any);
      }
    }
  } else {
    for (const [, indices] of groups) {
      const groupRows = indices.map(i => allRows[i]);
      const subScalars = new Map<string, number>();
      const subPerRow = new Map<string, Map<number, number>>();
      computeGlobal(name, columnName, extra, groupRows, subScalars, subPerRow, key);

      const subMap = subPerRow.get(key);
      if (subMap) {
        for (let j = 0; j < indices.length; j++) {
          map.set(indices[j], subMap.get(j) as any);
        }
      }
    }
  }

  perRow.set(key, map);
}

// ─── Statistical helpers ─────────────────────────────────────────────────────

function lowerBound(sorted: number[], target: number): number {
  let lo = 0, hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function arrayMin(values: number[]): number {
  let min = values[0];
  for (let i = 1; i < values.length; i++) {
    if (values[i] < min) min = values[i];
  }
  return min;
}

function arrayMax(values: number[]): number {
  let max = values[0];
  for (let i = 1; i < values.length; i++) {
    if (values[i] > max) max = values[i];
  }
  return max;
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function sampleSd(values: number[]): number {
  if (values.length <= 1) return 0;
  const m = mean(values);
  const variance = values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}
