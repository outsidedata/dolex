import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { handleTransformData } from '../../src/mcp/tools/transform-data.js';
import { SourceManager } from '../../src/connectors/manager.js';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

function parseResponse(result: any) {
  return JSON.parse(result.content[0].text);
}

describe('transform_data MCP tool', () => {
  let sourceManager: SourceManager;
  let tmpDir: string;
  let sourceId: string;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'transform-'));
    const csvPath = path.join(tmpDir, 'data.csv');
    fs.writeFileSync(csvPath, 'name,score,gender\nAlice,80,F\nBob,90,M\nCarol,70,F\nDave,60,M\nEve,85,F');

    sourceManager = new SourceManager();
    const addResult = await sourceManager.add('test', { type: 'csv', path: csvPath });
    sourceId = addResult.entry!.id;
  });

  afterEach(async () => {
    await sourceManager.closeAll();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('single-column mode', () => {
    it('creates working column', async () => {
      const handler = handleTransformData({ sourceManager });
      const result = await handler({
        sourceId,
        table: 'data',
        create: 'doubled',
        expr: 'score * 2',
      } as any);

      expect(result.isError).toBeUndefined();
      const body = parseResponse(result);
      expect(body.created[0].column).toBe('doubled');
      expect(body.created[0].layer).toBe('working');
    });

    it('returns correct response format', async () => {
      const handler = handleTransformData({ sourceManager });
      const result = await handler({
        sourceId,
        table: 'data',
        create: 'doubled',
        expr: 'score * 2',
      } as any);

      const body = parseResponse(result);
      expect(body.created).toHaveLength(1);
      expect(body.created[0].stats).toBeDefined();
      expect(body.created[0].stats.min).toBe(120);
      expect(body.created[0].stats.max).toBe(180);
      expect(body.warnings).toBeDefined();
      expect(body.working_column_count).toBe(1);
      expect(body.derived_column_count).toBe(0);
      expect(body.total_columns).toBeGreaterThan(3);
    });

    it('validates sourceId exists', async () => {
      const handler = handleTransformData({ sourceManager });
      const result = await handler({
        sourceId: 'nonexistent',
        table: 'data',
        create: 'x',
        expr: 'score + 1',
      } as any);

      expect(result.isError).toBe(true);
      expect(parseResponse(result).error).toContain('not found');
    });

    it('validates table exists', async () => {
      const handler = handleTransformData({ sourceManager });
      const result = await handler({
        sourceId,
        table: 'nonexistent',
        create: 'x',
        expr: 'score + 1',
      } as any);

      expect(result.isError).toBe(true);
      expect(parseResponse(result).error).toContain('not found');
    });
  });

  describe('batch mode', () => {
    it('creates multiple columns', async () => {
      const handler = handleTransformData({ sourceManager });
      const result = await handler({
        sourceId,
        table: 'data',
        transforms: [
          { create: 'a', expr: 'score + 1' },
          { create: 'b', expr: 'score + 2' },
        ],
      } as any);

      const body = parseResponse(result);
      expect(body.created).toHaveLength(2);
      expect(body.working_column_count).toBe(2);
    });

    it('all-or-nothing on failure', async () => {
      const handler = handleTransformData({ sourceManager });
      const result = await handler({
        sourceId,
        table: 'data',
        transforms: [
          { create: 'good', expr: 'score + 1' },
          { create: 'bad', expr: 'nonexistent + 1' },
        ],
      } as any);

      expect(result.isError).toBe(true);
    });
  });

  describe('input validation', () => {
    it('rejects invalid column name', async () => {
      const handler = handleTransformData({ sourceManager });
      const result = await handler({
        sourceId,
        table: 'data',
        create: 'bad name',
        expr: 'score + 1',
      } as any);

      expect(result.isError).toBe(true);
      expect(parseResponse(result).error).toContain('spaces');
    });

    it('rejects invalid expression', async () => {
      const handler = handleTransformData({ sourceManager });
      const result = await handler({
        sourceId,
        table: 'data',
        create: 'x',
        expr: '+ +',
      } as any);

      expect(result.isError).toBe(true);
    });

    it('accepts valid filter', async () => {
      const handler = handleTransformData({ sourceManager });
      const result = await handler({
        sourceId,
        table: 'data',
        create: 'f_score',
        expr: 'score * 2',
        filter: [{ field: 'gender', op: '=', value: 'F' }],
      } as any);

      expect(result.isError).toBeUndefined();
      const body = parseResponse(result);
      expect(body.created[0].column).toBe('f_score');
    });

    it('accepts valid partitionBy', async () => {
      const handler = handleTransformData({ sourceManager });
      const result = await handler({
        sourceId,
        table: 'data',
        create: 'z',
        expr: 'zscore(score)',
        partitionBy: 'gender',
      } as any);

      expect(result.isError).toBeUndefined();
    });
  });

  describe('response format', () => {
    it('includes overwritten flag', async () => {
      const handler = handleTransformData({ sourceManager });
      await handler({ sourceId, table: 'data', create: 'x', expr: 'score + 1' } as any);
      const result = await handler({ sourceId, table: 'data', create: 'x', expr: 'score + 10' } as any);

      const body = parseResponse(result);
      expect(body.created[0].overwritten).toBe(true);
    });
  });
});
