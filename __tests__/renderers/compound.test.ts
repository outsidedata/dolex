import { describe, it, expect } from 'vitest';
import type { VisualizationSpec, CompoundVisualizationSpec } from '../../src/types.js';
import { isCompoundSpec } from '../../src/types.js';
import { shouldCompound, buildCompoundSpec } from '../../src/renderers/html/compound.js';
import { buildCompoundHtml } from '../../src/renderers/html/builders/compound.js';

// ─── TEST DATA ──────────────────────────────────────────────────────────────

const sampleData = [
  { region: 'North', product: 'Widget', revenue: 142000 },
  { region: 'South', product: 'Widget', revenue: 98000 },
  { region: 'East', product: 'Gadget', revenue: 210000 },
  { region: 'West', product: 'Gadget', revenue: 175000 },
  { region: 'North', product: 'Gizmo', revenue: 88000 },
];

function makeSpec(pattern: string, overrides?: Partial<VisualizationSpec>): VisualizationSpec {
  return {
    pattern,
    title: `Test ${pattern}`,
    data: sampleData,
    encoding: {
      x: { field: 'region', type: 'nominal' as const },
      y: { field: 'revenue', type: 'quantitative' as const },
      color: { field: 'product', type: 'nominal' as const },
    },
    config: {},
    ...overrides,
  };
}

// ─── isCompoundSpec ─────────────────────────────────────────────────────────

describe('isCompoundSpec', () => {
  it('returns false for atomic spec', () => {
    expect(isCompoundSpec(makeSpec('bar'))).toBe(false);
  });

  it('returns true for compound spec', () => {
    const compound: CompoundVisualizationSpec = {
      compound: true,
      title: 'Test',
      data: sampleData,
      views: [],
      layout: { type: 'rows' },
      interactions: [],
    };
    expect(isCompoundSpec(compound)).toBe(true);
  });
});

// ─── shouldCompound ─────────────────────────────────────────────────────────

describe('shouldCompound', () => {
  it('returns true for bar chart with data', () => {
    expect(shouldCompound(makeSpec('bar'))).toBe(true);
  });

  it('returns false when compound: false is set', () => {
    expect(shouldCompound(makeSpec('bar'), { compound: false })).toBe(false);
  });

  it('returns false for flow patterns (sankey)', () => {
    expect(shouldCompound(makeSpec('sankey'))).toBe(false);
  });

  it('returns false for geo patterns (choropleth)', () => {
    expect(shouldCompound(makeSpec('choropleth'))).toBe(false);
  });

  it('returns false for treemap', () => {
    expect(shouldCompound(makeSpec('treemap'))).toBe(false);
  });

  it('returns false for empty data', () => {
    expect(shouldCompound(makeSpec('bar', { data: [] }))).toBe(false);
  });

  it('returns false for too many rows', () => {
    const bigData = Array.from({ length: 600 }, (_, i) => ({
      region: `R${i}`, product: 'A', revenue: i * 100,
    }));
    expect(shouldCompound(makeSpec('bar', { data: bigData }))).toBe(false);
  });

  it('returns true for scatter', () => {
    expect(shouldCompound(makeSpec('scatter'))).toBe(true);
  });

  it('returns true for histogram', () => {
    expect(shouldCompound(makeSpec('histogram'))).toBe(true);
  });

  it('returns true for line chart', () => {
    expect(shouldCompound(makeSpec('line'))).toBe(true);
  });
});

// ─── buildCompoundSpec ──────────────────────────────────────────────────────

