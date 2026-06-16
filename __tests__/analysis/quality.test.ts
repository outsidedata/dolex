import { describe, it, expect } from 'vitest';
import { auditColumns, type QualityFinding } from '../../src/analysis/quality.js';
import type { DataColumn } from '../../src/types.js';

function col(partial: Partial<DataColumn> & { name: string }): DataColumn {
  return {
    type: 'categorical',
    sampleValues: [],
    uniqueCount: 0,
    nullCount: 0,
    totalCount: 100,
    ...partial,
  } as DataColumn;
}

function issues(findings: QualityFinding[]): string[] {
  return findings.map((f) => f.issue);
}
function find(findings: QualityFinding[], issue: string): QualityFinding | undefined {
  return findings.find((f) => f.issue === issue);
}

describe('auditColumns data-quality heuristics', () => {
  it('flags an all-null column as high severity', () => {
    const f = auditColumns('t', [col({ name: 'x', type: 'numeric', nullCount: 100, totalCount: 100 })], 100);
    expect(find(f, 'all-null')?.severity).toBe('high');
  });

  it('flags a mostly-null column as medium', () => {
    const f = auditColumns('t', [col({ name: 'x', type: 'numeric', nullCount: 60, totalCount: 100, uniqueCount: 5 })], 100);
    expect(find(f, 'mostly-null')?.severity).toBe('medium');
  });

  it('flags a mixed numeric/text column as high (lexicographic risk)', () => {
    const f = auditColumns('t', [
      col({ name: 'amount', type: 'categorical', sampleValues: ['10', '20', 'N/A', '30', '40'], uniqueCount: 5 }),
    ], 100);
    const mixed = find(f, 'mixed-type');
    expect(mixed?.severity).toBe('high');
  });

  it('notes all-numeric text with leading zeros (low severity, not a code witch-hunt)', () => {
    const f = auditColumns('t', [
      col({ name: 'zip', type: 'categorical', sampleValues: ['00501', '00502', '00503'], uniqueCount: 50 }),
    ], 100);
    expect(find(f, 'numeric-text')?.severity).toBe('low');
  });

  it('does NOT flag zero-padded values on date-part columns (month/hour)', () => {
    const f = auditColumns('t', [
      col({ name: 'month', type: 'categorical', sampleValues: ['01', '02', '03', '12'], uniqueCount: 12 }),
    ], 100);
    expect(find(f, 'numeric-text')).toBeUndefined();
  });

  it('flags a genuinely constant column', () => {
    const f = auditColumns('t', [
      col({ name: 'flag', type: 'categorical', uniqueCount: 1, topValues: [{ value: 'Y', count: 100 }] }),
    ], 100);
    expect(find(f, 'constant')?.severity).toBe('medium');
  });

  it('does NOT call a sparse flag (mostly blank + a few Y) a constant', () => {
    // 175 blanks + 2 'Y' → one distinct non-empty value, but the blank-vs-Y is signal.
    const f = auditColumns('t', [
      col({ name: 'tie', type: 'categorical', uniqueCount: 1, totalCount: 177, topValues: [{ value: 'Y', count: 2 }] }),
    ], 177);
    expect(find(f, 'constant')).toBeUndefined();
  });

  it('flags a non-ISO date column as a time-series footgun', () => {
    const f = auditColumns('t', [
      col({ name: 'schedule_date', type: 'date', uniqueCount: 200, sampleValues: ['9/2/1966', '12/25/1970', '1/1/2000'] }),
    ], 200);
    expect(find(f, 'non-iso-date')?.severity).toBe('medium');
  });

  it('does NOT flag an ISO date column as non-iso', () => {
    const f = auditColumns('t', [
      col({ name: 'order_date', type: 'date', uniqueCount: 200, sampleValues: ['1872-11-30', '2024-01-15'] }),
    ], 200);
    expect(find(f, 'non-iso-date')).toBeUndefined();
  });

  it('flags an unambiguous missing-value sentinel among categories', () => {
    const f = auditColumns('t', [
      col({ name: 'cat', type: 'categorical', uniqueCount: 3, topValues: [{ value: 'a', count: 50 }, { value: 'N/A', count: 10 }] }),
    ], 100);
    expect(find(f, 'sentinel-value')?.severity).toBe('medium');
  });

  it('does NOT flag ambiguous tokens like "na" (Namibia) or "none" as sentinels', () => {
    const f = auditColumns('t', [
      col({ name: 'country', type: 'categorical', uniqueCount: 3, topValues: [{ value: 'us', count: 40 }, { value: 'na', count: 30 }, { value: 'uk', count: 30 }] }),
    ], 100);
    expect(find(f, 'sentinel-value')).toBeUndefined();
  });

  it('flags numeric outliers beyond 3×IQR (advisory)', () => {
    const f = auditColumns('t', [
      col({ name: 'val', type: 'numeric', uniqueCount: 50, stats: { min: 0, max: 1000, mean: 5, median: 4, stddev: 50, p25: 3, p75: 6 } }),
    ], 100);
    expect(find(f, 'outliers')?.severity).toBe('low');
  });

  it('flags a zero minimum on a measurement-like column', () => {
    const f = auditColumns('t', [
      col({ name: 'price', type: 'numeric', uniqueCount: 50, stats: { min: 0, max: 100, mean: 50, median: 50, stddev: 10, p25: 40, p75: 60 } }),
    ], 100);
    expect(find(f, 'suspicious-zero')).toBeDefined();
  });

  it('flags an id-like categorical (near-unique)', () => {
    const f = auditColumns('t', [col({ name: 'code', type: 'text', uniqueCount: 99, nullCount: 0, totalCount: 100 })], 100);
    expect(find(f, 'id-like')?.severity).toBe('low');
  });

  it('flags a column name needing quoting (footgun)', () => {
    const f = auditColumns('t', [col({ name: 'World Wide Sales (in $)', type: 'numeric', uniqueCount: 50 })], 100);
    expect(find(f, 'special-char-name')).toBeDefined();
  });

  it('notes a year column', () => {
    const f = auditColumns('t', [
      col({ name: 'year', type: 'date', sampleValues: ['2019', '2020', '2021'], uniqueCount: 3 }),
    ], 100);
    expect(find(f, 'year-column')).toBeDefined();
  });

  it('reports nothing for a clean, well-typed column', () => {
    const f = auditColumns('t', [
      col({ name: 'region', type: 'categorical', sampleValues: ['North', 'South', 'East', 'West'], uniqueCount: 4, nullCount: 0 }),
    ], 100);
    expect(issues(f)).toEqual([]);
  });
});
