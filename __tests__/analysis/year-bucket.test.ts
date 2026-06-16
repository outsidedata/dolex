import { describe, it, expect } from 'vitest';
import { isYearColumn, timeBucketing, generateCandidates } from '../../src/analysis/rules.js';
import type { ClassifiedColumn } from '../../src/analysis/types.js';

function ccol(partial: Partial<ClassifiedColumn> & { name: string; role: ClassifiedColumn['role'] }): ClassifiedColumn {
  return {
    originalType: 'numeric',
    uniqueCount: 10,
    nullCount: 0,
    totalCount: 1000,
    ...partial,
  } as ClassifiedColumn;
}

describe('year column detection & bucketing (no strftime-on-year garbage)', () => {
  it('detects year columns by name', () => {
    expect(isYearColumn(ccol({ name: 'year', role: 'time' }))).toBe(true);
    expect(isYearColumn(ccol({ name: 'release_year', role: 'time' }))).toBe(true);
    expect(isYearColumn(ccol({ name: 'fy', role: 'time' }))).toBe(true);
    expect(isYearColumn(ccol({ name: 'order_date', role: 'time' }))).toBe(false);
    expect(isYearColumn(ccol({ name: 'price', role: 'measure' }))).toBe(false);
  });

  it('detects year columns by 4-digit values', () => {
    const c = ccol({
      name: 'vintage', role: 'time', originalType: 'date',
      topValues: [{ value: '2008', count: 5 }, { value: '2009', count: 9 }, { value: '2010.0', count: 3 }],
    });
    expect(isYearColumn(c)).toBe(true);
  });

  it('year columns bucket to a clean integer year, never strftime', () => {
    const tb = timeBucketing(ccol({ name: 'year', role: 'time', uniqueCount: 40 }));
    expect(tb).not.toBeNull();
    expect(tb!.label).toBe('year');
    expect(tb!.expr).not.toMatch(/strftime/);
    expect(tb!.expr).toMatch(/CAST/);
    expect(tb!.expr).toContain('"year"');
  });

  it('real ISO date columns still use strftime buckets', () => {
    const tb = timeBucketing(ccol({
      name: 'order_date', role: 'time', originalType: 'date', uniqueCount: 300,
      topValues: [{ value: '2024-01-15', count: 5 }, { value: '2024-02-20', count: 3 }],
    }));
    expect(tb).not.toBeNull();
    expect(tb!.expr).toMatch(/strftime/);
  });

  it('non-ISO date columns are NOT bucketed (no strftime garbage)', () => {
    const tb = timeBucketing(ccol({
      name: 'schedule_date', role: 'time', originalType: 'date', uniqueCount: 300,
      topValues: [{ value: '9/2/1966', count: 5 }, { value: '12/25/1970', count: 3 }],
    }));
    expect(tb).toBeNull();
  });

  it('generateCandidates skips the trend for a non-ISO date column (but still plans others)', () => {
    const cols: ClassifiedColumn[] = [
      ccol({ name: 'schedule_date', role: 'time', originalType: 'date', uniqueCount: 100, topValues: [{ value: '9/2/1966', count: 5 }] }),
      ccol({ name: 'points', role: 'measure', originalType: 'numeric', uniqueCount: 50 }),
      ccol({ name: 'team', role: 'dimension', originalType: 'categorical', uniqueCount: 8 }),
    ];
    const steps = generateCandidates(cols, 'games');
    expect(steps.find((s) => s.category === 'trend')).toBeUndefined();
    expect(steps.length).toBeGreaterThan(0);
  });

  it('generateCandidates emits a year-bucketed trend (not strftime month) for a year+measure table', () => {
    const cols: ClassifiedColumn[] = [
      ccol({ name: 'year', role: 'time', originalType: 'date', uniqueCount: 40 }),
      ccol({ name: 'global_sales', role: 'measure', originalType: 'numeric', uniqueCount: 500 }),
    ];
    const steps = generateCandidates(cols, 'games');
    const trend = steps.find((s) => s.category === 'trend');
    expect(trend).toBeDefined();
    expect(trend!.sql).not.toMatch(/strftime\('%Y-%m'/);
    expect(trend!.sql).toMatch(/CAST.*AS INTEGER/);
  });

  it('escapes embedded double-quotes in column/table names (no malformed SQL / injection)', () => {
    const cols: ClassifiedColumn[] = [
      ccol({ name: 'order"date', role: 'time', originalType: 'date', uniqueCount: 40, topValues: [{ value: '2024-01-15', count: 2 }] }),
      ccol({ name: 'rev"enue', role: 'measure', originalType: 'numeric', uniqueCount: 100 }),
      ccol({ name: 'reg"ion', role: 'dimension', originalType: 'categorical', uniqueCount: 5 }),
    ];
    const steps = generateCandidates(cols, 'tab"le');
    expect(steps.length).toBeGreaterThan(0);
    // Every generated query references the table with doubled quotes; if escaping
    // were broken it would contain the malformed `"order"date"` instead.
    for (const s of steps) {
      expect(s.sql).toContain('"tab""le"');
      if (s.sql.includes('order')) expect(s.sql).toContain('"order""date"');
      if (s.sql.includes('enue')) expect(s.sql).toContain('"rev""enue"');
    }
  });
});
