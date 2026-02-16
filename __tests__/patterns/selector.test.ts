import { describe, it, expect } from 'vitest';
import { selectPattern } from '../../src/patterns/selector.js';
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

// ── Tests ────────────────────────────────────────────────────────────────────

describe('selectPattern', () => {
  it('should recommend a comparison pattern for categorical + numeric data with "compare" intent', () => {
    const data = [
      { region: 'North', sales: 100 },
      { region: 'South', sales: 200 },
      { region: 'East', sales: 150 },
      { region: 'West', sales: 180 },
      { region: 'Central', sales: 120 },
      { region: 'NorthEast', sales: 90 },
      { region: 'NorthWest', sales: 170 },
      { region: 'SouthEast', sales: 210 },
    ];
    const columns: DataColumn[] = [
      col('region', 'categorical', 8),
      col('sales', 'numeric'),
    ];

    const result = selectPattern(data, columns, 'compare sales by region');

    expect(result).toBeDefined();
    expect(result.recommended).toBeDefined();
    expect(result.intentCategory).toBe('comparison');
    // The recommended pattern should be from the comparison category
    const comparisonPatterns = ['bar', 'diverging-bar', 'slope-chart', 'connected-dot-plot', 'bump-chart'];
    expect(comparisonPatterns).toContain(result.recommended.pattern.id);
  });

  it('should recommend a time pattern for time series data with "trend" intent', () => {
    const data = Array.from({ length: 12 }, (_, i) => ({
      date: `2024-${String(i + 1).padStart(2, '0')}-01`,
      revenue: 1000 + i * 100,
    }));
    const columns: DataColumn[] = [
      col('date', 'date', 12),
      col('revenue', 'numeric'),
    ];

    const result = selectPattern(data, columns, 'show revenue trend over time');

    expect(result).toBeDefined();
    expect(result.recommended).toBeDefined();
    expect(result.intentCategory).toBe('time');
    // Should recommend a time-based pattern
    const timePatterns = ['line', 'small-multiples', 'sparkline-grid', 'calendar-heatmap'];
    expect(timePatterns).toContain(result.recommended.pattern.id);
  });

  it('should recommend a distribution pattern for numeric data with "distribution" intent', () => {
    const data = Array.from({ length: 50 }, (_, i) => ({
      salary: 30000 + Math.floor(i * 1500),
    }));
    const columns: DataColumn[] = [
      col('salary', 'numeric', 50),
    ];

    const result = selectPattern(data, columns, 'show salary distribution');

    expect(result).toBeDefined();
    expect(result.recommended).toBeDefined();
    expect(result.intentCategory).toBe('distribution');
    const distributionPatterns = ['histogram', 'beeswarm', 'violin', 'ridgeline', 'strip-plot'];
    expect(distributionPatterns).toContain(result.recommended.pattern.id);
  });

  it('should recommend a flow pattern for two categoricals + numeric with "flow" intent', () => {
    const data = [
      { source: 'A', target: 'X', value: 10 },
      { source: 'A', target: 'Y', value: 20 },
      { source: 'B', target: 'X', value: 15 },
      { source: 'B', target: 'Y', value: 25 },
      { source: 'C', target: 'X', value: 30 },
      { source: 'C', target: 'Z', value: 10 },
    ];
    const columns: DataColumn[] = [
      col('source', 'categorical', 3),
      col('target', 'categorical', 3),
      col('value', 'numeric'),
    ];

    const result = selectPattern(data, columns, 'flow from source to target');

    expect(result).toBeDefined();
    expect(result.recommended).toBeDefined();
    expect(result.intentCategory).toBe('flow');
    const flowPatterns = ['sankey', 'alluvial', 'chord'];
    expect(flowPatterns).toContain(result.recommended.pattern.id);
  });

  it('should recommend a composition pattern for few categories with "breakdown" intent', () => {
    const data = [
      { segment: 'Enterprise', share: 45 },
      { segment: 'Mid-Market', share: 30 },
      { segment: 'SMB', share: 20 },
      { segment: 'Consumer', share: 5 },
    ];
    const columns: DataColumn[] = [
      col('segment', 'categorical', 4),
      col('share', 'numeric'),
    ];

    const result = selectPattern(data, columns, 'breakdown of market share percentage');

    expect(result).toBeDefined();
    expect(result.recommended).toBeDefined();
    expect(result.intentCategory).toBe('composition');
    const compositionPatterns = ['stacked-bar', 'waffle', 'treemap', 'sunburst'];
    expect(compositionPatterns).toContain(result.recommended.pattern.id);
  });

  it('should return a recommendation (fallback) for empty data', () => {
    const data: Record<string, any>[] = [];
    const columns: DataColumn[] = [];

    const result = selectPattern(data, columns, 'show something');

    expect(result).toBeDefined();
    expect(result.recommended).toBeDefined();
    expect(result.recommended.pattern).toBeDefined();
    expect(result.recommended.pattern.id).toBeTruthy();
    // Score should be low or zero since nothing matched
    expect(typeof result.recommended.score).toBe('number');
  });

  it('should handle a single row gracefully', () => {
    const data = [{ name: 'Alice', score: 95 }];
    const columns: DataColumn[] = [
      col('name', 'categorical', 1),
      col('score', 'numeric', 1),
    ];

    const result = selectPattern(data, columns, 'compare scores');

    expect(result).toBeDefined();
    expect(result.recommended).toBeDefined();
    expect(result.recommended.pattern.id).toBeTruthy();
    expect(result.recommended.spec).toBeDefined();
  });

  describe('field-encoding mapping (bug fixes)', () => {
    it('heatmap: should assign two different categoricals to row and col axes', () => {
      const data = Array.from({ length: 10 }, (_, i) => ({
        surname: `Driver${i}`,
        location: `Circuit${i % 5}`,
        total_points: (i + 1) * 10,
      }));
      const columns: DataColumn[] = [
        col('surname', 'categorical', 10),
        col('location', 'categorical', 5),
        col('total_points', 'numeric'),
      ];

      const result = selectPattern(data, columns, 'heatmap of points by driver and circuit', {
        forcePattern: 'heatmap',
      });

      const spec = result.recommended.spec;
      expect(spec.pattern).toBe('heatmap');
      // Both axes must use different fields — the "surname × surname" bug
      expect(spec.encoding.x?.field).not.toBe(spec.encoding.y?.field);
      // Both categorical fields must be present across the two axes
      const axisFields = [spec.encoding.x?.field, spec.encoding.y?.field];
      expect(axisFields).toContain('surname');
      expect(axisFields).toContain('location');
    });

    it('heatmap: should melt wide-format data (1 cat + N numeric) into long format', () => {
      const data = [
        { type: 'Fighting', HP: 78.2, Attack: 108.1, Defense: 78.2 },
        { type: 'Dragon', HP: 84.6, Attack: 103.8, Defense: 80.8 },
        { type: 'Normal', HP: 78.6, Attack: 77.2, Defense: 61.7 },
      ];
      const columns: DataColumn[] = [
        col('type', 'categorical', 3),
        col('HP', 'numeric'),
        col('Attack', 'numeric'),
        col('Defense', 'numeric'),
      ];

      const result = selectPattern(data, columns, 'heatmap of stats by type', {
        forcePattern: 'heatmap',
      });

      const spec = result.recommended.spec;
      expect(spec.pattern).toBe('heatmap');
      // Should melt: y = type, x = metric names, color = values
      expect(spec.encoding.y?.field).toBe('type');
      expect(spec.encoding.x?.field).toBe('metric');
      expect(spec.encoding.color?.field).toBe('value');
      // Data should be melted: 3 rows × 3 numeric cols = 9 rows
      expect(spec.data).toHaveLength(9);
      // Check a melted row has the right shape
      expect(spec.data[0]).toHaveProperty('type');
      expect(spec.data[0]).toHaveProperty('metric');
      expect(spec.data[0]).toHaveProperty('value');
    });

    it('waterfall: should use date column as category labels, not numeric values', () => {
      const data = [
        { year: '2020', delta: 9 },
        { year: '2021', delta: 42 },
        { year: '2022', delta: -63 },
        { year: '2023', delta: 104 },
      ];
      const columns: DataColumn[] = [
        col('year', 'date', 4),
        col('delta', 'numeric'),
      ];

      const result = selectPattern(data, columns, 'show year over year changes as waterfall', {
        forcePattern: 'waterfall',
      });

      const spec = result.recommended.spec;
      expect(spec.pattern).toBe('waterfall');
      // The x-axis should use 'year', not 'delta'
      expect(spec.encoding.x?.field).toBe('year');
      expect(spec.encoding.y?.field).toBe('delta');
    });

    it('treemap: should not duplicate the same field across encodings', () => {
      const data = [
        { team: 'Mercedes', driver: 'Hamilton', races: 100 },
        { team: 'Mercedes', driver: 'Russell', races: 80 },
        { team: 'Red Bull', driver: 'Verstappen', races: 120 },
        { team: 'Red Bull', driver: 'Perez', races: 90 },
        { team: 'Ferrari', driver: 'Leclerc', races: 95 },
        { team: 'Ferrari', driver: 'Sainz', races: 85 },
      ];
      const columns: DataColumn[] = [
        col('team', 'categorical', 3),
        col('driver', 'categorical', 6),
        col('races', 'numeric'),
      ];

      const result = selectPattern(data, columns, 'treemap of races by team and driver', {
        forcePattern: 'treemap',
      });

      const spec = result.recommended.spec;
      expect(spec.pattern).toBe('treemap');
      // Both categoricals should appear — team as parent (fewer unique), driver as child (more unique)
      const colorField = spec.encoding.color?.field;
      const labelField = (spec.encoding as any).label?.field;
      if (colorField && labelField) {
        expect(colorField).not.toBe(labelField);
      }
      // Config should reflect hierarchy: team (3 unique) before driver (6 unique)
      const levelFields = spec.config?.levelFields;
      if (levelFields) {
        expect(levelFields[0]).toBe('team');
      }
    });

    it('should never produce duplicate column names in spec encoding fields', () => {
      const data = [
        { surname: 'Hamilton', location: 'Silverstone', total_points: 50 },
        { surname: 'Verstappen', location: 'Zandvoort', total_points: 75 },
        { surname: 'Leclerc', location: 'Monza', total_points: 40 },
      ];
      const columns: DataColumn[] = [
        col('surname', 'categorical', 3),
        col('location', 'categorical', 3),
        col('total_points', 'numeric'),
      ];

      const patternsToTest = ['heatmap', 'treemap', 'circle-pack', 'sankey'];
      for (const patternId of patternsToTest) {
        const result = selectPattern(data, columns, `show data as ${patternId}`, {
          forcePattern: patternId,
        });
        const spec = result.recommended.spec;
        const encodingFields = Object.values(spec.encoding)
          .map((enc: any) => enc?.field)
          .filter(Boolean);
        const uniqueFields = new Set(encodingFields);
        // Each encoding field should be unique (no field used twice)
        expect(uniqueFields.size).toBe(encodingFields.length);
      }
    });
  });

  describe('forcePattern', () => {
    const comparisonData = [
      { region: 'North', sales: 100 },
      { region: 'South', sales: 200 },
      { region: 'East', sales: 150 },
      { region: 'West', sales: 180 },
    ];
    const comparisonCols: DataColumn[] = [
      col('region', 'categorical', 4),
      col('sales', 'numeric'),
    ];

    it('should force a known pattern as recommended', () => {
      const result = selectPattern(comparisonData, comparisonCols, 'compare sales', {
        forcePattern: 'lollipop',
      });

      expect(result.recommended.pattern.id).toBe('lollipop');
      expect(result.recommended.reasoning).toContain('Forced pattern');
    });

    it('should promote a pattern already in alternatives', () => {
      // First run without force to see what the alternatives look like
      const normal = selectPattern(comparisonData, comparisonCols, 'compare sales');
      const normalIds = [normal.recommended.pattern.id, ...normal.alternatives.map(a => a.pattern.id)];

      // Force one that was in the scored list — pick one that isn't already recommended
      const altId = normalIds.find(id => id !== normal.recommended.pattern.id) ?? 'bar';
      const forced = selectPattern(comparisonData, comparisonCols, 'compare sales', {
        forcePattern: altId,
      });

      expect(forced.recommended.pattern.id).toBe(altId);
      expect(forced.recommended.reasoning).toContain('Forced pattern');
    });

    it('should fall back with reasoning note for unknown pattern ID', () => {
      const result = selectPattern(comparisonData, comparisonCols, 'compare sales', {
        forcePattern: 'nonexistent-chart-type',
      });

      expect(result.recommended).toBeDefined();
      expect(result.recommended.reasoning).toContain('Unknown forced pattern');
      expect(result.recommended.reasoning).toContain('nonexistent-chart-type');
    });

    it('should still return alternatives when forcing a pattern', () => {
      const result = selectPattern(comparisonData, comparisonCols, 'compare sales', {
        forcePattern: 'lollipop',
      });

      expect(result.recommended.pattern.id).toBe('lollipop');
      expect(result.alternatives.length).toBeGreaterThan(0);
    });
  });
});
