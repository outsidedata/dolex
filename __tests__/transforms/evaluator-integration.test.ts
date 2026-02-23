import { describe, it, expect } from 'vitest';
import { evaluateExpression } from '../../src/transforms/evaluator.js';

const testRows = [
  { name: 'Alice', age: 25, score: 80, gender: 'F', order_date: '2024-03-15' },
  { name: 'Bob', age: 35, score: 90, gender: 'M', order_date: '2024-06-20' },
  { name: 'Carol', age: 55, score: 70, gender: 'F', order_date: '2024-09-10' },
  { name: 'Dave', age: 17, score: 60, gender: 'M', order_date: '2024-12-01' },
  { name: 'Eve', age: 42, score: 85, gender: 'F', order_date: '2024-01-05' },
];

describe('Evaluator Integration', () => {
  describe('end-to-end expression evaluation', () => {
    it('simple arithmetic: "6 - score"', () => {
      const result = evaluateExpression('100 - score', testRows);
      expect(result.values).toEqual([20, 10, 30, 40, 15]);
      expect(result.type).toBe('numeric');
    });

    it('function: "log(age)"', () => {
      const result = evaluateExpression('log(age)', testRows);
      expect(result.values[0]).toBeCloseTo(Math.log(25));
      expect(result.type).toBe('numeric');
    });

    it('row aggregation: "row_mean(age, score)"', () => {
      const result = evaluateExpression('row_mean(age, score)', testRows);
      expect(result.values[0]).toBe(52.5); // (25+80)/2
    });

    it('column-wise: "zscore(score)"', () => {
      const result = evaluateExpression('zscore(score)', testRows);
      expect(result.type).toBe('numeric');
      expect(result.values.every((v: any) => typeof v === 'number')).toBe(true);
    });

    it('conditional: if_else(score > 80, "high", "low")', () => {
      const result = evaluateExpression('if_else(score > 80, "high", "low")', testRows);
      expect(result.values).toEqual(['low', 'high', 'low', 'low', 'high']);
      expect(result.type).toBe('categorical');
    });

    it('complex: (score - col_mean(score)) / col_sd(score)', () => {
      const result = evaluateExpression('(score - col_mean(score)) / col_sd(score)', testRows);
      const zscoreResult = evaluateExpression('zscore(score)', testRows);
      for (let i = 0; i < result.values.length; i++) {
        expect(result.values[i]).toBeCloseTo(zscoreResult.values[i], 5);
      }
    });

    it('string: lower(name)', () => {
      const result = evaluateExpression('lower(name)', testRows);
      expect(result.values).toEqual(['alice', 'bob', 'carol', 'dave', 'eve']);
      expect(result.type).toBe('categorical');
    });

    it('date: date_part(order_date, "month")', () => {
      const result = evaluateExpression('date_part(order_date, "month")', testRows);
      expect(result.values).toEqual([3, 6, 9, 12, 1]);
    });

    it('recode: recode(gender, "M", 0, "F", 1)', () => {
      const result = evaluateExpression('recode(gender, "M", 0, "F", 1)', testRows);
      expect(result.values).toEqual([1, 0, 1, 0, 1]);
    });

    it('cut: cut(age, [0, 18, 65, 100], ["youth", "adult", "senior"])', () => {
      const result = evaluateExpression('cut(age, [0, 18, 65, 100], ["youth", "adult", "senior"])', testRows);
      expect(result.values).toEqual(['adult', 'adult', 'adult', 'youth', 'adult']);
      expect(result.type).toBe('categorical');
    });
  });

  describe('column validation', () => {
    it('throws on missing column with suggestion', () => {
      expect(() => evaluateExpression('scroe + 1', testRows)).toThrow(/score/);
    });

    it('accepts backtick-quoted column', () => {
      const rows = [{ 'First Name': 'Alice' }];
      const result = evaluateExpression('`First Name`', rows);
      expect(result.values).toEqual(['Alice']);
    });
  });

  describe('type inference', () => {
    it('arithmetic → numeric', () => {
      expect(evaluateExpression('age + 1', testRows).type).toBe('numeric');
    });

    it('comparison → boolean', () => {
      expect(evaluateExpression('age > 30', testRows).type).toBe('boolean');
    });

    it('if_else with strings → categorical', () => {
      expect(evaluateExpression('if_else(age > 30, "old", "young")', testRows).type).toBe('categorical');
    });

    it('if_else with numbers → numeric', () => {
      expect(evaluateExpression('if_else(age > 30, 1, 0)', testRows).type).toBe('numeric');
    });

    it('string function → categorical', () => {
      expect(evaluateExpression('upper(name)', testRows).type).toBe('categorical');
    });

    it('cut → categorical', () => {
      expect(evaluateExpression('cut(age, [0, 50, 100])', testRows).type).toBe('categorical');
    });
  });

  describe('warnings', () => {
    it('warns on >20% null output', () => {
      const rows = [{ x: 1 }, { x: null }, { x: null }, { x: 4 }];
      const result = evaluateExpression('x + 1', rows);
      expect(result.warnings.some(w => w.includes('null'))).toBe(true);
    });

    it('warns on constant output', () => {
      const rows = [{ x: 5 }, { x: 5 }, { x: 5 }];
      const result = evaluateExpression('x', rows);
      expect(result.warnings.some(w => w.includes('Constant'))).toBe(true);
    });

    it('warns on all null output', () => {
      const rows = [{ x: null }, { x: null }];
      const result = evaluateExpression('x + 1', rows);
      expect(result.warnings.some(w => w.includes('All output values are null'))).toBe(true);
    });
  });

  describe('filter', () => {
    it('evaluates only matching rows', () => {
      const result = evaluateExpression('score * 2', testRows, {
        filter: [{ field: 'gender', op: '=', value: 'F' }],
      });
      // F rows: Alice(80), Carol(70), Eve(85) → 160, 140, 170
      // M rows: Bob, Dave → null
      expect(result.values[0]).toBe(160);
      expect(result.values[1]).toBe(null);
      expect(result.values[2]).toBe(140);
      expect(result.values[3]).toBe(null);
      expect(result.values[4]).toBe(170);
    });

    it('non-matching rows get null', () => {
      const result = evaluateExpression('age', testRows, {
        filter: [{ field: 'age', op: '>', value: 40 }],
      });
      expect(result.values[0]).toBe(null); // 25
      expect(result.values[2]).toBe(55);
      expect(result.values[4]).toBe(42);
    });

    it('stats reflect only evaluated rows', () => {
      const result = evaluateExpression('age', testRows, {
        filter: [{ field: 'age', op: '>', value: 40 }],
      });
      expect(result.stats.min).toBe(42);
      expect(result.stats.max).toBe(55);
    });
  });

  describe('stats', () => {
    it('correct min/max/mean for numeric output', () => {
      const result = evaluateExpression('score', testRows);
      expect(result.stats.min).toBe(60);
      expect(result.stats.max).toBe(90);
      expect(result.stats.mean).toBe(77);
    });

    it('correct null count', () => {
      const rows = [{ x: 1 }, { x: null }, { x: 3 }];
      const result = evaluateExpression('x', rows);
      expect(result.stats.nulls).toBe(1);
    });

    it('correct row count', () => {
      const result = evaluateExpression('score', testRows);
      expect(result.stats.rows).toBe(5);
    });
  });
});
