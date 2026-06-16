import { describe, it, expect } from 'vitest';
import { classifyColumns } from '../../src/analysis/classify.js';
import type { DataColumn } from '../../src/types.js';

function col(name: string, type: DataColumn['type'], overrides: Partial<DataColumn> = {}): DataColumn {
  return {
    name, type, sampleValues: [], uniqueCount: 10, nullCount: 0, totalCount: 100,
    ...overrides,
  };
}

describe('classifyColumns', () => {
  it('classifies numeric non-ID columns as measures', () => {
    const result = classifyColumns([col('revenue', 'numeric', { uniqueCount: 80, totalCount: 100 })]);
    expect(result[0].role).toBe('measure');
  });

  it('classifies an all-distinct *_id-named numeric column as id (by name, not by cardinality alone)', () => {
    const result = classifyColumns([col('user_id', 'numeric', { uniqueCount: 100, totalCount: 100 })]);
    expect(result[0].role).toBe('id');
  });

  it('classifies id-typed columns as id', () => {
    const result = classifyColumns([col('pk', 'id')]);
    expect(result[0].role).toBe('id');
  });

  it('classifies date columns as time', () => {
    const result = classifyColumns([col('order_date', 'date', { uniqueCount: 365 })]);
    expect(result[0].role).toBe('time');
  });

  it('classifies low-cardinality categorical as dimension', () => {
    const result = classifyColumns([col('region', 'categorical', { uniqueCount: 5, totalCount: 100 })]);
    expect(result[0].role).toBe('dimension');
  });

  it('classifies high-cardinality categorical as text', () => {
    const result = classifyColumns([col('description', 'categorical', { uniqueCount: 95, totalCount: 100 })]);
    expect(result[0].role).toBe('text');
  });

  it('classifies text-typed columns as text', () => {
    const result = classifyColumns([col('notes', 'text')]);
    expect(result[0].role).toBe('text');
  });

  it('detects hierarchy among multiple categoricals', () => {
    const result = classifyColumns([
      col('region', 'categorical', { uniqueCount: 4, totalCount: 100 }),
      col('city', 'categorical', { uniqueCount: 20, totalCount: 100 }),
      col('revenue', 'numeric', { uniqueCount: 80, totalCount: 100 }),
    ]);
    const hierarchyCols = result.filter(c => c.role === 'hierarchy');
    expect(hierarchyCols.length).toBeGreaterThanOrEqual(1);
  });

  it('preserves stats and topValues from input', () => {
    const stats = { min: 0, max: 100, mean: 50, median: 50, stddev: 25, p25: 25, p75: 75 };
    const result = classifyColumns([col('revenue', 'numeric', { uniqueCount: 80, totalCount: 100, stats })]);
    expect(result[0].stats).toEqual(stats);
  });

  describe('numeric ID name-based heuristics', () => {
    it('classifies *_id columns as id (strong pattern)', () => {
      const result = classifyColumns([col('product_id', 'numeric', { uniqueCount: 50, totalCount: 100 })]);
      expect(result[0].role).toBe('id');
    });

    it('classifies "id" column as id (strong pattern)', () => {
      const result = classifyColumns([col('id', 'numeric', { uniqueCount: 50, totalCount: 100 })]);
      expect(result[0].role).toBe('id');
    });

    it('classifies *_pk columns as id (strong pattern)', () => {
      const result = classifyColumns([col('row_pk', 'numeric', { uniqueCount: 50, totalCount: 100 })]);
      expect(result[0].role).toBe('id');
    });

    it('classifies Pokedex_Number as id (weak pattern, high cardinality)', () => {
      const result = classifyColumns([col('Pokedex_Number', 'numeric', { uniqueCount: 800, totalCount: 1000 })]);
      expect(result[0].role).toBe('id');
    });

    it('classifies order_number as id (weak pattern, high cardinality)', () => {
      const result = classifyColumns([col('order_number', 'numeric', { uniqueCount: 90, totalCount: 100 })]);
      expect(result[0].role).toBe('id');
    });

    it('classifies item_no as id (weak pattern, high cardinality)', () => {
      const result = classifyColumns([col('item_no', 'numeric', { uniqueCount: 60, totalCount: 100 })]);
      expect(result[0].role).toBe('id');
    });

    it('classifies row_index as id (weak pattern, high cardinality)', () => {
      const result = classifyColumns([col('row_index', 'numeric', { uniqueCount: 90, totalCount: 100 })]);
      expect(result[0].role).toBe('id');
    });

    it('does NOT classify weak-named column as id when low cardinality', () => {
      const result = classifyColumns([col('priority_number', 'numeric', { uniqueCount: 5, totalCount: 100 })]);
      expect(result[0].role).toBe('measure');
    });

    it('does NOT classify regular numeric column as id', () => {
      const result = classifyColumns([col('price', 'numeric', { uniqueCount: 80, totalCount: 100 })]);
      expect(result[0].role).toBe('measure');
    });

    it('handles space-separated names like "Pokedex Number"', () => {
      const result = classifyColumns([col('Pokedex Number', 'numeric', { uniqueCount: 800, totalCount: 1000 })]);
      expect(result[0].role).toBe('id');
    });

    it('handles dot-separated names like "item.id"', () => {
      const result = classifyColumns([col('item.id', 'numeric', { uniqueCount: 50, totalCount: 100 })]);
      expect(result[0].role).toBe('id');
    });
  });

  describe('all-distinct numeric measures are not mistaken for ids', () => {
    it('classifies an all-distinct measure in a SMALL table as measure (regression: analyze dead-end)', () => {
      // revenue with 12 distinct values across 12 rows — a normal small dataset,
      // NOT an identifier. Previously misclassified as 'id', which left the
      // analysis planner with zero measures → "No analyzable columns".
      const result = classifyColumns([col('revenue', 'numeric', { uniqueCount: 12, totalCount: 12 })]);
      expect(result[0].role).toBe('measure');
    });

    it('classifies an all-distinct measure in a LARGE table as measure when values are not row indices', () => {
      const stats = { min: 8700, max: 24500, mean: 14650, median: 13400, stddev: 4000, p25: 11000, p75: 18000 };
      const result = classifyColumns([col('revenue', 'numeric', { uniqueCount: 1000, totalCount: 1000, stats })]);
      expect(result[0].role).toBe('measure');
    });

    it('does not treat a tiny all-distinct ordinal-like column (1..12) as an id', () => {
      const stats = { min: 1, max: 12, mean: 6.5, median: 6.5, stddev: 3.4, p25: 3, p75: 9 };
      const result = classifyColumns([col('month', 'numeric', { uniqueCount: 12, totalCount: 12, stats })]);
      expect(result[0].role).toBe('measure');
    });

    it('still detects an unnamed sequential surrogate key (1..N) in a sizable table as id', () => {
      const stats = { min: 1, max: 1000, mean: 500, median: 500, stddev: 288, p25: 250, p75: 750 };
      const result = classifyColumns([col('n', 'numeric', { uniqueCount: 1000, totalCount: 1000, stats })]);
      expect(result[0].role).toBe('id');
    });
  });
});
