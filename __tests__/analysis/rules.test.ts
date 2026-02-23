import { describe, it, expect } from 'vitest';
import { generateCandidates } from '../../src/analysis/rules.js';
import type { ClassifiedColumn } from '../../src/analysis/types.js';

function cc(name: string, role: ClassifiedColumn['role'], overrides: Partial<ClassifiedColumn> = {}): ClassifiedColumn {
  return {
    name, role, originalType: role === 'measure' ? 'numeric' : role === 'time' ? 'date' : 'categorical',
    uniqueCount: 10, nullCount: 0, totalCount: 100,
    ...overrides,
  };
}

describe('generateCandidates', () => {
  const table = 'sales';

  it('generates a time trend when date + measure exist', () => {
    const cols = [cc('order_date', 'time'), cc('revenue', 'measure')];
    const candidates = generateCandidates(cols, table);
    const trend = candidates.find(c => c.category === 'trend');
    expect(trend).toBeDefined();
    expect(trend!.sql).toContain('GROUP BY');
    expect(trend!.suggestedPatterns).toContain('line');
  });

  it('generates a comparison when dimension + measure exist', () => {
    const cols = [cc('region', 'dimension', { uniqueCount: 5 }), cc('revenue', 'measure')];
    const candidates = generateCandidates(cols, table);
    const comp = candidates.find(c => c.category === 'comparison');
    expect(comp).toBeDefined();
    expect(comp!.sql).toContain('GROUP BY');
  });

  it('generates a distribution when a measure exists', () => {
    const cols = [cc('revenue', 'measure')];
    const candidates = generateCandidates(cols, table);
    const dist = candidates.find(c => c.category === 'distribution');
    expect(dist).toBeDefined();
  });

  it('generates a relationship when 2+ measures exist', () => {
    const cols = [cc('revenue', 'measure'), cc('quantity', 'measure')];
    const candidates = generateCandidates(cols, table);
    const rel = candidates.find(c => c.category === 'relationship');
    expect(rel).toBeDefined();
    expect(rel!.suggestedPatterns).toContain('scatter');
  });

  it('does not generate relationship with only 1 measure', () => {
    const cols = [cc('revenue', 'measure'), cc('region', 'dimension')];
    const candidates = generateCandidates(cols, table);
    const rel = candidates.find(c => c.category === 'relationship');
    expect(rel).toBeUndefined();
  });

  it('generates a ranking for high-cardinality dimensions', () => {
    const cols = [cc('product', 'dimension', { uniqueCount: 40 }), cc('revenue', 'measure')];
    const candidates = generateCandidates(cols, table);
    const ranking = candidates.find(c => c.category === 'ranking');
    expect(ranking).toBeDefined();
    expect(ranking!.sql).toContain('LIMIT');
    expect(ranking!.sql).toContain('ORDER BY');
  });

  it('generates composition when hierarchy + measure exist', () => {
    const cols = [
      cc('region', 'dimension', { uniqueCount: 4 }),
      cc('city', 'hierarchy', { uniqueCount: 20 }),
      cc('revenue', 'measure'),
    ];
    const candidates = generateCandidates(cols, table);
    const comp = candidates.find(c => c.category === 'composition');
    expect(comp).toBeDefined();
    expect(comp!.suggestedPatterns.some(p => ['treemap', 'sunburst'].includes(p))).toBe(true);
  });

  it('generates trend-by-group when time + dimension + measure exist', () => {
    const cols = [
      cc('order_date', 'time'),
      cc('region', 'dimension', { uniqueCount: 4 }),
      cc('revenue', 'measure'),
    ];
    const candidates = generateCandidates(cols, table);
    const trendGroup = candidates.filter(c => c.category === 'trend');
    // Should have a multi-group trend with both time and dimension in GROUP BY
    const multiGroup = trendGroup.find(c => c.sql.includes('region'));
    expect(multiGroup).toBeDefined();
  });

  it('returns empty array when only id/text columns', () => {
    const cols = [cc('user_id', 'id'), cc('notes', 'text')];
    const candidates = generateCandidates(cols, table);
    expect(candidates).toEqual([]);
  });
});
