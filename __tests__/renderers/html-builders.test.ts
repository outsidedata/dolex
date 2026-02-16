import { describe, it, expect } from 'vitest';
import type { VisualizationSpec } from '../../src/types.js';
import {
  buildChartHtml,
  getSupportedHtmlPatterns,
  isHtmlPatternSupported,
  buildHtml,
} from '../../src/renderers/html/index.js';
import { getAppShellHtml, CHART_RESOURCE_URI } from '../../src/mcp/app-shell.js';

// ─── TEST DATA ──────────────────────────────────────────────────────────────

const barData = [
  { category: 'A', value: 10 },
  { category: 'B', value: 25 },
  { category: 'C', value: 15 },
];

function makeSpec(pattern: string, data: Record<string, any>[], overrides?: Partial<VisualizationSpec>): VisualizationSpec {
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

function expectValidHtml(html: string) {
  expect(html).toContain('<!DOCTYPE html>');
  expect(html).toContain('d3.v7.min.js');
  expect(html).toContain('window.__SPEC__');
  expect(html).toContain('renderChart');
  expect(html).not.toContain('Invalid spec');
}

// ─── INDEX MODULE ───────────────────────────────────────────────────────────

describe('HTML Renderer Index', () => {
  it('getSupportedHtmlPatterns returns 43 patterns', () => {
    const patterns = getSupportedHtmlPatterns();
    expect(patterns).toHaveLength(43);
    expect(patterns).toContain('bar');
    expect(patterns).toContain('sankey');
    expect(patterns).toContain('violin');
    expect(patterns).toContain('chord');
    expect(patterns).toContain('grouped-bar');
    expect(patterns).toContain('waterfall');
  });

  it('isHtmlPatternSupported returns true for bar', () => {
    expect(isHtmlPatternSupported('bar')).toBe(true);
  });

  it('isHtmlPatternSupported returns false for unsupported pattern', () => {
    expect(isHtmlPatternSupported('nonexistent-chart')).toBe(false);
  });

  it('buildChartHtml returns HTML for a supported pattern', () => {
    const html = buildChartHtml(makeSpec('bar', barData));
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('d3.v7.min.js');
  });

  it('buildChartHtml returns placeholder for unsupported pattern', () => {
    const html = buildChartHtml(makeSpec('nonexistent-chart', barData));
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('not yet implemented');
  });

  it('buildChartHtml handles null spec', () => {
    const html = buildChartHtml(null as any);
    expect(html).toContain('Invalid spec');
  });

  it('buildChartHtml handles empty data', () => {
    const html = buildChartHtml(makeSpec('bar', []));
    expect(html).toContain('No data');
  });
});

// ─── TEMPLATE ───────────────────────────────────────────────────────────────

describe('HTML Template', () => {
  it('buildHtml produces a complete document', () => {
    const spec = makeSpec('bar', barData);
    const html = buildHtml(spec, 'console.log("hello");');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('d3.v7.min.js');
    expect(html).toContain('window.__SPEC__');
    expect(html).toContain('console.log("hello")');
    expect(html).toContain('Test bar');
  });

  it('embeds data as JSON in spec', () => {
    const html = buildHtml(makeSpec('bar', barData), '');
    expect(html).toContain('"category":"A"');
    expect(html).toContain('"value":10');
  });

  it('escapes HTML in title element', () => {
    const spec = makeSpec('bar', barData, { title: '<script>alert(1)</script>' });
    const html = buildHtml(spec, '');
    expect(html).toContain('<title>&lt;script&gt;alert(1)&lt;/script&gt;</title>');
  });

  it('includes shared utilities (createSvg, buildXScale, etc.)', () => {
    const html = buildHtml(makeSpec('bar', barData), '');
    expect(html).toContain('function createSvg');
    expect(html).toContain('function buildXScale');
    expect(html).toContain('function buildYScale');
    expect(html).toContain('function buildColorScale');
    expect(html).toContain('function drawXAxis');
    expect(html).toContain('function drawYAxis');
    expect(html).toContain('function createTooltip');
    expect(html).toContain('function formatValue');
  });
});

// ─── INDIVIDUAL BUILDERS (smoke tests via dispatcher) ───────────────────────

const builderSpecs: Array<{ pattern: string; data: Record<string, any>[]; overrides?: Partial<VisualizationSpec>; extraChecks?: (html: string) => void }> = [
  { pattern: 'bar', data: barData },
  { pattern: 'diverging-bar', data: [{ category: 'A', value: 10 }, { category: 'B', value: -5 }] },
  {
    pattern: 'slope-chart',
    data: [{ group: 'A', start: 10, end: 20 }, { group: 'B', start: 15, end: 8 }],
    overrides: { encoding: { x: { field: 'group', type: 'nominal' }, y: { field: 'start', type: 'quantitative' }, y2: { field: 'end', type: 'quantitative' } } },
  },
  {
    pattern: 'histogram',
    data: Array.from({ length: 50 }, (_, i) => ({ value: Math.random() * 100 })),
    overrides: { encoding: { x: { field: 'value', type: 'quantitative' } } },
  },
  {
    pattern: 'beeswarm',
    data: Array.from({ length: 20 }, (_, i) => ({ value: i * 5, group: i % 2 ? 'A' : 'B' })),
    overrides: { encoding: { x: { field: 'value', type: 'quantitative' } } },
  },
  {
    pattern: 'strip-plot',
    data: Array.from({ length: 20 }, (_, i) => ({ value: i * 3, group: i % 3 === 0 ? 'X' : 'Y' })),
    overrides: { encoding: { x: { field: 'value', type: 'quantitative' } } },
  },
  {
    pattern: 'stacked-bar',
    data: [{ category: 'Q1', series: 'A', value: 10 }, { category: 'Q1', series: 'B', value: 20 }, { category: 'Q2', series: 'A', value: 15 }, { category: 'Q2', series: 'B', value: 25 }],
    overrides: { encoding: { x: { field: 'category', type: 'nominal' }, y: { field: 'value', type: 'quantitative' }, color: { field: 'series', type: 'nominal' } } },
  },
  { pattern: 'waffle', data: [{ category: 'Yes', value: 60 }, { category: 'No', value: 40 }] },
  {
    pattern: 'treemap',
    data: [{ name: 'A', value: 100 }, { name: 'B', value: 80 }, { name: 'C', value: 60 }],
    overrides: { encoding: { size: { field: 'value', type: 'quantitative' }, color: { field: 'name', type: 'nominal' } } },
  },
  {
    pattern: 'line',
    data: [{ date: '2024-01-01', value: 10 }, { date: '2024-02-01', value: 20 }, { date: '2024-03-01', value: 15 }],
    overrides: { encoding: { x: { field: 'date', type: 'temporal' }, y: { field: 'value', type: 'quantitative' } } },
  },
  {
    pattern: 'area',
    data: [{ date: '2024-01-01', value: 10 }, { date: '2024-02-01', value: 20 }, { date: '2024-03-01', value: 15 }],
    overrides: { encoding: { x: { field: 'date', type: 'temporal' }, y: { field: 'value', type: 'quantitative' } }, config: { timeField: 'date', valueField: 'value' } },
  },
  {
    pattern: 'small-multiples',
    data: [{ group: 'A', x: 1, y: 10 }, { group: 'A', x: 2, y: 20 }, { group: 'B', x: 1, y: 15 }, { group: 'B', x: 2, y: 25 }],
    overrides: { encoding: { x: { field: 'x', type: 'quantitative' }, y: { field: 'y', type: 'quantitative' }, facet: { field: 'group', type: 'nominal' } } },
  },
  {
    pattern: 'scatter',
    data: [{ x: 1, y: 10 }, { x: 2, y: 20 }, { x: 3, y: 15 }],
    overrides: { encoding: { x: { field: 'x', type: 'quantitative' }, y: { field: 'y', type: 'quantitative' } } },
  },
  {
    pattern: 'sankey',
    data: [{ source: 'A', target: 'X', value: 10 }, { source: 'A', target: 'Y', value: 5 }, { source: 'B', target: 'X', value: 8 }],
    overrides: { encoding: { source: { field: 'source', type: 'nominal' }, target: { field: 'target', type: 'nominal' }, value: { field: 'value', type: 'quantitative' } } },
  },
  {
    pattern: 'bump-chart',
    data: [
      { team: 'Alpha', season: '2020', _rank: 1 }, { team: 'Alpha', season: '2021', _rank: 2 }, { team: 'Alpha', season: '2022', _rank: 1 },
      { team: 'Beta', season: '2020', _rank: 2 }, { team: 'Beta', season: '2021', _rank: 1 }, { team: 'Beta', season: '2022', _rank: 3 },
      { team: 'Gamma', season: '2020', _rank: 3 }, { team: 'Gamma', season: '2021', _rank: 3 }, { team: 'Gamma', season: '2022', _rank: 2 },
    ],
    overrides: {
      encoding: { x: { field: 'season', type: 'ordinal' }, y: { field: '_rank', type: 'quantitative' }, color: { field: 'team', type: 'nominal' } },
      config: { categoryField: 'team', timeField: 'season', rankField: '_rank', invertYAxis: true, showLabels: true },
    },
  },
  {
    pattern: 'connected-dot-plot',
    data: [{ department: 'Engineering', budget: 500, actual: 480 }, { department: 'Marketing', budget: 300, actual: 350 }, { department: 'Sales', budget: 400, actual: 420 }, { department: 'HR', budget: 150, actual: 140 }],
    overrides: {
      encoding: { y: { field: 'department', type: 'nominal' }, x: { field: 'budget', type: 'quantitative', title: 'Amount ($K)' }, color: { scale: { domain: ['budget', 'actual'], range: ['#4e79a7', '#e15759'] } } },
      config: { categoryField: 'department', metric1Field: 'budget', metric2Field: 'actual', sortBy: 'gap', sortOrder: 'descending' },
    },
  },
  {
    pattern: 'choropleth',
    data: [{ country: 'United States', value: 320 }, { country: 'China', value: 1400 }, { country: 'India', value: 1300 }],
    overrides: { encoding: { color: { field: 'value', type: 'quantitative' } }, config: { nameField: 'country' } },
    extraChecks: (html) => expect(html).toContain('topojson'),
  },
  {
    pattern: 'proportional-symbol',
    data: [{ city: 'New York', value: 8400 }, { city: 'London', value: 8900 }, { city: 'Tokyo', value: 13900 }],
    overrides: { encoding: { size: { field: 'value', type: 'quantitative' } }, config: { nameField: 'city' } },
    extraChecks: (html) => expect(html).toContain('topojson'),
  },
  {
    pattern: 'violin',
    data: Array.from({ length: 40 }, (_, i) => ({ group: i % 2 ? 'A' : 'B', value: 10 + Math.sin(i) * 20 })),
    overrides: { encoding: { x: { field: 'group', type: 'nominal' }, y: { field: 'value', type: 'quantitative' } } },
  },
  {
    pattern: 'ridgeline',
    data: Array.from({ length: 40 }, (_, i) => ({ group: i % 2 ? 'A' : 'B', value: 10 + Math.sin(i) * 20 })),
    overrides: { encoding: { x: { field: 'value', type: 'quantitative' }, y: { field: 'group', type: 'nominal' } } },
  },
  {
    pattern: 'sunburst',
    data: [{ parent: 'Fruit', child: 'Apple', value: 50 }, { parent: 'Fruit', child: 'Banana', value: 30 }, { parent: 'Veggie', child: 'Carrot', value: 40 }],
    overrides: { encoding: { size: { field: 'value', type: 'quantitative' } }, config: { parentField: 'parent', childField: 'child', valueField: 'value' } },
  },
  {
    pattern: 'sparkline-grid',
    data: [{ series: 'A', date: '2024-01-01', value: 10 }, { series: 'A', date: '2024-02-01', value: 20 }, { series: 'B', date: '2024-01-01', value: 30 }, { series: 'B', date: '2024-02-01', value: 25 }],
    overrides: { encoding: { x: { field: 'date', type: 'temporal' }, y: { field: 'value', type: 'quantitative' }, facet: { field: 'series', type: 'nominal' } }, config: { timeField: 'date', valueField: 'value', seriesField: 'series' } },
  },
  {
    pattern: 'calendar-heatmap',
    data: [{ date: '2024-01-01', count: 5 }, { date: '2024-01-15', count: 12 }, { date: '2024-02-01', count: 8 }],
    overrides: { encoding: { x: { field: 'date', type: 'temporal' }, color: { field: 'count', type: 'quantitative' } }, config: { timeField: 'date', valueField: 'count' } },
  },
  {
    pattern: 'connected-scatter',
    data: [{ x: 1, y: 10, time: 1 }, { x: 3, y: 20, time: 2 }, { x: 2, y: 15, time: 3 }],
    overrides: { encoding: { x: { field: 'x', type: 'quantitative' }, y: { field: 'y', type: 'quantitative' } }, config: { xField: 'x', yField: 'y', orderField: 'time' } },
  },
  {
    pattern: 'parallel-coordinates',
    data: [{ speed: 80, power: 120, weight: 1500 }, { speed: 100, power: 150, weight: 1200 }, { speed: 60, power: 90, weight: 1800 }],
    overrides: { encoding: {}, config: { dimensions: ['speed', 'power', 'weight'] } },
  },
  {
    pattern: 'radar',
    data: [{ entity: 'Player A', speed: 80, power: 70, agility: 90 }, { entity: 'Player B', speed: 60, power: 90, agility: 75 }],
    overrides: { encoding: {}, config: { categoryField: 'entity', dimensions: ['speed', 'power', 'agility'] } },
  },
  {
    pattern: 'alluvial',
    data: [{ stage1: 'A', stage2: 'X', value: 10 }, { stage1: 'A', stage2: 'Y', value: 5 }, { stage1: 'B', stage2: 'X', value: 8 }],
    overrides: { encoding: {}, config: { stageFields: ['stage1', 'stage2'], valueField: 'value' } },
  },
  {
    pattern: 'chord',
    data: [{ source: 'A', target: 'B', value: 10 }, { source: 'B', target: 'C', value: 15 }, { source: 'C', target: 'A', value: 8 }],
    overrides: { encoding: { source: { field: 'source', type: 'nominal' }, target: { field: 'target', type: 'nominal' }, size: { field: 'value', type: 'quantitative' } }, config: { sourceField: 'source', targetField: 'target', valueField: 'value' } },
  },
  {
    pattern: 'circle-pack',
    data: [{ name: 'A', value: 100 }, { name: 'B', value: 80 }, { name: 'C', value: 60 }],
    overrides: { encoding: { size: { field: 'value', type: 'quantitative' }, color: { field: 'name', type: 'nominal' } } },
  },
  {
    pattern: 'metric',
    data: [{ label: 'Revenue', value: 1234567, previousValue: 1100000 }, { label: 'Users', value: 99000 }, { label: 'Problems', value: 99 }],
    overrides: { encoding: { label: { field: 'label', type: 'nominal' }, y: { field: 'value', type: 'quantitative' } }, config: { labelField: 'label', valueField: 'value', previousValueField: 'previousValue', abbreviate: true, format: 'auto' } },
  },
  {
    pattern: 'donut',
    data: [{ category: 'Marketing', value: 35 }, { category: 'Engineering', value: 45 }, { category: 'Sales', value: 20 }],
    overrides: { encoding: { color: { field: 'category', type: 'nominal' } }, config: { categoryField: 'category', valueField: 'value', innerRadius: 0.55 } },
  },
  {
    pattern: 'box-plot',
    data: Array.from({ length: 30 }, (_, i) => ({ group: i % 3 === 0 ? 'A' : i % 3 === 1 ? 'B' : 'C', value: Math.random() * 100 })),
    overrides: { encoding: { x: { field: 'group', type: 'nominal' }, y: { field: 'value', type: 'quantitative' } } },
  },
];

describe('Individual HTML builders', () => {
  it.each(builderSpecs.map(s => [s.pattern, s] as const))('%s produces valid HTML', (_name, { pattern, data, overrides, extraChecks }) => {
    const html = buildChartHtml(makeSpec(pattern, data, overrides));
    expectValidHtml(html);
    extraChecks?.(html);
  });
});

// ─── APP SHELL ──────────────────────────────────────────────────────────────

describe('MCP App Shell', () => {
  it('CHART_RESOURCE_URI uses ui:// scheme', () => {
    expect(CHART_RESOURCE_URI).toMatch(/^ui:\/\//);
  });

  it('getAppShellHtml returns a complete HTML document', () => {
    const html = getAppShellHtml();
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Dolex Chart');
  });

  it('includes JSON-RPC 2.0 bridge', () => {
    const html = getAppShellHtml();
    expect(html).toContain('jsonrpc');
    expect(html).toContain('ui/initialize');
    expect(html).toContain('ui/notifications/tool-result');
  });

  it('includes protocol version 2026-01-26', () => {
    const html = getAppShellHtml();
    expect(html).toContain('2026-01-26');
  });

  it('displays chart via srcdoc iframe', () => {
    const html = getAppShellHtml();
    expect(html).toContain('srcdoc');
    expect(html).toContain('chart-frame');
  });
});
