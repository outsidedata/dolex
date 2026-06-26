import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { riskyDivisionTerms, detectSqlFootguns, detectDivByZero, detectBareAggregate } from '../../src/connectors/sql-safety.js';
import { SourceManager } from '../../src/connectors/manager.js';

const FIXTURES = path.resolve(__dirname, '../fixtures');

// Design + head-to-head rationale live in
// local-orchestration/experiments/017-sql-integer-division.ts. This is the fast
// CI guard for the promoted type-aware detect-and-signal behavior.

const allInteger = async (_col: string) => 'integer';
const anyReal = async (_col: string) => 'real';

describe('sql-safety: riskyDivisionTerms (syntactic pre-filter)', () => {
  it('ignores `/` inside string literals and comments', () => {
    expect(riskyDivisionTerms(`SELECT team FROM t WHERE team = 'a/b'`)).toHaveLength(0);
    expect(riskyDivisionTerms(`SELECT SUM(x) FROM t /* w/g ratio */`)).toHaveLength(0);
  });
  it('treats a float literal or CAST-to-real term as safe', () => {
    expect(riskyDivisionTerms(`SELECT 100.0*SUM(a)/SUM(b) FROM t`)).toHaveLength(0);
    expect(riskyDivisionTerms(`SELECT CAST(SUM(a) AS REAL)/SUM(b) FROM t`)).toHaveLength(0);
  });
  it('flags a bare division term and surfaces its operand columns', () => {
    const terms = riskyDivisionTerms(`SELECT SUM(wins)/SUM(games) FROM t`);
    expect(terms).toHaveLength(1);
    expect(terms[0].columns).toEqual(['wins', 'games']);
  });
});

describe('sql-safety: detectSqlFootguns (type-aware)', () => {
  it('warns when every operand is integer-typed', async () => {
    const w = await detectSqlFootguns(`SELECT SUM(wins)/SUM(games) AS r FROM t`, allInteger);
    expect(w).toHaveLength(1);
    expect(w[0].code).toBe('integer-division');
    expect(w[0].message).toMatch(/truncate/i);
  });
  it('stays silent when an operand is real-typed (no truncation)', async () => {
    expect(await detectSqlFootguns(`SELECT SUM(rate)/COUNT(*) AS r FROM t`, anyReal)).toHaveLength(0);
  });
  it('stays silent on float-context, CAST, literals, and comments', async () => {
    expect(await detectSqlFootguns(`SELECT 100.0*SUM(a)/SUM(b) FROM t`, allInteger)).toHaveLength(0);
    expect(await detectSqlFootguns(`SELECT CAST(SUM(a) AS REAL)/SUM(b) FROM t`, allInteger)).toHaveLength(0);
    expect(await detectSqlFootguns(`SELECT team FROM t WHERE team = 'a/b'`, allInteger)).toHaveLength(0);
  });
});

describe('sql-safety: detectDivByZero (data-gated)', () => {
  const hasZero = async (_c: string) => true;
  const noZero = async (_c: string) => false;
  it('warns only when the denominator column actually contains a zero', async () => {
    expect(await detectDivByZero(`SELECT a/b AS r FROM t`, hasZero)).toHaveLength(1);
    expect(await detectDivByZero(`SELECT a/b AS r FROM t`, noZero)).toHaveLength(0);
  });
  it('skips an already-guarded NULLIF denominator', async () => {
    expect(await detectDivByZero(`SELECT a/NULLIF(b,0) AS r FROM t`, hasZero)).toHaveLength(0);
  });
});

describe('sql-safety: detectBareAggregate (conservative)', () => {
  const isCol = (c: string) => ['team', 'kills', 'name', 'score'].includes(c);
  it('flags a bare base column next to SUM/AVG with no GROUP BY', () => {
    expect(detectBareAggregate(`SELECT team, SUM(kills) FROM t`, isCol)).toHaveLength(1);
    expect(detectBareAggregate(`SELECT name, AVG(score) FROM t`, isCol)).toHaveLength(1);
  });
  it('skips a lone MIN/MAX (SQLite returns the extremal row)', () => {
    expect(detectBareAggregate(`SELECT team, MAX(kills) FROM t`, isCol)).toHaveLength(0);
    expect(detectBareAggregate(`SELECT name, MIN(score) FROM t`, isCol)).toHaveLength(0);
  });
  it('skips grouped queries and aggregate-only queries', () => {
    expect(detectBareAggregate(`SELECT team, SUM(kills) FROM t GROUP BY team`, isCol)).toHaveLength(0);
    expect(detectBareAggregate(`SELECT COUNT(*) FROM t`, isCol)).toHaveLength(0);
  });
});

describe('sql-safety: SourceManager.querySql wiring', () => {
  it('surfaces an integer-division warning end-to-end and stays silent otherwise', async () => {
    const mgr = new SourceManager();
    const id = (await mgr.add('sales', { type: 'csv', path: path.join(FIXTURES, 'sales.csv') })).entry!.id;

    const risky = await mgr.querySql(id, 'SELECT SUM(price)/SUM(quantity) AS r FROM sales');
    expect(risky.ok).toBe(true);
    expect(risky.warnings?.some((m) => /truncate/i.test(m))).toBe(true);

    const clean = await mgr.querySql(id, 'SELECT category, SUM(price) AS p FROM sales GROUP BY category');
    expect(clean.ok).toBe(true);
    expect(clean.warnings).toBeUndefined();
  });
});
