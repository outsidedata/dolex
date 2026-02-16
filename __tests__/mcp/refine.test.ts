import { describe, it, expect, beforeEach } from 'vitest';
import type { VisualizationSpec, CompoundVisualizationSpec } from '../../src/types.js';
import { specStore } from '../../src/mcp/spec-store.js';
import { handleRefine, refineInputSchema } from '../../src/mcp/tools/refine.js';

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function makeSpec(pattern: string, overrides?: Partial<VisualizationSpec>): VisualizationSpec {
  return {
    pattern,
    title: `Test ${pattern}`,
    data: [
      { region: 'North', revenue: 100 },
      { region: 'South', revenue: 200 },
      { region: 'East', revenue: 150 },
      { region: 'West', revenue: 50 },
    ],
    encoding: {
      x: { field: 'region', type: 'nominal' as const },
      y: { field: 'revenue', type: 'quantitative' as const },
    },
    config: {},
    ...overrides,
  };
}

function makeCompoundSpec(overrides?: Partial<CompoundVisualizationSpec>): CompoundVisualizationSpec {
  return {
    compound: true,
    title: 'Compound Test',
    data: [
      { region: 'North', revenue: 100 },
      { region: 'South', revenue: 200 },
      { region: 'East', revenue: 150 },
    ],
    views: [
      {
        id: 'chart-1',
        type: 'chart',
        chart: {
          pattern: 'bar',
          title: 'Revenue by Region',
          encoding: {
            x: { field: 'region', type: 'nominal' as const },
            y: { field: 'revenue', type: 'quantitative' as const },
          },
          config: {},
        },
      },
      {
        id: 'table-1',
        type: 'table',
        table: {
          columns: [
            { field: 'region', title: 'Region' },
            { field: 'revenue', title: 'Revenue' },
          ],
        },
      },
    ],
    layout: { type: 'rows' },
    interactions: [{ type: 'highlight', field: 'region' }],
    ...overrides,
  };
}

/** Parse the JSON text from a handler result */
function parseResult(result: { content: { text: string }[] }) {
  return JSON.parse(result.content[0].text);
}

// ─── TESTS ───────────────────────────────────────────────────────────────────