describe('buildCompoundSpec', () => {
  it('creates a valid compound spec from a bar chart', () => {
    const spec = makeSpec('bar');
    const compound = buildCompoundSpec(spec);

    expect(compound.compound).toBe(true);
    expect(compound.title).toBe('Test bar');
    expect(compound.data).toBe(spec.data); // same reference
    expect(compound.views).toHaveLength(2);
    expect(compound.layout.type).toBe('rows');
    expect(compound.layout.sizes).toEqual([3, 2]);
  });

  it('first view is the chart', () => {
    const compound = buildCompoundSpec(makeSpec('bar'));
    const chartView = compound.views[0];

    expect(chartView.type).toBe('chart');
    expect(chartView.id).toBe('chart');
    expect(chartView.chart).toBeDefined();
    expect(chartView.chart!.pattern).toBe('bar');
  });

  it('second view is the table', () => {
    const compound = buildCompoundSpec(makeSpec('bar'));
    const tableView = compound.views[1];

    expect(tableView.type).toBe('table');
    expect(tableView.id).toBe('table');
    expect(tableView.table).toBeDefined();
  });

  it('chart view does not include data (it lives on parent)', () => {
    const compound = buildCompoundSpec(makeSpec('bar'));
    const chartView = compound.views[0];

    expect(chartView.chart).not.toHaveProperty('data');
  });

  it('table columns lead with encoding fields', () => {
    const compound = buildCompoundSpec(makeSpec('bar'));
    const tableView = compound.views[1];
    const cols = tableView.table!.columns!;

    // encoding fields (region, revenue, product) should come first
    const encodingFields = ['region', 'revenue', 'product'];
    const tableFields = cols.map(c => c.field);
    encodingFields.forEach(f => {
      expect(tableFields).toContain(f);
    });
    // First column should be an encoding field
    expect(encodingFields).toContain(tableFields[0]);
  });

  it('interaction field is the categorical x-axis', () => {
    const compound = buildCompoundSpec(makeSpec('bar'));

    expect(compound.interactions).toHaveLength(1);
    expect(compound.interactions[0].type).toBe('highlight');
    expect(compound.interactions[0].field).toBe('region');
  });

  it('falls back to color field when x is quantitative', () => {
    const spec = makeSpec('scatter', {
      encoding: {
        x: { field: 'revenue', type: 'quantitative' },
        y: { field: 'revenue', type: 'quantitative' },
        color: { field: 'product', type: 'nominal' },
      },
    });
    const compound = buildCompoundSpec(spec);

    expect(compound.interactions[0].field).toBe('product');
  });

  it('table columns have prettified titles', () => {
    const compound = buildCompoundSpec(makeSpec('bar'));
    const cols = compound.views[1].table!.columns!;
    const regionCol = cols.find(c => c.field === 'region');
    expect(regionCol?.title).toBe('Region');
  });

  it('numeric columns get right alignment', () => {
    const compound = buildCompoundSpec(makeSpec('bar'));
    const cols = compound.views[1].table!.columns!;
    const revenueCol = cols.find(c => c.field === 'revenue');
    expect(revenueCol?.align).toBe('right');
  });

  it('table has a sort default', () => {
    const compound = buildCompoundSpec(makeSpec('bar'));
    const table = compound.views[1].table!;
    expect(table.sort).toBeDefined();
    expect(table.sort!.field).toBe('region');
  });
});

// ─── buildCompoundHtml ──────────────────────────────────────────────────────

