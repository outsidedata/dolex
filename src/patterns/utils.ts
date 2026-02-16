/**
 * Shared utilities for data shape analysis.
 * Used by the pattern selector to evaluate data characteristics
 * before scoring patterns.
 */

import type { DataColumn, PatternMatchContext } from '../types.js';

// ─── DATA SHAPE DETECTION ────────────────────────────────────────────────────

/**
 * Detect whether numeric data contains a time-series column.
 * Checks column type and name heuristics.
 */
export function hasTimeSeriesColumn(columns: DataColumn[]): boolean {
  return columns.some(
    (col) =>
      col.type === 'date' ||
      /^(date|time|timestamp|year|month|day|quarter|week|period|created|updated)$/i.test(col.name) ||
      /_(date|time|at|on)$/i.test(col.name)
  );
}

/**
 * Count unique categorical values in the data for a given column name.
 */
export function countCategories(data: Record<string, any>[], columnName: string): number {
  const unique = new Set<string>();
  for (const row of data) {
    const val = row[columnName];
    if (val != null) {
      unique.add(String(val));
    }
  }
  return unique.size;
}

/**
 * Count unique series values in the data.
 * A "series" column is typically the second categorical column used for grouping.
 */
export function countSeries(data: Record<string, any>[], columns: DataColumn[]): number {
  const categoricalCols = columns.filter((c) => c.type === 'categorical');
  if (categoricalCols.length < 2) return 1;
  // The second categorical column is typically the series
  return countCategories(data, categoricalCols[1].name);
}

/**
 * Check if any numeric column contains negative values.
 */
export function hasNegativeValues(data: Record<string, any>[], columns: DataColumn[]): boolean {
  const numericCols = columns.filter((c) => c.type === 'numeric');
  for (const col of numericCols) {
    for (const row of data) {
      const val = Number(row[col.name]);
      if (!isNaN(val) && val < 0) return true;
    }
  }
  return false;
}

/**
 * Get the min and max values across all numeric columns.
 */
export function getValueRange(
  data: Record<string, any>[],
  columns: DataColumn[]
): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  const numericCols = columns.filter((c) => c.type === 'numeric');

  for (const col of numericCols) {
    for (const row of data) {
      const val = Number(row[col.name]);
      if (!isNaN(val)) {
        if (val < min) min = val;
        if (val > max) max = val;
      }
    }
  }

  if (min === Infinity) min = 0;
  if (max === -Infinity) max = 0;
  return { min, max };
}

/**
 * Detect hierarchical structure in the data.
 * Looks for parent-child relationships or multiple categorical columns
 * with decreasing cardinality (e.g., region > country > city).
 */
export function detectHierarchy(data: Record<string, any>[], columns: DataColumn[]): boolean {
  const categoricalCols = columns.filter((c) => c.type === 'categorical');
  if (categoricalCols.length < 2) return false;

  // Check for decreasing cardinality pattern
  const cardinalities = categoricalCols.map((col) => countCategories(data, col.name));
  for (let i = 0; i < cardinalities.length - 1; i++) {
    if (cardinalities[i] < cardinalities[i + 1]) {
      // Higher level has fewer categories — possible hierarchy
      return true;
    }
  }

  // Check for parent-child naming patterns
  const names = categoricalCols.map((c) => c.name.toLowerCase());
  const hierarchyPairs = [
    ['region', 'country'],
    ['country', 'city'],
    ['department', 'team'],
    ['category', 'subcategory'],
    ['parent', 'child'],
    ['group', 'subgroup'],
  ];
  for (const [parent, child] of hierarchyPairs) {
    if (names.some((n) => n.includes(parent)) && names.some((n) => n.includes(child))) {
      return true;
    }
  }

  return false;
}

// ─── INTENT PARSING ──────────────────────────────────────────────────────────

export type IntentCategory = 'comparison' | 'distribution' | 'composition' | 'time' | 'relationship' | 'flow' | 'unknown';

