import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { ColumnManager } from '../../src/transforms/column-manager.js';
import type { DataTable } from '../../src/types.js';

function createTestDb(): { db: Database.Database; table: DataTable } {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE test (
      id INTEGER PRIMARY KEY,
      name TEXT,
      score REAL,
      group_col TEXT
    )
  `);
  const insert = db.prepare('INSERT INTO test (name, score, group_col) VALUES (?, ?, ?)');
  const tx = db.transaction(() => {
    insert.run('Alice', 80, 'A');
    insert.run('Bob', 90, 'B');
    insert.run('Carol', 70, 'A');
    insert.run('Dave', 60, 'B');
    insert.run('Eve', 85, 'A');
  });
  tx();

  const table: DataTable = {
    name: 'test',
    columns: [
      { name: 'id', type: 'id', sampleValues: ['1','2','3'], uniqueCount: 5, nullCount: 0, totalCount: 5 },
      { name: 'name', type: 'categorical', sampleValues: ['Alice','Bob','Carol'], uniqueCount: 5, nullCount: 0, totalCount: 5 },
      { name: 'score', type: 'numeric', sampleValues: ['80','90','70'], uniqueCount: 5, nullCount: 0, totalCount: 5, stats: { min: 60, max: 90, mean: 77, median: 80, stddev: 11.5, p25: 70, p75: 85 } },
      { name: 'group_col', type: 'categorical', sampleValues: ['A','B'], uniqueCount: 2, nullCount: 0, totalCount: 5 },
    ],
    rowCount: 5,
  };

  return { db, table };
}

describe('Column Manager', () => {
  let db: Database.Database;
  let table: DataTable;
  let mgr: ColumnManager;

  beforeEach(() => {
    const setup = createTestDb();
    db = setup.db;
    table = setup.table;
    mgr = new ColumnManager(db);
  });

  describe('addColumn', () => {
    it('adds numeric column with correct values', () => {
      mgr.addColumn('test', 'doubled', [160, 180, 140, 120, 170], 'numeric');
      const rows = db.prepare('SELECT doubled FROM test ORDER BY rowid').all() as any[];
      expect(rows.map(r => r.doubled)).toEqual([160, 180, 140, 120, 170]);
    });

    it('adds categorical column with correct values', () => {
      mgr.addColumn('test', 'grade', ['B+', 'A-', 'C+', 'D', 'B'], 'categorical');
      const rows = db.prepare('SELECT grade FROM test ORDER BY rowid').all() as any[];
      expect(rows.map(r => r.grade)).toEqual(['B+', 'A-', 'C+', 'D', 'B']);
    });

    it('adds boolean column (stored as integer)', () => {
      mgr.addColumn('test', 'passed', [1, 1, 1, 0, 1], 'boolean');
      const rows = db.prepare('SELECT passed FROM test ORDER BY rowid').all() as any[];
      expect(rows.map(r => r.passed)).toEqual([1, 1, 1, 0, 1]);
    });

    it('values accessible via SQL SELECT', () => {
      mgr.addColumn('test', 'doubled', [160, 180, 140, 120, 170], 'numeric');
      const result = db.prepare('SELECT name, doubled FROM test WHERE doubled > 150').all() as any[];
      expect(result.length).toBe(3);
    });

    it('column appears in column names after add', () => {
      mgr.addColumn('test', 'doubled', [160, 180, 140, 120, 170], 'numeric');
      const cols = mgr.getColumnNames('test');
      expect(cols).toContain('doubled');
    });

    it('handles null values correctly', () => {
      mgr.addColumn('test', 'nullable', [1, null, 3, null, 5], 'numeric');
      const rows = db.prepare('SELECT nullable FROM test ORDER BY rowid').all() as any[];
      expect(rows.map(r => r.nullable)).toEqual([1, null, 3, null, 5]);
    });

    it('performance: 10,000 rows in < 2 seconds', () => {
      const bigDb = new Database(':memory:');
      bigDb.exec('CREATE TABLE big (val REAL)');
      const ins = bigDb.prepare('INSERT INTO big (val) VALUES (?)');
      const tx = bigDb.transaction(() => {
        for (let i = 0; i < 10000; i++) ins.run(i);
      });
      tx();

      const bigMgr = new ColumnManager(bigDb);
      const values = Array.from({ length: 10000 }, (_, i) => i * 2);
      const start = Date.now();
      bigMgr.addColumn('big', 'doubled', values, 'numeric');
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(2000);
      bigDb.close();
    });
  });

  describe('overwriteColumn', () => {
    it('overwrites existing column values', () => {
      mgr.addColumn('test', 'extra', [1, 2, 3, 4, 5], 'numeric');
      mgr.overwriteColumn('test', 'extra', [10, 20, 30, 40, 50]);
      const rows = db.prepare('SELECT extra FROM test ORDER BY rowid').all() as any[];
      expect(rows.map(r => r.extra)).toEqual([10, 20, 30, 40, 50]);
    });

    it('new values accessible via SQL', () => {
      mgr.addColumn('test', 'extra', [1, 2, 3, 4, 5], 'numeric');
      mgr.overwriteColumn('test', 'extra', [100, 200, 300, 400, 500]);
      const result = db.prepare('SELECT SUM(extra) as total FROM test').get() as any;
      expect(result.total).toBe(1500);
    });
  });

  describe('dropColumn', () => {
    it('removes column from table', () => {
      mgr.addColumn('test', 'extra', [1, 2, 3, 4, 5], 'numeric');
      mgr.dropColumn('test', 'extra');
      const cols = mgr.getColumnNames('test');
      expect(cols).not.toContain('extra');
    });

    it('remaining columns unaffected', () => {
      mgr.addColumn('test', 'extra', [1, 2, 3, 4, 5], 'numeric');
      mgr.dropColumn('test', 'extra');
      const rows = db.prepare('SELECT name, score FROM test ORDER BY rowid').all() as any[];
      expect(rows[0].name).toBe('Alice');
      expect(rows[0].score).toBe(80);
    });

    it('data in remaining columns preserved', () => {
      mgr.addColumn('test', 'extra', [1, 2, 3, 4, 5], 'numeric');
      mgr.dropColumn('test', 'extra');
      const result = db.prepare('SELECT COUNT(*) as cnt FROM test').get() as any;
      expect(result.cnt).toBe(5);
    });
  });

  describe('schema refresh', () => {
    it('new column appears in refreshed schema', () => {
      mgr.addColumn('test', 'doubled', [160, 180, 140, 120, 170], 'numeric');
      const refreshed = mgr.refreshTableSchema('test', table);
      expect(refreshed.columns.some(c => c.name === 'doubled')).toBe(true);
    });

    it('numeric column gets stats (min/max/mean/etc.)', () => {
      mgr.addColumn('test', 'doubled', [160, 180, 140, 120, 170], 'numeric');
      const col = mgr.profileColumn('test', 'doubled', 'numeric');
      expect(col.stats?.min).toBe(120);
      expect(col.stats?.max).toBe(180);
      expect(col.stats?.mean).toBeCloseTo(154);
    });

    it('categorical column gets topValues', () => {
      mgr.addColumn('test', 'grade', ['A', 'B', 'A', 'C', 'A'], 'categorical');
      const col = mgr.profileColumn('test', 'grade', 'categorical');
      expect(col.topValues).toBeDefined();
      expect(col.topValues![0].value).toBe('A');
      expect(col.topValues![0].count).toBe(3);
    });

    it('column disappears from schema after drop', () => {
      mgr.addColumn('test', 'extra', [1, 2, 3, 4, 5], 'numeric');
      mgr.dropColumn('test', 'extra');
      const refreshed = mgr.refreshTableSchema('test', table);
      expect(refreshed.columns.some(c => c.name === 'extra')).toBe(false);
    });

    it('row count unchanged after add/drop', () => {
      mgr.addColumn('test', 'extra', [1, 2, 3, 4, 5], 'numeric');
      mgr.dropColumn('test', 'extra');
      const refreshed = mgr.refreshTableSchema('test', table);
      expect(refreshed.rowCount).toBe(5);
    });
  });

  describe('integration with DSL queries', () => {
    it('can SELECT derived column', () => {
      mgr.addColumn('test', 'doubled', [160, 180, 140, 120, 170], 'numeric');
      const rows = db.prepare('SELECT name, doubled FROM test').all() as any[];
      expect(rows[0].doubled).toBe(160);
    });

    it('can filter on derived column', () => {
      mgr.addColumn('test', 'doubled', [160, 180, 140, 120, 170], 'numeric');
      const rows = db.prepare('SELECT name FROM test WHERE doubled > 160').all() as any[];
      expect(rows.map((r: any) => r.name).sort()).toEqual(['Bob', 'Eve']);
    });

    it('can GROUP BY derived column', () => {
      mgr.addColumn('test', 'tier', ['high', 'high', 'low', 'low', 'high'], 'categorical');
      const rows = db.prepare('SELECT tier, COUNT(*) as cnt FROM test GROUP BY tier ORDER BY tier').all() as any[];
      expect(rows).toEqual([{ tier: 'high', cnt: 3 }, { tier: 'low', cnt: 2 }]);
    });

    it('can ORDER BY derived column', () => {
      mgr.addColumn('test', 'doubled', [160, 180, 140, 120, 170], 'numeric');
      const rows = db.prepare('SELECT name FROM test ORDER BY doubled').all() as any[];
      expect(rows[0].name).toBe('Dave');
    });

    it('can aggregate derived column (SUM, AVG, etc.)', () => {
      mgr.addColumn('test', 'doubled', [160, 180, 140, 120, 170], 'numeric');
      const result = db.prepare('SELECT AVG(doubled) as avg_d FROM test').get() as any;
      expect(result.avg_d).toBeCloseTo(154);
    });
  });

  describe('error cases', () => {
    it('addColumn with mismatched value count → error', () => {
      expect(() => mgr.addColumn('test', 'bad', [1, 2, 3], 'numeric')).toThrow(/mismatch/);
    });

    it('addColumn with duplicate name → error', () => {
      mgr.addColumn('test', 'extra', [1, 2, 3, 4, 5], 'numeric');
      expect(() => mgr.addColumn('test', 'extra', [1, 2, 3, 4, 5], 'numeric')).toThrow(/already exists/);
    });

    it('dropColumn for non-existent column → error', () => {
      expect(() => mgr.dropColumn('test', 'nonexistent')).toThrow(/does not exist/);
    });
  });
});
