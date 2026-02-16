/**
 * Content-appropriate height calculation for visualization specs.
 *
 * Returns a pixel height based on pattern type, data shape, and container width.
 */

import type { VisualizationSpec } from '../../types.js';

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

/** Count unique values for a given field in the data array. */
function uniqueValues(data: Record<string, any>[], field: string): number {
  const seen = new Set<any>();
  for (const row of data) {
    if (row[field] !== undefined && row[field] !== null) {
      seen.add(row[field]);
    }
  }
  return seen.size || 1;
}

/** Count unique series from the color encoding field. */
function seriesCount(spec: VisualizationSpec): number {
  const colorField = spec.encoding.color?.field;
  if (colorField) {
    return uniqueValues(spec.data, colorField);
  }
  // No color encoding — treat as single series
  return 1;
}

/** Count unique categories from the y encoding field (or fall back to data length). */
function categoryCount(spec: VisualizationSpec): number {
  const yField = spec.encoding.y?.field;
  if (yField) {
    return uniqueValues(spec.data, yField);
  }
  // Fall back: count rows as proxy for categories
  return spec.data.length;
}

/** Extract unique years from the x (temporal) encoding field. */
function yearCount(spec: VisualizationSpec): number {
  const xField = spec.encoding.x?.field;
  if (!xField) return 1;

  const years = new Set<number>();
  for (const row of spec.data) {
    const val = row[xField];
    if (val != null) {
      const parsed = new Date(val);
      if (!isNaN(parsed.getTime())) {
        years.add(parsed.getFullYear());
      }
    }
  }
  return years.size || 1;
}

// ─── PATTERN SETS ────────────────────────────────────────────────────────────

const SQUARE_PATTERNS = new Set(['treemap', 'circle-pack', 'sunburst', 'donut']);
const WIDE_PATTERNS = new Set(['parallel-coordinates', 'radar']);
const FLOW_PATTERNS = new Set(['sankey', 'alluvial', 'chord', 'funnel']);
const ALWAYS_HORIZONTAL = new Set(['lollipop', 'bullet']);

// ─── MAIN FUNCTION ───────────────────────────────────────────────────────────

/**
 * Calculate the preferred height for a visualization based on its pattern,
 * data shape, and available container width.
 */
export function getPreferredHeight(spec: VisualizationSpec, containerWidth: number): number {
  const { pattern, data, config } = spec;

  // Empty data — safe fallback
  if (!data || data.length === 0) {
    return 300;
  }

  // ── Metric: compact fixed height ──────────────────────────────────
  if (pattern === 'metric') {
    return 120;
  }

  // ── Sparkline-grid: 80px per series ───────────────────────────────
  if (pattern === 'sparkline-grid') {
    const count = seriesCount(spec);
    return clamp(count * 80 + 60, 200, 600);
  }

  // ── Horizontal bar-like: 28px per category ────────────────────────
  if (ALWAYS_HORIZONTAL.has(pattern) || config?.orientation === 'horizontal') {
    const count = categoryCount(spec);
    return clamp(count * 28 + 100, 300, 800);
  }

  // ── Square layouts: match container width ─────────────────────────
  if (SQUARE_PATTERNS.has(pattern)) {
    return clamp(containerWidth, 300, 700);
  }

  // ── Heatmap: 30px per unique y value ──────────────────────────────
  if (pattern === 'heatmap') {
    const count = categoryCount(spec);
    return clamp(count * 30 + 100, 300, 800);
  }

  // ── Calendar-heatmap: 160px per unique year ───────────────────────
  if (pattern === 'calendar-heatmap') {
    const count = yearCount(spec);
    return clamp(count * 160 + 60, 300, 800);
  }

  // ── Wide charts: fixed 450px ──────────────────────────────────────
  if (WIDE_PATTERNS.has(pattern)) {
    return 450;
  }

  // ── Flow charts: 600 if dense ─────────────────────────────────────
  if (FLOW_PATTERNS.has(pattern)) {
    return data.length > 20 ? 600 : 500;
  }

  // ── Ridgeline: 60px per group ─────────────────────────────────────
  if (pattern === 'ridgeline') {
    const count = categoryCount(spec);
    return clamp(count * 60 + 80, 300, 800);
  }

  // ── Small-multiples: rows of 3 cols at 200px each ────────────────
  if (pattern === 'small-multiples') {
    const count = seriesCount(spec);
    const rows = Math.ceil(count / 3);
    return clamp(rows * 200 + 60, 300, 900);
  }

  // ── Horizon-chart: 80px per series ────────────────────────────────
  if (pattern === 'horizon-chart') {
    const count = seriesCount(spec);
    return clamp(count * 80 + 60, 250, 600);
  }

  // ── Default: standard chart height ────────────────────────────────
  return 500;
}
