import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import Database from 'better-sqlite3';
import {
  resolveManifestPath,
  readManifest,
  writeManifest,
  replayManifest,
} from '../../src/transforms/manifest.js';
import { TransformMetadata } from '../../src/transforms/metadata.js';
import { ColumnManager } from '../../src/transforms/column-manager.js';
import { executeSingleTransform } from '../../src/transforms/pipeline.js';
import type { CsvSourceConfig } from '../../src/types.js';

function createTestDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE data (
      name TEXT,
      score REAL
    )
  `);
  const insert = db.prepare('INSERT INTO data (name, score) VALUES (?, ?)');
  const tx = db.transaction(() => {
    insert.run('Alice', 80);
    insert.run('Bob', 90);
    insert.run('Carol', 70);
  });
  tx();

  const metadata = new TransformMetadata(db);
  metadata.init();

  return { db, metadata };
}

describe('Manifest Persistence', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'dolex-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('path resolution', () => {
    it('single CSV file: /data/file.csv → /data/file.dolex.json', () => {
      const config: CsvSourceConfig = { type: 'csv', path: '/data/file.csv' };
      expect(resolveManifestPath(config)).toBe('/data/file.dolex.json');
    });

    it('directory source: /data/dir/ → /data/dir/.dolex.json', () => {
      const config: CsvSourceConfig = { type: 'csv', path: '/data/dir/' };
      expect(resolveManifestPath(config)).toBe('/data/dir/.dolex.json');
    });

    it('handles trailing slash', () => {
      const config: CsvSourceConfig = { type: 'csv', path: '/data/dir/' };
      expect(resolveManifestPath(config)).toBe('/data/dir/.dolex.json');
    });

    it('handles no extension (directory)', () => {
      const config: CsvSourceConfig = { type: 'csv', path: '/data/dir' };
      expect(resolveManifestPath(config)).toBe('/data/dir/.dolex.json');
    });
  });

  describe('write manifest', () => {
    it('writes valid JSON file', () => {
      const { db, metadata } = createTestDb();
      metadata.add('data', { column: 'doubled', expr: 'score * 2', type: 'numeric', layer: 'derived' });

      const manifestPath = join(tempDir, 'test.dolex.json');
      writeManifest(metadata, ['data'], manifestPath);

      expect(existsSync(manifestPath)).toBe(true);
      const content = JSON.parse(readFileSync(manifestPath, 'utf-8'));
      expect(content.version).toBe(1);
    });

    it('manifest matches Zod schema', () => {
      const { db, metadata } = createTestDb();
      metadata.add('data', { column: 'doubled', expr: 'score * 2', type: 'numeric', layer: 'derived' });

      const manifestPath = join(tempDir, 'test.dolex.json');
      writeManifest(metadata, ['data'], manifestPath);

      const result = readManifest(manifestPath);
      expect(result).not.toBeNull();
    });

    it('only includes derived columns (not working)', () => {
      const { db, metadata } = createTestDb();
      metadata.add('data', { column: 'derived_col', expr: 'score * 2', type: 'numeric', layer: 'derived' });
      metadata.add('data', { column: 'working_col', expr: 'score + 1', type: 'numeric', layer: 'working' });

      const manifestPath = join(tempDir, 'test.dolex.json');
      writeManifest(metadata, ['data'], manifestPath);

      const manifest = readManifest(manifestPath)!;
      expect(manifest.tables.data.length).toBe(1);
      expect(manifest.tables.data[0].column).toBe('derived_col');
    });

    it('overwrites existing manifest', () => {
      const { db, metadata } = createTestDb();
      metadata.add('data', { column: 'a', expr: 'score + 1', type: 'numeric', layer: 'derived' });

      const manifestPath = join(tempDir, 'test.dolex.json');
      writeManifest(metadata, ['data'], manifestPath);

      metadata.add('data', { column: 'b', expr: 'score + 2', type: 'numeric', layer: 'derived' });
      writeManifest(metadata, ['data'], manifestPath);

      const manifest = readManifest(manifestPath)!;
      expect(manifest.tables.data.length).toBe(2);
    });
  });

  describe('read manifest', () => {
    it('reads valid manifest', () => {
      const manifestPath = join(tempDir, 'test.dolex.json');
      writeFileSync(manifestPath, JSON.stringify({
        version: 1,
        tables: { data: [{ column: 'x', expr: 'a + 1', type: 'numeric' }] },
      }));
      const result = readManifest(manifestPath);
      expect(result).not.toBeNull();
      expect(result!.tables.data[0].column).toBe('x');
    });

    it('returns null for missing file', () => {
      expect(readManifest(join(tempDir, 'nonexistent.json'))).toBeNull();
    });

    it('returns null for empty file', () => {
      const manifestPath = join(tempDir, 'empty.json');
      writeFileSync(manifestPath, '');
      expect(readManifest(manifestPath)).toBeNull();
    });

    it('rejects invalid JSON', () => {
      const manifestPath = join(tempDir, 'bad.json');
      writeFileSync(manifestPath, 'not json');
      expect(readManifest(manifestPath)).toBeNull();
    });

    it('rejects schema-invalid manifest', () => {
      const manifestPath = join(tempDir, 'bad.json');
      writeFileSync(manifestPath, JSON.stringify({ wrong: 'format' }));
      expect(readManifest(manifestPath)).toBeNull();
    });
  });

  describe('replay', () => {
    it('replays single transform', () => {
      const { db, metadata } = createTestDb();
      const manifest = {
        version: 1 as const,
        tables: {
          data: [{ column: 'doubled', expr: 'score * 2', type: 'numeric' as const }],
        },
      };

      const result = replayManifest(db, metadata, manifest, 'data');
      expect(result.replayed).toEqual(['doubled']);
      expect(result.skipped.length).toBe(0);
    });

    it('replays multiple transforms in order', () => {
      const { db, metadata } = createTestDb();
      const manifest = {
        version: 1 as const,
        tables: {
          data: [
            { column: 'doubled', expr: 'score * 2', type: 'numeric' as const },
            { column: 'quad', expr: 'doubled * 2', type: 'numeric' as const },
          ],
        },
      };

      const result = replayManifest(db, metadata, manifest, 'data');
      expect(result.replayed).toEqual(['doubled', 'quad']);
    });

    it('derived columns have correct values', () => {
      const { db, metadata } = createTestDb();
      const manifest = {
        version: 1 as const,
        tables: {
          data: [{ column: 'doubled', expr: 'score * 2', type: 'numeric' as const }],
        },
      };

      replayManifest(db, metadata, manifest, 'data');
      const rows = db.prepare('SELECT doubled FROM data ORDER BY rowid').all() as any[];
      expect(rows.map(r => r.doubled)).toEqual([160, 180, 140]);
    });

    it('skips transform with missing column reference', () => {
      const { db, metadata } = createTestDb();
      const manifest = {
        version: 1 as const,
        tables: {
          data: [{ column: 'x', expr: 'nonexistent + 1', type: 'numeric' as const }],
        },
      };

      const result = replayManifest(db, metadata, manifest, 'data');
      expect(result.skipped.length).toBe(1);
      expect(result.skipped[0].column).toBe('x');
      expect(result.skipped[0].reason).toContain('Missing columns');
    });

    it('reports skipped transforms with reason', () => {
      const { db, metadata } = createTestDb();
      const manifest = {
        version: 1 as const,
        tables: {
          data: [{ column: 'x', expr: 'bad_col + 1', type: 'numeric' as const }],
        },
      };

      const result = replayManifest(db, metadata, manifest, 'data');
      expect(result.skipped[0].reason).toBeDefined();
    });

    it('continues after skip (does not abort)', () => {
      const { db, metadata } = createTestDb();
      const manifest = {
        version: 1 as const,
        tables: {
          data: [
            { column: 'bad', expr: 'nonexistent + 1', type: 'numeric' as const },
            { column: 'good', expr: 'score + 1', type: 'numeric' as const },
          ],
        },
      };

      const result = replayManifest(db, metadata, manifest, 'data');
      expect(result.skipped.length).toBe(1);
      expect(result.replayed).toEqual(['good']);
    });

    it('later transforms can reference earlier ones', () => {
      const { db, metadata } = createTestDb();
      const manifest = {
        version: 1 as const,
        tables: {
          data: [
            { column: 'a', expr: 'score + 1', type: 'numeric' as const },
            { column: 'b', expr: 'a + 1', type: 'numeric' as const },
          ],
        },
      };

      replayManifest(db, metadata, manifest, 'data');
      const rows = db.prepare('SELECT b FROM data ORDER BY rowid').all() as any[];
      expect(rows.map(r => r.b)).toEqual([82, 92, 72]); // score + 1 + 1
    });
  });

  describe('round-trip', () => {
    it('transform → promote → write → replay → verify values', () => {
      const { db, metadata } = createTestDb();
      const sourceColumns = ['name', 'score'];

      // Transform
      executeSingleTransform(db, metadata, {
        sourceId: 'test', table: 'data', create: 'doubled', expr: 'score * 2',
      }, sourceColumns);

      // Promote
      metadata.updateLayer('data', 'doubled', 'working', 'derived');

      // Write manifest
      const manifestPath = join(tempDir, 'test.dolex.json');
      writeManifest(metadata, ['data'], manifestPath);

      // Now simulate reload: new DB, new metadata
      const db2 = new Database(':memory:');
      db2.exec('CREATE TABLE data (name TEXT, score REAL)');
      const insert = db2.prepare('INSERT INTO data (name, score) VALUES (?, ?)');
      db2.transaction(() => {
        insert.run('Alice', 80);
        insert.run('Bob', 90);
        insert.run('Carol', 70);
      })();

      const metadata2 = new TransformMetadata(db2);
      metadata2.init();

      // Read and replay
      const manifest = readManifest(manifestPath)!;
      const result = replayManifest(db2, metadata2, manifest, 'data');

      expect(result.replayed).toEqual(['doubled']);
      const rows = db2.prepare('SELECT doubled FROM data ORDER BY rowid').all() as any[];
      expect(rows.map(r => r.doubled)).toEqual([160, 180, 140]);

      // Derived metadata restored
      expect(metadata2.getLayer('data', 'doubled')).toBe('derived');
    });
  });
});
