import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SourceManager } from '../../src/connectors/manager.js';

// Custom SQLite aggregates added in Tier 3 (cv, mad, extended percentiles).
// Data [1,2,3,4,100]: mean 22, median 3 (verified independently below).
let mgr: SourceManager;
let id: string;
let dir: string;

beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dolex-agg-'));
  const csv = path.join(dir, 'n.csv');
  fs.writeFileSync(csv, 'x\n1\n2\n3\n4\n100\n');
  mgr = new SourceManager();
  id = (await mgr.add('n', { type: 'csv', path: csv })).entry!.id;
});

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

const val = async (sql: string) => {
  const r = await mgr.querySql(id, sql);
  return Number((r.rows![0] as any).v);
};

describe('custom aggregates', () => {
  it('mad = median(|x - median|) = 1', async () => {
    expect(await val('SELECT mad(x) AS v FROM n')).toBeCloseTo(1, 9);
  });
  it('cv = population stddev / mean ≈ 1.7732', async () => {
    // stddev = sqrt(1522) = 39.0128…, mean = 22
    expect(await val('SELECT cv(x) AS v FROM n')).toBeCloseTo(Math.sqrt(1522) / 22, 6);
  });
  it('p95 interpolates to 80.8; p5 to 1.2', async () => {
    expect(await val('SELECT p95(x) AS v FROM n')).toBeCloseTo(80.8, 9);
    expect(await val('SELECT p5(x) AS v FROM n')).toBeCloseTo(1.2, 9);
  });
  // Regression for the NULL/empty→0 contamination found in red-team (attacker 3):
  // missing values must be IGNORED, not coerced to 0, and must agree with native AVG/COUNT.
  it('ignores NULL and empty cells (no 0-contamination) — agrees with native AVG/COUNT', async () => {
    const r = await mgr.querySql(id,
      `SELECT cv(c) cv, mad(c) mad, median(c) med, stddev(c) sd, p95(c) p95, COUNT(c) n, AVG(c) avg
       FROM (SELECT 10 c UNION ALL SELECT 20 UNION ALL SELECT 30 UNION ALL SELECT NULL UNION ALL SELECT NULL)`);
    const row = r.rows![0] as any;
    // Oracle: over {10,20,30} only. mean 20, COUNT 3 (native). If NULLs leaked as 0,
    // median would be 10 and mean 12.
    expect(Number(row.n)).toBe(3);
    expect(Number(row.avg)).toBeCloseTo(20, 9);   // native, ignores NULL
    expect(Number(row.med)).toBeCloseTo(20, 9);   // custom must match domain {10,20,30}
    expect(Number(row.sd)).toBeCloseTo(Math.sqrt(((10-20)**2+(20-20)**2+(30-20)**2)/3), 6);
    expect(Number(row.cv)).toBeCloseTo(8.16496580927726 / 20, 6);
    expect(Number(row.p95)).toBeCloseTo(29, 9);   // p95 of [10,20,30]
  });

  it('empty-string cells are ignored too (Number("")===0 trap)', async () => {
    const csvE = path.join(dir, 'e.csv');
    fs.writeFileSync(csvE, 'x\n10\n\n20\n\n30\n');
    const idE = (await mgr.add('e', { type: 'csv', path: csvE })).entry!.id;
    const r = await mgr.querySql(idE, 'SELECT median(x) med, COUNT(x) n FROM e');
    expect(Number((r.rows![0] as any).med)).toBeCloseTo(20, 9); // not 10
  });

  it('cv returns NULL when mean is 0 (undefined ratio)', async () => {
    const csv0 = path.join(dir, 'z.csv');
    fs.writeFileSync(csv0, 'x\n-1\n0\n1\n');
    const id0 = (await mgr.add('z', { type: 'csv', path: csv0 })).entry!.id;
    const r = await mgr.querySql(id0, 'SELECT cv(x) AS v FROM z');
    expect((r.rows![0] as any).v).toBeNull();
  });
});