const INTENT_KEYWORDS: Record<IntentCategory, RegExp[]> = {
  comparison: [
    /\bcompar/i,
    /\bvs\.?\b/i,
    /\bversus\b/i,
    /\bbetween\b/i,
    /\bdifference/i,
    /\brank/i,
    /\btop\b/i,
    /\bbottom\b/i,
    /\blargest\b/i,
    /\bsmallest\b/i,
    /\bhighest\b/i,
    /\blowest\b/i,
    /\bmore than\b/i,
    /\bless than\b/i,
    /\bgrowth\b/i,
    /\bdecline\b/i,
    /\bchange\b/i,
  ],
  distribution: [
    /\bdistribut/i,
    /\bspread\b/i,
    /\boutlier/i,
    /\bfrequenc/i,
    /\bhistogram\b/i,
    /\bdensity\b/i,
    /\brange\b/i,
    /\bvariance\b/i,
    /\bskew/i,
    /\bnormal\b/i,
    /\bbell curve\b/i,
    /\bquartile/i,
    /\bpercentile/i,
    /\bmedian\b/i,
  ],
  composition: [
    /\bpercentage/i,
    /\bproportion/i,
    /\bshare\b/i,
    /\bpart.of/i,
    /\bmakeup\b/i,
    /\bcompos/i,
    /\bbreakdown\b/i,
    /\bconstituent/i,
    /\bsplit\b/i,
    /\b(what|how)\s+(much|many)\s+of\b/i,
    /\bpie\b/i,
    /\bfraction/i,
    /\bratio\b/i,
    /\bpercent\b/i,
  ],
  time: [
    /\bover time\b/i,
    /\btrend/i,
    /\btime.?series\b/i,
    /\bmonth/i,
    /\byear/i,
    /\bquarter/i,
    /\bweek/i,
    /\bdaily\b/i,
    /\bseason/i,
    /\bhistor/i,
    /\bforecast/i,
    /\bgrowth\b/i,
    /\bprogress/i,
    /\bevolution\b/i,
    /\btrajectory/i,
  ],
  relationship: [
    /\bcorrelat/i,
    /\brelation/i,
    /\bassociat/i,
    /\bscatter/i,
    /\bregress/i,
    /\bpredict/i,
    /\bfactor/i,
    /\binfluence/i,
    /\bimpact\b/i,
    /\baffect/i,
    /\bdepend/i,
    /\bmultivariat/i,
    /\bdimension/i,
    /\bprofile\b/i,
  ],
  flow: [
    /\bflow\b/i,
    /\bsankey\b/i,
    /\btransition/i,
    /\bconver/i,
    /\bfunnel\b/i,
    /\bpath\b/i,
    /\bjourney\b/i,
    /\bpipeline\b/i,
    /\bstage/i,
    /\bstep/i,
    /\bfrom.+to\b/i,
    /\bsource.+target\b/i,
    /\binput.+output\b/i,
  ],
  unknown: [],
};

/**
 * Parse user intent string and return the most likely category.
 * Returns all matching categories ranked by keyword match count.
 */
export function parseIntent(intent: string): { primary: IntentCategory; scores: Record<IntentCategory, number> } {
  const scores: Record<IntentCategory, number> = {
    comparison: 0,
    distribution: 0,
    composition: 0,
    time: 0,
    relationship: 0,
    flow: 0,
    unknown: 0,
  };

  for (const [category, patterns] of Object.entries(INTENT_KEYWORDS) as [IntentCategory, RegExp[]][]) {
    if (category === 'unknown') continue;
    for (const pattern of patterns) {
      if (pattern.test(intent)) {
        scores[category]++;
      }
    }
  }

  let primary: IntentCategory = 'unknown';
  let maxScore = 0;
  for (const [category, score] of Object.entries(scores) as [IntentCategory, number][]) {
    if (category === 'unknown') continue;
    if (score > maxScore) {
      maxScore = score;
      primary = category;
    }
  }

  return { primary, scores };
}

