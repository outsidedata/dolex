import { describe, it, expect, vi } from 'vitest';
import type { DashboardSpec, DashboardViewSpec, VisualizationSpec } from '../src/types.js';
import { isDashboardSpec, isCompoundSpec } from '../src/types.js';
import { buildDashboardHtml, type DashboardViewData } from '../src/renderers/html/builders/dashboard.js';

// ─── TEST DATA ──────────────────────────────────────────────────────────────

const sampleData = [
  { region: 'North', product: 'Widget', revenue: 142000, month: '2024-01' },
  { region: 'South', product: 'Widget', revenue: 98000, month: '2024-02' },
  { region: 'East', product: 'Gadget', revenue: 210000, month: '2024-03' },
  { region: 'West', product: 'Gadget', revenue: 175000, month: '2024-04' },
  { region: 'North', product: 'Gizmo', revenue: 88000, month: '2024-05' },
];

function makeViewSpec(pattern: string, title: string): VisualizationSpec {
  return {
    pattern,
    title,
    data: sampleData,
    encoding: {
      x: { field: 'region', type: 'nominal' as const },
      y: { field: 'revenue', type: 'quantitative' as const },
      color: { field: 'product', type: 'nominal' as const },
    },
    config: {},
  };
}

function makeDashboardSpec(overrides?: Partial<DashboardSpec>): DashboardSpec {
  return {
    dashboard: true,
    id: 'test-dashboard',
    title: 'Test Dashboard',
    sourceId: 'src-test',
    table: 'sales',
    views: [
      {
        id: 'revenue-by-region',
        title: 'Revenue by Region',
        intent: 'compare revenue by region',
        query: { select: ['region', { field: 'revenue', aggregate: 'sum', as: 'total' }], groupBy: ['region'] },
      },
      {
        id: 'revenue-trend',
        title: 'Revenue Trend',
        intent: 'show revenue over time',
        query: { select: ['month', { field: 'revenue', aggregate: 'sum', as: 'total' }], groupBy: ['month'] },
      },
    ],
    layout: { columns: 2 },
    ...overrides,
  };
}

function makeViewData(): DashboardViewData[] {
  return [
    {
      viewId: 'revenue-by-region',
      data: sampleData,
      spec: makeViewSpec('bar', 'Revenue by Region'),
    },
    {
      viewId: 'revenue-trend',
      data: sampleData,
      spec: makeViewSpec('line', 'Revenue Trend'),
    },
  ];
}

function mockSourceManager() {
  return {
    get: vi.fn().mockReturnValue({ id: 'src-test', type: 'csv', name: 'test' }),
    queryDsl: vi.fn().mockResolvedValue({
      ok: true,
      rows: sampleData,
      columns: ['region', 'product', 'revenue', 'month'],
      totalRows: 5,
    }),
  };
}

// ─── Type Guards ─────────────────────────────────────────────────────────────

describe('isDashboardSpec', () => {
  it('returns true for a dashboard spec', () => {
    expect(isDashboardSpec(makeDashboardSpec())).toBe(true);
  });

  it('returns false for an atomic visualization spec', () => {
    expect(isDashboardSpec(makeViewSpec('bar', 'Test') as any)).toBe(false);
  });

  it('returns false for a compound spec', () => {
    const compound = {
      compound: true as const,
      title: 'Test',
      data: sampleData,
      views: [],
      layout: { type: 'rows' as const },
      interactions: [],
    };
    expect(isDashboardSpec(compound as any)).toBe(false);
  });
});

// ─── Dashboard Type Construction ────────────────────────────────────────────

describe('Dashboard type construction', () => {
  it('creates a valid dashboard spec with required fields', () => {
    const spec = makeDashboardSpec();
    expect(spec.dashboard).toBe(true);
    expect(spec.id).toBe('test-dashboard');
    expect(spec.views).toHaveLength(2);
    expect(spec.layout.columns).toBe(2);
  });

  it('supports optional fields', () => {
    const spec = makeDashboardSpec({
      description: 'A test dashboard',
      globalFilters: [
        { field: 'region', type: 'select' },
      ],
      interactions: [
        { type: 'crossfilter', field: 'region' },
      ],
      theme: 'light',
    });

    expect(spec.description).toBe('A test dashboard');
    expect(spec.globalFilters).toHaveLength(1);
    expect(spec.interactions).toHaveLength(1);
    expect(spec.theme).toBe('light');
  });

  it('views have per-view queries', () => {
    const spec = makeDashboardSpec();
    const view1 = spec.views[0] as DashboardViewSpec;
    const view2 = spec.views[1] as DashboardViewSpec;

    expect(view1.query.select).toBeDefined();
    expect(view2.query.select).toBeDefined();
    expect(view1.query.groupBy).toEqual(['region']);
    expect(view2.query.groupBy).toEqual(['month']);
  });

  it('layout supports viewSizes overrides', () => {
    const spec = makeDashboardSpec({
      layout: {
        columns: 2,
        viewSizes: {
          'revenue-by-region': { colSpan: 2 },
          'revenue-trend': { rowSpan: 2 },
        },
      },
    });

    expect(spec.layout.viewSizes!['revenue-by-region'].colSpan).toBe(2);
    expect(spec.layout.viewSizes!['revenue-trend'].rowSpan).toBe(2);
  });
});

