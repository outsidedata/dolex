import { describe, it, expect } from 'vitest';
import { SourceManager } from '../../src/connectors/manager.js';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

describe('CSV Connector Rich Profiling', () => {
  it('numeric columns have stats (min, max, mean, median, stddev, p25, p75)', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'csv-profile-'));
    const csvPath = path.join(tmpDir, 'numbers.csv');
    const rows = Array.from({ length: 10 }, (_, i) => `${i + 1},${(i + 1) * 10}`);
    fs.writeFileSync(csvPath, `value,amount\n${rows.join('\n')}`);

    const manager = new SourceManager();
    await manager.add('nums', { type: 'csv', path: csvPath });
    const schema = await manager.getSchema('nums');
    expect(schema.ok).toBe(true);

    const valueCol = schema.schema!.tables[0].columns.find(c => c.name === 'value');
    expect(valueCol).toBeDefined();
    expect(valueCol!.type).toBe('numeric');
    expect(valueCol!.stats).toBeDefined();
    expect(valueCol!.stats!.min).toBe(1);
    expect(valueCol!.stats!.max).toBe(10);
    expect(valueCol!.stats!.mean).toBeCloseTo(5.5, 1);
    expect(valueCol!.stats!.median).toBeCloseTo(5.5, 1);
    expect(valueCol!.stats!.p25).toBeDefined();
    expect(valueCol!.stats!.p75).toBeDefined();

    await manager.closeAll();
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('categorical columns have topValues with counts', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'csv-profile-'));
    const csvPath = path.join(tmpDir, 'categories.csv');
    const regions = ['North','North','North','North','North','South','South','South','East','East'];
    const data = regions.map((r, i) => `${r},${(i+1)*10}`);
    fs.writeFileSync(csvPath, `region,val\n${data.join('\n')}`);

    const manager = new SourceManager();
    await manager.add('cats', { type: 'csv', path: csvPath });
    const schema = await manager.getSchema('cats');
    expect(schema.ok).toBe(true);

    const regionCol = schema.schema!.tables[0].columns.find(c => c.name === 'region');
    expect(regionCol).toBeDefined();
    expect(regionCol!.type).toBe('categorical');
    expect(regionCol!.topValues).toBeDefined();
    expect(regionCol!.topValues!.length).toBeGreaterThan(0);
    expect(regionCol!.topValues![0].value).toBe('North');
    expect(regionCol!.topValues![0].count).toBe(5);

    await manager.closeAll();
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('getSampleRows returns varied rows', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'csv-sample-'));
    const csvPath = path.join(tmpDir, 'large.csv');
    const rows = Array.from({ length: 100 }, (_, i) => `row${i},${i}`);
    fs.writeFileSync(csvPath, `name,value\n${rows.join('\n')}`);

    const manager = new SourceManager();
    await manager.add('large', { type: 'csv', path: csvPath });
    const conn = await manager.connect('large');
    expect(conn.ok).toBe(true);

    const samples = await conn.source!.getSampleRows('large', 5);
    expect(samples).toHaveLength(5);
    const names = samples.map(r => r.name);
    expect(names[0]).not.toBe(names[1]);

    await manager.closeAll();
    fs.rmSync(tmpDir, { recursive: true });
  });
});

describe('SQLite Connector Rich Profiling', () => {
  it('numeric columns have stats', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sqlite-profile-'));
    const dbPath = path.join(tmpDir, 'test.sqlite');

    const Database = (await import('better-sqlite3')).default;
    const db = new Database(dbPath);
    db.exec('CREATE TABLE test (name TEXT, value REAL)');
    const insert = db.prepare('INSERT INTO test VALUES (?, ?)');
    for (let i = 1; i <= 10; i++) {
      insert.run(`item${i}`, i * 10);
    }
    db.close();

    const manager = new SourceManager();
    await manager.add('sqlitetest', { type: 'sqlite', path: dbPath });
    const schema = await manager.getSchema('sqlitetest');
    expect(schema.ok).toBe(true);

    const valueCol = schema.schema!.tables[0].columns.find(c => c.name === 'value');
    expect(valueCol).toBeDefined();
    expect(valueCol!.stats).toBeDefined();
    expect(valueCol!.stats!.min).toBe(10);
    expect(valueCol!.stats!.max).toBe(100);

    await manager.closeAll();
    fs.rmSync(tmpDir, { recursive: true });
  });
});
