import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { queryCommand } from '../../src/cli/commands/query.js';
import { analyzeCommand } from '../../src/cli/commands/analyze.js';
import { describeCommand } from '../../src/cli/commands/describe.js';
import { checkCommand } from '../../src/cli/commands/check.js';

/** Run a command, capturing its stdout+stderr; returns { code, text }. */
async function run(fn: (argv: string[]) => Promise<number>, argv: string[]): Promise<{ code: number; text: string }> {
  const lines: string[] = [];
  const origOut = process.stdout.write.bind(process.stdout);
  const origErr = process.stderr.write.bind(process.stderr);
  const cap = (chunk: any) => {
    lines.push(typeof chunk === 'string' ? chunk : String(chunk));
    return true;
  };
  process.stdout.write = cap as any;
  process.stderr.write = cap as any;
  try {
    const code = await fn(argv);
    return { code, text: lines.join('') };
  } finally {
    process.stdout.write = origOut as any;
    process.stderr.write = origErr as any;
  }
}

describe('CLI command integration', () => {
  let dir: string;
  let csv: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'cli-cmd-'));
    csv = join(dir, 'shop.csv'); // table name → "shop"
    // Enough rows with repetition that the classifier sees sales as a measure
    // and region as a dimension (tiny samples get mis-typed as id/text).
    const regions = ['North', 'South', 'East', 'West'];
    const years = ['2019', '2020', '2021'];
    const notes = ['ok', 'fine', 'great', 'N/A', ''];
    const lines = ['region,sales,year,note,dup_a,dup_b'];
    for (let i = 0; i < 24; i++) {
      const region = regions[i % 4];
      const sales = ((i % 8) + 1) * 25; // 25..200, repeated → measure
      const year = years[i % 3];
      const note = notes[i % 5];
      const d = ['p', 'q', 'r'][i % 3];
      lines.push(`${region},${sales},${year},${note},${d},${d}`);
    }
    writeFileSync(csv, lines.join('\n'), 'utf-8');
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  describe('query', () => {
    it('aggregates correctly and emits valid JSON (numeric sums, descending)', async () => {
      const { code, text } = await run(queryCommand, [
        csv,
        'SELECT region, SUM(sales) AS s FROM shop GROUP BY region ORDER BY s DESC',
        '--format',
        'json',
      ]);
      expect(code).toBe(0);
      const rows = JSON.parse(text);
      expect(rows).toHaveLength(4);
      // sums are real numbers (not string concatenation) and sorted descending
      expect(rows.every((r: any) => typeof r.s === 'number')).toBe(true);
      for (let i = 1; i < rows.length; i++) expect(rows[i - 1].s).toBeGreaterThanOrEqual(rows[i].s);
      // total across regions equals the table total
      const total = rows.reduce((a: number, r: any) => a + r.s, 0);
      expect(total).toBe(((1 + 2 + 3 + 4 + 5 + 6 + 7 + 8) * 25 * 24) / 8);
    });

    it('numeric ORDER BY is numeric, not lexicographic', async () => {
      const { code, text } = await run(queryCommand, [
        csv,
        'SELECT sales FROM shop ORDER BY sales DESC LIMIT 1',
        '--format',
        'json',
      ]);
      expect(code).toBe(0);
      expect(JSON.parse(text)[0].sales).toBe(200); // not '90' lexicographically
    });

    it('fails with a helpful error on a bad column', async () => {
      const { code, text } = await run(queryCommand, [csv, 'SELECT nope FROM shop']);
      expect(code).toBe(1);
      expect(text).toMatch(/no such column|available/i);
    });
  });

  describe('analyze', () => {
    it('plans steps and buckets the year column without strftime-on-year', async () => {
      const { code, text } = await run(analyzeCommand, [csv, '--json']);
      expect(code).toBe(0);
      const plan = JSON.parse(text);
      expect(plan.steps.length).toBeGreaterThan(0);
      const trend = plan.steps.find((s: any) => s.category === 'trend');
      if (trend) {
        expect(trend.sql).not.toMatch(/strftime\('%Y-%m'/);
        expect(trend.sql).toMatch(/CAST/);
      }
    });
  });

  describe('describe', () => {
    it('profiles all columns', async () => {
      const { code, text } = await run(describeCommand, [csv]);
      expect(code).toBe(0);
      for (const c of ['region', 'sales', 'year', 'note']) expect(text).toContain(c);
    });
  });

  describe('check', () => {
    it('flags identical columns as HIGH and exits non-zero', async () => {
      const { code, text } = await run(checkCommand, [csv]);
      expect(code).toBe(1); // dup_a == dup_b is a high-severity finding
      expect(text).toMatch(/identical/i);
      expect(text).toContain('dup_a');
    });

    it('flags the missing-value sentinel', async () => {
      const { text } = await run(checkCommand, [csv]);
      expect(text).toMatch(/sentinel/i);
    });

    it('reports a clean dataset with no issues', async () => {
      const clean = join(dir, 'clean.csv');
      writeFileSync(clean, ['region,sales', 'North,100', 'South,200', 'East,150'].join('\n'), 'utf-8');
      const { code, text } = await run(checkCommand, [clean]);
      expect(code).toBe(0);
      expect(text).toMatch(/no .*issues|no data-quality/i);
    });
  });
});
