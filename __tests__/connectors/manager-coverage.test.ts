import { describe, it, expect, beforeEach } from 'vitest';
import { SourceManager } from '../../src/connectors/manager.js';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

const FIXTURES = path.resolve(__dirname, '../fixtures');

describe('SourceManager — coverage gaps', () => {
  let manager: SourceManager;

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
      await manager.add('test', { type: 'csv', path: FIXTURES });
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
      await manager.add('disc-test', { type: 'csv', path: FIXTURES });
      await manager.connect('disc-test');
      expect(manager.isConnected('disc-test')).toBe(true);

      const result = await manager.disconnect('disc-test');
      expect(result.ok).toBe(true);
      expect(manager.isConnected('disc-test')).toBe(false);
    });

    it('returns ok when source is not connected', async () => {
      await manager.add('not-connected', { type: 'csv', path: FIXTURES });
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
      await manager.add('ic-test', { type: 'csv', path: FIXTURES });
      expect(manager.isConnected('ic-test')).toBe(false);

      await manager.connect('ic-test');
      expect(manager.isConnected('ic-test')).toBe(true);

      await manager.closeAll();
    });
  });

  describe('query()', () => {
    it('executes SQL against a connected source', async () => {
      await manager.add('q-test', { type: 'csv', path: FIXTURES });
      const result = await manager.query('q-test', 'SELECT * FROM sales LIMIT 2');
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
      await manager.add('bad-sql', { type: 'csv', path: FIXTURES });
      const result = await manager.query('bad-sql', 'NOT VALID SQL AT ALL !!!');
      expect(result.ok).toBe(false);

      await manager.closeAll();
    });
  });

  describe('remove() with active connection', () => {
    it('closes connection and removes entry', async () => {
      await manager.add('rm-conn', { type: 'csv', path: FIXTURES });
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
      await manager.add('d1', { type: 'csv', path: FIXTURES });
      await manager.add('d2', { type: 'csv', path: FIXTURES });
      await manager.connect('d1');

      expect(manager.list()).toHaveLength(2);
      await manager.destroy();
      expect(manager.list()).toHaveLength(0);
    });
  });

  describe('closeAll()', () => {
    it('closes all connections but keeps registry', async () => {
      await manager.add('ca1', { type: 'csv', path: FIXTURES });
      await manager.connect('ca1');
      expect(manager.isConnected('ca1')).toBe(true);

      await manager.closeAll();
      expect(manager.isConnected('ca1')).toBe(false);
      expect(manager.list()).toHaveLength(1);
    });
  });

  describe('getAllSchemas()', () => {
    it('returns schemas for all sources', async () => {
      await manager.add('as1', { type: 'csv', path: FIXTURES });
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

  describe('querySql()', () => {
    it('executes SQL query against a connected source', async () => {
      await manager.add('sql-test', { type: 'csv', path: FIXTURES });
      const result = await manager.querySql('sql-test', 'SELECT * FROM sales LIMIT 2');
      expect(result.ok).toBe(true);
      expect(result.rows).toBeDefined();
      expect(result.rows!.length).toBe(2);
      await manager.closeAll();
    });

    it('returns error for non-existent source', async () => {
      const result = await manager.querySql('ghost', 'SELECT 1');
      expect(result.ok).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('rejects non-SELECT queries', async () => {
      await manager.add('sql-safety', { type: 'csv', path: FIXTURES });
      const result = await manager.querySql('sql-safety', 'DROP TABLE sales');
      expect(result.ok).toBe(false);
      expect(result.error).toContain('SELECT');
      await manager.closeAll();
    });

    it('computes custom aggregates (median, stddev, p25, p75)', async () => {
      await manager.add('sql-agg', { type: 'csv', path: FIXTURES });
      const result = await manager.querySql('sql-agg',
        'SELECT category, MEDIAN(price) AS median_price, STDDEV(price) AS price_sd, P25(price) AS p25, P75(price) AS p75 FROM sales GROUP BY category'
      );
      expect(result.ok).toBe(true);
      expect(result.rows!.length).toBeGreaterThan(0);
      for (const row of result.rows!) {
        expect(row).toHaveProperty('category');
        expect(row).toHaveProperty('median_price');
        expect(typeof row.median_price).toBe('number');
      }
      await manager.closeAll();
    });

    it('wraps query with LIMIT to prevent huge results', async () => {
      await manager.add('sql-limit', { type: 'csv', path: FIXTURES });
      const result = await manager.querySql('sql-limit', 'SELECT * FROM sales', 2);
      expect(result.ok).toBe(true);
      expect(result.rows!.length).toBeLessThanOrEqual(2);
      await manager.closeAll();
    });
  });

  describe('persistence', () => {
    it('persists and loads registry from file', async () => {
      const tmpFile = path.join(os.tmpdir(), `sm-persist-${Date.now()}.json`);

      const m1 = new SourceManager(tmpFile);
      await m1.add('persist-test', { type: 'csv', path: FIXTURES });
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
      await manager.add('my-source', { type: 'csv', path: FIXTURES });
      const entry = manager.get('my-source');
      expect(entry).toBeDefined();
      expect(entry!.name).toBe('my-source');
    });
  });
});
