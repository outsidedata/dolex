import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { executeSingleTransform, executeBatchTransform } from '../../src/transforms/pipeline.js';
import { TransformMetadata } from '../../src/transforms/metadata.js';
import { ColumnManager } from '../../src/transforms/column-manager.js';

function createTestDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE data (
      name TEXT,
      age REAL,
      score REAL,
      gender TEXT
    )
  `);
  const insert = db.prepare('INSERT INTO data (name, age, score, gender) VALUES (?, ?, ?, ?)');
  const tx = db.transaction(() => {
    insert.run('Alice', 25, 80, 'F');
    insert.run('Bob', 35, 90, 'M');
    insert.run('Carol', 55, 70, 'F');
    insert.run('Dave', 17, 60, 'M');
    insert.run('Eve', 42, 85, 'F');
  });
  tx();

  const metadata = new TransformMetadata(db);
  metadata.init();
  const sourceColumns = ['name', 'age', 'score', 'gender'];

  return { db, metadata, sourceColumns };
}

describe('Transform Pipeline', () => {
  let db: Database.Database;
  let metadata: TransformMetadata;
  let sourceColumns: string[];

  beforeEach(() => {
    const setup = createTestDb();
    db = setup.db;
    metadata = setup.metadata;
    sourceColumns = setup.sourceColumns;
  });

  describe('single transform', () => {
    it('creates working column with correct values', () => {
      const result = executeSingleTransform(db, metadata, {
        sourceId: 'test', table: 'data', create: 'doubled', expr: 'score * 2',
      }, sourceColumns);
      expect(result.created[0].column).toBe('doubled');
      const rows = db.prepare('SELECT doubled FROM data ORDER BY rowid').all() as any[];
      expect(rows.map(r => r.doubled)).toEqual([160, 180, 140, 120, 170]);
    });

    it('column appears in SQLite', () => {
      executeSingleTransform(db, metadata, {
        sourceId: 'test', table: 'data', create: 'doubled', expr: 'score * 2',
      }, sourceColumns);
      const mgr = new ColumnManager(db);
      expect(mgr.getColumnNames('data')).toContain('doubled');
    });

    it('metadata record created with correct fields', () => {
      executeSingleTransform(db, metadata, {
        sourceId: 'test', table: 'data', create: 'doubled', expr: 'score * 2',
      }, sourceColumns);
      const record = metadata.get('data', 'doubled');
      expect(record).not.toBeNull();
      expect(record!.layer).toBe('working');
      expect(record!.expr).toBe('score * 2');
    });

    it('returns correct stats', () => {
      const result = executeSingleTransform(db, metadata, {
        sourceId: 'test', table: 'data', create: 'doubled', expr: 'score * 2',
      }, sourceColumns);
      expect(result.created[0].stats.min).toBe(120);
      expect(result.created[0].stats.max).toBe(180);
      expect(result.created[0].stats.rows).toBe(5);
    });

    it('returns correct column counts', () => {
      const result = executeSingleTransform(db, metadata, {
        sourceId: 'test', table: 'data', create: 'doubled', expr: 'score * 2',
      }, sourceColumns);
      expect(result.working_column_count).toBe(1);
      expect(result.derived_column_count).toBe(0);
    });
  });

  describe('batch transform', () => {
    it('creates multiple working columns', () => {
      const result = executeBatchTransform(db, metadata, {
        sourceId: 'test', table: 'data',
        transforms: [
          { create: 'doubled', expr: 'score * 2' },
          { create: 'tripled', expr: 'score * 3' },
        ],
      }, sourceColumns);
      expect(result.created.length).toBe(2);
      expect(result.working_column_count).toBe(2);
    });

    it('earlier results visible to later expressions', () => {
      const result = executeBatchTransform(db, metadata, {
        sourceId: 'test', table: 'data',
        transforms: [
          { create: 'doubled', expr: 'score * 2' },
          { create: 'quad', expr: 'doubled * 2' },
        ],
      }, sourceColumns);
      const rows = db.prepare('SELECT quad FROM data ORDER BY rowid').all() as any[];
      expect(rows.map(r => r.quad)).toEqual([320, 360, 280, 240, 340]);
    });

    it('all metadata records created', () => {
      executeBatchTransform(db, metadata, {
        sourceId: 'test', table: 'data',
        transforms: [
          { create: 'a', expr: 'score + 1' },
          { create: 'b', expr: 'score + 2' },
        ],
      }, sourceColumns);
      expect(metadata.list('data').length).toBe(2);
    });
  });

  describe('batch rollback', () => {
    it('first expression valid, second invalid → both rolled back', () => {
      expect(() => {
        executeBatchTransform(db, metadata, {
          sourceId: 'test', table: 'data',
          transforms: [
            { create: 'good', expr: 'score + 1' },
            { create: 'bad', expr: 'nonexistent + 1' },
          ],
        }, sourceColumns);
      }).toThrow();

      // No columns should remain
      const mgr = new ColumnManager(db);
      expect(mgr.getColumnNames('data')).not.toContain('good');
      expect(mgr.getColumnNames('data')).not.toContain('bad');
    });

    it('metadata unchanged after rollback', () => {
      try {
        executeBatchTransform(db, metadata, {
          sourceId: 'test', table: 'data',
          transforms: [
            { create: 'good', expr: 'score + 1' },
            { create: 'bad', expr: 'nonexistent + 1' },
          ],
        }, sourceColumns);
      } catch { /* expected */ }
      expect(metadata.list('data').length).toBe(0);
    });

    it('error message identifies which expression failed', () => {
      try {
        executeBatchTransform(db, metadata, {
          sourceId: 'test', table: 'data',
          transforms: [
            { create: 'good', expr: 'score + 1' },
            { create: 'bad', expr: 'nonexistent + 1' },
          ],
        }, sourceColumns);
        expect.fail('should throw');
      } catch (e: any) {
        expect(e.message).toContain('nonexistent');
      }
    });
  });

  describe('name collision: source column', () => {
    it('rejects creation with source column name', () => {
      expect(() => {
        executeSingleTransform(db, metadata, {
          sourceId: 'test', table: 'data', create: 'age', expr: 'score + 1',
        }, sourceColumns);
      }).toThrow(/already exists in source/);
    });

    it('nothing modified on rejection', () => {
      try {
        executeSingleTransform(db, metadata, {
          sourceId: 'test', table: 'data', create: 'age', expr: 'score + 1',
        }, sourceColumns);
      } catch { /* expected */ }
      expect(metadata.list('data').length).toBe(0);
    });
  });

  describe('name collision: working column overwrite', () => {
    it('silently overwrites existing working column', () => {
      executeSingleTransform(db, metadata, {
        sourceId: 'test', table: 'data', create: 'extra', expr: 'score + 1',
      }, sourceColumns);
      executeSingleTransform(db, metadata, {
        sourceId: 'test', table: 'data', create: 'extra', expr: 'score + 10',
      }, sourceColumns);

      const rows = db.prepare('SELECT extra FROM data ORDER BY rowid').all() as any[];
      expect(rows[0].extra).toBe(90); // 80 + 10
    });

    it('metadata updated with new expression', () => {
      executeSingleTransform(db, metadata, {
        sourceId: 'test', table: 'data', create: 'extra', expr: 'score + 1',
      }, sourceColumns);
      executeSingleTransform(db, metadata, {
        sourceId: 'test', table: 'data', create: 'extra', expr: 'score + 10',
      }, sourceColumns);

      const record = metadata.get('data', 'extra');
      expect(record!.expr).toBe('score + 10');
    });

    it('response shows overwritten: true', () => {
      executeSingleTransform(db, metadata, {
        sourceId: 'test', table: 'data', create: 'extra', expr: 'score + 1',
      }, sourceColumns);
      const result = executeSingleTransform(db, metadata, {
        sourceId: 'test', table: 'data', create: 'extra', expr: 'score + 10',
      }, sourceColumns);
      expect(result.created[0].overwritten).toBe(true);
    });
  });

  describe('name collision: derived shadow', () => {
    it('creates working shadow over derived column', () => {
      // First create as working, then promote to derived
      executeSingleTransform(db, metadata, {
        sourceId: 'test', table: 'data', create: 'extra', expr: 'score + 1',
      }, sourceColumns);
      metadata.updateLayer('data', 'extra', 'working', 'derived');

      // Now shadow it
      const result = executeSingleTransform(db, metadata, {
        sourceId: 'test', table: 'data', create: 'extra', expr: 'score + 100',
      }, sourceColumns);

      expect(result.created[0].overwritten).toBe(true);
      const rows = db.prepare('SELECT extra FROM data ORDER BY rowid').all() as any[];
      expect(rows[0].extra).toBe(180); // 80 + 100
    });

    it('derived metadata record preserved', () => {
      executeSingleTransform(db, metadata, {
        sourceId: 'test', table: 'data', create: 'extra', expr: 'score + 1',
      }, sourceColumns);
      metadata.updateLayer('data', 'extra', 'working', 'derived');

      executeSingleTransform(db, metadata, {
        sourceId: 'test', table: 'data', create: 'extra', expr: 'score + 100',
      }, sourceColumns);

      expect(metadata.hasDerived('data', 'extra')).toBe(true);
      const derived = metadata.getDerived('data', 'extra');
      expect(derived!.expr).toBe('score + 1');
    });
  });

  describe('column name validation', () => {
    it('rejects names with spaces', () => {
      expect(() => executeSingleTransform(db, metadata, {
        sourceId: 'test', table: 'data', create: 'bad name', expr: 'score + 1',
      }, sourceColumns)).toThrow(/spaces/);
    });

    it('rejects names with dots', () => {
      expect(() => executeSingleTransform(db, metadata, {
        sourceId: 'test', table: 'data', create: 'bad.name', expr: 'score + 1',
      }, sourceColumns)).toThrow(/dots/);
    });

    it('rejects names starting with digit', () => {
      expect(() => executeSingleTransform(db, metadata, {
        sourceId: 'test', table: 'data', create: '1bad', expr: 'score + 1',
      }, sourceColumns)).toThrow(/digit/);
    });

    it('rejects empty name', () => {
      expect(() => executeSingleTransform(db, metadata, {
        sourceId: 'test', table: 'data', create: '', expr: 'score + 1',
      }, sourceColumns)).toThrow(/empty/);
    });

    it('accepts underscores', () => {
      expect(() => executeSingleTransform(db, metadata, {
        sourceId: 'test', table: 'data', create: 'good_name', expr: 'score + 1',
      }, sourceColumns)).not.toThrow();
    });

    it('accepts alphanumeric', () => {
      expect(() => executeSingleTransform(db, metadata, {
        sourceId: 'test', table: 'data', create: 'good2', expr: 'score + 1',
      }, sourceColumns)).not.toThrow();
    });
  });

  describe('expression validation', () => {
    it('rejects invalid expression syntax', () => {
      expect(() => executeSingleTransform(db, metadata, {
        sourceId: 'test', table: 'data', create: 'x', expr: '+ +',
      }, sourceColumns)).toThrow();
    });

    it('rejects reference to non-existent column', () => {
      expect(() => executeSingleTransform(db, metadata, {
        sourceId: 'test', table: 'data', create: 'x', expr: 'nonexistent + 1',
      }, sourceColumns)).toThrow(/nonexistent/);
    });

    it('rejects circular dependency', () => {
      executeSingleTransform(db, metadata, {
        sourceId: 'test', table: 'data', create: 'a', expr: 'score + 1',
      }, sourceColumns);
      executeSingleTransform(db, metadata, {
        sourceId: 'test', table: 'data', create: 'b', expr: 'a + 1',
      }, sourceColumns);

      expect(() => executeSingleTransform(db, metadata, {
        sourceId: 'test', table: 'data', create: 'a', expr: 'b + 1',
      }, sourceColumns)).toThrow(/Circular/);
    });
  });

  describe('filter', () => {
    it('only evaluates matching rows', () => {
      const result = executeSingleTransform(db, metadata, {
        sourceId: 'test', table: 'data', create: 'f_score', expr: 'score * 2',
        filter: [{ field: 'gender', op: '=', value: 'F' }],
      }, sourceColumns);

      const rows = db.prepare('SELECT f_score FROM data ORDER BY rowid').all() as any[];
      expect(rows[0].f_score).toBe(160); // Alice F
      expect(rows[1].f_score).toBe(null); // Bob M
      expect(rows[2].f_score).toBe(140); // Carol F
      expect(rows[3].f_score).toBe(null); // Dave M
      expect(rows[4].f_score).toBe(170); // Eve F
    });
  });

  describe('partitionBy', () => {
    it('zscore computed within groups', () => {
      const result = executeSingleTransform(db, metadata, {
        sourceId: 'test', table: 'data', create: 'zscore_score', expr: 'zscore(score)',
        partitionBy: 'gender',
      }, sourceColumns);

      const record = metadata.get('data', 'zscore_score');
      expect(record!.partitionBy).toBe('gender');
    });
  });

  describe('type inference', () => {
    it('arithmetic → numeric', () => {
      const result = executeSingleTransform(db, metadata, {
        sourceId: 'test', table: 'data', create: 'x', expr: 'score + 1',
      }, sourceColumns);
      expect(result.created[0].type).toBe('numeric');
    });

    it('comparison → boolean', () => {
      const result = executeSingleTransform(db, metadata, {
        sourceId: 'test', table: 'data', create: 'x', expr: 'score > 75',
      }, sourceColumns);
      expect(result.created[0].type).toBe('boolean');
    });

    it('if_else with strings → categorical', () => {
      const result = executeSingleTransform(db, metadata, {
        sourceId: 'test', table: 'data', create: 'x', expr: 'if_else(score > 75, "high", "low")',
      }, sourceColumns);
      expect(result.created[0].type).toBe('categorical');
    });

    it('explicit type overrides inference', () => {
      const result = executeSingleTransform(db, metadata, {
        sourceId: 'test', table: 'data', create: 'x', expr: 'score + 1',
        type: 'categorical',
      }, sourceColumns);
      expect(result.created[0].type).toBe('categorical');
    });
  });

  describe('warnings', () => {
    it('>20% null output warns', () => {
      // Add a column with nulls
      db.exec('ALTER TABLE data ADD COLUMN maybe REAL');
      db.exec("UPDATE data SET maybe = NULL WHERE name IN ('Alice', 'Bob')");
      db.exec("UPDATE data SET maybe = 5 WHERE name NOT IN ('Alice', 'Bob')");

      const result = executeSingleTransform(db, metadata, {
        sourceId: 'test', table: 'data', create: 'x', expr: 'maybe + 1',
      }, [...sourceColumns, 'maybe']);

      expect(result.warnings.some(w => w.includes('null'))).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('expression referencing another working column', () => {
      executeSingleTransform(db, metadata, {
        sourceId: 'test', table: 'data', create: 'a', expr: 'score + 1',
      }, sourceColumns);
      const result = executeSingleTransform(db, metadata, {
        sourceId: 'test', table: 'data', create: 'b', expr: 'a * 2',
      }, sourceColumns);

      const rows = db.prepare('SELECT b FROM data ORDER BY rowid').all() as any[];
      expect(rows[0].b).toBe(162); // (80 + 1) * 2
    });
  });
});