describe('refine_visualization', () => {
  let handler: ReturnType<typeof handleRefine>;

  beforeEach(() => {
    handler = handleRefine();
  });

  // ── Schema validation ──────────────────────────────────────────────────────

  describe('schema', () => {
    it('requires specId', () => {
      const parsed = refineInputSchema.safeParse({ refinement: 'sort descending' });
      expect(parsed.success).toBe(false);
    });

    it('accepts selectAlternative', () => {
      const parsed = refineInputSchema.safeParse({
        specId: 'spec-12345678',
        refinement: 'switch',
        selectAlternative: 'line',
      });
      expect(parsed.success).toBe(true);
    });
  });

  // ── Error cases ────────────────────────────────────────────────────────────

  describe('errors', () => {
    it('returns error for expired specId', async () => {
      const result = await handler({
        specId: 'spec-expired0',
        refinement: 'sort ascending',
      });

      expect(result.isError).toBe(true);
      const parsed = parseResult(result);
      expect(parsed.error).toContain('not found');
    });

    it('returns error for missing alternative', async () => {
      const specId = specStore.save(makeSpec('bar'), []);
      const result = await handler({
        specId,
        refinement: 'switch',
        selectAlternative: 'nonexistent',
      });

      expect(result.isError).toBe(true);
      const parsed = parseResult(result);
      expect(parsed.error).toContain('not found');
    });
  });

  // ── Atomic spec refinements ────────────────────────────────────────────────

  describe('atomic refinements', () => {
    it('sort descending', async () => {
      const specId = specStore.save(makeSpec('bar'), []);
      const result = await handler({ specId, refinement: 'sort descending' });

      const parsed = parseResult(result);
      expect(parsed.specId).toMatch(/^spec-/);
      expect(parsed.specId).not.toBe(specId);
      expect(parsed.changes).toContain('Applied descending sort');

      // Verify the stored spec was actually updated
      const stored = specStore.get(parsed.specId);
      expect(stored).not.toBeNull();
      expect((stored!.spec as VisualizationSpec).encoding.x?.sort).toBe('descending');
      expect((stored!.spec as VisualizationSpec).encoding.y?.sort).toBe('descending');
    });

    it('sort ascending', async () => {
      const specId = specStore.save(makeSpec('bar'), []);
      const result = await handler({ specId, refinement: 'sort ascending' });

      const parsed = parseResult(result);
      expect(parsed.specId).toMatch(/^spec-/);
      expect(parsed.changes).toContain('Applied ascending sort');

      const stored = specStore.get(parsed.specId);
      expect((stored!.spec as VisualizationSpec).encoding.x?.sort).toBe('ascending');
      expect((stored!.spec as VisualizationSpec).encoding.y?.sort).toBe('ascending');
    });

    it('limit / top N', async () => {
      const specId = specStore.save(makeSpec('bar'), []);
      const result = await handler({ specId, refinement: 'show top 2' });

      const parsed = parseResult(result);
      expect(parsed.changes).toContain('Limited data to top 2 rows');

      const stored = specStore.get(parsed.specId);
      expect((stored!.spec as VisualizationSpec).data).toHaveLength(2);
    });

    it('horizontal / flip axes', async () => {
      const specId = specStore.save(makeSpec('bar'), []);
      const result = await handler({ specId, refinement: 'make it horizontal' });

      const parsed = parseResult(result);
      expect(parsed.changes).toContain('Flipped axes for horizontal layout');

      const stored = specStore.get(parsed.specId);
      const spec = stored!.spec as VisualizationSpec;
      // x and y should be swapped
      expect(spec.encoding.x?.field).toBe('revenue');
      expect(spec.encoding.y?.field).toBe('region');
    });

    it('flip axes', async () => {
      const specId = specStore.save(makeSpec('bar'), []);
      const result = await handler({ specId, refinement: 'flip the axes' });

      const parsed = parseResult(result);
      expect(parsed.changes).toContain('Flipped axes for horizontal layout');
    });

    it('title change', async () => {
      const specId = specStore.save(makeSpec('bar'), []);
      const result = await handler({ specId, refinement: 'title: "Revenue Overview"' });

      const parsed = parseResult(result);
      expect(parsed.changes).toContain('Changed title to "Revenue Overview"');

      const stored = specStore.get(parsed.specId);
      expect((stored!.spec as VisualizationSpec).title).toBe('Revenue Overview');
    });

    it('warm palette', async () => {
      const specId = specStore.save(makeSpec('bar'), []);
      const result = await handler({ specId, refinement: 'use warm palette' });

      const parsed = parseResult(result);
      expect(parsed.changes).toContain('Applied warm palette');

      const stored = specStore.get(parsed.specId);
      const spec = stored!.spec as VisualizationSpec;
      expect(spec.encoding.color?.palette).toBe('warm');
    });

    it('blue palette', async () => {
      const specId = specStore.save(makeSpec('bar'), []);
      const result = await handler({ specId, refinement: 'use blue palette' });

      const parsed = parseResult(result);
      expect(parsed.changes).toContain('Applied blue palette');

      const stored = specStore.get(parsed.specId);
      const spec = stored!.spec as VisualizationSpec;
      expect(spec.encoding.color?.palette).toBe('blue');
    });

    it('categorical colors', async () => {
      const specId = specStore.save(makeSpec('bar'), []);
      const result = await handler({ specId, refinement: 'use categorical colors' });

      const parsed = parseResult(result);
      expect(parsed.changes).toContain('Applied categorical palette');

      const stored = specStore.get(parsed.specId);
      const spec = stored!.spec as VisualizationSpec;
      expect(spec.encoding.color?.palette).toBe('categorical');
    });

    it('highlight with color field — valid values', async () => {
      const spec = makeSpec('bar', {
        encoding: {
          x: { field: 'region', type: 'nominal' as const },
          y: { field: 'revenue', type: 'quantitative' as const },
          color: { field: 'region', type: 'nominal' as const },
        },
      });
      const specId = specStore.save(spec, []);
      const result = await handler({ specId, refinement: 'highlight North and South' });

      const parsed = parseResult(result);
      expect(parsed.changes).toContain('Highlighted values: North, South');

      const stored = specStore.get(parsed.specId);
      const refined = stored!.spec as VisualizationSpec;
      expect(refined.encoding.color?.highlight?.values).toEqual(['North', 'South']);
    });

    it('highlight with color field — no matching values is silently skipped', async () => {
      const spec = makeSpec('bar', {
        encoding: {
          x: { field: 'region', type: 'nominal' as const },
          y: { field: 'revenue', type: 'quantitative' as const },
          color: { field: 'region', type: 'nominal' as const },
        },
      });
      const specId = specStore.save(spec, []);
      const result = await handler({ specId, refinement: 'highlight Mars and Jupiter' });

      const parsed = parseResult(result);
      // No highlight change was applied, so it falls through to unrecognized
      expect(parsed.changes.some((c: string) => c.includes('Highlighted'))).toBe(false);
    });

    it('highlight without color field', async () => {
      // Spec with no color encoding field
      const spec = makeSpec('bar');
      const specId = specStore.save(spec, []);
      const result = await handler({ specId, refinement: 'highlight North and South' });

      const parsed = parseResult(result);
      expect(parsed.changes).toContain('Highlighted values: North, South');

      const stored = specStore.get(parsed.specId);
      const refined = stored!.spec as VisualizationSpec;
      expect(refined.encoding.color?.highlight?.values).toEqual(['North', 'South']);
    });

    it('muted opacity', async () => {
      const specId = specStore.save(makeSpec('bar'), []);
      const result = await handler({ specId, refinement: 'mute to 30% opacity' });

      const parsed = parseResult(result);
      expect(parsed.changes).toContain('Set muted opacity to 0.3');

      const stored = specStore.get(parsed.specId);
      const spec = stored!.spec as VisualizationSpec;
      expect(spec.encoding.color?.highlight?.mutedOpacity).toBe(0.3);
    });

    it('muted opacity on existing highlight', async () => {
      const spec = makeSpec('bar', {
        encoding: {
          x: { field: 'region', type: 'nominal' as const },
          y: { field: 'revenue', type: 'quantitative' as const },
          color: {
            field: 'region',
            type: 'nominal' as const,
            highlight: { values: ['North'] },
          },
        },
      });
      const specId = specStore.save(spec, []);
      const result = await handler({ specId, refinement: 'mute to 20% opacity' });

      const parsed = parseResult(result);
      expect(parsed.changes).toContain('Set muted opacity to 0.2');

      const stored = specStore.get(parsed.specId);
      const refined = stored!.spec as VisualizationSpec;
      expect(refined.encoding.color?.highlight?.mutedOpacity).toBe(0.2);
      // Existing highlight values should be preserved
      expect(refined.encoding.color?.highlight?.values).toEqual(['North']);
    });

    it('colorBy refinement', async () => {
      const specId = specStore.save(makeSpec('sankey'), []);
      const result = await handler({ specId, refinement: 'color by source' });

      const parsed = parseResult(result);
      expect(parsed.changes).toContain('Set colorBy to "source"');

      const stored = specStore.get(parsed.specId);
      expect((stored!.spec as VisualizationSpec).config.colorBy).toBe('source');
    });

    it('percentage format', async () => {
      const specId = specStore.save(makeSpec('bar'), []);
      const result = await handler({ specId, refinement: 'show as percent' });

      const parsed = parseResult(result);
      expect(parsed.changes).toContain('Applied percentage format to y-axis');

      const stored = specStore.get(parsed.specId);
      const spec = stored!.spec as VisualizationSpec;
      expect(spec.encoding.y?.format).toBe('.1%');
    });

    it('unrecognized refinement', async () => {
      const specId = specStore.save(makeSpec('bar'), []);
      const result = await handler({ specId, refinement: 'make it sparkle' });

      const parsed = parseResult(result);
      expect(parsed.changes).toHaveLength(1);
      expect(parsed.changes[0]).toContain('Refinement noted');
      expect(parsed.changes[0]).toContain('make it sparkle');

      // _pendingRefinement should be set on the stored spec
      const stored = specStore.get(parsed.specId);
      expect((stored!.spec as VisualizationSpec).config._pendingRefinement).toBe('make it sparkle');
    });

    it('switches to an alternative pattern', async () => {
      const alts = new Map<string, VisualizationSpec>();
      alts.set('lollipop', makeSpec('lollipop'));
      const specId = specStore.save(makeSpec('bar'), [], alts);

      const result = await handler({
        specId,
        refinement: 'switch to lollipop',
        selectAlternative: 'lollipop',
      });

      const parsed = parseResult(result);
      expect(parsed.specId).toMatch(/^spec-/);
      expect(parsed.changes).toBeDefined();
    });

    it('chained refine uses new specId', async () => {
      const specId = specStore.save(makeSpec('bar'), []);

      const result1 = await handler({ specId, refinement: 'sort descending' });
      const parsed1 = parseResult(result1);
      const newSpecId = parsed1.specId;

      const result2 = await handler({ specId: newSpecId, refinement: 'use warm palette' });
      const parsed2 = parseResult(result2);
      expect(parsed2.changes).toContain('Applied warm palette');
      expect(parsed2.specId).not.toBe(newSpecId);
    });
  });

  // ── Compound spec refinements ──────────────────────────────────────────────

  describe('compound refinements', () => {
    it('remove table — unwraps to atomic spec', async () => {
      const specId = specStore.save(makeCompoundSpec(), []);
      const result = await handler({ specId, refinement: 'remove the table' });

      const parsed = parseResult(result);
      expect(parsed.changes).toContain('Removed table, returned atomic chart spec');

      // The stored spec should now be an atomic VisualizationSpec (not compound)
      const stored = specStore.get(parsed.specId);
      const spec = stored!.spec as VisualizationSpec;
      expect(spec).not.toHaveProperty('compound');
      expect(spec.pattern).toBe('bar');
      expect(spec.data).toHaveLength(3);
    });

    it('layout change — side by side', async () => {
      const specId = specStore.save(makeCompoundSpec(), []);
      const result = await handler({ specId, refinement: 'put them side by side' });

      const parsed = parseResult(result);
      expect(parsed.changes).toContain('Changed layout to side-by-side columns');

      const stored = specStore.get(parsed.specId);
      const spec = stored!.spec as CompoundVisualizationSpec;
      expect(spec.layout.type).toBe('columns');
    });

    it('layout change — stack rows', async () => {
      const compound = makeCompoundSpec({ layout: { type: 'columns' } });
      const specId = specStore.save(compound, []);
      const result = await handler({ specId, refinement: 'stack them in rows' });

      const parsed = parseResult(result);
      expect(parsed.changes).toContain('Changed layout to stacked rows');

      const stored = specStore.get(parsed.specId);
      const spec = stored!.spec as CompoundVisualizationSpec;
      expect(spec.layout.type).toBe('rows');
    });

    it('highlight by field', async () => {
      const specId = specStore.save(makeCompoundSpec(), []);
      const result = await handler({ specId, refinement: 'highlight by category' });

      const parsed = parseResult(result);
      expect(parsed.changes).toContain('Changed highlight interaction field to "category"');

      const stored = specStore.get(parsed.specId);
      const spec = stored!.spec as CompoundVisualizationSpec;
      expect(spec.interactions).toEqual([{ type: 'highlight', field: 'category' }]);
    });

    it('hide column', async () => {
      const specId = specStore.save(makeCompoundSpec(), []);
      const result = await handler({ specId, refinement: 'hide the revenue column' });

      const parsed = parseResult(result);
      expect(parsed.changes).toContain('Hidden "revenue" column from table');

      const stored = specStore.get(parsed.specId);
      const spec = stored!.spec as CompoundVisualizationSpec;
      const tableView = spec.views.find(v => v.type === 'table');
      expect(tableView?.table?.columns).toHaveLength(1);
      expect(tableView?.table?.columns![0].field).toBe('region');
    });

    it('title change on compound', async () => {
      const specId = specStore.save(makeCompoundSpec(), []);
      const result = await handler({ specId, refinement: 'title: "Sales Dashboard"' });

      const parsed = parseResult(result);
      expect(parsed.changes).toContain('Changed title to "Sales Dashboard"');

      const stored = specStore.get(parsed.specId);
      const spec = stored!.spec as CompoundVisualizationSpec;
      expect(spec.title).toBe('Sales Dashboard');
      // Chart view title should also be updated
      const chartView = spec.views.find(v => v.type === 'chart');
      expect(chartView?.chart?.title).toBe('Sales Dashboard');
    });

    it('delegate to chart — sort descending', async () => {
      const specId = specStore.save(makeCompoundSpec(), []);
      const result = await handler({ specId, refinement: 'sort descending' });

      const parsed = parseResult(result);
      expect(parsed.changes).toContain('Applied descending sort');

      const stored = specStore.get(parsed.specId);
      const spec = stored!.spec as CompoundVisualizationSpec;
      const chartView = spec.views.find(v => v.type === 'chart');
      expect(chartView?.chart?.encoding.x?.sort).toBe('descending');
      expect(chartView?.chart?.encoding.y?.sort).toBe('descending');
    });

    it('unrecognized compound refinement', async () => {
      const specId = specStore.save(makeCompoundSpec(), []);
      const result = await handler({ specId, refinement: 'make it sparkle' });

      const parsed = parseResult(result);
      // Delegation to chart also finds nothing, so we get the chart's unrecognized message
      // The compound handler delegates to applyRefinement which sets _pendingRefinement
      expect(parsed.changes).toHaveLength(1);
      expect(parsed.changes[0]).toContain('Refinement noted');
      expect(parsed.changes[0]).toContain('make it sparkle');
    });
  });
});
