import { describe, it, expect } from 'vitest';
import { handleAddSource, handleDescribeSource } from '../../src/mcp/tools/sources.js';
import { SourceManager } from '../../src/connectors/manager.js';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

describe('load_csv smart summary response', () => {
  it('returns smart summary with column names, types, and ranges', async () => {
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
    });

    expect(result.isError).toBeUndefined();
    const body = JSON.parse(result.content[0].text);

    // New format: sourceId + summary (string) + message
    expect(body.sourceId).toBeDefined();
    expect(typeof body.summary).toBe('string');
    expect(body.message).toContain('Loaded');
    expect(body.message).toContain('1 table');

    // Summary should contain table info
    expect(body.summary).toContain('sales:'); // table name
    expect(body.summary).toContain('5 rows'); // row count

    // Summary should contain column names
    expect(body.summary).toContain('date');
    expect(body.summary).toContain('region');
    expect(body.summary).toContain('revenue');

    // Summary should contain numeric range for revenue
    expect(body.summary).toContain('100'); // min
    expect(body.summary).toContain('300'); // max

    // Summary should contain categorical values for region
    expect(body.summary).toContain('North');
    expect(body.summary).toContain('South');

    // Should NOT have the old tables array
    expect(body.tables).toBeUndefined();

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
