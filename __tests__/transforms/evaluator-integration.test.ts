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

    it('errors on all-null output (never silently persist a dead column)', () => {
      const rows = [{ x: null }, { x: null }];
      expect(() => evaluateExpression('x + 1', rows)).toThrow(/null for all|all-null column/i);
    });

    it('treats a non-finite (Infinity) literal as null — never persists +Inf (red-team #11)', () => {
      // 1e400 overflows to IEEE Infinity; it must become null, not a "valid"
      // numeric. An all-Infinity column therefore trips the all-null guard.
      const rows = [{ x: 1 }, { x: 2 }];
      expect(() => evaluateExpression('1e400', rows)).toThrow(/null for all|all-null column/i);
      expect(() => evaluateExpression('x * 1e400', rows)).toThrow(/null for all|all-null column/i);
    });

    it('non-finite values count as null in stats (no Infinity reported as a valid number)', () => {
      // division by zero -> Infinity in JS; must be null, not Infinity.
      const rows = [{ x: 1, z: 0 }, { x: 2, z: 2 }];
      const r = evaluateExpression('x / z', rows);
      expect(r.values[0]).toBeNull();      // 1/0 -> Infinity -> null
      expect(r.values[1]).toBe(1);          // 2/2 -> 1
      expect(r.values.some((v) => v === Infinity || v === -Infinity)).toBe(false);
    });
  });

  // A double-quoted string is a LITERAL; columns use backticks (or bare names).
  // A literal that matches a column name silently computes garbage — must error.
  describe('misquoted column guard', () => {
    const rows = [
      { price: 10, carat: 2 },
      { price: 30, carat: 3 },
    ];

    it('errors when a quoted literal matches a column name in arithmetic', () => {
      expect(() => evaluateExpression('"price" - "carat"', rows)).toThrow(/Misquoted column|backticks/i);
      expect(() => evaluateExpression('"price" * 2', rows)).toThrow(/Misquoted column|backticks/i);
    });

    it('errors for misquoted column inside a function argument', () => {
      expect(() => evaluateExpression('log("price")', rows)).toThrow(/Misquoted column|backticks/i);
    });

    it('accepts backtick column references', () => {
      const r = evaluateExpression('`price` - `carat`', rows);
      expect(r.values).toEqual([8, 27]);
    });

    it('accepts bare column references', () => {
      const r = evaluateExpression('price - carat', rows);
      expect(r.values).toEqual([8, 27]);
    });

    it('exempts a genuine `column == "value"` comparison even if the value matches a column name', () => {
      // Here "status" is both a literal value and a column name; the comparison
      // is against the `state` column, so it is a legitimate value comparison.
      const r = [
        { state: 'status', status: 1 },
        { state: 'other', status: 0 },
      ];
      const out = evaluateExpression('state == "status"', r);
      expect(out.values).toEqual([true, false]);
    });

    it('flags a non-equality comparison against a column-name literal', () => {
      expect(() => evaluateExpression('price > "carat"', rows)).toThrow(/Misquoted column|backticks/i);
    });

    it('does NOT flag a string literal in a string-arg position even if it matches a column (GOTCHA #10)', () => {
      // "year" matches the `year` column but here it is the date_part PART name —
      // a legit string literal, not a misquoted column. Must not throw.
      const r = [
        { year: 2020, ts: '2021-05-01' },
        { year: 2019, ts: '2022-06-01' },
      ];
      const out = evaluateExpression('date_part(ts, "year")', r);
      expect(out.values).toEqual([2021, 2022]);
    });

    it('still flags a misquoted column in a NUMERIC function arg (log)', () => {
      expect(() => evaluateExpression('log("price")', rows)).toThrow(/Misquoted column|backticks/i);
    });

    it('flags a misquoted column at the VALUE arg0 of coalesce/concat/in/cut (red-team #10)', () => {
      // arg0 of these is a value/column slot, NOT a string-literal slot — a quoted
      // column name there is the footgun the guard exists to catch.
      expect(() => evaluateExpression('coalesce("price", 0)', rows)).toThrow(/Misquoted column|backticks/i);
      expect(() => evaluateExpression('concat("price", "_x")', rows)).toThrow(/Misquoted column|backticks/i);
      expect(() => evaluateExpression('cut("price", [0, 5, 10], ["lo", "hi"])', rows)).toThrow(/Misquoted column|backticks/i);
    });

    it('still exempts genuine string-literal positions (str_contains needle, date_part part)', () => {
      const r = [{ name: 'priceless', price: 1 }, { name: 'cheap', price: 2 }];
      // searching for the text "price" — legit, even though a `price` column exists
      const out = evaluateExpression('str_contains(name, "price")', r);
      expect(out.values).toEqual([true, false]);
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
