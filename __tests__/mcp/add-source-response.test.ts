import { describe, it, expect } from 'vitest';
import { handleAddSource, handleDescribeSource } from '../../src/mcp/tools/sources.js';
import { SourceManager } from '../../src/connectors/manager.js';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

describe('load_csv enhanced response', () => {
  it('returns full column profiles with stats, topValues, and sampleRows', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'add-src-'));
    const csvPath = path.join(tmpDir, 'sales.csv');
    const rows = [
      'date,region,revenue',
      '2024-01-01,North,100',
      '2024-02-01,North,200',
      '2024-03-01,South,150',
      '2024-04-01,East,300',
      '2024-05-01,West,250',
    ];
    fs.writeFileSync(csvPath, rows.join('\n'));

    const sourceManager = new SourceManager();
    const handler = handleAddSource({ sourceManager });
    const result = await handler({
      name: 'sales',
      path: csvPath,
      detail: 'full',
    });

    expect(result.isError).toBeUndefined();
    const body = JSON.parse(result.content[0].text);

    expect(body.sourceId).toBeDefined();
    expect(body.name).toBe('sales');
    expect(body.tables).toHaveLength(1);

    const table = body.tables[0];
    expect(table.rowCount).toBe(5);
    expect(table.columns).toBeDefined();
    expect(table.columns.length).toBeGreaterThan(0);
    expect(table.sampleRows).toBeDefined();
    expect(table.sampleRows.length).toBeLessThanOrEqual(5);

    // Numeric column should have stats
    const revenueCol = table.columns.find((c: any) => c.name === 'revenue');
    expect(revenueCol).toBeDefined();
    expect(revenueCol.stats).toBeDefined();
    expect(revenueCol.stats.min).toBe(100);
    expect(revenueCol.stats.max).toBe(300);

    // Categorical column should have topValues
    const regionCol = table.columns.find((c: any) => c.name === 'region');
    expect(regionCol).toBeDefined();
    expect(regionCol.topValues).toBeDefined();
    expect(regionCol.topValues.length).toBeGreaterThan(0);

    await sourceManager.closeAll();
    fs.rmSync(tmpDir, { recursive: true });
  });
});

describe('describe_source', () => {
  it('returns full table profile for a valid source', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'describe-'));
    const csvPath = path.join(tmpDir, 'data.csv');
    fs.writeFileSync(csvPath, 'name,value\nAlice,100\nBob,200\nCarol,150');

    const sourceManager = new SourceManager();
    const addResult = await sourceManager.add('test', { type: 'csv', path: csvPath });

    const handler = handleDescribeSource({ sourceManager });
    const result = await handler({ sourceId: addResult.entry!.id, table: 'data', detail: 'full' });

    const body = JSON.parse(result.content[0].text);
    expect(body.name).toBe('data');
    expect(body.rowCount).toBe(3);
    expect(body.columns).toBeDefined();
    expect(body.sampleRows).toBeDefined();

    await sourceManager.closeAll();
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('returns error for non-existent source', async () => {
    const sourceManager = new SourceManager();
    const handler = handleDescribeSource({ sourceManager });
    const result = await handler({ sourceId: 'nope', table: 'foo', detail: 'full' });

    expect(result.isError).toBe(true);
  });
});
