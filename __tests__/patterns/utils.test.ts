import { describe, it, expect } from 'vitest';
import {
  parseIntent,
  buildMatchContext,
  hasTimeSeriesColumn,
  hasNegativeValues,
} from '../../src/patterns/utils.js';
import type { DataColumn } from '../../src/types.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function col(name: string, type: DataColumn['type'], uniqueCount = 10): DataColumn {
  return {
    name,
    type,
    sampleValues: [],
    uniqueCount,
    nullCount: 0,
    totalCount: 100,
  };
}

// ── parseIntent ──────────────────────────────────────────────────────────────

describe('parseIntent', () => {
  it('should detect comparison intent from "compare sales by region"', () => {
    const result = parseIntent('compare sales by region');
    expect(result.primary).toBe('comparison');
  });

  it('should detect time intent from "show trend over time"', () => {
    const result = parseIntent('show trend over time');
    expect(result.primary).toBe('time');
  });

  it('should detect distribution intent from "distribution of salaries"', () => {
    const result = parseIntent('distribution of salaries');
    expect(result.primary).toBe('distribution');
  });

  it('should detect composition intent from "breakdown of market share percentage"', () => {
    const result = parseIntent('breakdown of market share percentage');
    expect(result.primary).toBe('composition');
  });

  it('should detect relationship intent from "show correlation of height and weight"', () => {
    const result = parseIntent('show correlation of height and weight');
    expect(result.primary).toBe('relationship');
  });

  it('should detect flow intent from "flow from source to destination"', () => {
    const result = parseIntent('flow from source to destination');
    expect(result.primary).toBe('flow');
  });

  it('should return "unknown" for generic intent "show me the data"', () => {
    const result = parseIntent('show me the data');
    expect(result.primary).toBe('unknown');
  });

  it('should return scores for all categories', () => {
    const result = parseIntent('compare sales by region');
    expect(result.scores).toBeDefined();
    expect(typeof result.scores.comparison).toBe('number');
    expect(typeof result.scores.distribution).toBe('number');
    expect(typeof result.scores.composition).toBe('number');
    expect(typeof result.scores.time).toBe('number');
    expect(typeof result.scores.relationship).toBe('number');
    expect(typeof result.scores.flow).toBe('number');
  });
});

// ── buildMatchContext ────────────────────────────────────────────────────────

describe('buildMatchContext', () => {
  it('should return a valid PatternMatchContext with correct counts', () => {
    const data = [
      { region: 'North', date: '2024-01-01', sales: 100, profit: 20 },
      { region: 'South', date: '2024-02-01', sales: 200, profit: 40 },
      { region: 'East', date: '2024-03-01', sales: 150, profit: 30 },
    ];
    const columns: DataColumn[] = [
      col('region', 'categorical', 3),
      col('date', 'date', 3),
      col('sales', 'numeric'),
      col('profit', 'numeric'),
    ];

    const ctx = buildMatchContext(data, columns, 'compare sales');

    expect(ctx.data).toBe(data);
    expect(ctx.columns).toBe(columns);
    expect(ctx.intent).toBe('compare sales');
    expect(ctx.dataShape).toBeDefined();

    // Row count
    expect(ctx.dataShape.rowCount).toBe(3);
    // Column type counts
    expect(ctx.dataShape.numericColumnCount).toBe(2);
    expect(ctx.dataShape.categoricalColumnCount).toBe(1);
    expect(ctx.dataShape.dateColumnCount).toBe(1);
    // Category count from first categorical column
    expect(ctx.dataShape.categoryCount).toBe(3);
    // Has time series (date column present)
    expect(ctx.dataShape.hasTimeSeries).toBe(true);
    // Value range
    expect(ctx.dataShape.valueRange.min).toBeLessThanOrEqual(20);
    expect(ctx.dataShape.valueRange.max).toBeGreaterThanOrEqual(200);
    // No negative values
    expect(ctx.dataShape.hasNegativeValues).toBe(false);
  });

  it('should handle empty data', () => {
    const ctx = buildMatchContext([], [], 'anything');
    expect(ctx.dataShape.rowCount).toBe(0);
    expect(ctx.dataShape.numericColumnCount).toBe(0);
    expect(ctx.dataShape.categoricalColumnCount).toBe(0);
    expect(ctx.dataShape.dateColumnCount).toBe(0);
    expect(ctx.dataShape.categoryCount).toBe(0);
  });
});

// ── hasTimeSeriesColumn ─────────────────────────────────────────────────────

describe('hasTimeSeriesColumn', () => {
  it('should detect a column with type "date"', () => {
    const columns: DataColumn[] = [col('mydate', 'date')];
    expect(hasTimeSeriesColumn(columns)).toBe(true);
  });

  it('should detect columns by name heuristic (e.g., "created_at")', () => {
    const columns: DataColumn[] = [col('created_at', 'categorical')];
    expect(hasTimeSeriesColumn(columns)).toBe(true);
  });

  it('should detect columns named "year"', () => {
    const columns: DataColumn[] = [col('year', 'numeric')];
    expect(hasTimeSeriesColumn(columns)).toBe(true);
  });

  it('should detect columns named "timestamp"', () => {
    const columns: DataColumn[] = [col('timestamp', 'categorical')];
    expect(hasTimeSeriesColumn(columns)).toBe(true);
  });

  it('should return false when no time-like columns exist', () => {
    const columns: DataColumn[] = [
      col('name', 'categorical'),
      col('value', 'numeric'),
    ];
    expect(hasTimeSeriesColumn(columns)).toBe(false);
  });
});

// ── hasNegativeValues ───────────────────────────────────────────────────────

describe('hasNegativeValues', () => {
  it('should detect negative values in numeric columns', () => {
    const data = [
      { score: 10, change: -5 },
      { score: 20, change: 3 },
    ];
    const columns: DataColumn[] = [
      col('score', 'numeric'),
      col('change', 'numeric'),
    ];
    expect(hasNegativeValues(data, columns)).toBe(true);
  });

  it('should return false when all values are positive', () => {
    const data = [
      { score: 10, value: 5 },
      { score: 20, value: 3 },
    ];
    const columns: DataColumn[] = [
      col('score', 'numeric'),
      col('value', 'numeric'),
    ];
    expect(hasNegativeValues(data, columns)).toBe(false);
  });

  it('should return false when there are no numeric columns', () => {
    const data = [{ name: 'Alice' }, { name: 'Bob' }];
    const columns: DataColumn[] = [col('name', 'categorical')];
    expect(hasNegativeValues(data, columns)).toBe(false);
  });

  it('should return false for empty data', () => {
    const columns: DataColumn[] = [col('value', 'numeric')];
    expect(hasNegativeValues([], columns)).toBe(false);
  });
});
