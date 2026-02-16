import { describe, it, expect, beforeEach } from 'vitest';
import { SourceManager } from '../../src/connectors/manager.js';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

describe('SourceManager — coverage gaps', () => {
  let manager: SourceManager;
  const csvPath = path.resolve(__dirname, '../../data/diamonds');

  beforeEach(() => {
    manager = new SourceManager();
  });

  describe('add() edge cases', () => {
    it('returns error for unsupported data source type', async () => {
      const result = await manager.add('bad-type', {
        type: 'unknown' as any,
        path: '/tmp/nope',
      });
      expect(result.ok).toBe(false);
      expect(result.error).toContain('Unsupported');
    });
  });

  describe('connect()', () => {
    it('returns cached connection on second call', async () => {
      await manager.add('test', { type: 'csv', path: csvPath });
      const conn1 = await manager.connect('test');
      expect(conn1.ok).toBe(true);

      const conn2 = await manager.connect('test');
      expect(conn2.ok).toBe(true);
      expect(conn2.source).toBe(conn1.source);

      await manager.closeAll();
    });

    it('returns error for non-existent source', async () => {
      const result = await manager.connect('nonexistent');
      expect(result.ok).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('disconnect()', () => {
    it('disconnects an active connection', async () => {
      await manager.add('disc-test', { type: 'csv', path: csvPath });
      await manager.connect('disc-test');
      expect(manager.isConnected('disc-test')).toBe(true);

      const result = await manager.disconnect('disc-test');
      expect(result.ok).toBe(true);
      expect(manager.isConnected('disc-test')).toBe(false);
    });

    it('returns ok when source is not connected', async () => {
      await manager.add('not-connected', { type: 'csv', path: csvPath });
      const result = await manager.disconnect('not-connected');
      expect(result.ok).toBe(true);
    });

    it('returns error for non-existent source', async () => {
      const result = await manager.disconnect('ghost');
      expect(result.ok).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('isConnected()', () => {
    it('returns false for non-existent source', () => {
      expect(manager.isConnected('nope')).toBe(false);
    });

    it('returns false before connect, true after', async () => {
      await manager.add('ic-test', { type: 'csv', path: csvPath });
      expect(manager.isConnected('ic-test')).toBe(false);

      await manager.connect('ic-test');
      expect(manager.isConnected('ic-test')).toBe(true);

      await manager.closeAll();
    });
  });

  describe('query()', () => {
    it('executes SQL against a connected source', async () => {
      await manager.add('q-test', { type: 'csv', path: csvPath });
      const result = await manager.query('q-test', 'SELECT * FROM diamonds LIMIT 2');
      expect(result.ok).toBe(true);
      expect(result.result).toBeDefined();
      expect(result.result!.rows.length).toBe(2);

      await manager.closeAll();
    });

    it('returns error for non-existent source', async () => {
      const result = await manager.query('ghost', 'SELECT 1');
      expect(result.ok).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('returns error for invalid SQL', async () => {
      await manager.add('bad-sql', { type: 'csv', path: csvPath });
      const result = await manager.query('bad-sql', 'NOT VALID SQL AT ALL !!!');
      expect(result.ok).toBe(false);

      await manager.closeAll();
    });
  });

  describe('remove() with active connection', () => {
    it('closes connection and removes entry', async () => {
      await manager.add('rm-conn', { type: 'csv', path: csvPath });
      await manager.connect('rm-conn');
      expect(manager.isConnected('rm-conn')).toBe(true);

      const result = await manager.remove('rm-conn');
      expect(result.ok).toBe(true);
      expect(manager.list()).toHaveLength(0);
      expect(manager.isConnected('rm-conn')).toBe(false);
    });
  });

  describe('destroy()', () => {
    it('closes all connections and clears registry', async () => {
      await manager.add('d1', { type: 'csv', path: csvPath });
      await manager.add('d2', { type: 'csv', path: csvPath });
      await manager.connect('d1');

      expect(manager.list()).toHaveLength(2);
      await manager.destroy();
      expect(manager.list()).toHaveLength(0);
    });
  });

  describe('closeAll()', () => {
    it('closes all connections but keeps registry', async () => {
      await manager.add('ca1', { type: 'csv', path: csvPath });
      await manager.connect('ca1');
      expect(manager.isConnected('ca1')).toBe(true);

      await manager.closeAll();
      expect(manager.isConnected('ca1')).toBe(false);
      expect(manager.list()).toHaveLength(1);
    });
  });

  describe('getAllSchemas()', () => {
    it('returns schemas for all sources', async () => {
      await manager.add('as1', { type: 'csv', path: csvPath });
      const schemas = await manager.getAllSchemas();
      expect(schemas.length).toBe(1);
      expect(schemas[0].sourceName).toBe('as1');
      expect(schemas[0].schema.tables.length).toBeGreaterThan(0);

      await manager.closeAll();
    });

    it('returns empty array when no sources', async () => {
      const schemas = await manager.getAllSchemas();
      expect(schemas).toEqual([]);
    });
  });

  describe('queryDsl()', () => {
    it('executes a simple DSL query', async () => {
      await manager.add('dsl-test', { type: 'csv', path: csvPath });
      const result = await manager.queryDsl('dsl-test', 'diamonds', {
        select: ['cut', { field: 'price', aggregate: 'avg', as: 'avg_price' }],
        groupBy: ['cut'],
        limit: 5,
      });
      expect(result.ok).toBe(true);
      expect(result.rows).toBeDefined();
      expect(result.rows!.length).toBeGreaterThan(0);

      await manager.closeAll();
    });

    it('returns error for non-existent source', async () => {
      const result = await manager.queryDsl('ghost', 'tbl', { select: ['a'] });
      expect(result.ok).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('returns validation error for non-existent table', async () => {
      await manager.add('dsl-bad-tbl', { type: 'csv', path: csvPath });
      const result = await manager.queryDsl('dsl-bad-tbl', 'nonexistent_table', {
        select: ['a'],
      });
      expect(result.ok).toBe(false);
      expect(result.error).toContain('not found');

      await manager.closeAll();
    });

    it('returns validation error for non-existent field', async () => {
      await manager.add('dsl-bad-field', { type: 'csv', path: csvPath });
      const result = await manager.queryDsl('dsl-bad-field', 'diamonds', {
        select: ['nonexistent_column_xyz'],
      });
      expect(result.ok).toBe(false);

      await manager.closeAll();
    });
  });

  describe('queryDsl — JS aggregation path (median/stddev/percentile)', () => {
    it('computes median via JS aggregation with groupBy', async () => {
      await manager.add('js-agg', { type: 'csv', path: csvPath });
      const result = await manager.queryDsl('js-agg', 'diamonds', {
        select: ['cut', { field: 'price', aggregate: 'median', as: 'median_price' }],
        groupBy: ['cut'],
        limit: 10,
      });
      expect(result.ok).toBe(true);
      expect(result.rows!.length).toBeGreaterThan(0);
      for (const row of result.rows!) {
        expect(row).toHaveProperty('cut');
        expect(row).toHaveProperty('median_price');
        expect(typeof row.median_price).toBe('number');
      }

      await manager.closeAll();
    });

    it('computes stddev via JS aggregation', async () => {
      await manager.add('js-stddev', { type: 'csv', path: csvPath });
      const result = await manager.queryDsl('js-stddev', 'diamonds', {
        select: ['cut', { field: 'price', aggregate: 'stddev', as: 'price_stddev' }],
        groupBy: ['cut'],
      });
      expect(result.ok).toBe(true);
      expect(result.rows!.length).toBeGreaterThan(0);
      for (const row of result.rows!) {
        expect(typeof row.price_stddev).toBe('number');
        expect(row.price_stddev).toBeGreaterThan(0);
      }

      await manager.closeAll();
    });

    it('computes p25 and p75 via JS aggregation', async () => {
      await manager.add('js-pct', { type: 'csv', path: csvPath });
      const result = await manager.queryDsl('js-pct', 'diamonds', {
        select: [
          'cut',
          { field: 'price', aggregate: 'p25', as: 'p25_price' },
          { field: 'price', aggregate: 'p75', as: 'p75_price' },
        ],
        groupBy: ['cut'],
      });
      expect(result.ok).toBe(true);
      for (const row of result.rows!) {
        expect(row.p25_price).toBeLessThanOrEqual(row.p75_price);
      }

      await manager.closeAll();
    });

    it('computes median without groupBy (whole-table aggregate)', async () => {
      await manager.add('js-no-group', { type: 'csv', path: csvPath });
      const result = await manager.queryDsl('js-no-group', 'diamonds', {
        select: [{ field: 'price', aggregate: 'median', as: 'median_price' }],
      });
      expect(result.ok).toBe(true);
      expect(result.rows).toHaveLength(1);
      expect(typeof result.rows![0].median_price).toBe('number');

      await manager.closeAll();
    });

    it('applies orderBy to JS-aggregated results', async () => {
      await manager.add('js-order', { type: 'csv', path: csvPath });
      const result = await manager.queryDsl('js-order', 'diamonds', {
        select: ['cut', { field: 'price', aggregate: 'median', as: 'median_price' }],
        groupBy: ['cut'],
        orderBy: [{ field: 'median_price', direction: 'desc' }],
      });
      expect(result.ok).toBe(true);
      const prices = result.rows!.map(r => r.median_price);
      for (let i = 1; i < prices.length; i++) {
        expect(prices[i]).toBeLessThanOrEqual(prices[i - 1]);
      }

      await manager.closeAll();
    });

    it('applies having filter to JS-aggregated results', async () => {
      await manager.add('js-having', { type: 'csv', path: csvPath });
      const result = await manager.queryDsl('js-having', 'diamonds', {
        select: ['cut', { field: 'price', aggregate: 'median', as: 'median_price' }],
        groupBy: ['cut'],
        having: [{ field: 'median_price', op: '>', value: 3000 }],
      });
      expect(result.ok).toBe(true);
      for (const row of result.rows!) {
        expect(row.median_price).toBeGreaterThan(3000);
      }

      await manager.closeAll();
    });

    it('respects limit on JS-aggregated results', async () => {
      await manager.add('js-limit', { type: 'csv', path: csvPath });
      const result = await manager.queryDsl('js-limit', 'diamonds', {
        select: ['cut', { field: 'price', aggregate: 'median', as: 'median_price' }],
        groupBy: ['cut'],
        limit: 2,
      });
      expect(result.ok).toBe(true);
      expect(result.rows!.length).toBeLessThanOrEqual(2);

      await manager.closeAll();
    });
  });

  describe('persistence', () => {
    it('persists and loads registry from file', async () => {
      const tmpFile = path.join(os.tmpdir(), `sm-persist-${Date.now()}.json`);

      const m1 = new SourceManager(tmpFile);
      await m1.add('persist-test', { type: 'csv', path: csvPath });
      expect(m1.list()).toHaveLength(1);

      // Create a new manager from the same file
      const m2 = new SourceManager(tmpFile);
      expect(m2.list()).toHaveLength(1);
      expect(m2.get('persist-test')).toBeDefined();

      // Clean up
      fs.unlinkSync(tmpFile);
    });
  });

  describe('findEntry by generated ID', () => {
    it('finds entry using name-based generated ID', async () => {
      await manager.add('my-source', { type: 'csv', path: csvPath });
      // Get by the exact name should work
      const entry = manager.get('my-source');
      expect(entry).toBeDefined();
      expect(entry!.name).toBe('my-source');
    });
  });
});
