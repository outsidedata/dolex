import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { handleTransformData } from '../../src/mcp/tools/transform-data.js';
import { handlePromoteColumns } from '../../src/mcp/tools/promote-columns.js';
import { SourceManager } from '../../src/connectors/manager.js';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

function parseResponse(result: any) {
  return JSON.parse(result.content[0].text);
}

describe('promote_columns MCP tool', () => {
  let sourceManager: SourceManager;
  let tmpDir: string;
  let sourceId: string;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'promote-'));
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

  it('promotes single column', async () => {
    const transform = handleTransformData({ sourceManager });
    await transform({ sourceId, table: 'data', create: 'doubled', expr: 'score * 2' } as any);

    const promote = handlePromoteColumns({ sourceManager });
    const result = await promote({ sourceId, table: 'data', columns: ['doubled'] });

    expect(result.isError).toBeUndefined();
    const body = parseResponse(result);
    expect(body.promoted).toEqual(['doubled']);
    expect(body.working_remaining).toBe(0);
    expect(body.derived_total).toBe(1);
  });

  it('promotes multiple columns', async () => {
    const transform = handleTransformData({ sourceManager });
    await transform({ sourceId, table: 'data', create: 'a', expr: 'score + 1' } as any);
    await transform({ sourceId, table: 'data', create: 'b', expr: 'score + 2' } as any);

    const promote = handlePromoteColumns({ sourceManager });
    const result = await promote({ sourceId, table: 'data', columns: ['a', 'b'] });

    const body = parseResponse(result);
    expect(body.promoted).toEqual(['a', 'b']);
    expect(body.derived_total).toBe(2);
  });

  it('promotes all with ["*"]', async () => {
    const transform = handleTransformData({ sourceManager });
    await transform({ sourceId, table: 'data', create: 'a', expr: 'score + 1' } as any);
    await transform({ sourceId, table: 'data', create: 'b', expr: 'score + 2' } as any);

    const promote = handlePromoteColumns({ sourceManager });
    const result = await promote({ sourceId, table: 'data', columns: ['*'] });

    const body = parseResponse(result);
    expect(body.promoted).toHaveLength(2);
    expect(body.working_remaining).toBe(0);
  });

  it('rejects promoting non-working column', async () => {
    const promote = handlePromoteColumns({ sourceManager });
    const result = await promote({ sourceId, table: 'data', columns: ['score'] });

    expect(result.isError).toBe(true);
    expect(parseResponse(result).error).toContain('not found');
  });

  it('overwrites existing derived on promote', async () => {
    const transform = handleTransformData({ sourceManager });
    await transform({ sourceId, table: 'data', create: 'x', expr: 'score + 1' } as any);

    const promote = handlePromoteColumns({ sourceManager });
    await promote({ sourceId, table: 'data', columns: ['x'] });

    // Create a new working column with same name (shadow)
    await transform({ sourceId, table: 'data', create: 'x', expr: 'score + 100' } as any);

    // Promote again — should overwrite the derived record
    const result = await promote({ sourceId, table: 'data', columns: ['x'] });
    const body = parseResponse(result);
    expect(body.promoted).toEqual(['x']);
    expect(body.overwrote_existing).toEqual(['x']);
  });

  it('working_remaining count correct', async () => {
    const transform = handleTransformData({ sourceManager });
    await transform({ sourceId, table: 'data', create: 'a', expr: 'score + 1' } as any);
    await transform({ sourceId, table: 'data', create: 'b', expr: 'score + 2' } as any);

    const promote = handlePromoteColumns({ sourceManager });
    const result = await promote({ sourceId, table: 'data', columns: ['a'] });

    const body = parseResponse(result);
    expect(body.working_remaining).toBe(1);
  });

  it('manifest written to disk after promote', async () => {
    const transform = handleTransformData({ sourceManager });
    await transform({ sourceId, table: 'data', create: 'doubled', expr: 'score * 2' } as any);

    const promote = handlePromoteColumns({ sourceManager });
    await promote({ sourceId, table: 'data', columns: ['doubled'] });

    // Check that a .dolex.json was created
    const manifestPath = path.join(tmpDir, 'data.dolex.json');
    expect(fs.existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    expect(manifest.tables.data[0].column).toBe('doubled');
  });
});
