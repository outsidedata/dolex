// __tests__/analysis/tool-integration.test.ts
import { describe, it, expect } from 'vitest';
import { handleAnalyzeSource, analyzeSourceInputSchema } from '../../src/mcp/tools/analyze.js';

function mockSourceManager(tables: any[]) {
  return {
    getSchema: async (id: string) => ({
      ok: true,
      schema: { tables, foreignKeys: [], source: { id, type: 'csv', name: 'test', config: {} } },
    }),
    connect: async () => ({ ok: true, source: { getSampleRows: async () => [] } }),
  };
}

describe('analyze_source tool', () => {
  it('returns an analysis plan for a sales-like dataset', async () => {
    const sm = mockSourceManager([{
      name: 'sales',
      rowCount: 1000,
      columns: [
        { name: 'date', type: 'date', sampleValues: [], uniqueCount: 365, nullCount: 0, totalCount: 1000 },
        { name: 'region', type: 'categorical', sampleValues: ['North', 'South'], uniqueCount: 5, nullCount: 0, totalCount: 1000 },
        { name: 'revenue', type: 'numeric', sampleValues: [], uniqueCount: 800, nullCount: 0, totalCount: 1000,
          stats: { min: 10, max: 5000, mean: 500, median: 400, stddev: 300, p25: 200, p75: 700 } },
      ],
    }]);

    const handler = handleAnalyzeSource({ sourceManager: sm });
    const result = await handler({ sourceId: 'src-123', table: 'sales' });

    expect(result.isError).toBeUndefined();
    const body = JSON.parse(result.content[0].text);
    expect(body.summary).toBeTruthy();
    expect(body.steps.length).toBeGreaterThanOrEqual(3);
    expect(body.steps[0].query).toBeDefined();
    expect(body.steps[0].suggestedPatterns).toBeDefined();
  });

  it('returns error for nonexistent source', async () => {
    const sm = {
      getSchema: async () => ({ ok: false, error: 'Source not found' }),
      connect: async () => ({ ok: false }),
    };
    const handler = handleAnalyzeSource({ sourceManager: sm });
    const result = await handler({ sourceId: 'bad', table: 'x' });
    expect(result.isError).toBe(true);
  });

  it('validates input schema', () => {
    const valid = analyzeSourceInputSchema.safeParse({ sourceId: 'src-123' });
    expect(valid.success).toBe(true);

    const withTable = analyzeSourceInputSchema.safeParse({ sourceId: 'src-123', table: 'sales', maxSteps: 4 });
    expect(withTable.success).toBe(true);
  });

  it('defaults to first table when table not specified', async () => {
    const sm = mockSourceManager([{
      name: 'orders',
      rowCount: 500,
      columns: [
        { name: 'amount', type: 'numeric', sampleValues: [], uniqueCount: 400, nullCount: 0, totalCount: 500 },
      ],
    }]);

    const handler = handleAnalyzeSource({ sourceManager: sm });
    const result = await handler({ sourceId: 'src-123' });
    const body = JSON.parse(result.content[0].text);
    expect(body.steps.length).toBeGreaterThanOrEqual(1);
  });
});
