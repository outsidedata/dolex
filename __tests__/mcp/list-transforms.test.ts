import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { handleTransformData } from '../../src/mcp/tools/transform-data.js';
import { handlePromoteColumns } from '../../src/mcp/tools/promote-columns.js';
import { handleListTransforms } from '../../src/mcp/tools/list-transforms.js';
import { SourceManager } from '../../src/connectors/manager.js';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

function parseResponse(result: any) {
  return JSON.parse(result.content[0].text);
}

describe('list_transforms MCP tool', () => {
  let sourceManager: SourceManager;
  let tmpDir: string;
  let sourceId: string;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'list-'));
    const csvPath = path.join(tmpDir, 'data.csv');
    fs.writeFileSync(csvPath, 'name,score\nAlice,80\nBob,90\nCarol,70');

    sourceManager = new SourceManager();
    const addResult = await sourceManager.add('test', { type: 'csv', path: csvPath });
    sourceId = addResult.entry!.id;
  });

  afterEach(async () => {
    await sourceManager.closeAll();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns source columns', async () => {
    const handler = handleListTransforms({ sourceManager });
    const result = await handler({ sourceId, table: 'data' });

    const body = parseResponse(result);
    expect(body.source_columns).toContain('name');
    expect(body.source_columns).toContain('score');
  });

  it('returns derived columns with info', async () => {
    const transform = handleTransformData({ sourceManager });
    await transform({ sourceId, table: 'data', create: 'doubled', expr: 'score * 2' } as any);

    const promote = handlePromoteColumns({ sourceManager });
    await promote({ sourceId, table: 'data', columns: ['doubled'] });

    const handler = handleListTransforms({ sourceManager });
    const result = await handler({ sourceId, table: 'data' });

    const body = parseResponse(result);
    expect(body.derived_columns).toHaveLength(1);
    expect(body.derived_columns[0].column).toBe('doubled');
    expect(body.derived_columns[0].expr).toBe('score * 2');
    expect(body.derived_columns[0].type).toBe('numeric');
  });

  it('returns working columns with info', async () => {
    const transform = handleTransformData({ sourceManager });
    await transform({ sourceId, table: 'data', create: 'extra', expr: 'score + 1' } as any);

    const handler = handleListTransforms({ sourceManager });
    const result = await handler({ sourceId, table: 'data' });

    const body = parseResponse(result);
    expect(body.working_columns).toHaveLength(1);
    expect(body.working_columns[0].column).toBe('extra');
    expect(body.working_columns[0].expr).toBe('score + 1');
  });

  it('returns total column count', async () => {
    const handler = handleListTransforms({ sourceManager });
    const result = await handler({ sourceId, table: 'data' });

    const body = parseResponse(result);
    expect(body.total_columns).toBe(2); // name + score
  });

  it('empty table (no transforms) returns only source', async () => {
    const handler = handleListTransforms({ sourceManager });
    const result = await handler({ sourceId, table: 'data' });

    const body = parseResponse(result);
    expect(body.source_columns).toHaveLength(2);
    expect(body.derived_columns).toHaveLength(0);
    expect(body.working_columns).toHaveLength(0);
  });

  it('validates sourceId', async () => {
    const handler = handleListTransforms({ sourceManager });
    const result = await handler({ sourceId: 'nonexistent', table: 'data' });

    expect(result.isError).toBe(true);
  });

  it('validates table name', async () => {
    const handler = handleListTransforms({ sourceManager });
    const result = await handler({ sourceId, table: 'nonexistent' });

    expect(result.isError).toBe(true);
  });
});