// ─── DATA SHAPE BUILDING ─────────────────────────────────────────────────────

/**
 * Build a complete PatternMatchContext from raw data, columns, and intent.
 * This is the main entry point for constructing the context object
 * that pattern selection rules evaluate against.
 */
export function buildMatchContext(
  data: Record<string, any>[],
  columns: DataColumn[],
  intent: string
): PatternMatchContext {
  const categoricalCols = columns.filter((c) => c.type === 'categorical');
  const numericCols = columns.filter((c) => c.type === 'numeric');
  const dateCols = columns.filter((c) => c.type === 'date');

  const categoryCount = categoricalCols.length > 0
    ? countCategories(data, categoricalCols[0].name)
    : 0;

  const seriesCount = countSeries(data, columns);
  const valueRange = getValueRange(data, columns);

  return {
    data,
    columns,
    intent,
    dataShape: {
      rowCount: data.length,
      categoryCount,
      seriesCount,
      numericColumnCount: numericCols.length,
      categoricalColumnCount: categoricalCols.length,
      dateColumnCount: dateCols.length,
      hasTimeSeries: hasTimeSeriesColumn(columns),
      hasHierarchy: detectHierarchy(data, columns),
      hasNegativeValues: hasNegativeValues(data, columns),
      valueRange,
    },
  };
}

// ─── COLUMN UTILITIES ─────────────────────────────────────────────────────────

/**
 * Find the first column of a given type from a list of column names
 * using the full DataColumn metadata.
 */
export function findColumnByType(
  columns: DataColumn[],
  type: DataColumn['type']
): DataColumn | undefined {
  return columns.find((c) => c.type === type);
}

/**
 * Find all columns of a given type.
 */
export function findColumnsByType(
  columns: DataColumn[],
  type: DataColumn['type']
): DataColumn[] {
  return columns.filter((c) => c.type === type);
}

/**
 * Infer the Vega-Lite field type from a DataColumn type.
 */
export function inferFieldType(colType: DataColumn['type']): 'quantitative' | 'nominal' | 'ordinal' | 'temporal' {
  switch (colType) {
    case 'numeric':
      return 'quantitative';
    case 'date':
      return 'temporal';
    case 'categorical':
      return 'nominal';
    case 'id':
      return 'nominal';
    case 'text':
      return 'nominal';
    default:
      return 'nominal';
  }
}

/**
 * Given an array of column names and full DataColumn metadata,
 * determine the best x, y, color, and size columns.
 * A best-effort heuristic for generateSpec functions.
 */
export function inferEncoding(
  columnNames: string[],
  columns: DataColumn[]
): {
  x: string | null;
  y: string | null;
  color: string | null;
  size: string | null;
} {
  const colMap = new Map(columns.map((c) => [c.name, c]));
  const available = columnNames.filter((n) => colMap.has(n));

  const categoricalCols = available.filter((n) => {
    const c = colMap.get(n)!;
    return c.type === 'categorical' || c.type === 'id' || c.type === 'text';
  });
  const numericCols = available.filter((n) => colMap.get(n)!.type === 'numeric');
  const dateCols = available.filter((n) => colMap.get(n)!.type === 'date');

  let x: string | null = null;
  let y: string | null = null;
  let color: string | null = null;
  let size: string | null = null;

  // Prefer date for x-axis if present
  if (dateCols.length > 0) {
    x = dateCols[0];
  } else if (categoricalCols.length > 0) {
    x = categoricalCols[0];
  }

  // First numeric for y-axis
  if (numericCols.length > 0) {
    y = numericCols[0];
  }

  // Second categorical for color, or second numeric for size
  if (categoricalCols.length > 1) {
    color = categoricalCols.find((n) => n !== x) ?? null;
  }

  if (numericCols.length > 1) {
    size = numericCols.find((n) => n !== y) ?? null;
  }

  return { x, y, color, size };
}
