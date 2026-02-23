import { describe, it, expect } from 'vitest';
import { handleAddSource, handleDescribeSource } from '../../src/mcp/tools/sources.js';
import { handleQuerySource } from '../../src/mcp/tools/query-source.js';
import { saveResult, getResult, clearResultCache, resultCacheSize } from '../../src/mcp/tools/result-cache.js';
import { SourceManager } from '../../src/connectors/manager.js';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('compact schema mode', () => {
  it('load_csv with detail=compact returns minimal columns', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'compact-'));
    const csvPath = path.join(tmpDir, 'data.csv');
    fs.writeFileSync(csvPath, 'name,value\nAlice,100\nBob,200\nCarol,150');

    const sourceManager = new SourceManager();
    const handler = handleAddSource({ sourceManager });
    const result = await handler({
      name: 'compact-test',
      path: csvPath,
      detail: 'compact',
    });

    const body = JSON.parse(result.content[0].text);
    const table = body.tables[0];

    expect(table.rowCount).toBe(3);
    expect(table.columns).toHaveLength(2);
    expect(table.columns[0]).toEqual({ name: 'name', type: expect.any(String) });
    expect(table.columns[1]).toEqual({ name: 'value', type: expect.any(String) });
    expect(table.sampleRows).toBeUndefined();
    expect(table.columns[0].stats).toBeUndefined();
    expect(table.columns[0].topValues).toBeUndefined();
    expect(table.columns[0].sample).toBeUndefined();

    await sourceManager.closeAll();
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('describe_source with detail=compact returns minimal columns', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'compact-desc-'));
    const csvPath = path.join(tmpDir, 'data.csv');
    fs.writeFileSync(csvPath, 'city,pop\nNYC,8000000\nLA,4000000');

    const sourceManager = new SourceManager();
    const addResult = await sourceManager.add('desc-test', { type: 'csv', path: csvPath });

    const handler = handleDescribeSource({ sourceManager });
    const result = await handler({
      sourceId: addResult.entry!.id,
      table: 'data',
      detail: 'compact',
    });

    const body = JSON.parse(result.content[0].text);
    expect(body.rowCount).toBe(2);
    expect(body.columns[0]).toEqual({ name: 'city', type: expect.any(String) });
    expect(body.sampleRows).toBeUndefined();

    await sourceManager.closeAll();
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('load_csv with detail=full returns stats and samples', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'full-'));
    const csvPath = path.join(tmpDir, 'data.csv');
    fs.writeFileSync(csvPath, 'name,value\nAlice,100\nBob,200\nCarol,150');

    const sourceManager = new SourceManager();
    const handler = handleAddSource({ sourceManager });
    const result = await handler({
      name: 'full-test',
      path: csvPath,
      detail: 'full',
    });

    const body = JSON.parse(result.content[0].text);
    const table = body.tables[0];
    expect(table.sampleRows).toBeDefined();
    expect(table.columns[0].sample).toBeDefined();

    await sourceManager.closeAll();
    fs.rmSync(tmpDir, { recursive: true });
  });
});

describe('result cache', () => {
  it('save and get round-trip', () => {
    clearResultCache();
    const rows = [{ a: 1 }, { a: 2 }];
    const cols = [{ name: 'a', type: 'integer' }];
    const id = saveResult(rows, cols);

    expect(id).toMatch(/^qr-/);
    const cached = getResult(id);
    expect(cached).not.toBeNull();
    expect(cached!.rows).toEqual(rows);
    expect(cached!.columns).toEqual(cols);
  });

  it('returns null for missing resultId', () => {
    clearResultCache();
    expect(getResult('qr-nonexistent')).toBeNull();
  });

  it('evicts oldest when exceeding max entries', () => {
    clearResultCache();
    const ids: string[] = [];
    for (let i = 0; i < 21; i++) {
      ids.push(saveResult([{ x: i }], [{ name: 'x', type: 'integer' }]));
    }
    expect(getResult(ids[0])).toBeNull();
    expect(getResult(ids[20])).not.toBeNull();
    expect(resultCacheSize()).toBe(20);
  });
});

describe('query_source returns resultId', () => {
  it('includes resultId in response', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qr-'));
    const csvPath = path.join(tmpDir, 'data.csv');
    fs.writeFileSync(csvPath, 'name,value\nA,10\nB,20');

    const sourceManager = new SourceManager();
    await sourceManager.add('qr-test', { type: 'csv', path: csvPath });

    const handler = handleQuerySource({ sourceManager });
    const result = await handler({
      sourceId: 'qr-test',
      sql: 'SELECT name, value FROM data',
    });

    const body = JSON.parse(result.content[0].text);
    expect(body.resultId).toMatch(/^qr-/);
    expect(body.rows).toBeDefined();

    const cached = getResult(body.resultId);
    expect(cached).not.toBeNull();
    expect(cached!.rows).toEqual(body.rows);

    await sourceManager.closeAll();
    fs.rmSync(tmpDir, { recursive: true });
  });
});

describe('refine response trimmed', () => {
  it('does not include spec echo in response', async () => {
    const { handleRefine } = await import('../../src/mcp/tools/refine.js');
    const { specStore } = await import('../../src/mcp/spec-store.js');
    const handler = handleRefine();

    const spec = {
      pattern: 'bar',
      title: 'Test',
      data: [{ x: 'A', y: 1 }, { x: 'B', y: 2 }],
      encoding: {
        x: { field: 'x', type: 'nominal' as const },
        y: { field: 'y', type: 'quantitative' as const },
      },
      config: {},
    };
    const specId = specStore.save(spec, []);

    const result = await handler({ specId, sort: { direction: 'desc' } });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.specId).toBeDefined();
    expect(parsed.changes).toBeDefined();
    expect(parsed.spec).toBeUndefined();
  });
});

describe('load_csv idempotent re-add', () => {
  it('reconnects existing source instead of erroring', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'readd-'));
    const csvPath = path.join(tmpDir, 'data.csv');
    fs.writeFileSync(csvPath, 'a,b\n1,2\n3,4');

    const sourceManager = new SourceManager();
    const handler = handleAddSource({ sourceManager });

    const result1 = await handler({
      name: 'readd-test',
      path: csvPath,
      detail: 'compact',
    });
    const body1 = JSON.parse(result1.content[0].text);
    expect(body1.message).toContain('Loaded');

    const result2 = await handler({
      name: 'readd-test',
      path: csvPath,
      detail: 'compact',
    });
    const body2 = JSON.parse(result2.content[0].text);
    expect(body2.message).toContain('Reconnected');
    expect(body2.sourceId).toBe(body1.sourceId);

    await sourceManager.closeAll();
    fs.rmSync(tmpDir, { recursive: true });
  });
});

describe('source persistence', () => {
  it('SourceManager round-trips sources to disk', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'persist-'));
    const csvPath = path.join(tmpDir, 'data.csv');
    fs.writeFileSync(csvPath, 'x,y\n1,2');
    const persistPath = path.join(tmpDir, 'sources.json');

    const sm1 = new SourceManager(persistPath);
    await sm1.add('persist-test', { type: 'csv', path: csvPath });
    expect(sm1.list()).toHaveLength(1);
    await sm1.closeAll();

    const sm2 = new SourceManager(persistPath);
    const list = sm2.list();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('persist-test');
    await sm2.closeAll();

    fs.rmSync(tmpDir, { recursive: true });
  });
});
