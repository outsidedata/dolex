import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { handleTransformData } from '../../src/mcp/tools/transform-data.js';
import { handlePromoteColumns } from '../../src/mcp/tools/promote-columns.js';
import { handleDropColumns } from '../../src/mcp/tools/drop-columns.js';
import { handleListTransforms } from '../../src/mcp/tools/list-transforms.js';
import { SourceManager } from '../../src/connectors/manager.js';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

function parseResponse(result: any) {
  return JSON.parse(result.content[0].text);
}

describe('drop_columns MCP tool', () => {
  let sourceManager: SourceManager;
  let tmpDir: string;
  let sourceId: string;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'drop-'));
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

  it('drops working column', async () => {
    const transform = handleTransformData({ sourceManager });
    await transform({ sourceId, table: 'data', create: 'extra', expr: 'score + 1' } as any);

    const drop = handleDropColumns({ sourceManager });
    const result = await drop({ sourceId, table: 'data', columns: ['extra'] });

    const body = parseResponse(result);
    expect(body.dropped).toEqual(['extra']);
    expect(body.working_remaining).toBe(0);
  });

  it('drops derived column (no dependents)', async () => {
    const transform = handleTransformData({ sourceManager });
    await transform({ sourceId, table: 'data', create: 'extra', expr: 'score + 1' } as any);
    const promote = handlePromoteColumns({ sourceManager });
    await promote({ sourceId, table: 'data', columns: ['extra'] });

    const drop = handleDropColumns({ sourceManager });
    const result = await drop({ sourceId, table: 'data', columns: ['extra'], layer: 'derived' });

    const body = parseResponse(result);
    expect(body.dropped).toEqual(['extra']);
    expect(body.derived_remaining).toBe(0);
  });

  it('rejects derived column with dependents', async () => {
    const transform = handleTransformData({ sourceManager });
    await transform({ sourceId, table: 'data', create: 'a', expr: 'score + 1' } as any);
    await transform({ sourceId, table: 'data', create: 'b', expr: 'a + 1' } as any);
    const promote = handlePromoteColumns({ sourceManager });
    await promote({ sourceId, table: 'data', columns: ['a', 'b'] });

    const drop = handleDropColumns({ sourceManager });
    const result = await drop({ sourceId, table: 'data', columns: ['a'], layer: 'derived' });

    expect(result.isError).toBe(true);
    const body = parseResponse(result);
    expect(body.error).toContain('b');
    expect(body.error).toContain('depend');
  });

  it('drops all working with ["*"] + layer', async () => {
    const transform = handleTransformData({ sourceManager });
    await transform({ sourceId, table: 'data', create: 'a', expr: 'score + 1' } as any);
    await transform({ sourceId, table: 'data', create: 'b', expr: 'score + 2' } as any);

    const drop = handleDropColumns({ sourceManager });
    const result = await drop({ sourceId, table: 'data', columns: ['*'], layer: 'working' });

    const body = parseResponse(result);
    expect(body.dropped).toHaveLength(2);
    expect(body.working_remaining).toBe(0);
  });

  it('rejects source column', async () => {
    const drop = handleDropColumns({ sourceManager });
    const result = await drop({ sourceId, table: 'data', columns: ['score'] });

    expect(result.isError).toBe(true);
    expect(parseResponse(result).error).toContain('source column');
  });

  it('auto-finds layer when not specified', async () => {
    const transform = handleTransformData({ sourceManager });
    await transform({ sourceId, table: 'data', create: 'extra', expr: 'score + 1' } as any);

    const drop = handleDropColumns({ sourceManager });
    const result = await drop({ sourceId, table: 'data', columns: ['extra'] });

    const body = parseResponse(result);
    expect(body.dropped).toEqual(['extra']);
  });

  it('shadow drop restores derived column', async () => {
    const transform = handleTransformData({ sourceManager });
    // Create and promote
    await transform({ sourceId, table: 'data', create: 'extra', expr: 'score + 1' } as any);
    const promote = handlePromoteColumns({ sourceManager });
    await promote({ sourceId, table: 'data', columns: ['extra'] });

    // Shadow the derived
    await transform({ sourceId, table: 'data', create: 'extra', expr: 'score + 100' } as any);

    // Drop the working shadow
    const drop = handleDropColumns({ sourceManager });
    const result = await drop({ sourceId, table: 'data', columns: ['extra'], layer: 'working' });

    const body = parseResponse(result);
    expect(body.dropped).toEqual(['extra']);
    expect(body.restored).toEqual(['extra']);

    // Verify derived values are restored
    const list = handleListTransforms({ sourceManager });
    const listResult = await list({ sourceId, table: 'data' });
    const listBody = parseResponse(listResult);
    expect(listBody.derived_columns[0].expr).toBe('score + 1');
  });

  it('working_remaining count correct', async () => {
    const transform = handleTransformData({ sourceManager });
    await transform({ sourceId, table: 'data', create: 'a', expr: 'score + 1' } as any);
    await transform({ sourceId, table: 'data', create: 'b', expr: 'score + 2' } as any);

    const drop = handleDropColumns({ sourceManager });
    const result = await drop({ sourceId, table: 'data', columns: ['a'] });

    const body = parseResponse(result);
    expect(body.working_remaining).toBe(1);
  });

  it('manifest updated after derived drop', async () => {
    const transform = handleTransformData({ sourceManager });
    await transform({ sourceId, table: 'data', create: 'a', expr: 'score + 1' } as any);
    await transform({ sourceId, table: 'data', create: 'b', expr: 'score + 2' } as any);
    const promote = handlePromoteColumns({ sourceManager });
    await promote({ sourceId, table: 'data', columns: ['a', 'b'] });

    const manifestPath = path.join(tmpDir, 'data.dolex.json');
    expect(fs.existsSync(manifestPath)).toBe(true);
    let manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    expect(manifest.tables.data).toHaveLength(2);

    // Drop one derived column
    const drop = handleDropColumns({ sourceManager });
    await drop({ sourceId, table: 'data', columns: ['a'], layer: 'derived' });

    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    expect(manifest.tables.data).toHaveLength(1);
    expect(manifest.tables.data[0].column).toBe('b');
  });
});
