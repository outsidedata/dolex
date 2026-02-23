import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { TransformMetadata } from '../../src/transforms/metadata.js';

describe('Transform Metadata', () => {
  let db: Database.Database;
  let meta: TransformMetadata;

  beforeEach(() => {
    db = new Database(':memory:');
    meta = new TransformMetadata(db);
    meta.init();
  });

  describe('init', () => {
    it('creates _dolex_transforms table', () => {
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='_dolex_transforms'").all();
      expect(tables.length).toBe(1);
    });

    it('idempotent: calling init twice is safe', () => {
      expect(() => meta.init()).not.toThrow();
    });
  });

  describe('add', () => {
    it('adds a working transform', () => {
      meta.add('data', { column: 'score_z', expr: 'zscore(score)', type: 'numeric', layer: 'working' });
      const record = meta.get('data', 'score_z');
      expect(record).not.toBeNull();
      expect(record!.layer).toBe('working');
    });

    it('adds a derived transform', () => {
      meta.add('data', { column: 'score_z', expr: 'zscore(score)', type: 'numeric', layer: 'derived' });
      const record = meta.get('data', 'score_z');
      expect(record!.layer).toBe('derived');
    });

    it('stores expression correctly', () => {
      meta.add('data', { column: 'x', expr: 'a + b * 2', type: 'numeric', layer: 'working' });
      expect(meta.get('data', 'x')!.expr).toBe('a + b * 2');
    });

    it('stores type correctly', () => {
      meta.add('data', { column: 'x', expr: 'lower(name)', type: 'categorical', layer: 'working' });
      expect(meta.get('data', 'x')!.type).toBe('categorical');
    });

    it('auto-increments order', () => {
      meta.add('data', { column: 'a', expr: 'x + 1', type: 'numeric', layer: 'working' });
      meta.add('data', { column: 'b', expr: 'x + 2', type: 'numeric', layer: 'working' });
      const records = meta.list('data');
      expect(records[0].order).toBe(1);
      expect(records[1].order).toBe(2);
    });
  });

  describe('list', () => {
    beforeEach(() => {
      meta.add('data', { column: 'a', expr: 'x + 1', type: 'numeric', layer: 'working' });
      meta.add('data', { column: 'b', expr: 'x + 2', type: 'numeric', layer: 'derived' });
      meta.add('data', { column: 'c', expr: 'x + 3', type: 'numeric', layer: 'working' });
    });

    it('lists all transforms for a table', () => {
      expect(meta.list('data').length).toBe(3);
    });

    it('filters by layer: working only', () => {
      const working = meta.list('data', 'working');
      expect(working.length).toBe(2);
      expect(working.every(r => r.layer === 'working')).toBe(true);
    });

    it('filters by layer: derived only', () => {
      const derived = meta.list('data', 'derived');
      expect(derived.length).toBe(1);
      expect(derived[0].column).toBe('b');
    });

    it('empty table returns empty array', () => {
      expect(meta.list('nonexistent').length).toBe(0);
    });

    it('returns in order', () => {
      const records = meta.list('data');
      expect(records.map(r => r.column)).toEqual(['a', 'b', 'c']);
    });
  });

  describe('get', () => {
    it('retrieves specific transform', () => {
      meta.add('data', { column: 'x', expr: 'a + 1', type: 'numeric', layer: 'working' });
      const record = meta.get('data', 'x');
      expect(record).not.toBeNull();
      expect(record!.column).toBe('x');
    });

    it('returns null for missing column', () => {
      expect(meta.get('data', 'nonexistent')).toBeNull();
    });
  });

  describe('updateLayer', () => {
    it('changes working to derived', () => {
      meta.add('data', { column: 'x', expr: 'a + 1', type: 'numeric', layer: 'working' });
      meta.updateLayer('data', 'x', 'working', 'derived');
      const record = meta.get('data', 'x');
      expect(record!.layer).toBe('derived');
    });

    it('preserves expression and type', () => {
      meta.add('data', { column: 'x', expr: 'a + 1', type: 'numeric', layer: 'working' });
      meta.updateLayer('data', 'x', 'working', 'derived');
      const record = meta.get('data', 'x');
      expect(record!.expr).toBe('a + 1');
      expect(record!.type).toBe('numeric');
    });
  });

  describe('remove', () => {
    it('removes transform record', () => {
      meta.add('data', { column: 'x', expr: 'a + 1', type: 'numeric', layer: 'working' });
      meta.remove('data', 'x');
      expect(meta.get('data', 'x')).toBeNull();
    });

    it('get returns null after remove', () => {
      meta.add('data', { column: 'x', expr: 'a + 1', type: 'numeric', layer: 'working' });
      meta.remove('data', 'x');
      expect(meta.get('data', 'x')).toBeNull();
    });
  });

  describe('exists / getLayer', () => {
    it('exists returns true for known column', () => {
      meta.add('data', { column: 'x', expr: 'a + 1', type: 'numeric', layer: 'working' });
      expect(meta.exists('data', 'x')).toBe(true);
    });

    it('exists returns false for unknown', () => {
      expect(meta.exists('data', 'nonexistent')).toBe(false);
    });

    it('getLayer returns correct layer', () => {
      meta.add('data', { column: 'x', expr: 'a + 1', type: 'numeric', layer: 'derived' });
      expect(meta.getLayer('data', 'x')).toBe('derived');
    });

    it('getLayer returns null for source column', () => {
      expect(meta.getLayer('data', 'age')).toBeNull();
    });
  });
});
