import { describe, it, expect } from 'vitest';

describe('visualize (inline data mode)', () => {
  it('schema allows omitting data when resultId is used', async () => {
    const { visualizeInputSchema } = await import('../../src/mcp/tools/visualize.js');

    const parsed = visualizeInputSchema.safeParse({
      intent: 'test',
      resultId: 'qr-12345678',
    });

    expect(parsed.success).toBe(true);
  });

  it('schema requires intent field', async () => {
    const { visualizeInputSchema } = await import('../../src/mcp/tools/visualize.js');

    const parsed = visualizeInputSchema.safeParse({
      data: [{ x: 1 }],
    });

    expect(parsed.success).toBe(false);
  });

  it('schema accepts inline data', async () => {
    const { visualizeInputSchema } = await import('../../src/mcp/tools/visualize.js');

    const parsed = visualizeInputSchema.safeParse({
      data: [{ x: 1, y: 2 }],
      intent: 'test',
    });

    expect(parsed.success).toBe(true);
  });

  it('schema does not accept sourceId', async () => {
    const { visualizeInputSchema } = await import('../../src/mcp/tools/visualize.js');

    const result = visualizeInputSchema.safeParse({
      data: [{ x: 1 }],
      sourceId: 'src-abc123',
      intent: 'test',
    });

    // sourceId is not in the schema, so it should be stripped (Zod strip mode)
    // or if strict, rejected. Either way, the key shouldn't appear in output.
    if (result.success) {
      expect((result.data as any).sourceId).toBeUndefined();
    }
  });

  it('schema accepts pattern parameter', async () => {
    const { visualizeInputSchema } = await import('../../src/mcp/tools/visualize.js');

    const parsed = visualizeInputSchema.safeParse({
      data: [{ region: 'North', sales: 100 }],
      intent: 'compare sales',
      pattern: 'lollipop',
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.pattern).toBe('lollipop');
    }
  });

  it('schema accepts without pattern parameter', async () => {
    const { visualizeInputSchema } = await import('../../src/mcp/tools/visualize.js');

    const parsed = visualizeInputSchema.safeParse({
      data: [{ x: 1, y: 2 }],
      intent: 'test',
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.pattern).toBeUndefined();
    }
  });

  it('schema accepts maxAlternativeChartTypes parameter', async () => {
    const { visualizeInputSchema } = await import('../../src/mcp/tools/visualize.js');

    const parsed = visualizeInputSchema.safeParse({
      data: [{ x: 1, y: 2 }],
      intent: 'test',
      maxAlternativeChartTypes: 0,
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.maxAlternativeChartTypes).toBe(0);
    }
  });

  it('schema accepts includeDataTable parameter', async () => {
    const { visualizeInputSchema } = await import('../../src/mcp/tools/visualize.js');

    const parsed = visualizeInputSchema.safeParse({
      data: [{ x: 1, y: 2 }],
      intent: 'test',
      includeDataTable: false,
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.includeDataTable).toBe(false);
    }
  });

  it('handler returns compact response with specId', async () => {
    const { handleVisualize } = await import('../../src/mcp/tools/visualize.js');

    const handler = handleVisualize((input) => ({
      recommended: {
        pattern: 'bar',
        spec: {
          pattern: 'bar',
          title: 'Test Bar',
          data: input.data,
          encoding: { x: { field: 'x', type: 'nominal' }, y: { field: 'y', type: 'quantitative' } },
          config: {},
        },
        reasoning: 'Bar chart for comparison',
      },
      alternatives: [
        {
          pattern: 'lollipop',
          spec: {
            pattern: 'lollipop',
            title: 'Test Lollipop',
            data: input.data,
            encoding: { x: { field: 'x', type: 'nominal' }, y: { field: 'y', type: 'quantitative' } },
            config: {},
          },
          reasoning: 'Lollipop as alternative',
        },
      ],
    }));

    const result = await handler({
      data: [{ x: 'A', y: 10 }, { x: 'B', y: 20 }],
      intent: 'compare values',
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.specId).toMatch(/^spec-[a-f0-9]{8}$/);
    expect(parsed.recommended.pattern).toBe('bar');
    expect(parsed.recommended.title).toBe('Test Bar');
    expect(parsed.recommended.reasoning).toBeDefined();
    expect(parsed.recommended.spec).toBeUndefined();
    expect(parsed.recommended.data).toBeUndefined();
    expect(parsed.alternatives[0].pattern).toBe('lollipop');
    expect(parsed.alternatives[0].spec).toBeUndefined();
    expect(parsed.dataShape.rowCount).toBe(2);
  });

  it('handler respects maxAlternativeChartTypes: 0', async () => {
    const { handleVisualize } = await import('../../src/mcp/tools/visualize.js');

    const handler = handleVisualize((input) => ({
      recommended: {
        pattern: 'bar',
        spec: {
          pattern: 'bar',
          title: 'Test',
          data: input.data,
          encoding: { x: { field: 'x', type: 'nominal' }, y: { field: 'y', type: 'quantitative' } },
          config: {},
        },
        reasoning: 'Bar',
      },
      alternatives: [
        {
          pattern: 'lollipop',
          spec: { pattern: 'lollipop', title: 'Alt', data: input.data, encoding: {}, config: {} },
          reasoning: 'Alt',
        },
      ],
    }));

    const result = await handler({
      data: [{ x: 'A', y: 10 }],
      intent: 'test',
      maxAlternativeChartTypes: 0,
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.alternatives).toHaveLength(0);
  });
});

describe('visualize_from_source', () => {
  it('schema requires sourceId, table, and query', async () => {
    const { visualizeFromSourceInputSchema } = await import('../../src/mcp/tools/visualize-from-source.js');

    // Missing all required fields
    expect(visualizeFromSourceInputSchema.safeParse({ intent: 'test' }).success).toBe(false);

    // Missing table and query
    expect(visualizeFromSourceInputSchema.safeParse({
      sourceId: 'src-abc',
      intent: 'test',
    }).success).toBe(false);

    // Missing query
    expect(visualizeFromSourceInputSchema.safeParse({
      sourceId: 'src-abc',
      table: 'sales',
      intent: 'test',
    }).success).toBe(false);
  });

  it('schema accepts valid source query', async () => {
    const { visualizeFromSourceInputSchema } = await import('../../src/mcp/tools/visualize-from-source.js');

    const parsed = visualizeFromSourceInputSchema.safeParse({
      sourceId: 'src-abc123',
      table: 'sales',
      query: {
        select: ['region', { field: 'revenue', aggregate: 'sum', as: 'total' }],
        groupBy: ['region'],
      },
      intent: 'compare revenue by region',
    });

    expect(parsed.success).toBe(true);
  });

  it('schema accepts query with join array', async () => {
    const { visualizeFromSourceInputSchema } = await import('../../src/mcp/tools/visualize-from-source.js');

    const parsed = visualizeFromSourceInputSchema.safeParse({
      sourceId: 'src-abc123',
      table: 'order_items',
      query: {
        join: [
          { table: 'products', on: { left: 'product_id', right: 'product_id' } },
        ],
        select: [
          'products.product_category_name',
          { field: 'price', aggregate: 'sum', as: 'revenue' },
        ],
        groupBy: ['products.product_category_name'],
      },
      intent: 'revenue by product category',
    });

    expect(parsed.success).toBe(true);
  });

  it('schema accepts chained joins with type', async () => {
    const { visualizeFromSourceInputSchema } = await import('../../src/mcp/tools/visualize-from-source.js');

    const parsed = visualizeFromSourceInputSchema.safeParse({
      sourceId: 'src-abc123',
      table: 'order_items',
      query: {
        join: [
          { table: 'orders', on: { left: 'order_id', right: 'order_id' }, type: 'inner' },
          { table: 'customers', on: { left: 'orders.customer_id', right: 'customer_id' } },
        ],
        select: ['customers.customer_state'],
      },
      intent: 'test',
    });

    expect(parsed.success).toBe(true);
  });

  it('schema accepts pattern and renamed params', async () => {
    const { visualizeFromSourceInputSchema } = await import('../../src/mcp/tools/visualize-from-source.js');

    const parsed = visualizeFromSourceInputSchema.safeParse({
      sourceId: 'src-abc123',
      table: 'sales',
      query: { select: ['region'] },
      intent: 'test',
      pattern: 'lollipop',
      includeDataTable: false,
      maxAlternativeChartTypes: 0,
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.pattern).toBe('lollipop');
      expect(parsed.data.includeDataTable).toBe(false);
      expect(parsed.data.maxAlternativeChartTypes).toBe(0);
    }
  });

  it('handler returns error when source manager not available', async () => {
    const { handleVisualizeFromSource } = await import('../../src/mcp/tools/visualize-from-source.js');

    const handler = handleVisualizeFromSource(
      () => ({ recommended: { pattern: 'bar', spec: {} as any, reasoning: '' }, alternatives: [] }),
      { sourceManager: null },
    );

    const result = await handler({
      sourceId: 'src-abc',
      table: 'sales',
      query: { select: ['x'] },
      intent: 'test',
    });

    expect((result as any).isError).toBe(true);
    expect(JSON.parse(result.content[0].text).error).toContain('Source manager not available');
  });

  it('handler returns error on query failure', async () => {
    const { handleVisualizeFromSource } = await import('../../src/mcp/tools/visualize-from-source.js');

    const mockSourceManager = {
      queryDsl: async () => ({ ok: false, error: 'Table not found' }),
    };

    const handler = handleVisualizeFromSource(
      () => ({ recommended: { pattern: 'bar', spec: {} as any, reasoning: '' }, alternatives: [] }),
      { sourceManager: mockSourceManager },
    );

    const result = await handler({
      sourceId: 'src-abc',
      table: 'nonexistent',
      query: { select: ['x'] },
      intent: 'test',
    });

    expect((result as any).isError).toBe(true);
    expect(JSON.parse(result.content[0].text).error).toContain('Table not found');
  });

  it('handler returns visualization on successful query', async () => {
    const { handleVisualizeFromSource } = await import('../../src/mcp/tools/visualize-from-source.js');

    const mockSourceManager = {
      queryDsl: async () => ({
        ok: true,
        rows: [{ region: 'North', total: 100 }, { region: 'South', total: 200 }],
        columns: ['region', 'total'],
      }),
    };

    const handler = handleVisualizeFromSource(
      (input) => ({
        recommended: {
          pattern: 'bar',
          spec: {
            pattern: 'bar',
            title: 'Revenue by Region',
            data: input.data,
            encoding: { x: { field: 'region', type: 'nominal' }, y: { field: 'total', type: 'quantitative' } },
            config: {},
          },
          reasoning: 'Bar chart for comparison',
        },
        alternatives: [],
      }),
      { sourceManager: mockSourceManager },
    );

    const result = await handler({
      sourceId: 'src-abc',
      table: 'sales',
      query: {
        select: ['region', { field: 'revenue', aggregate: 'sum', as: 'total' }],
        groupBy: ['region'],
      },
      intent: 'compare revenue by region',
    });

    expect((result as any).isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.specId).toMatch(/^spec-[a-f0-9]{8}$/);
    expect(parsed.recommended.pattern).toBe('bar');
    expect(parsed.dataShape.rowCount).toBe(2);
  });
});
