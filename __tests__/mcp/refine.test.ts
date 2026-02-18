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
      const parsed = refineInputSchema.safeParse({ sort: { direction: 'desc' } });
      expect(parsed.success).toBe(false);
    });

    it('accepts specId alone (no-op refine)', () => {
      const parsed = refineInputSchema.safeParse({ specId: 'spec-12345678' });
      expect(parsed.success).toBe(true);
    });

    it('accepts sort param', () => {
      const parsed = refineInputSchema.safeParse({
        specId: 'spec-12345678',
        sort: { direction: 'desc' },
      });
      expect(parsed.success).toBe(true);
    });

    it('accepts filter param', () => {
      const parsed = refineInputSchema.safeParse({
        specId: 'spec-12345678',
        filter: [{ field: 'region', op: 'in', values: ['North'] }],
      });
      expect(parsed.success).toBe(true);
    });

    it('accepts switchPattern param', () => {
      const parsed = refineInputSchema.safeParse({
        specId: 'spec-12345678',
        switchPattern: 'lollipop',
      });
      expect(parsed.success).toBe(true);
    });

    it('accepts highlight with null to clear', () => {
      const parsed = refineInputSchema.safeParse({
        specId: 'spec-12345678',
        highlight: null,
      });
      expect(parsed.success).toBe(true);
    });

    it('accepts sort with null to clear', () => {
      const parsed = refineInputSchema.safeParse({
        specId: 'spec-12345678',
        sort: null,
      });
      expect(parsed.success).toBe(true);
    });

    it('transforms highlight with empty values to null', () => {
      const parsed = refineInputSchema.safeParse({
        specId: 'spec-12345678',
        highlight: { values: [] },
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.highlight).toBeNull();
      }
    });
  });

  // ── Error cases ────────────────────────────────────────────────────────────

  describe('errors', () => {
    it('returns error for expired specId', async () => {
      const result = await handler({
        specId: 'spec-expired0',
      });

      expect(result.isError).toBe(true);
      const parsed = parseResult(result);
      expect(parsed.error).toContain('not found');
    });
  });

  // ── Atomic spec refinements ────────────────────────────────────────────────

  describe('atomic refinements', () => {
    // ── Sort ──

    it('sort descending without field defaults to value sort', async () => {
      const specId = specStore.save(makeSpec('bar'), []);
      const result = await handler({ specId, sort: { direction: 'desc' } });

      const parsed = parseResult(result);
      expect(parsed.specId).toMatch(/^spec-/);
      expect(parsed.specId).not.toBe(specId);
      expect(parsed.changes).toContain('Sorted by value desc');

      const stored = specStore.get(parsed.specId);
      expect(stored).not.toBeNull();
      expect((stored!.spec as VisualizationSpec).config.sortBy).toBe('value');
      expect((stored!.spec as VisualizationSpec).config.sortOrder).toBe('descending');
    });

    it('sort ascending without field defaults to value sort', async () => {
      const specId = specStore.save(makeSpec('bar'), []);
      const result = await handler({ specId, sort: { direction: 'asc' } });

      const parsed = parseResult(result);
      expect(parsed.changes).toContain('Sorted by value asc');

      const stored = specStore.get(parsed.specId);
      expect((stored!.spec as VisualizationSpec).config.sortBy).toBe('value');
      expect((stored!.spec as VisualizationSpec).config.sortOrder).toBe('ascending');
    });

    it('sort with explicit field matching y-axis sets sortBy to value', async () => {
      const specId = specStore.save(makeSpec('bar'), []);
      const result = await handler({ specId, sort: { field: 'revenue', direction: 'desc' } });

      const parsed = parseResult(result);
      expect(parsed.changes).toContain('Sorted by revenue desc');

      const stored = specStore.get(parsed.specId);
      const spec = stored!.spec as VisualizationSpec;
      expect(spec.config.sortBy).toBe('value');
      expect(spec.config.sortOrder).toBe('descending');
    });

    it('sort with explicit field matching x-axis sets sortBy to category', async () => {
      const specId = specStore.save(makeSpec('bar'), []);
      const result = await handler({ specId, sort: { field: 'region', direction: 'asc' } });

      const parsed = parseResult(result);
      expect(parsed.changes).toContain('Sorted by region asc');

      const stored = specStore.get(parsed.specId);
      const spec = stored!.spec as VisualizationSpec;
      expect(spec.config.sortBy).toBe('category');
      expect(spec.config.sortOrder).toBe('ascending');
    });

    it('sort with invalid field name returns note with available fields', async () => {
      const specId = specStore.save(makeSpec('bar'), []);
      const result = await handler({ specId, sort: { field: 'nonexistent', direction: 'desc' } });

      const parsed = parseResult(result);
      expect(parsed.notes).toBeDefined();
      expect(parsed.notes.some((n: string) => n.includes('not found'))).toBe(true);
      expect(parsed.notes.some((n: string) => n.includes('region'))).toBe(true);
    });

    it('sort: null clears existing sort', async () => {
      const spec = makeSpec('bar');
      spec.config.sortBy = 'value';
      spec.config.sortOrder = 'descending';
      const specId = specStore.save(spec, []);

      const result = await handler({ specId, sort: null });

      const parsed = parseResult(result);
      expect(parsed.changes).toContain('Cleared sort');

      const stored = specStore.get(parsed.specId);
      const refined = stored!.spec as VisualizationSpec;
      expect(refined.config.sortBy).toBeUndefined();
      expect(refined.config.sortOrder).toBeUndefined();
    });

    // ── Limit ──

    it('limit top N', async () => {
      const specId = specStore.save(makeSpec('bar'), []);
      const result = await handler({ specId, limit: 2 });

      const parsed = parseResult(result);
      expect(parsed.changes).toContain('Limited to top 2 rows');

      const stored = specStore.get(parsed.specId);
      expect((stored!.spec as VisualizationSpec).data).toHaveLength(2);
    });

    // ── Filter ──

    it('filter with op: in keeps matching rows', async () => {
      const specId = specStore.save(makeSpec('bar'), [], new Map(),
        [
          { region: 'North', revenue: 100 },
          { region: 'South', revenue: 200 },
          { region: 'East', revenue: 150 },
          { region: 'West', revenue: 50 },
        ],
      );
      const result = await handler({
        specId,
        filter: [{ field: 'region', op: 'in', values: ['North', 'South'] }],
      });

      const parsed = parseResult(result);
      expect(parsed.changes.some((c: string) => c.includes('Filtered region'))).toBe(true);

      const stored = specStore.get(parsed.specId);
      const data = (stored!.spec as VisualizationSpec).data;
      expect(data).toHaveLength(2);
      expect(data.every((d: any) => ['North', 'South'].includes(d.region))).toBe(true);
    });

    it('filter with op: not_in removes matching rows', async () => {
      const specId = specStore.save(makeSpec('bar'), [], new Map(),
        [
          { region: 'North', revenue: 100 },
          { region: 'South', revenue: 200 },
          { region: 'East', revenue: 150 },
          { region: 'West', revenue: 50 },
        ],
      );
      const result = await handler({
        specId,
        filter: [{ field: 'region', op: 'not_in', values: ['North', 'South'] }],
      });

      const parsed = parseResult(result);
      expect(parsed.changes.some((c: string) => c.includes('Filtered region'))).toBe(true);

      const stored = specStore.get(parsed.specId);
      const data = (stored!.spec as VisualizationSpec).data;
      expect(data).toHaveLength(2);
      expect(data.every((d: any) => ['East', 'West'].includes(d.region))).toBe(true);
    });

    it('filter with op: gt does numeric comparison', async () => {
      const specId = specStore.save(makeSpec('bar'), [], new Map(),
        [
          { region: 'North', revenue: 100 },
          { region: 'South', revenue: 200 },
          { region: 'East', revenue: 150 },
          { region: 'West', revenue: 50 },
        ],
      );
      const result = await handler({
        specId,
        filter: [{ field: 'revenue', op: 'gt', values: [100] }],
      });

      const parsed = parseResult(result);
      expect(parsed.changes.some((c: string) => c.includes('Filtered revenue'))).toBe(true);

      const stored = specStore.get(parsed.specId);
      const data = (stored!.spec as VisualizationSpec).data;
      expect(data).toHaveLength(2); // South (200) and East (150)
      expect(data.every((d: any) => d.revenue > 100)).toBe(true);
    });

    it('filter: [] restores original data', async () => {
      const originalData = [
        { region: 'North', revenue: 100 },
        { region: 'South', revenue: 200 },
        { region: 'East', revenue: 150 },
        { region: 'West', revenue: 50 },
      ];
      // Save with original data, then pre-filter
      const spec = makeSpec('bar', { data: originalData.slice(0, 2) }); // only 2 rows
      const specId = specStore.save(spec, [], new Map(), originalData);

      const result = await handler({ specId, filter: [] });

      const parsed = parseResult(result);
      expect(parsed.changes).toContain('Cleared all filters');

      const stored = specStore.get(parsed.specId);
      expect((stored!.spec as VisualizationSpec).data).toHaveLength(4);
    });

    it('filter that removes all rows returns note and leaves data unchanged', async () => {
      const originalData = [
        { region: 'North', revenue: 100 },
        { region: 'South', revenue: 200 },
        { region: 'East', revenue: 150 },
        { region: 'West', revenue: 50 },
      ];
      const specId = specStore.save(makeSpec('bar'), [], new Map(), originalData);

      const result = await handler({
        specId,
        filter: [{ field: 'region', op: 'in', values: ['Atlantis'] }],
      });

      const parsed = parseResult(result);
      expect(parsed.notes).toBeDefined();
      expect(parsed.notes.some((n: string) => n.includes('removed all rows'))).toBe(true);

      // Data should be restored to original
      const stored = specStore.get(parsed.specId);
      expect((stored!.spec as VisualizationSpec).data).toHaveLength(4);
    });

    // ── Flip ──

    it('flip axes on bar chart', async () => {
      const specId = specStore.save(makeSpec('bar'), []);
      const result = await handler({ specId, flip: true });

      const parsed = parseResult(result);
      expect(parsed.changes).toContain('Flipped axes');

      const stored = specStore.get(parsed.specId);
      const spec = stored!.spec as VisualizationSpec;
      // x and y should be swapped
      expect(spec.encoding.x?.field).toBe('revenue');
      expect(spec.encoding.y?.field).toBe('region');
    });

    it('flip on non-flippable pattern returns note', async () => {
      const specId = specStore.save(makeSpec('radar'), []);
      const result = await handler({ specId, flip: true });

      const parsed = parseResult(result);
      expect(parsed.notes).toBeDefined();
      expect(parsed.notes.some((n: string) => n.includes('Flip ignored'))).toBe(true);
      expect(parsed.changes.some((c: string) => c.includes('Flipped'))).toBe(false);
    });

    // ── Title / subtitle / labels ──

    it('title change', async () => {
      const specId = specStore.save(makeSpec('bar'), []);
      const result = await handler({ specId, title: 'Revenue Overview' });

      const parsed = parseResult(result);
      expect(parsed.changes).toContain('Title: "Revenue Overview"');

      const stored = specStore.get(parsed.specId);
      expect((stored!.spec as VisualizationSpec).title).toBe('Revenue Overview');
    });

    it('subtitle change', async () => {
      const specId = specStore.save(makeSpec('bar'), []);
      const result = await handler({ specId, subtitle: 'Q1 2024' });

      const parsed = parseResult(result);
      expect(parsed.changes).toContain('Subtitle: "Q1 2024"');

      const stored = specStore.get(parsed.specId);
      expect((stored!.spec as VisualizationSpec).config.subtitle).toBe('Q1 2024');
    });

    it('xLabel and yLabel', async () => {
      const specId = specStore.save(makeSpec('bar'), []);
      const result = await handler({ specId, xLabel: 'Region Name', yLabel: 'Revenue ($)' });

      const parsed = parseResult(result);
      expect(parsed.changes).toContain('X-axis label: "Region Name"');
      expect(parsed.changes).toContain('Y-axis label: "Revenue ($)"');

      const stored = specStore.get(parsed.specId);
      const spec = stored!.spec as VisualizationSpec;
      expect(spec.encoding.x?.title).toBe('Region Name');
      expect(spec.encoding.y?.title).toBe('Revenue ($)');
    });

    // ── Palette ──

    it('warm palette', async () => {
      const specId = specStore.save(makeSpec('bar'), []);
      const result = await handler({ specId, palette: 'warm' });

      const parsed = parseResult(result);
      expect(parsed.changes).toContain('Applied warm palette');

      const stored = specStore.get(parsed.specId);
      const spec = stored!.spec as VisualizationSpec;
      expect(spec.encoding.color?.palette).toBe('warm');
    });

    it('blue palette', async () => {
      const specId = specStore.save(makeSpec('bar'), []);
      const result = await handler({ specId, palette: 'blue' });

      const parsed = parseResult(result);
      expect(parsed.changes).toContain('Applied blue palette');

      const stored = specStore.get(parsed.specId);
      const spec = stored!.spec as VisualizationSpec;
      expect(spec.encoding.color?.palette).toBe('blue');
    });

    it('categorical palette', async () => {
      const specId = specStore.save(makeSpec('bar'), []);
      const result = await handler({ specId, palette: 'categorical' });

      const parsed = parseResult(result);
      expect(parsed.changes).toContain('Applied categorical palette');

      const stored = specStore.get(parsed.specId);
      const spec = stored!.spec as VisualizationSpec;
      expect(spec.encoding.color?.palette).toBe('categorical');
    });

    // ── Highlight ──

    it('highlight with color field - valid values', async () => {
      const spec = makeSpec('bar', {
        encoding: {
          x: { field: 'region', type: 'nominal' as const },
          y: { field: 'revenue', type: 'quantitative' as const },
          color: { field: 'region', type: 'nominal' as const },
        },
      });
      const specId = specStore.save(spec, []);
      const result = await handler({ specId, highlight: { values: ['North', 'South'] } });

      const parsed = parseResult(result);
      expect(parsed.changes).toContain('Highlighted: North, South');

      const stored = specStore.get(parsed.specId);
      const refined = stored!.spec as VisualizationSpec;
      expect(refined.encoding.color?.highlight?.values).toEqual(['North', 'South']);
    });

    it('highlight with color field - no matching values returns note', async () => {
      const spec = makeSpec('bar', {
        encoding: {
          x: { field: 'region', type: 'nominal' as const },
          y: { field: 'revenue', type: 'quantitative' as const },
          color: { field: 'region', type: 'nominal' as const },
        },
      });
      const specId = specStore.save(spec, []);
      const result = await handler({ specId, highlight: { values: ['Mars', 'Jupiter'] } });

      const parsed = parseResult(result);
      // No highlight change was applied
      expect(parsed.changes.some((c: string) => c.includes('Highlighted'))).toBe(false);
      // But a note about unmatched values should appear
      expect(parsed.notes).toBeDefined();
      expect(parsed.notes.some((n: string) => n.includes('not found'))).toBe(true);
    });

    it('highlight without color field sets values directly', async () => {
      const spec = makeSpec('bar');
      const specId = specStore.save(spec, []);
      const result = await handler({ specId, highlight: { values: ['North', 'South'] } });

      const parsed = parseResult(result);
      expect(parsed.changes).toContain('Highlighted: North, South');

      const stored = specStore.get(parsed.specId);
      const refined = stored!.spec as VisualizationSpec;
      expect(refined.encoding.color?.highlight?.values).toEqual(['North', 'South']);
    });

    it('highlight with mutedOpacity', async () => {
      const spec = makeSpec('bar');
      const specId = specStore.save(spec, []);
      const result = await handler({
        specId,
        highlight: { values: ['North', 'South'], mutedOpacity: 0.3 },
      });

      const parsed = parseResult(result);
      expect(parsed.changes).toContain('Highlighted: North, South');

      const stored = specStore.get(parsed.specId);
      const refined = stored!.spec as VisualizationSpec;
      expect(refined.encoding.color?.highlight?.values).toEqual(['North', 'South']);
      expect(refined.encoding.color?.highlight?.mutedOpacity).toBe(0.3);
    });

    it('highlight: null clears existing highlight', async () => {
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
      const result = await handler({ specId, highlight: null });

      const parsed = parseResult(result);
      expect(parsed.changes).toContain('Cleared highlight');

      const stored = specStore.get(parsed.specId);
      const refined = stored!.spec as VisualizationSpec;
      expect(refined.encoding.color?.highlight).toBeUndefined();
    });

    it('highlight with wrong casing matches case-insensitively', async () => {
      const spec = makeSpec('bar', {
        encoding: {
          x: { field: 'region', type: 'nominal' as const },
          y: { field: 'revenue', type: 'quantitative' as const },
          color: { field: 'region', type: 'nominal' as const },
        },
      });
      const specId = specStore.save(spec, []);
      const result = await handler({ specId, highlight: { values: ['north', 'SOUTH'] } });

      const parsed = parseResult(result);
      expect(parsed.changes).toContain('Highlighted: North, South');

      const stored = specStore.get(parsed.specId);
      const refined = stored!.spec as VisualizationSpec;
      // Should match the canonical casing from the data
      expect(refined.encoding.color?.highlight?.values).toEqual(['North', 'South']);
    });

    // ── Color field ──

    it('colorField sets encoding.color.field', async () => {
      const specId = specStore.save(makeSpec('bar'), []);
      const result = await handler({ specId, colorField: 'region' });

      const parsed = parseResult(result);
      expect(parsed.changes).toContain("Set color field to 'region'");

      const stored = specStore.get(parsed.specId);
      const spec = stored!.spec as VisualizationSpec;
      expect(spec.encoding.color?.field).toBe('region');
      expect(spec.encoding.color?.type).toBe('nominal');
    });

    // ── Flow colorBy ──

    it('flowColorBy on sankey chart', async () => {
      const specId = specStore.save(makeSpec('sankey'), []);
      const result = await handler({ specId, flowColorBy: 'source' });

      const parsed = parseResult(result);
      expect(parsed.changes).toContain("Set flow colorBy to 'source'");

      const stored = specStore.get(parsed.specId);
      expect((stored!.spec as VisualizationSpec).config.colorBy).toBe('source');
    });

    it('flowColorBy on non-flow pattern returns note', async () => {
      const specId = specStore.save(makeSpec('bar'), []);
      const result = await handler({ specId, flowColorBy: 'source' });

      const parsed = parseResult(result);
      expect(parsed.notes).toBeDefined();
      expect(parsed.notes.some((n: string) => n.includes('flowColorBy ignored'))).toBe(true);
      expect(parsed.changes.some((c: string) => c.includes('colorBy'))).toBe(false);
    });

    // ── Format ──

    it('percent format', async () => {
      const specId = specStore.save(makeSpec('bar'), []);
      const result = await handler({ specId, format: 'percent' });

      const parsed = parseResult(result);
      expect(parsed.changes).toContain('Applied percent format');

      const stored = specStore.get(parsed.specId);
      const spec = stored!.spec as VisualizationSpec;
      expect(spec.encoding.y?.format).toBe('.1%');
    });

    it('dollar format', async () => {
      const specId = specStore.save(makeSpec('bar'), []);
      const result = await handler({ specId, format: 'dollar' });

      const parsed = parseResult(result);
      expect(parsed.changes).toContain('Applied dollar format');

      const stored = specStore.get(parsed.specId);
      const spec = stored!.spec as VisualizationSpec;
      expect(spec.encoding.y?.format).toBe('$,.0f');
    });

    // ── Switch pattern ──

    it('switchPattern to alternative in store (fast path)', async () => {
      const alts = new Map<string, VisualizationSpec>();
      alts.set('lollipop', makeSpec('lollipop'));
      const specId = specStore.save(makeSpec('bar'), [], alts);

      const result = await handler({ specId, switchPattern: 'lollipop' });

      const parsed = parseResult(result);
      expect(parsed.specId).toMatch(/^spec-/);
      expect(parsed.changes).toContain('Switched to lollipop');

      const stored = specStore.get(parsed.specId);
      expect((stored!.spec as VisualizationSpec).pattern).toBe('lollipop');
    });

    it('switchPattern to unknown pattern generates via forcePattern', async () => {
      const specId = specStore.save(makeSpec('bar'), []);

      const result = await handler({ specId, switchPattern: 'scatter' });

      const parsed = parseResult(result);
      expect(parsed.specId).toMatch(/^spec-/);
      // selectPattern with forcePattern should succeed for scatter
      expect(parsed.changes).toContain('Switched to scatter');
    });

    // ── No-op / no params ──

    it('no params except specId returns unchanged spec with empty changes', async () => {
      const specId = specStore.save(makeSpec('bar'), []);
      const result = await handler({ specId });

      const parsed = parseResult(result);
      expect(parsed.specId).toMatch(/^spec-/);
      expect(parsed.changes).toEqual([]);
      // notes should not be present when empty
      expect(parsed.notes).toBeUndefined();
    });

    // ── Chained refine ──

    it('chained refine uses new specId', async () => {
      const specId = specStore.save(makeSpec('bar'), []);

      const result1 = await handler({ specId, sort: { direction: 'desc' } });
      const parsed1 = parseResult(result1);
      const newSpecId = parsed1.specId;

      const result2 = await handler({ specId: newSpecId, palette: 'warm' });
      const parsed2 = parseResult(result2);
      expect(parsed2.changes).toContain('Applied warm palette');
      expect(parsed2.specId).not.toBe(newSpecId);
    });

    // ── Combined params ──

    it('sort + palette + limit in one call applies all', async () => {
      const specId = specStore.save(makeSpec('bar'), []);
      const result = await handler({
        specId,
        sort: { direction: 'desc' },
        palette: 'warm',
        limit: 2,
      });

      const parsed = parseResult(result);
      expect(parsed.changes).toContain('Sorted by value desc');
      expect(parsed.changes).toContain('Applied warm palette');
      expect(parsed.changes).toContain('Limited to top 2 rows');

      const stored = specStore.get(parsed.specId);
      const spec = stored!.spec as VisualizationSpec;
      expect(spec.config.sortBy).toBe('value');
      expect(spec.config.sortOrder).toBe('descending');
      expect(spec.encoding.color?.palette).toBe('warm');
      expect(spec.data).toHaveLength(2);
    });

    // ── Response structure ──

    it('response includes alternatives list', async () => {
      const alts = new Map<string, VisualizationSpec>();
      alts.set('lollipop', makeSpec('lollipop'));
      alts.set('scatter', makeSpec('scatter'));
      const specId = specStore.save(makeSpec('bar'), [], alts);

      const result = await handler({ specId, palette: 'blue' });

      const parsed = parseResult(result);
      expect(parsed.alternatives).toBeDefined();
      expect(parsed.alternatives).toContain('lollipop');
      expect(parsed.alternatives).toContain('scatter');
    });
  });

  // ── Compound spec refinements ──────────────────────────────────────────────

  describe('compound refinements', () => {
    it('removeTable unwraps to atomic spec', async () => {
      const specId = specStore.save(makeCompoundSpec(), []);
      const result = await handler({ specId, removeTable: true });

      const parsed = parseResult(result);
      expect(parsed.changes).toContain('Removed table, returned atomic chart');

      // The stored spec should now be an atomic VisualizationSpec (not compound)
      const stored = specStore.get(parsed.specId);
      const spec = stored!.spec as VisualizationSpec;
      expect(spec).not.toHaveProperty('compound');
      expect(spec.pattern).toBe('bar');
      expect(spec.data).toHaveLength(3);
    });

    it('layout: columns changes layout type', async () => {
      const specId = specStore.save(makeCompoundSpec(), []);
      const result = await handler({ specId, layout: 'columns' });

      const parsed = parseResult(result);
      expect(parsed.changes).toContain('Layout: columns');

      const stored = specStore.get(parsed.specId);
      const spec = stored!.spec as CompoundVisualizationSpec;
      expect(spec.layout.type).toBe('columns');
    });

    it('layout: rows changes layout type', async () => {
      const compound = makeCompoundSpec({ layout: { type: 'columns' } });
      const specId = specStore.save(compound, []);
      const result = await handler({ specId, layout: 'rows' });

      const parsed = parseResult(result);
      expect(parsed.changes).toContain('Layout: rows');

      const stored = specStore.get(parsed.specId);
      const spec = stored!.spec as CompoundVisualizationSpec;
      expect(spec.layout.type).toBe('rows');
    });

    it('hideColumns removes column from table', async () => {
      const specId = specStore.save(makeCompoundSpec(), []);
      const result = await handler({ specId, hideColumns: ['revenue'] });

      const parsed = parseResult(result);
      expect(parsed.changes).toContain('Hidden columns: revenue');

      const stored = specStore.get(parsed.specId);
      const spec = stored!.spec as CompoundVisualizationSpec;
      const tableView = spec.views.find(v => v.type === 'table');
      expect(tableView?.table?.columns).toHaveLength(1);
      expect(tableView?.table?.columns![0].field).toBe('region');
    });

    it('title change on compound updates both spec and chart view', async () => {
      const specId = specStore.save(makeCompoundSpec(), []);
      const result = await handler({ specId, title: 'Sales Dashboard' });

      const parsed = parseResult(result);
      expect(parsed.changes).toContain('Title: "Sales Dashboard"');

      const stored = specStore.get(parsed.specId);
      const spec = stored!.spec as CompoundVisualizationSpec;
      expect(spec.title).toBe('Sales Dashboard');
      // Chart view title should also be updated
      const chartView = spec.views.find(v => v.type === 'chart');
      expect(chartView?.chart?.title).toBe('Sales Dashboard');
    });

    it('sort param applies to chart sub-spec', async () => {
      const specId = specStore.save(makeCompoundSpec(), []);
      const result = await handler({ specId, sort: { direction: 'desc' } });

      const parsed = parseResult(result);
      expect(parsed.changes).toContain('Sorted by value desc');

      const stored = specStore.get(parsed.specId);
      const spec = stored!.spec as CompoundVisualizationSpec;
      const chartView = spec.views.find(v => v.type === 'chart');
      expect(chartView?.chart?.config.sortBy).toBe('value');
      expect(chartView?.chart?.config.sortOrder).toBe('descending');
    });

    it('palette on compound applies to chart sub-spec', async () => {
      const specId = specStore.save(makeCompoundSpec(), []);
      const result = await handler({ specId, palette: 'warm' });

      const parsed = parseResult(result);
      expect(parsed.changes).toContain('Applied warm palette');

      const stored = specStore.get(parsed.specId);
      const spec = stored!.spec as CompoundVisualizationSpec;
      const chartView = spec.views.find(v => v.type === 'chart');
      expect(chartView?.chart?.encoding.color?.palette).toBe('warm');
    });

    it('no params on compound returns empty changes', async () => {
      const specId = specStore.save(makeCompoundSpec(), []);
      const result = await handler({ specId });

      const parsed = parseResult(result);
      expect(parsed.changes).toEqual([]);
      expect(parsed.notes).toBeUndefined();
    });
  });
});