describe('buildCompoundHtml', () => {
  it('produces a valid HTML document', () => {
    const compound = buildCompoundSpec(makeSpec('bar'));
    const html = buildCompoundHtml(compound);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('</html>');
  });

  it('includes the title', () => {
    const compound = buildCompoundSpec(makeSpec('bar'));
    const html = buildCompoundHtml(compound);

    expect(html).toContain('Test bar');
  });

  it('includes CSS grid layout', () => {
    const compound = buildCompoundSpec(makeSpec('bar'));
    const html = buildCompoundHtml(compound);

    expect(html).toContain('display: grid');
    expect(html).toContain('grid-template-rows');
  });

  it('includes chart-view and table-view containers', () => {
    const compound = buildCompoundSpec(makeSpec('bar'));
    const html = buildCompoundHtml(compound);

    expect(html).toContain('id="chart-view"');
    expect(html).toContain('id="table-view"');
  });

  it('embeds the data as JSON', () => {
    const compound = buildCompoundSpec(makeSpec('bar'));
    const html = buildCompoundHtml(compound);

    expect(html).toContain('"region"');
    expect(html).toContain('"revenue"');
    expect(html).toContain('142000');
  });

  it('includes the interaction bus code', () => {
    const compound = buildCompoundSpec(makeSpec('bar'));
    const html = buildCompoundHtml(compound);

    expect(html).toContain('createInteractionBus');
    expect(html).toContain('highlight');
    expect(html).toContain('clearHighlight');
  });

  it('includes the table renderer code', () => {
    const compound = buildCompoundSpec(makeSpec('bar'));
    const html = buildCompoundHtml(compound);

    expect(html).toContain('renderTable');
  });

  it('includes D3 CDN script', () => {
    const compound = buildCompoundSpec(makeSpec('bar'));
    const html = buildCompoundHtml(compound);

    expect(html).toContain('d3js.org/d3.v7.min.js');
  });

  it('uses columns layout when specified', () => {
    const compound = buildCompoundSpec(makeSpec('bar'));
    compound.layout.type = 'columns';
    const html = buildCompoundHtml(compound);

    expect(html).toContain('grid-template-columns');
  });

  it('embeds chart iframe with srcdoc', () => {
    const compound = buildCompoundSpec(makeSpec('bar'));
    const html = buildCompoundHtml(compound);

    // The chart HTML should be embedded as a JSON-stringified srcdoc
    expect(html).toContain('iframe');
    expect(html).toContain('srcdoc');
  });
});

// ─── Compound Refinement ────────────────────────────────────────────────────

describe('Compound Refinement', () => {
  it('refine: remove table unwraps to atomic spec', async () => {
    const { handleRefine } = await import('../../src/mcp/tools/refine.js');
    const { specStore } = await import('../../src/mcp/spec-store.js');
    const handler = handleRefine();

    const compound = buildCompoundSpec(makeSpec('bar'));
    const specId = specStore.save(compound, [], new Map());
    const result = await handler({
      specId,
      removeTable: true,
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.specId).toBeDefined();
    expect(parsed.changes).toContain('Removed table, returned atomic chart');
  });

  it('refine: change layout to columns', async () => {
    const { handleRefine } = await import('../../src/mcp/tools/refine.js');
    const { specStore } = await import('../../src/mcp/spec-store.js');
    const handler = handleRefine();

    const compound = buildCompoundSpec(makeSpec('bar'));
    const specId = specStore.save(compound, [], new Map());
    const result = await handler({
      specId,
      layout: 'columns',
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.specId).toBeDefined();
    expect(parsed.changes).toContain('Layout: columns');
  });

  it('refine: delegates chart-specific refinements through compound', async () => {
    const { handleRefine } = await import('../../src/mcp/tools/refine.js');
    const { specStore } = await import('../../src/mcp/spec-store.js');
    const handler = handleRefine();

    const compound = buildCompoundSpec(makeSpec('bar'));
    const specId = specStore.save(compound, [], new Map());
    const result = await handler({
      specId,
      sort: { direction: 'desc' },
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.specId).toBeDefined();
    expect(parsed.changes).toContain('Sorted by value desc');
  });

  it('refine: change title on compound spec', async () => {
    const { handleRefine } = await import('../../src/mcp/tools/refine.js');
    const { specStore } = await import('../../src/mcp/spec-store.js');
    const handler = handleRefine();

    const compound = buildCompoundSpec(makeSpec('bar'));
    const specId = specStore.save(compound, [], new Map());
    const result = await handler({
      specId,
      title: 'Revenue Overview',
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.specId).toBeDefined();
    expect(parsed.changes).toContain('Title: "Revenue Overview"');
  });
});
