import { describe, it, expect } from 'vitest';
import { selectPattern, quickRecommend, scoreSpecificPattern } from '../../src/patterns/selector.js';
import type { DataColumn } from '../../src/types.js';

function col(name: string, type: DataColumn['type'], uniqueCount = 10): DataColumn {
  return { name, type, sampleValues: [], uniqueCount, nullCount: 0, totalCount: 100 };
}

const simpleData = [
  { region: 'North', sales: 100 },
  { region: 'South', sales: 200 },
  { region: 'East', sales: 150 },
  { region: 'West', sales: 180 },
];
const simpleCols: DataColumn[] = [
  col('region', 'categorical', 4),
  col('sales', 'numeric'),
];

describe('quickRecommend', () => {
  it('returns patternId and reasoning', () => {
    const result = quickRecommend(simpleData, simpleCols, 'compare sales by region');
    expect(result.patternId).toBeTruthy();
    expect(typeof result.patternId).toBe('string');
    expect(result.reasoning).toBeTruthy();
    expect(typeof result.reasoning).toBe('string');
  });

  it('works with empty data', () => {
    const result = quickRecommend([], [], 'show something');
    expect(result.patternId).toBeTruthy();
  });
});

describe('scoreSpecificPattern', () => {
  it('returns score details for a valid pattern', () => {
    const result = scoreSpecificPattern('bar', simpleData, simpleCols, 'compare sales');
    expect(result).not.toBeNull();
    expect(typeof result!.score).toBe('number');
    expect(Array.isArray(result!.matchedRules)).toBe(true);
    expect(typeof result!.reasoning).toBe('string');
  });

  it('returns null for unknown pattern ID', () => {
    const result = scoreSpecificPattern('nonexistent-chart', simpleData, simpleCols, 'compare');
    expect(result).toBeNull();
  });

  it('returns matched rules with conditions and weights', () => {
    const result = scoreSpecificPattern('bar', simpleData, simpleCols, 'compare sales by region');
    expect(result).not.toBeNull();
    expect(result!.matchedRules.length).toBeGreaterThan(0);
    for (const rule of result!.matchedRules) {
      expect(typeof rule.condition).toBe('string');
      expect(typeof rule.weight).toBe('number');
    }
  });
});

describe('selectPattern — forcePattern edge cases', () => {
  it('forcePattern with a pattern that fails generateSpec falls back gracefully', () => {
    // Force a geo pattern with non-geo data — generateSpec may throw
    const result = selectPattern(simpleData, simpleCols, 'compare sales', {
      forcePattern: 'choropleth',
    });
    expect(result.recommended).toBeDefined();
    expect(result.recommended.pattern).toBeDefined();
    // Should either be choropleth (if it didn't throw) or fallback with reasoning
    expect(result.recommended.reasoning).toBeTruthy();
  });
});

describe('selectPattern — filterCategories', () => {
  it('only returns patterns from specified categories', () => {
    const result = selectPattern(simpleData, simpleCols, 'compare sales', {
      filterCategories: ['comparison'],
      maxAlternatives: 5,
    });
    expect(result.recommended.pattern.category).toBe('comparison');
    for (const alt of result.alternatives) {
      expect(alt.pattern.category).toBe('comparison');
    }
  });
});

describe('selectPattern — excludePatterns', () => {
  it('excludes specified patterns from results', () => {
    const result = selectPattern(simpleData, simpleCols, 'compare sales', {
      excludePatterns: ['bar'],
      maxAlternatives: 5,
    });
    const allIds = [result.recommended.pattern.id, ...result.alternatives.map(a => a.pattern.id)];
    expect(allIds).not.toContain('bar');
  });
});

describe('selectPattern — relationship category column selection', () => {
  it('connected-scatter: uses date + 2 numeric columns', () => {
    const data = Array.from({ length: 10 }, (_, i) => ({
      date: `2024-${String(i + 1).padStart(2, '0')}-01`,
      x: i * 10,
      y: i * 5,
    }));
    const cols: DataColumn[] = [
      col('date', 'date', 10),
      col('x', 'numeric', 10),
      col('y', 'numeric', 10),
    ];
    const result = selectPattern(data, cols, 'show trajectory over time', {
      forcePattern: 'connected-scatter',
    });
    expect(result.recommended.pattern.id).toBe('connected-scatter');
    expect(result.recommended.spec).toBeDefined();
  });

  it('parallel-coordinates: uses categorical + multiple numerics', () => {
    const data = Array.from({ length: 10 }, (_, i) => ({
      name: `item${i}`,
      a: i * 10,
      b: i * 5,
      c: i * 3,
    }));
    const cols: DataColumn[] = [
      col('name', 'categorical', 10),
      col('a', 'numeric', 10),
      col('b', 'numeric', 10),
      col('c', 'numeric', 10),
    ];
    const result = selectPattern(data, cols, 'compare dimensions', {
      forcePattern: 'parallel-coordinates',
    });
    expect(result.recommended.pattern.id).toBe('parallel-coordinates');
  });

  it('scatter: uses 2 numeric + optional categorical + optional size', () => {
    const data = Array.from({ length: 10 }, (_, i) => ({
      group: `g${i % 3}`,
      x: i * 10,
      y: i * 5,
      size: i * 2,
    }));
    const cols: DataColumn[] = [
      col('group', 'categorical', 3),
      col('x', 'numeric', 10),
      col('y', 'numeric', 10),
      col('size', 'numeric', 10),
    ];
    const result = selectPattern(data, cols, 'scatter plot', {
      forcePattern: 'scatter',
    });
    expect(result.recommended.pattern.id).toBe('scatter');
  });
});

describe('selectPattern — geo column selection', () => {
  it('choropleth with geo data', () => {
    const data = [
      { country: 'USA', value: 100 },
      { country: 'Canada', value: 200 },
      { country: 'Mexico', value: 150 },
    ];
    const cols: DataColumn[] = [
      col('country', 'categorical', 3),
      col('value', 'numeric'),
    ];
    const result = selectPattern(data, cols, 'show on a map', {
      forcePattern: 'choropleth',
    });
    expect(result.recommended.pattern.id).toBe('choropleth');
  });
});