// ─── Dashboard Zod Schemas ──────────────────────────────────────────────────

describe('Dashboard Zod schemas', () => {
  const minView = { id: 'v1', title: 'Test', intent: 'test', query: { select: ['a'] } };

  it('createDashboardInputSchema validates valid input', async () => {
    const { createDashboardInputSchema } = await import('../src/mcp/tools/dsl-schemas.js');

    const result = createDashboardInputSchema.safeParse({
      sourceId: 'src-test',
      table: 'sales',
      title: 'Revenue Dashboard',
      views: [{
        id: 'view-1',
        title: 'Revenue by Region',
        intent: 'compare revenue by region',
        query: { select: ['region', { field: 'revenue', aggregate: 'sum', as: 'total' }], groupBy: ['region'] },
      }],
    });

    expect(result.success).toBe(true);
  });

  it('requires at least one view', async () => {
    const { createDashboardInputSchema } = await import('../src/mcp/tools/dsl-schemas.js');
    const result = createDashboardInputSchema.safeParse({ sourceId: 'src-test', table: 'sales', views: [] });
    expect(result.success).toBe(false);
  });

  it('accepts optional layout', async () => {
    const { createDashboardInputSchema } = await import('../src/mcp/tools/dsl-schemas.js');
    const result = createDashboardInputSchema.safeParse({
      sourceId: 'src-test', table: 'sales', views: [minView], layout: { columns: 3 },
    });
    expect(result.success).toBe(true);
  });

  it('accepts globalFilters', async () => {
    const { createDashboardInputSchema } = await import('../src/mcp/tools/dsl-schemas.js');
    const result = createDashboardInputSchema.safeParse({
      sourceId: 'src-test', table: 'sales', views: [minView],
      globalFilters: [{ field: 'region', type: 'select' }, { field: 'year', type: 'range' }],
    });
    expect(result.success).toBe(true);
  });

  it('accepts interactions', async () => {
    const { createDashboardInputSchema } = await import('../src/mcp/tools/dsl-schemas.js');
    const result = createDashboardInputSchema.safeParse({
      sourceId: 'src-test', table: 'sales', views: [minView],
      interactions: [{ type: 'crossfilter', field: 'region' }, { type: 'highlight', field: 'product', views: ['v1'] }],
    });
    expect(result.success).toBe(true);
  });

  it('refineDashboardInputSchema validates valid input', async () => {
    const { refineDashboardInputSchema } = await import('../src/mcp/tools/dsl-schemas.js');
    const result = refineDashboardInputSchema.safeParse({ currentSpec: makeDashboardSpec(), refinement: 'make it 3 columns' });
    expect(result.success).toBe(true);
  });

  it('accepts views with color preferences', async () => {
    const { createDashboardInputSchema } = await import('../src/mcp/tools/dsl-schemas.js');
    const result = createDashboardInputSchema.safeParse({
      sourceId: 'src-test', table: 'sales',
      views: [{ ...minView, colorPreferences: { palette: 'warm', colorField: 'region' } }],
    });
    expect(result.success).toBe(true);
  });

  it('accepts views with pattern override', async () => {
    const { createDashboardInputSchema } = await import('../src/mcp/tools/dsl-schemas.js');
    const result = createDashboardInputSchema.safeParse({
      sourceId: 'src-test', table: 'sales',
      views: [{ ...minView, pattern: 'line' }],
    });
    expect(result.success).toBe(true);
  });
});

// ─── Dashboard HTML Builder ─────────────────────────────────────────────────

