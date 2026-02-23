import { describe, it, expect } from 'vitest';
import { parse } from '../../src/transforms/parser.js';
import { evaluate } from '../../src/transforms/evaluator.js';
import { precompute, findColumnWiseCalls } from '../../src/transforms/column-functions.js';

// Test dataset: scores = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20]
// mean = 11, sd ≈ 6.0553 (sample)
const testRows = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20].map(v => ({ score: v, group: v <= 10 ? 'A' : 'B' }));
const testMean = 11;
const testSd = Math.sqrt([2,4,6,8,10,12,14,16,18,20].reduce((s, v) => s + (v - 11) ** 2, 0) / 9);

function evAll(expr: string, rows: Record<string, any>[], partitionBy?: string): any[] {
  const ast = parse(expr);
  const pre = precompute(ast, rows, partitionBy);
  return rows.map((row, i) => evaluate(ast, { row, rowIndex: i, precomputed: pre }));
}

describe('Column-wise Functions', () => {
  describe('col_mean', () => {
    it('computes mean of column', () => {
      const results = evAll('col_mean(score)', testRows);
      expect(results[0]).toBeCloseTo(testMean);
    });

    it('excludes nulls', () => {
      const rows = [{ score: 10 }, { score: 20 }, { score: null }];
      const results = evAll('col_mean(score)', rows);
      expect(results[0]).toBe(15);
    });

    it('all null → null', () => {
      const rows = [{ score: null }, { score: null }];
      const results = evAll('col_mean(score)', rows);
      expect(results[0]).toBe(null);
    });

    it('returns same scalar for every row', () => {
      const results = evAll('col_mean(score)', testRows);
      for (const r of results) expect(r).toBeCloseTo(testMean);
    });
  });

  describe('col_sd', () => {
    it('computes sample std dev', () => {
      const results = evAll('col_sd(score)', testRows);
      expect(results[0]).toBeCloseTo(testSd);
    });

    it('excludes nulls', () => {
      const rows = [{ score: 10 }, { score: 20 }, { score: null }];
      const results = evAll('col_sd(score)', rows);
      expect(results[0]).toBeCloseTo(Math.sqrt(50), 5);
    });

    it('single value → 0', () => {
      const rows = [{ score: 5 }];
      const results = evAll('col_sd(score)', rows);
      expect(results[0]).toBe(0);
    });
  });

  describe('col_min', () => {
    it('finds minimum', () => {
      const results = evAll('col_min(score)', testRows);
      expect(results[0]).toBe(2);
    });

    it('excludes nulls', () => {
      const rows = [{ score: 10 }, { score: null }, { score: 5 }];
      const results = evAll('col_min(score)', rows);
      expect(results[0]).toBe(5);
    });
  });

  describe('col_max', () => {
    it('finds maximum', () => {
      const results = evAll('col_max(score)', testRows);
      expect(results[0]).toBe(20);
    });

    it('excludes nulls', () => {
      const rows = [{ score: 10 }, { score: null }, { score: 5 }];
      const results = evAll('col_max(score)', rows);
      expect(results[0]).toBe(10);
    });
  });

  describe('col_median', () => {
    it('computes median (even count, interpolation)', () => {
      const results = evAll('col_median(score)', testRows);
      // 10 values: median = (10 + 12) / 2 = 11
      expect(results[0]).toBe(11);
    });

    it('computes median (odd count)', () => {
      const rows = [{ score: 1 }, { score: 3 }, { score: 5 }];
      const results = evAll('col_median(score)', rows);
      expect(results[0]).toBe(3);
    });

    it('excludes nulls', () => {
      const rows = [{ score: 1 }, { score: null }, { score: 5 }];
      const results = evAll('col_median(score)', rows);
      expect(results[0]).toBe(3);
    });
  });

  describe('zscore', () => {
    it('correct z-scores for known data', () => {
      const results = evAll('zscore(score)', testRows);
      // First value: (2 - 11) / sd = -9/sd
      expect(results[0]).toBeCloseTo(-9 / testSd, 5);
      // Mean value position
      expect(results[4]).toBeCloseTo((10 - testMean) / testSd, 5);
    });

    it('null input → null output', () => {
      const rows = [{ score: 10 }, { score: null }, { score: 20 }];
      const results = evAll('zscore(score)', rows);
      expect(results[1]).toBe(null);
    });

    it('excludes nulls from mean/sd calculation', () => {
      const rows = [{ score: 10 }, { score: null }, { score: 20 }];
      const results = evAll('zscore(score)', rows);
      // mean = 15, sd = sqrt((25+25)/1) = sqrt(50)
      expect(results[0]).toBeCloseTo((10 - 15) / Math.sqrt(50), 5);
    });

    it('zero variance (all same) → null', () => {
      const rows = [{ score: 5 }, { score: 5 }, { score: 5 }];
      const results = evAll('zscore(score)', rows);
      expect(results[0]).toBe(null);
    });
  });

  describe('center', () => {
    it('correct centering for known data', () => {
      const results = evAll('center(score)', testRows);
      expect(results[0]).toBeCloseTo(2 - testMean);
      expect(results[9]).toBeCloseTo(20 - testMean);
    });

    it('null input → null output', () => {
      const rows = [{ score: 10 }, { score: null }];
      const results = evAll('center(score)', rows);
      expect(results[1]).toBe(null);
    });
  });

  describe('rank', () => {
    it('dense ranking for distinct values', () => {
      const results = evAll('rank(score)', testRows);
      expect(results[0]).toBe(1); // score=2, lowest
      expect(results[9]).toBe(10); // score=20, highest
    });

    it('ties get same rank', () => {
      const rows = [{ score: 10 }, { score: 5 }, { score: 10 }, { score: 15 }];
      const results = evAll('rank(score)', rows);
      expect(results[0]).toBe(2); // 10 is second rank
      expect(results[1]).toBe(1); // 5 is first rank
      expect(results[2]).toBe(2); // 10 ties
      expect(results[3]).toBe(3); // 15 is third rank
    });

    it('null excluded from ranking', () => {
      const rows = [{ score: 10 }, { score: null }, { score: 5 }];
      const results = evAll('rank(score)', rows);
      expect(results[0]).toBe(2);
      expect(results[1]).toBe(null);
      expect(results[2]).toBe(1);
    });
  });

  describe('percentile_rank', () => {
    it('correct percentile ranks', () => {
      const results = evAll('percentile_rank(score)', testRows);
      expect(results[0]).toBeCloseTo(0); // lowest
      expect(results[9]).toBeCloseTo(1); // highest
    });

    it('null excluded', () => {
      const rows = [{ score: 10 }, { score: null }, { score: 20 }];
      const results = evAll('percentile_rank(score)', rows);
      expect(results[1]).toBe(null);
    });

    it('single value → 0', () => {
      const rows = [{ score: 5 }];
      const results = evAll('percentile_rank(score)', rows);
      expect(results[0]).toBe(0);
    });
  });

  describe('ntile', () => {
    it('quartiles (n=4) for 20 rows', () => {
      const rows = Array.from({ length: 20 }, (_, i) => ({ score: i + 1 }));
      const results = evAll('ntile(score, 4)', rows);
      expect(results[0]).toBe(1);
      expect(results[4]).toBe(1);
      expect(results[5]).toBe(2);
      expect(results[19]).toBe(4);
    });

    it('terciles (n=3)', () => {
      const rows = Array.from({ length: 9 }, (_, i) => ({ score: i + 1 }));
      const results = evAll('ntile(score, 3)', rows);
      expect(results[0]).toBe(1);
      expect(results[3]).toBe(2);
      expect(results[6]).toBe(3);
    });

    it('null excluded', () => {
      const rows = [{ score: 1 }, { score: null }, { score: 3 }, { score: 4 }];
      const results = evAll('ntile(score, 2)', rows);
      expect(results[1]).toBe(null);
    });
  });

  describe('partitioned computation', () => {
    it('zscore partitioned by group column', () => {
      const results = evAll('zscore(score)', testRows, 'group');
      // Group A: [2,4,6,8,10], mean=6, sd=sqrt(10)
      // Group B: [12,14,16,18,20], mean=16, sd=sqrt(10)
      const meanA = 6, sdA = Math.sqrt(10);
      expect(results[0]).toBeCloseTo((2 - meanA) / sdA, 5);
      expect(results[5]).toBeCloseTo((12 - 16) / Math.sqrt(10), 5);
    });

    it('col_mean partitioned: each group has different mean', () => {
      const results = evAll('col_mean(score)', testRows, 'group');
      // Group A mean = 6, Group B mean = 16
      expect(results[0]).toBe(6);
      expect(results[5]).toBe(16);
    });

    it('rank partitioned: ranks restart per group', () => {
      const results = evAll('rank(score)', testRows, 'group');
      // Group A: [2,4,6,8,10] → ranks 1-5
      expect(results[0]).toBe(1);
      expect(results[4]).toBe(5);
      // Group B: [12,14,16,18,20] → ranks 1-5
      expect(results[5]).toBe(1);
      expect(results[9]).toBe(5);
    });

    it('single-member group: zscore → null (sd=0)', () => {
      const rows = [{ score: 5, group: 'X' }, { score: 10, group: 'Y' }];
      const results = evAll('zscore(score)', rows, 'group');
      expect(results[0]).toBe(null); // single member
      expect(results[1]).toBe(null); // single member
    });
  });

  describe('mixed expressions', () => {
    it('zscore(col) + 10', () => {
      const results = evAll('zscore(score) + 10', testRows);
      expect(results[0]).toBeCloseTo((-9 / testSd) + 10, 5);
    });

    it('abs(zscore(col))', () => {
      const results = evAll('abs(zscore(score))', testRows);
      expect(results[0]).toBeCloseTo(Math.abs(-9 / testSd), 5);
    });

    it('(col - col_mean(col)) / col_sd(col) — manual zscore', () => {
      const results = evAll('(score - col_mean(score)) / col_sd(score)', testRows);
      // Should match zscore
      const zscoreResults = evAll('zscore(score)', testRows);
      for (let i = 0; i < results.length; i++) {
        if (zscoreResults[i] === null) continue;
        expect(results[i]).toBeCloseTo(zscoreResults[i], 5);
      }
    });

    it('col_min + col_max (two different column-wise in one expr)', () => {
      const results = evAll('col_min(score) + col_max(score)', testRows);
      expect(results[0]).toBe(22); // 2 + 20
    });
  });

  describe('pre-computation', () => {
    it('correctly identifies column-wise nodes in AST', () => {
      const ast = parse('zscore(score) + col_mean(age)');
      const calls = findColumnWiseCalls(ast);
      expect(calls).toHaveLength(2);
      expect(calls[0]).toEqual({ name: 'zscore', columnName: 'score', extra: undefined });
      expect(calls[1]).toEqual({ name: 'col_mean', columnName: 'age', extra: undefined });
    });

    it('handles column-wise inside if_else', () => {
      const ast = parse('if_else(zscore(score) > 2, "outlier", "normal")');
      const calls = findColumnWiseCalls(ast);
      expect(calls).toHaveLength(1);
      expect(calls[0].name).toBe('zscore');
    });
  });
});
