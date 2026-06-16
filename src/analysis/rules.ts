import type { ClassifiedColumn, AnalysisStep, AnalysisCategory } from './types.js';

// --- Helpers ----------------------------------------------------------------

export function capitalize(s: string): string {
  return s
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/** Escape + quote a SQL identifier so embedded double-quotes can't break out
 *  of (or inject into) the generated query. e.g. order"date → "order""date". */
function q(id: string): string {
  return '"' + String(id).replace(/"/g, '""') + '"';
}

export function pickTimeBucket(col: ClassifiedColumn): 'day' | 'week' | 'month' | 'quarter' | 'year' {
  if (col.uniqueCount > 365) return 'day';
  if (col.uniqueCount > 100) return 'week';
  if (col.uniqueCount > 24) return 'month';
  if (col.uniqueCount > 8) return 'quarter';
  return 'month';
}

/**
 * A "year" column holds 4-digit years (often as integers/floats), not full
 * dates. Sub-year buckets like strftime('%Y-%m', year) are nonsense on these —
 * SQLite reads a bare number as a Julian day and emits garbage ('-4707-04').
 * Detect by name (year/yr/fy) or by all top values being 4-digit years.
 */
export function isYearColumn(col: ClassifiedColumn): boolean {
  if (/(^|[^a-z])(year|yr|fy)([^a-z]|$)/i.test(col.name)) return true;
  const vals = (col.topValues ?? []).map((t) => String(t.value));
  return vals.length > 0 && vals.every((v) => /^(1[89]|20)\d{2}(\.0+)?$/.test(v));
}

/**
 * True only if the column's values are ISO-8601 dates (YYYY-MM-DD…). SQLite's
 * strftime parses ONLY ISO format; on slash/text dates ('9/2/1966') it returns
 * NULL for every row, collapsing a trend into one garbage bucket.
 */
export function isIsoDateColumn(col: ClassifiedColumn): boolean {
  const vals = (col.topValues ?? []).map((t) => String(t.value));
  return vals.length > 0 && vals.every((v) => /^\d{4}-\d{2}-\d{2}([ T]|$)/.test(v));
}

/**
 * Choose the time-bucket label + a SQL expression robust to how the value is
 * stored. Year columns extract the integer year (works for '1980', '1980.0',
 * numeric 1980); ISO dates use strftime. Returns null for a non-ISO, non-year
 * date column — we'd rather skip the trend than ship strftime SQL that silently
 * produces a single NULL bucket summing the whole table.
 */
export function timeBucketing(col: ClassifiedColumn): { label: string; expr: string } | null {
  if (isYearColumn(col)) {
    const c = q(col.name);
    return {
      label: 'year',
      expr: `CASE WHEN CAST(${c} AS REAL) BETWEEN 1000 AND 2200 THEN CAST(CAST(${c} AS INTEGER) AS TEXT) END`,
    };
  }
  // Skip only on POSITIVE evidence the dates are non-ISO (top values present and
  // not ISO). Absent top values, assume ISO and bucket as before — a real date
  // column always has top values, so genuine non-ISO data is still caught.
  const vals = (col.topValues ?? []).map((t) => String(t.value));
  if (vals.length > 0 && !isIsoDateColumn(col)) return null;
  const bucket = pickTimeBucket(col);
  return { label: bucket, expr: sqlTimeBucket(col.name, bucket) };
}

function findByRole(columns: ClassifiedColumn[], role: ClassifiedColumn['role']): ClassifiedColumn[] {
  return columns.filter(c => c.role === role);
}

function first(columns: ClassifiedColumn[], role: ClassifiedColumn['role']): ClassifiedColumn | undefined {
  return columns.find(c => c.role === role);
}

function sumAlias(measureName: string): string {
  return `total_${measureName}`;
}

function sqlTimeBucket(col: string, bucket: 'day' | 'week' | 'month' | 'quarter' | 'year'): string {
  const c = q(col);
  switch (bucket) {
    case 'year':
      return `CASE WHEN typeof(${c}) = 'integer' AND ${c} BETWEEN 1000 AND 2200 THEN CAST(${c} AS TEXT) ELSE strftime('%Y', ${c}) END`;
    case 'quarter':
      return `strftime('%Y', ${c}) || '-Q' || ((CAST(strftime('%m', ${c}) AS INTEGER) - 1) / 3 + 1)`;
    case 'month':
      return `strftime('%Y-%m', ${c})`;
    case 'week':
      return `strftime('%Y-W%W', ${c})`;
    case 'day':
      return `strftime('%Y-%m-%d', ${c})`;
  }
}

function makeStep(
  category: AnalysisCategory,
  title: string,
  question: string,
  intent: string,
  rationale: string,
  sql: string,
  table: string,
  suggestedPatterns: string[],
): AnalysisStep {
  return { title, question, intent, sql, table, suggestedPatterns, rationale, category };
}

// --- Rules ------------------------------------------------------------------

type AnalysisRule = (columns: ClassifiedColumn[], table: string) => AnalysisStep | null;

const timeTrend: AnalysisRule = (columns, table) => {
  const timeCol = first(columns, 'time');
  const measureCol = first(columns, 'measure');
  if (!timeCol || !measureCol) return null;

  const tb = timeBucketing(timeCol);
  if (!tb) return null; // date column isn't ISO/year-bucketable — skip rather than ship garbage SQL
  const { label: bucket, expr: bucketExpr } = tb;
  const asName = sumAlias(measureCol.name);

  return makeStep(
    'trend',
    `${capitalize(measureCol.name)} Over Time`,
    `How does ${capitalize(measureCol.name)} change over time?`,
    `Show ${measureCol.name} trend over ${timeCol.name}`,
    `Time column "${timeCol.name}" paired with measure "${measureCol.name}" suggests a time-series trend analysis.`,
    `SELECT ${bucketExpr} AS ${q(`${timeCol.name}_${bucket}`)}, SUM(${q(measureCol.name)}) AS ${q(asName)} FROM ${q(table)} GROUP BY 1 ORDER BY 1 ASC`,
    table,
    ['line', 'area', 'sparkline-grid'],
  );
};

const trendByGroup: AnalysisRule = (columns, table) => {
  const timeCol = first(columns, 'time');
  const measureCol = first(columns, 'measure');
  const dimCol = findByRole(columns, 'dimension').find(d => d.uniqueCount <= 8);
  if (!timeCol || !measureCol || !dimCol) return null;

  const tb = timeBucketing(timeCol);
  if (!tb) return null; // non-ISO/non-year date — skip rather than ship garbage SQL
  const { label: bucket, expr: bucketExpr } = tb;
  const asName = sumAlias(measureCol.name);

  return makeStep(
    'trend',
    `${capitalize(measureCol.name)} Over Time by ${capitalize(dimCol.name)}`,
    `How does ${capitalize(measureCol.name)} trend over time across different ${capitalize(dimCol.name)} values?`,
    `Show ${measureCol.name} trend over ${timeCol.name} grouped by ${dimCol.name}`,
    `Time column "${timeCol.name}" with low-cardinality dimension "${dimCol.name}" (${dimCol.uniqueCount} values) enables grouped trend comparison.`,
    `SELECT ${bucketExpr} AS ${q(`${timeCol.name}_${bucket}`)}, ${q(dimCol.name)}, SUM(${q(measureCol.name)}) AS ${q(asName)} FROM ${q(table)} GROUP BY 1, ${q(dimCol.name)} ORDER BY 1 ASC`,
    table,
    ['small-multiples', 'sparkline-grid'],
  );
};

const comparison: AnalysisRule = (columns, table) => {
  const dimCol = first(columns, 'dimension');
  const measureCol = first(columns, 'measure');
  if (!dimCol || !measureCol) return null;

  const asName = sumAlias(measureCol.name);
  const patterns = dimCol.uniqueCount > 10
    ? ['bar', 'lollipop']
    : ['bar', 'lollipop', 'diverging-bar'];

  return makeStep(
    'comparison',
    `${capitalize(measureCol.name)} by ${capitalize(dimCol.name)}`,
    `How does ${capitalize(measureCol.name)} compare across ${capitalize(dimCol.name)} values?`,
    `Compare ${measureCol.name} across ${dimCol.name}`,
    `Dimension "${dimCol.name}" (${dimCol.uniqueCount} unique values) with measure "${measureCol.name}" enables categorical comparison.`,
    `SELECT ${q(dimCol.name)}, SUM(${q(measureCol.name)}) AS ${q(asName)} FROM ${q(table)} GROUP BY ${q(dimCol.name)} ORDER BY ${q(asName)} DESC`,
    table,
    patterns,
  );
};

const distribution: AnalysisRule = (columns, table) => {
  const measureCol = first(columns, 'measure');
  if (!measureCol) return null;

  return makeStep(
    'distribution',
    `Distribution of ${capitalize(measureCol.name)}`,
    `What is the distribution of ${capitalize(measureCol.name)}?`,
    `Show distribution of ${measureCol.name}`,
    `Measure "${measureCol.name}" can be analyzed for its statistical distribution.`,
    `SELECT ${q(measureCol.name)} FROM ${q(table)}`,
    table,
    ['histogram', 'violin', 'beeswarm'],
  );
};

const relationship: AnalysisRule = (columns, table) => {
  const measures = findByRole(columns, 'measure');
  if (measures.length < 2) return null;

  const [m1, m2] = measures;
  const dimCol = findByRole(columns, 'dimension').find(d => d.uniqueCount <= 10);
  const selectCols = dimCol
    ? `${q(m1.name)}, ${q(m2.name)}, ${q(dimCol.name)}`
    : `${q(m1.name)}, ${q(m2.name)}`;

  return makeStep(
    'relationship',
    `${capitalize(m1.name)} vs ${capitalize(m2.name)}`,
    `What is the relationship between ${capitalize(m1.name)} and ${capitalize(m2.name)}?`,
    `Explore relationship between ${m1.name} and ${m2.name}`,
    `Two measure columns "${m1.name}" and "${m2.name}" enable relationship analysis.${dimCol ? ` Dimension "${dimCol.name}" adds color grouping.` : ''}`,
    `SELECT ${selectCols} FROM ${q(table)}`,
    table,
    ['scatter', 'heatmap'],
  );
};

const ranking: AnalysisRule = (columns, table) => {
  const dimCol = findByRole(columns, 'dimension').find(d => d.uniqueCount > 10);
  const measureCol = first(columns, 'measure');
  if (!dimCol || !measureCol) return null;

  if (measureCol.stats && measureCol.stats.mean !== 0 && measureCol.stats.stddev != null) {
    const cv = Math.abs(measureCol.stats.stddev / measureCol.stats.mean);
    if (cv < 0.1) return null;
  }

  const asName = sumAlias(measureCol.name);

  return makeStep(
    'ranking',
    `Top ${capitalize(dimCol.name)} by ${capitalize(measureCol.name)}`,
    `Which ${capitalize(dimCol.name)} values rank highest by ${capitalize(measureCol.name)}?`,
    `Rank top ${dimCol.name} by ${measureCol.name}`,
    `High-cardinality dimension "${dimCol.name}" (${dimCol.uniqueCount} values) with measure "${measureCol.name}" suits a top-N ranking with limit.`,
    `SELECT ${q(dimCol.name)}, SUM(${q(measureCol.name)}) AS ${q(asName)} FROM ${q(table)} GROUP BY ${q(dimCol.name)} ORDER BY ${q(asName)} DESC LIMIT 15`,
    table,
    ['bar', 'lollipop'],
  );
};

const isNullDominant = (col: ClassifiedColumn): boolean =>
  col.totalCount > 0 && col.nullCount / col.totalCount > 0.5;

const composition: AnalysisRule = (columns, table) => {
  const hierarchyCol = first(columns, 'hierarchy');
  const measureCol = first(columns, 'measure');
  const dimCol = findByRole(columns, 'dimension').find(d => !isNullDominant(d));

  if (hierarchyCol && !isNullDominant(hierarchyCol) && dimCol && measureCol) {
    const asName = sumAlias(measureCol.name);

    return makeStep(
      'composition',
      `${capitalize(measureCol.name)} Composition by ${capitalize(dimCol.name)} and ${capitalize(hierarchyCol.name)}`,
      `How is ${capitalize(measureCol.name)} distributed across ${capitalize(dimCol.name)} and ${capitalize(hierarchyCol.name)}?`,
      `Show composition of ${measureCol.name} by ${dimCol.name} and ${hierarchyCol.name}`,
      `Hierarchy column "${hierarchyCol.name}" with dimension "${dimCol.name}" and measure "${measureCol.name}" enables hierarchical composition analysis.`,
      `SELECT ${q(dimCol.name)}, ${q(hierarchyCol.name)}, SUM(${q(measureCol.name)}) AS ${q(asName)} FROM ${q(table)} GROUP BY ${q(dimCol.name)}, ${q(hierarchyCol.name)}`,
      table,
      ['treemap', 'sunburst', 'stacked-bar'],
    );
  }

  if (dimCol && measureCol && dimCol.uniqueCount >= 3 && dimCol.uniqueCount <= 12) {
    const asName = sumAlias(measureCol.name);

    return makeStep(
      'composition',
      `${capitalize(measureCol.name)} Composition by ${capitalize(dimCol.name)}`,
      `What share does each ${capitalize(dimCol.name)} contribute to total ${capitalize(measureCol.name)}?`,
      `Show composition of ${measureCol.name} by ${dimCol.name}`,
      `Dimension "${dimCol.name}" (${dimCol.uniqueCount} values) with measure "${measureCol.name}" suits part-of-whole composition analysis.`,
      `SELECT ${q(dimCol.name)}, SUM(${q(measureCol.name)}) AS ${q(asName)} FROM ${q(table)} GROUP BY ${q(dimCol.name)}`,
      table,
      ['donut', 'waffle', 'treemap'],
    );
  }

  return null;
};

// --- All Rules --------------------------------------------------------------

const ALL_RULES: AnalysisRule[] = [
  timeTrend,
  trendByGroup,
  comparison,
  distribution,
  relationship,
  ranking,
  composition,
];

// --- Main Export -------------------------------------------------------------

export function generateCandidates(columns: ClassifiedColumn[], table: string): AnalysisStep[] {
  return ALL_RULES.flatMap(rule => {
    const result = rule(columns, table);
    return result ? [result] : [];
  });
}