describe('buildDashboardHtml', () => {
  it('produces a valid HTML document', () => {
    const html = buildDashboardHtml(makeDashboardSpec(), makeViewData());
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('</html>');
  });

  it('includes the dashboard title', () => {
    const html = buildDashboardHtml(makeDashboardSpec(), makeViewData());
    expect(html).toContain('Test Dashboard');
  });

  it('includes dashboard-grid container', () => {
    const html = buildDashboardHtml(makeDashboardSpec(), makeViewData());
    expect(html).toContain('id="dashboard-grid"');
  });

  it('includes CSS grid layout with correct columns', () => {
    const html = buildDashboardHtml(makeDashboardSpec(), makeViewData());
    expect(html).toContain('grid-template-columns: repeat(2, 1fr)');
  });

  it('creates panels for each view', () => {
    const html = buildDashboardHtml(makeDashboardSpec(), makeViewData());
    expect(html).toContain('panel-revenue-by-region');
    expect(html).toContain('panel-revenue-trend');
  });

  it('creates iframes for each view', () => {
    const html = buildDashboardHtml(makeDashboardSpec(), makeViewData());
    const iframeCount = (html.match(/class="chart-frame"/g) || []).length;
    expect(iframeCount).toBe(2);
  });

  it('includes panel headers with view titles', () => {
    const html = buildDashboardHtml(makeDashboardSpec(), makeViewData());
    expect(html).toContain('Revenue by Region');
    expect(html).toContain('Revenue Trend');
  });

  it('embeds view data as JSON', () => {
    const html = buildDashboardHtml(makeDashboardSpec(), makeViewData());
    expect(html).toContain('"region"');
    expect(html).toContain('"revenue"');
    expect(html).toContain('142000');
  });

  it('includes description when provided', () => {
    const spec = makeDashboardSpec({ description: 'My test dashboard description' });
    const html = buildDashboardHtml(spec, makeViewData());
    expect(html).toContain('My test dashboard description');
  });

  it('supports light theme', () => {
    const spec = makeDashboardSpec({ theme: 'light' });
    const html = buildDashboardHtml(spec, makeViewData());
    expect(html).toContain('#ffffff');
  });

  it('uses dark theme by default', () => {
    const html = buildDashboardHtml(makeDashboardSpec(), makeViewData());
    expect(html).toContain('#0f1117');
  });

  it('respects layout columns', () => {
    const spec = makeDashboardSpec({ layout: { columns: 3 } });
    const html = buildDashboardHtml(spec, makeViewData());
    expect(html).toContain('grid-template-columns: repeat(3, 1fr)');
  });

  it('applies viewSizes as CSS grid span', () => {
    const spec = makeDashboardSpec({
      layout: { columns: 2, viewSizes: { 'revenue-by-region': { colSpan: 2 } } },
    });
    const html = buildDashboardHtml(spec, makeViewData());
    expect(html).toContain('grid-column: span 2');
  });

  it('handles single view dashboard', () => {
    const spec = makeDashboardSpec();
    spec.views = [spec.views[0]];
    const vd = [makeViewData()[0]];
    const html = buildDashboardHtml(spec, vd);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('panel-revenue-by-region');
  });

  it('includes global filter controls when specified', () => {
    const spec = makeDashboardSpec({
      globalFilters: [{ field: 'region', type: 'select', label: 'Region' }],
    });
    const html = buildDashboardHtml(spec, makeViewData());
    expect(html).toContain('filter-bar');
    expect(html).toContain('"field"');
    expect(html).toContain('"region"');
  });

  it('includes interaction config when specified', () => {
    const spec = makeDashboardSpec({
      interactions: [{ type: 'crossfilter', field: 'region' }],
    });
    const html = buildDashboardHtml(spec, makeViewData());
    expect(html).toContain('crossfilter');
  });
});

// ─── create_dashboard handler ───────────────────────────────────────────────

