import { describe, it, expect } from 'vitest';
import type { VisualizationSpec } from '../../src/types.js';
import { getPreferredHeight } from '../../src/renderers/html/sizing.js';

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function makeSpec(
  pattern: string,
  data: Record<string, any>[],
  overrides?: Partial<VisualizationSpec>,
): VisualizationSpec {
  return {
    pattern,
    title: `Test ${pattern}`,
    data,
    encoding: {
      x: { field: 'category', type: 'nominal' },
      y: { field: 'value', type: 'quantitative' },
    },
    config: {},
    ...overrides,
  };
}

function makeCategories(n: number): Record<string, any>[] {
  return Array.from({ length: n }, (_, i) => ({
    category: `Cat ${i}`,
    value: Math.round(Math.random() * 100),
  }));
}

function makeTimeSeries(n: number, series: string[] = ['A']): Record<string, any>[] {
  const rows: Record<string, any>[] = [];
  for (const s of series) {
    for (let i = 0; i < n; i++) {
      rows.push({ date: `2024-${String(i + 1).padStart(2, '0')}`, value: Math.random() * 100, series: s });
    }
  }
  return rows;
}

// ─── TESTS ───────────────────────────────────────────────────────────────────

describe('getPreferredHeight', () => {
  // ─── EMPTY DATA ──────────────────────────────────────────────────────
  describe('empty data', () => {
    it('returns 300 for empty data array', () => {
      const spec = makeSpec('bar', []);
      expect(getPreferredHeight(spec, 800)).toBe(300);
    });

    it('returns 300 for any pattern with empty data', () => {
      expect(getPreferredHeight(makeSpec('scatter', []), 800)).toBe(300);
      expect(getPreferredHeight(makeSpec('heatmap', []), 800)).toBe(300);
      expect(getPreferredHeight(makeSpec('treemap', []), 800)).toBe(300);
    });
  });

  // ─── METRIC ──────────────────────────────────────────────────────────
  describe('metric', () => {
    it('returns 120 fixed regardless of data or width', () => {
      const spec = makeSpec('metric', [{ value: 42 }]);
      expect(getPreferredHeight(spec, 800)).toBe(120);
      expect(getPreferredHeight(spec, 400)).toBe(120);
      expect(getPreferredHeight(spec, 1200)).toBe(120);
    });
  });

  // ─── SPARKLINE-GRID ──────────────────────────────────────────────────
  describe('sparkline-grid', () => {
    it('calculates 80px per series + 60px margins', () => {
      const data = makeTimeSeries(12, ['Sales', 'Revenue', 'Profit']);
      const spec = makeSpec('sparkline-grid', data, {
        encoding: {
          x: { field: 'date', type: 'temporal' },
          y: { field: 'value', type: 'quantitative' },
          color: { field: 'series', type: 'nominal' },
        },
      });
      // 3 series * 80 + 60 = 300
      expect(getPreferredHeight(spec, 800)).toBe(300);
    });

    it('enforces minimum of 200', () => {
      const data = [{ date: '2024-01', value: 10, series: 'A' }];
      const spec = makeSpec('sparkline-grid', data, {
        encoding: {
          x: { field: 'date', type: 'temporal' },
          y: { field: 'value', type: 'quantitative' },
          color: { field: 'series', type: 'nominal' },
        },
      });
      // 1 series * 80 + 60 = 140, clamped to 200
      expect(getPreferredHeight(spec, 800)).toBe(200);
    });

    it('enforces maximum of 600', () => {
      const data = makeTimeSeries(12, ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
      const spec = makeSpec('sparkline-grid', data, {
        encoding: {
          x: { field: 'date', type: 'temporal' },
          y: { field: 'value', type: 'quantitative' },
          color: { field: 'series', type: 'nominal' },
        },
      });
      // 8 series * 80 + 60 = 700, clamped to 600
      expect(getPreferredHeight(spec, 800)).toBe(600);
    });
  });

  // ─── HORIZONTAL BAR-LIKE CHARTS ──────────────────────────────────────
  describe('horizontal bars', () => {
    it('calculates 28px per category + 100px margins for horizontal bar', () => {
      const data = makeCategories(10);
      const spec = makeSpec('bar', data, {
        encoding: {
          x: { field: 'value', type: 'quantitative' },
          y: { field: 'category', type: 'nominal' },
        },
        config: { orientation: 'horizontal' },
      });
      // 10 * 28 + 100 = 380
      expect(getPreferredHeight(spec, 800)).toBe(380);
    });

    it('uses y-field unique values for category count', () => {
      const data = [
        { category: 'A', value: 10 },
        { category: 'B', value: 20 },
        { category: 'A', value: 30 }, // duplicate category
      ];
      const spec = makeSpec('bar', data, {
        encoding: {
          x: { field: 'value', type: 'quantitative' },
          y: { field: 'category', type: 'nominal' },
        },
        config: { orientation: 'horizontal' },
      });
      // 2 unique categories * 28 + 100 = 156, clamped to 300
      expect(getPreferredHeight(spec, 800)).toBe(300);
    });

    it('lollipop is always horizontal-style', () => {
      const data = makeCategories(15);
      const spec = makeSpec('lollipop', data, {
        encoding: {
          x: { field: 'value', type: 'quantitative' },
          y: { field: 'category', type: 'nominal' },
        },
      });
      // 15 * 28 + 100 = 520
      expect(getPreferredHeight(spec, 800)).toBe(520);
    });

    it('bullet is always horizontal-style', () => {
      const data = makeCategories(8);
      const spec = makeSpec('bullet', data, {
        encoding: {
          x: { field: 'value', type: 'quantitative' },
          y: { field: 'category', type: 'nominal' },
        },
      });
      // 8 * 28 + 100 = 324
      expect(getPreferredHeight(spec, 800)).toBe(324);
    });

    it('enforces minimum of 300', () => {
      const data = makeCategories(3);
      const spec = makeSpec('lollipop', data, {
        encoding: {
          x: { field: 'value', type: 'quantitative' },
          y: { field: 'category', type: 'nominal' },
        },
      });
      // 3 * 28 + 100 = 184, clamped to 300
      expect(getPreferredHeight(spec, 800)).toBe(300);
    });

    it('enforces maximum of 800', () => {
      const data = makeCategories(30);
      const spec = makeSpec('bullet', data, {
        encoding: {
          x: { field: 'value', type: 'quantitative' },
          y: { field: 'category', type: 'nominal' },
        },
      });
      // 30 * 28 + 100 = 940, clamped to 800
      expect(getPreferredHeight(spec, 800)).toBe(800);
    });
  });

  // ─── STANDARD CHARTS (500px default) ─────────────────────────────────
  describe('standard charts', () => {
    it('returns 500 for vertical bar', () => {
      const spec = makeSpec('bar', makeCategories(5));
      expect(getPreferredHeight(spec, 800)).toBe(500);
    });

    it('returns 500 for scatter', () => {
      const spec = makeSpec('scatter', [{ x: 1, y: 2 }]);
      expect(getPreferredHeight(spec, 800)).toBe(500);
    });

    it('returns 500 for line', () => {
      const spec = makeSpec('line', makeTimeSeries(12));
      expect(getPreferredHeight(spec, 800)).toBe(500);
    });

    it('returns 500 for area', () => {
      const spec = makeSpec('area', makeTimeSeries(12));
      expect(getPreferredHeight(spec, 800)).toBe(500);
    });

    it('returns 500 for connected-scatter', () => {
      const spec = makeSpec('connected-scatter', [{ x: 1, y: 2 }]);
      expect(getPreferredHeight(spec, 800)).toBe(500);
    });

    it('returns 500 for stacked-bar (vertical)', () => {
      const spec = makeSpec('stacked-bar', makeCategories(5));
      expect(getPreferredHeight(spec, 800)).toBe(500);
    });

    it('returns 500 for histogram', () => {
      const spec = makeSpec('histogram', [{ value: 1 }, { value: 2 }]);
      expect(getPreferredHeight(spec, 800)).toBe(500);
    });

    it('returns 500 for slope-chart', () => {
      const spec = makeSpec('slope-chart', makeCategories(5));
      expect(getPreferredHeight(spec, 800)).toBe(500);
    });

    it('returns 500 for diverging-bar', () => {
      const spec = makeSpec('diverging-bar', makeCategories(5));
      expect(getPreferredHeight(spec, 800)).toBe(500);
    });

    it('returns 500 for box-plot', () => {
      const spec = makeSpec('box-plot', makeCategories(5));
      expect(getPreferredHeight(spec, 800)).toBe(500);
    });

    it('returns 500 for violin', () => {
      const spec = makeSpec('violin', makeCategories(5));
      expect(getPreferredHeight(spec, 800)).toBe(500);
    });

    it('returns 500 for strip-plot', () => {
      const spec = makeSpec('strip-plot', makeCategories(5));
      expect(getPreferredHeight(spec, 800)).toBe(500);
    });

    it('returns 500 for beeswarm', () => {
      const spec = makeSpec('beeswarm', makeCategories(5));
      expect(getPreferredHeight(spec, 800)).toBe(500);
    });

    it('returns 500 for density-plot', () => {
      const spec = makeSpec('density-plot', [{ value: 1 }]);
      expect(getPreferredHeight(spec, 800)).toBe(500);
    });

    it('returns 500 for connected-dot-plot', () => {
      const spec = makeSpec('connected-dot-plot', makeCategories(5));
      expect(getPreferredHeight(spec, 800)).toBe(500);
    });

    it('returns 500 for bump-chart', () => {
      const spec = makeSpec('bump-chart', makeCategories(5));
      expect(getPreferredHeight(spec, 800)).toBe(500);
    });

    it('returns 500 for stream-graph', () => {
      const spec = makeSpec('stream-graph', makeTimeSeries(12));
      expect(getPreferredHeight(spec, 800)).toBe(500);
    });

    it('returns 500 for waffle', () => {
      const spec = makeSpec('waffle', makeCategories(5));
      expect(getPreferredHeight(spec, 800)).toBe(500);
    });

    it('returns 500 for marimekko', () => {
      const spec = makeSpec('marimekko', makeCategories(5));
      expect(getPreferredHeight(spec, 800)).toBe(500);
    });

    it('returns 500 for choropleth', () => {
      const spec = makeSpec('choropleth', [{ region: 'US', value: 100 }]);
      expect(getPreferredHeight(spec, 800)).toBe(500);
    });

    it('returns 500 for proportional-symbol', () => {
      const spec = makeSpec('proportional-symbol', [{ region: 'US', value: 100 }]);
      expect(getPreferredHeight(spec, 800)).toBe(500);
    });

    it('returns 500 for icicle', () => {
      const spec = makeSpec('icicle', makeCategories(5));
      expect(getPreferredHeight(spec, 800)).toBe(500);
    });
  });

  // ─── SQUARE LAYOUTS ──────────────────────────────────────────────────
  describe('square layouts', () => {
    it('treemap matches containerWidth', () => {
      expect(getPreferredHeight(makeSpec('treemap', makeCategories(5)), 500)).toBe(500);
    });

    it('circle-pack matches containerWidth', () => {
      expect(getPreferredHeight(makeSpec('circle-pack', makeCategories(5)), 600)).toBe(600);
    });

    it('sunburst matches containerWidth', () => {
      expect(getPreferredHeight(makeSpec('sunburst', makeCategories(5)), 400)).toBe(400);
    });

    it('donut matches containerWidth', () => {
      expect(getPreferredHeight(makeSpec('donut', makeCategories(5)), 550)).toBe(550);
    });

    it('caps at 700', () => {
      expect(getPreferredHeight(makeSpec('treemap', makeCategories(5)), 1200)).toBe(700);
    });

    it('enforces minimum of 300', () => {
      expect(getPreferredHeight(makeSpec('sunburst', makeCategories(5)), 200)).toBe(300);
    });
  });

  // ─── ROW-BASED: HEATMAP ──────────────────────────────────────────────
  describe('heatmap', () => {
    it('calculates 30px per unique y value + 100px margins', () => {
      const data: Record<string, any>[] = [];
      for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 5; x++) {
          data.push({ yVal: `Row ${y}`, xVal: `Col ${x}`, value: Math.random() });
        }
      }
      const spec = makeSpec('heatmap', data, {
        encoding: {
          x: { field: 'xVal', type: 'nominal' },
          y: { field: 'yVal', type: 'nominal' },
          color: { field: 'value', type: 'quantitative' },
        },
      });
      // 10 unique y * 30 + 100 = 400
      expect(getPreferredHeight(spec, 800)).toBe(400);
    });

    it('enforces minimum of 300', () => {
      const data = [{ yVal: 'A', xVal: 'X', value: 1 }];
      const spec = makeSpec('heatmap', data, {
        encoding: {
          x: { field: 'xVal', type: 'nominal' },
          y: { field: 'yVal', type: 'nominal' },
          color: { field: 'value', type: 'quantitative' },
        },
      });
      // 1 * 30 + 100 = 130, clamped to 300
      expect(getPreferredHeight(spec, 800)).toBe(300);
    });

    it('enforces maximum of 800', () => {
      const data: Record<string, any>[] = [];
      for (let y = 0; y < 30; y++) {
        data.push({ yVal: `Row ${y}`, xVal: 'A', value: 1 });
      }
      const spec = makeSpec('heatmap', data, {
        encoding: {
          x: { field: 'xVal', type: 'nominal' },
          y: { field: 'yVal', type: 'nominal' },
          color: { field: 'value', type: 'quantitative' },
        },
      });
      // 30 * 30 + 100 = 1000, clamped to 800
      expect(getPreferredHeight(spec, 800)).toBe(800);
    });
  });

  // ─── ROW-BASED: CALENDAR-HEATMAP ────────────────────────────────────
  describe('calendar-heatmap', () => {
    it('calculates 160px per unique year + 60px margins', () => {
      const data = [
        { date: '2022-03-15', value: 10 },
        { date: '2022-07-20', value: 20 },
        { date: '2023-01-05', value: 30 },
        { date: '2023-06-10', value: 40 },
        { date: '2024-02-28', value: 50 },
      ];
      const spec = makeSpec('calendar-heatmap', data, {
        encoding: {
          x: { field: 'date', type: 'temporal' },
          y: { field: 'value', type: 'quantitative' },
        },
      });
      // 3 years * 160 + 60 = 540
      expect(getPreferredHeight(spec, 800)).toBe(540);
    });

    it('enforces minimum of 300', () => {
      const data = [{ date: '2024-01-01', value: 10 }];
      const spec = makeSpec('calendar-heatmap', data, {
        encoding: {
          x: { field: 'date', type: 'temporal' },
          y: { field: 'value', type: 'quantitative' },
        },
      });
      // 1 year * 160 + 60 = 220, clamped to 300
      expect(getPreferredHeight(spec, 800)).toBe(300);
    });

    it('enforces maximum of 800', () => {
      const data: Record<string, any>[] = [];
      for (let y = 2015; y <= 2024; y++) {
        data.push({ date: `${y}-06-15`, value: y });
      }
      const spec = makeSpec('calendar-heatmap', data, {
        encoding: {
          x: { field: 'date', type: 'temporal' },
          y: { field: 'value', type: 'quantitative' },
        },
      });
      // 10 years * 160 + 60 = 1660, clamped to 800
      expect(getPreferredHeight(spec, 800)).toBe(800);
    });
  });

  // ─── WIDE CHARTS ─────────────────────────────────────────────────────
  describe('wide charts', () => {
    it('parallel-coordinates returns 450', () => {
      const spec = makeSpec('parallel-coordinates', makeCategories(5));
      expect(getPreferredHeight(spec, 800)).toBe(450);
    });

    it('radar returns 450', () => {
      const spec = makeSpec('radar', makeCategories(5));
      expect(getPreferredHeight(spec, 800)).toBe(450);
    });

    it('width does not affect wide chart height', () => {
      const spec = makeSpec('radar', makeCategories(5));
      expect(getPreferredHeight(spec, 400)).toBe(450);
      expect(getPreferredHeight(spec, 1200)).toBe(450);
    });
  });

  // ─── FLOW CHARTS ─────────────────────────────────────────────────────
  describe('flow charts', () => {
    it('sankey returns 500 for small datasets', () => {
      const spec = makeSpec('sankey', makeCategories(10));
      expect(getPreferredHeight(spec, 800)).toBe(500);
    });

    it('sankey returns 600 for >20 rows', () => {
      const spec = makeSpec('sankey', makeCategories(25));
      expect(getPreferredHeight(spec, 800)).toBe(600);
    });

    it('alluvial returns 500 for <=20 rows', () => {
      const spec = makeSpec('alluvial', makeCategories(20));
      expect(getPreferredHeight(spec, 800)).toBe(500);
    });

    it('alluvial returns 600 for >20 rows', () => {
      const spec = makeSpec('alluvial', makeCategories(21));
      expect(getPreferredHeight(spec, 800)).toBe(600);
    });

    it('chord returns 500 for small data', () => {
      const spec = makeSpec('chord', makeCategories(15));
      expect(getPreferredHeight(spec, 800)).toBe(500);
    });

    it('chord returns 600 for >20 rows', () => {
      const spec = makeSpec('chord', makeCategories(25));
      expect(getPreferredHeight(spec, 800)).toBe(600);
    });

    it('funnel returns 500 for small data', () => {
      const spec = makeSpec('funnel', makeCategories(5));
      expect(getPreferredHeight(spec, 800)).toBe(500);
    });

    it('funnel returns 600 for >20 rows', () => {
      const spec = makeSpec('funnel', makeCategories(25));
      expect(getPreferredHeight(spec, 800)).toBe(600);
    });
  });

  // ─── RIDGELINE ───────────────────────────────────────────────────────
  describe('ridgeline', () => {
    it('calculates 60px per group + 80px margins', () => {
      const data: Record<string, any>[] = [];
      for (const group of ['A', 'B', 'C', 'D', 'E']) {
        for (let i = 0; i < 20; i++) {
          data.push({ group, value: Math.random() * 100 });
        }
      }
      const spec = makeSpec('ridgeline', data, {
        encoding: {
          x: { field: 'value', type: 'quantitative' },
          y: { field: 'group', type: 'nominal' },
        },
      });
      // 5 groups * 60 + 80 = 380
      expect(getPreferredHeight(spec, 800)).toBe(380);
    });

    it('enforces minimum of 300', () => {
      const data = [{ group: 'A', value: 10 }];
      const spec = makeSpec('ridgeline', data, {
        encoding: {
          x: { field: 'value', type: 'quantitative' },
          y: { field: 'group', type: 'nominal' },
        },
      });
      // 1 * 60 + 80 = 140, clamped to 300
      expect(getPreferredHeight(spec, 800)).toBe(300);
    });

    it('enforces maximum of 800', () => {
      const data: Record<string, any>[] = [];
      for (let i = 0; i < 15; i++) {
        data.push({ group: `Group ${i}`, value: i });
      }
      const spec = makeSpec('ridgeline', data, {
        encoding: {
          x: { field: 'value', type: 'quantitative' },
          y: { field: 'group', type: 'nominal' },
        },
      });
      // 15 * 60 + 80 = 980, clamped to 800
      expect(getPreferredHeight(spec, 800)).toBe(800);
    });
  });

  // ─── SMALL-MULTIPLES ─────────────────────────────────────────────────
  describe('small-multiples', () => {
    it('calculates rows*200 + 60 for 3-col grid', () => {
      // 6 series => 2 rows of 3 => 2*200+60 = 460
      const data = makeTimeSeries(5, ['A', 'B', 'C', 'D', 'E', 'F']);
      const spec = makeSpec('small-multiples', data, {
        encoding: {
          x: { field: 'date', type: 'temporal' },
          y: { field: 'value', type: 'quantitative' },
          color: { field: 'series', type: 'nominal' },
        },
      });
      expect(getPreferredHeight(spec, 800)).toBe(460);
    });

    it('rounds up partial rows', () => {
      // 4 series => ceil(4/3) = 2 rows => 2*200+60 = 460
      const data = makeTimeSeries(5, ['A', 'B', 'C', 'D']);
      const spec = makeSpec('small-multiples', data, {
        encoding: {
          x: { field: 'date', type: 'temporal' },
          y: { field: 'value', type: 'quantitative' },
          color: { field: 'series', type: 'nominal' },
        },
      });
      expect(getPreferredHeight(spec, 800)).toBe(460);
    });

    it('single series is 1 row', () => {
      const data = makeTimeSeries(5, ['A']);
      const spec = makeSpec('small-multiples', data, {
        encoding: {
          x: { field: 'date', type: 'temporal' },
          y: { field: 'value', type: 'quantitative' },
          color: { field: 'series', type: 'nominal' },
        },
      });
      // ceil(1/3) = 1 row => 1*200+60 = 260, but min 300
      expect(getPreferredHeight(spec, 800)).toBe(300);
    });

    it('enforces minimum of 300', () => {
      const data = makeTimeSeries(5, ['A', 'B']);
      const spec = makeSpec('small-multiples', data, {
        encoding: {
          x: { field: 'date', type: 'temporal' },
          y: { field: 'value', type: 'quantitative' },
          color: { field: 'series', type: 'nominal' },
        },
      });
      // ceil(2/3) = 1 row => 1*200+60 = 260, clamped to 300
      expect(getPreferredHeight(spec, 800)).toBe(300);
    });

    it('enforces maximum of 900', () => {
      const series = Array.from({ length: 20 }, (_, i) => `S${i}`);
      const data = makeTimeSeries(3, series);
      const spec = makeSpec('small-multiples', data, {
        encoding: {
          x: { field: 'date', type: 'temporal' },
          y: { field: 'value', type: 'quantitative' },
          color: { field: 'series', type: 'nominal' },
        },
      });
      // ceil(20/3) = 7 rows => 7*200+60 = 1460, clamped to 900
      expect(getPreferredHeight(spec, 800)).toBe(900);
    });
  });

  // ─── HORIZON-CHART ───────────────────────────────────────────────────
  describe('horizon-chart', () => {
    it('calculates 80px per series + 60px', () => {
      const data = makeTimeSeries(12, ['Temp', 'Humidity', 'Wind']);
      const spec = makeSpec('horizon-chart', data, {
        encoding: {
          x: { field: 'date', type: 'temporal' },
          y: { field: 'value', type: 'quantitative' },
          color: { field: 'series', type: 'nominal' },
        },
      });
      // 3 * 80 + 60 = 300
      expect(getPreferredHeight(spec, 800)).toBe(300);
    });

    it('enforces minimum of 250', () => {
      const data = makeTimeSeries(12, ['A']);
      const spec = makeSpec('horizon-chart', data, {
        encoding: {
          x: { field: 'date', type: 'temporal' },
          y: { field: 'value', type: 'quantitative' },
          color: { field: 'series', type: 'nominal' },
        },
      });
      // 1 * 80 + 60 = 140, clamped to 250
      expect(getPreferredHeight(spec, 800)).toBe(250);
    });

    it('enforces maximum of 600', () => {
      const series = Array.from({ length: 10 }, (_, i) => `S${i}`);
      const data = makeTimeSeries(12, series);
      const spec = makeSpec('horizon-chart', data, {
        encoding: {
          x: { field: 'date', type: 'temporal' },
          y: { field: 'value', type: 'quantitative' },
          color: { field: 'series', type: 'nominal' },
        },
      });
      // 10 * 80 + 60 = 860, clamped to 600
      expect(getPreferredHeight(spec, 800)).toBe(600);
    });
  });

  // ─── EDGE CASES ──────────────────────────────────────────────────────
  describe('edge cases', () => {
    it('handles missing encoding fields gracefully', () => {
      const spec = makeSpec('heatmap', [{ a: 1 }], {
        encoding: {},
      });
      // No y field -> falls back to counting data rows
      expect(typeof getPreferredHeight(spec, 800)).toBe('number');
      expect(getPreferredHeight(spec, 800)).toBeGreaterThanOrEqual(300);
    });

    it('handles unknown pattern as standard (500px)', () => {
      const spec = makeSpec('unknown-future-pattern', makeCategories(5));
      expect(getPreferredHeight(spec, 800)).toBe(500);
    });

    it('horizontal bar without config.orientation uses y encoding to detect categories', () => {
      // Non-horizontal bar should be standard 500
      const spec = makeSpec('bar', makeCategories(10));
      expect(getPreferredHeight(spec, 800)).toBe(500);
    });

    it('horizontal diverging-bar uses orientation config', () => {
      const spec = makeSpec('diverging-bar', makeCategories(10), {
        encoding: {
          x: { field: 'value', type: 'quantitative' },
          y: { field: 'category', type: 'nominal' },
        },
        config: { orientation: 'horizontal' },
      });
      // 10 * 28 + 100 = 380
      expect(getPreferredHeight(spec, 800)).toBe(380);
    });

    it('returns integer heights', () => {
      const spec = makeSpec('treemap', makeCategories(5));
      const height = getPreferredHeight(spec, 333);
      expect(Number.isInteger(height)).toBe(true);
    });
  });
});