describe('create_dashboard handler', () => {
  it('returns dashboard spec and HTML on success', async () => {
    const { handleCreateDashboard } = await import('../src/mcp/tools/dashboard.js');
    const sm = mockSourceManager();
    const result = await handleCreateDashboard({ sourceManager: sm })({
      sourceId: 'src-test',
      table: 'sales',
      title: 'Test Dashboard',
      views: [{
        id: 'view-1',
        title: 'Revenue by Region',
        intent: 'compare revenue by region',
        query: { select: ['region', { field: 'revenue', aggregate: 'sum', as: 'total' }], groupBy: ['region'] },
      }],
    });

    expect(result.content).toHaveLength(1);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.dashboardSpec.dashboard).toBe(true);
    expect(parsed.dashboardSpec.title).toBe('Test Dashboard');
    expect(parsed.dashboardSpec.views).toHaveLength(1);
    expect(parsed.viewReasonings).toHaveLength(1);
    expect(result.structuredContent).toBeDefined();
    expect(result.structuredContent!.html).toContain('<!DOCTYPE html>');
  });

  it('returns error when source not found', async () => {
    const { handleCreateDashboard } = await import('../src/mcp/tools/dashboard.js');
    const sm = mockSourceManager();
    sm.get.mockReturnValue(null);
    const result = await handleCreateDashboard({ sourceManager: sm })({
      sourceId: 'nonexistent', table: 'sales',
      views: [{ id: 'v1', title: 'Test', intent: 'test', query: { select: ['a'] } }],
    });

    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toContain('Source not found');
  });

  it('returns error when query fails', async () => {
    const { handleCreateDashboard } = await import('../src/mcp/tools/dashboard.js');
    const sm = mockSourceManager();
    sm.queryDsl.mockResolvedValue({ ok: false, error: 'Table not found: bad_table' });
    const result = await handleCreateDashboard({ sourceManager: sm })({
      sourceId: 'src-test', table: 'sales',
      views: [{ id: 'v1', title: 'Test', intent: 'test', query: { select: ['a'] } }],
    });

    expect(result.isError).toBe(true);
  });

  it('auto-calculates layout when not provided', async () => {
    const { handleCreateDashboard } = await import('../src/mcp/tools/dashboard.js');
    const sm = mockSourceManager();
    const result = await handleCreateDashboard({ sourceManager: sm })({
      sourceId: 'src-test', table: 'sales',
      views: [
        { id: 'v1', title: 'View 1', intent: 'test 1', query: { select: ['a'] } },
        { id: 'v2', title: 'View 2', intent: 'test 2', query: { select: ['b'] } },
        { id: 'v3', title: 'View 3', intent: 'test 3', query: { select: ['c'] } },
      ],
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.dashboardSpec.layout.columns).toBe(2);
  });

  it('respects pattern override on views', async () => {
    const { handleCreateDashboard } = await import('../src/mcp/tools/dashboard.js');
    const sm = mockSourceManager();
    const result = await handleCreateDashboard({ sourceManager: sm })({
      sourceId: 'src-test', table: 'sales',
      views: [{ id: 'v1', title: 'Test', intent: 'compare revenue by region', query: { select: ['region', 'revenue'] }, pattern: 'line' }],
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.viewReasonings[0].pattern).toBeDefined();
  });

  it('generates a unique dashboard ID', async () => {
    const { handleCreateDashboard } = await import('../src/mcp/tools/dashboard.js');
    const sm = mockSourceManager();
    const result = await handleCreateDashboard({ sourceManager: sm })({
      sourceId: 'src-test', table: 'sales',
      views: [{ id: 'v1', title: 'Test', intent: 'test', query: { select: ['a'] } }],
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.dashboardSpec.id).toMatch(/^dashboard-/);
  });

  it('queries each view independently', async () => {
    const { handleCreateDashboard } = await import('../src/mcp/tools/dashboard.js');
    const sm = mockSourceManager();
    await handleCreateDashboard({ sourceManager: sm })({
      sourceId: 'src-test', table: 'sales',
      views: [
        { id: 'v1', title: 'View 1', intent: 'test', query: { select: ['a'] } },
        { id: 'v2', title: 'View 2', intent: 'test', query: { select: ['b'] } },
      ],
    });

    expect(sm.queryDsl).toHaveBeenCalledTimes(2);
  });
});

// ─── refine_dashboard handler ───────────────────────────────────────────────

describe('refine_dashboard handler', () => {
  it('changes layout columns', async () => {
    const { handleRefineDashboard } = await import('../src/mcp/tools/dashboard-refine.js');
    const sm = mockSourceManager();
    const result = await handleRefineDashboard({ sourceManager: sm })({
      currentSpec: makeDashboardSpec(), refinement: 'make it 3 columns',
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.dashboardSpec.layout.columns).toBe(3);
    expect(parsed.changes).toContain('Changed layout to 3 columns');
  });

  it('changes theme to light', async () => {
    const { handleRefineDashboard } = await import('../src/mcp/tools/dashboard-refine.js');
    const sm = mockSourceManager();
    const result = await handleRefineDashboard({ sourceManager: sm })({
      currentSpec: makeDashboardSpec(), refinement: 'switch to light mode',
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.dashboardSpec.theme).toBe('light');
  });

  it('changes theme to dark', async () => {
    const { handleRefineDashboard } = await import('../src/mcp/tools/dashboard-refine.js');
    const sm = mockSourceManager();
    const result = await handleRefineDashboard({ sourceManager: sm })({
      currentSpec: makeDashboardSpec({ theme: 'light' }), refinement: 'switch to dark mode',
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.dashboardSpec.theme).toBe('dark');
  });

  it('removes a view by title match', async () => {
    const { handleRefineDashboard } = await import('../src/mcp/tools/dashboard-refine.js');
    const sm = mockSourceManager();
    const result = await handleRefineDashboard({ sourceManager: sm })({
      currentSpec: makeDashboardSpec(), refinement: 'remove the revenue trend view',
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.dashboardSpec.views).toHaveLength(1);
    expect(parsed.dashboardSpec.views[0].id).toBe('revenue-by-region');
    expect(parsed.changes).toContain('Removed view "revenue-trend"');
  });

  it('adds a new view', async () => {
    const { handleRefineDashboard } = await import('../src/mcp/tools/dashboard-refine.js');
    const sm = mockSourceManager();
    const result = await handleRefineDashboard({ sourceManager: sm })({
      currentSpec: makeDashboardSpec(), refinement: 'add a chart showing product distribution',
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.dashboardSpec.views).toHaveLength(3);
    expect(parsed.changes[0]).toContain('Added new view');
  });

  it('adds a global filter', async () => {
    const { handleRefineDashboard } = await import('../src/mcp/tools/dashboard-refine.js');
    const sm = mockSourceManager();
    const result = await handleRefineDashboard({ sourceManager: sm })({
      currentSpec: makeDashboardSpec(), refinement: 'add a region filter',
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.dashboardSpec.globalFilters).toHaveLength(1);
    expect(parsed.dashboardSpec.globalFilters[0].field).toBe('region');
  });

  it('changes title', async () => {
    const { handleRefineDashboard } = await import('../src/mcp/tools/dashboard-refine.js');
    const sm = mockSourceManager();
    const result = await handleRefineDashboard({ sourceManager: sm })({
      currentSpec: makeDashboardSpec(), refinement: 'title: "Sales Overview 2024"',
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.dashboardSpec.title).toBe('Sales Overview 2024');
  });

  it('swaps two views', async () => {
    const { handleRefineDashboard } = await import('../src/mcp/tools/dashboard-refine.js');
    const sm = mockSourceManager();
    const result = await handleRefineDashboard({ sourceManager: sm })({
      currentSpec: makeDashboardSpec(), refinement: 'swap revenue-by-region and revenue-trend',
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.dashboardSpec.views[0].id).toBe('revenue-trend');
    expect(parsed.dashboardSpec.views[1].id).toBe('revenue-by-region');
  });

  it('returns HTML with the updated dashboard', async () => {
    const { handleRefineDashboard } = await import('../src/mcp/tools/dashboard-refine.js');
    const sm = mockSourceManager();
    const result = await handleRefineDashboard({ sourceManager: sm })({
      currentSpec: makeDashboardSpec(), refinement: 'make it 3 columns',
    });

    expect(result.structuredContent).toBeDefined();
    expect(result.structuredContent!.html).toContain('<!DOCTYPE html>');
    expect(result.structuredContent!.html).toContain('dashboard-grid');
  });

  it('handles unknown refinements gracefully', async () => {
    const { handleRefineDashboard } = await import('../src/mcp/tools/dashboard-refine.js');
    const sm = mockSourceManager();
    const result = await handleRefineDashboard({ sourceManager: sm })({
      currentSpec: makeDashboardSpec(), refinement: 'make it sparkle',
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.changes[0]).toContain('Refinement noted');
    expect(result.structuredContent!.html).toContain('<!DOCTYPE html>');
  });

  it('returns error when query fails during refinement', async () => {
    const { handleRefineDashboard } = await import('../src/mcp/tools/dashboard-refine.js');
    const sm = mockSourceManager();
    sm.queryDsl.mockResolvedValue({ ok: false, error: 'Connection lost' });
    const result = await handleRefineDashboard({ sourceManager: sm })({
      currentSpec: makeDashboardSpec(), refinement: 'make it 3 columns',
    });

    expect(result.isError).toBe(true);
  });
});

// ─── App Shell Sizing ───────────────────────────────────────────────────────

describe('App shell dashboard detection', () => {
  it('dashboard HTML contains dashboard-grid class for app shell detection', () => {
    const html = buildDashboardHtml(makeDashboardSpec(), makeViewData());
    expect(html).toContain('dashboard-grid');
  });
});
