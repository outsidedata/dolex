import { describe, it, expect } from 'vitest';
import { parse } from '../../src/transforms/parser.js';
import { evaluate } from '../../src/transforms/evaluator.js';

function ev(expr: string, row: Record<string, any> = {}) {
  return evaluate(parse(expr), { row });
}

describe('Row-wise Functions', () => {
  describe('row_mean', () => {
    it('computes mean of values', () => {
      expect(ev('row_mean(a, b, c)', { a: 2, b: 4, c: 6 })).toBe(4);
    });

    it('skips nulls', () => {
      expect(ev('row_mean(a, b, c)', { a: 2, c: 6 })).toBe(4);
    });

    it('all null returns null', () => {
      expect(ev('row_mean(a, b)', {})).toBe(null);
    });

    it('single value returns itself', () => {
      expect(ev('row_mean(a)', { a: 5 })).toBe(5);
    });

    it('handles numeric strings', () => {
      expect(ev('row_mean(a, b)', { a: '3', b: 7 })).toBe(5);
    });
  });

  describe('row_sum', () => {
    it('sums values', () => {
      expect(ev('row_sum(a, b, c)', { a: 1, b: 2, c: 3 })).toBe(6);
    });

    it('skips nulls', () => {
      expect(ev('row_sum(a, b, c)', { a: 1, c: 3 })).toBe(4);
    });

    it('all null returns null', () => {
      expect(ev('row_sum(a, b)', {})).toBe(null);
    });
  });

  describe('row_min', () => {
    it('finds minimum', () => {
      expect(ev('row_min(a, b, c)', { a: 3, b: 1, c: 5 })).toBe(1);
    });

    it('skips nulls', () => {
      expect(ev('row_min(a, b, c)', { a: 3, c: 5 })).toBe(3);
    });
  });

  describe('row_max', () => {
    it('finds maximum', () => {
      expect(ev('row_max(a, b, c)', { a: 3, b: 1, c: 5 })).toBe(5);
    });

    it('skips nulls', () => {
      expect(ev('row_max(a, b, c)', { b: 1, c: 5 })).toBe(5);
    });
  });

  describe('row_sd', () => {
    it('computes std dev', () => {
      // [2, 4, 6] → mean=4, var=((2-4)²+(4-4)²+(6-4)²)/2 = 4, sd=2
      expect(ev('row_sd(a, b, c)', { a: 2, b: 4, c: 6 })).toBe(2);
    });

    it('single value returns 0', () => {
      expect(ev('row_sd(a)', { a: 5 })).toBe(0);
    });

    it('skips nulls', () => {
      expect(ev('row_sd(a, b, c)', { a: 2, c: 6 })).toBeCloseTo(Math.sqrt(8), 5);
    });
  });

  describe('row_count_null', () => {
    it('counts nulls', () => {
      expect(ev('row_count_null(a, b, c)', { a: 1, c: 3 })).toBe(1);
    });

    it('no nulls returns 0', () => {
      expect(ev('row_count_null(a, b)', { a: 1, b: 2 })).toBe(0);
    });
  });

  describe('row_count_valid', () => {
    it('counts non-nulls', () => {
      expect(ev('row_count_valid(a, b, c)', { a: 1, c: 3 })).toBe(2);
    });

    it('all nulls returns 0', () => {
      expect(ev('row_count_valid(a, b)', {})).toBe(0);
    });
  });

  describe('if_else', () => {
    it('true condition returns true_val', () => {
      expect(ev('if_else(true, "yes", "no")')).toBe('yes');
    });

    it('false condition returns false_val', () => {
      expect(ev('if_else(false, "yes", "no")')).toBe('no');
    });

    it('condition is null returns false_val', () => {
      expect(ev('if_else(x, "yes", "no")', {})).toBe('no');
    });

    it('nested: if_else(if_else(...))', () => {
      expect(ev('if_else(true, if_else(false, "a", "b"), "c")')).toBe('b');
    });
  });

  describe('case', () => {
    it('first matching branch', () => {
      expect(ev('case(true, "first", false, "second")')).toBe('first');
    });

    it('second matching branch', () => {
      expect(ev('case(false, "first", true, "second")')).toBe('second');
    });

    it('default value (odd args)', () => {
      expect(ev('case(false, "first", false, "second", "default")')).toBe('default');
    });

    it('no match, no default → null', () => {
      expect(ev('case(false, "first", false, "second")')).toBe(null);
    });

    it('multiple conditions, last matches', () => {
      expect(ev('case(false, "a", false, "b", true, "c", "d")')).toBe('c');
    });
  });

  describe('coalesce', () => {
    it('returns first non-null', () => {
      expect(ev('coalesce(a, b, c)', { b: 5, c: 10 })).toBe(5);
    });

    it('all null returns null', () => {
      expect(ev('coalesce(a, b)', {})).toBe(null);
    });

    it('single arg', () => {
      expect(ev('coalesce(a)', { a: 42 })).toBe(42);
    });
  });

  describe('is_null', () => {
    it('null returns true', () => {
      expect(ev('is_null(x)', {})).toBe(true);
    });

    it('non-null returns false', () => {
      expect(ev('is_null(x)', { x: 5 })).toBe(false);
    });
  });

  describe('fill_null', () => {
    it('null replaced with value', () => {
      expect(ev('fill_null(x, 0)', {})).toBe(0);
    });

    it('non-null unchanged', () => {
      expect(ev('fill_null(x, 0)', { x: 5 })).toBe(5);
    });
  });

  describe('null_if', () => {
    it('matching value → null', () => {
      expect(ev('null_if(x, 999)', { x: 999 })).toBe(null);
    });

    it('non-matching value → unchanged', () => {
      expect(ev('null_if(x, 999)', { x: 5 })).toBe(5);
    });
  });

  describe('in', () => {
    it('value in list → true', () => {
      expect(ev('in(x, 1, 2, 3)', { x: 2 })).toBe(true);
    });

    it('value not in list → false', () => {
      expect(ev('in(x, 1, 2, 3)', { x: 5 })).toBe(false);
    });

    it('null → false', () => {
      expect(ev('in(x, 1, 2, 3)', {})).toBe(false);
    });
  });

  describe('between', () => {
    it('value in range → true', () => {
      expect(ev('between(x, 1, 10)', { x: 5 })).toBe(true);
    });

    it('value below range → false', () => {
      expect(ev('between(x, 1, 10)', { x: 0 })).toBe(false);
    });

    it('value above range → false', () => {
      expect(ev('between(x, 1, 10)', { x: 11 })).toBe(false);
    });

    it('inclusive boundaries', () => {
      expect(ev('between(x, 1, 10)', { x: 1 })).toBe(true);
      expect(ev('between(x, 1, 10)', { x: 10 })).toBe(true);
    });
  });

  describe('lower', () => {
    it('lowercases string', () => {
      expect(ev('lower(x)', { x: 'HELLO' })).toBe('hello');
    });

    it('null → null', () => {
      expect(ev('lower(x)', {})).toBe(null);
    });
  });

  describe('upper', () => {
    it('uppercases string', () => {
      expect(ev('upper(x)', { x: 'hello' })).toBe('HELLO');
    });

    it('null → null', () => {
      expect(ev('upper(x)', {})).toBe(null);
    });
  });

  describe('trim', () => {
    it('trims whitespace', () => {
      expect(ev('trim(x)', { x: '  hello  ' })).toBe('hello');
    });

    it('null → null', () => {
      expect(ev('trim(x)', {})).toBe(null);
    });
  });

  describe('concat', () => {
    it('concatenates strings', () => {
      expect(ev('concat(a, b)', { a: 'hello', b: ' world' })).toBe('hello world');
    });

    it('null becomes empty string', () => {
      expect(ev('concat(a, b)', { a: 'hello' })).toBe('hello');
    });

    it('numbers coerced to string', () => {
      expect(ev('concat(a, b)', { a: 'val:', b: 42 })).toBe('val:42');
    });
  });

  describe('str_contains', () => {
    it('found → true', () => {
      expect(ev('str_contains(x, "ell")', { x: 'hello' })).toBe(true);
    });

    it('not found → false', () => {
      expect(ev('str_contains(x, "xyz")', { x: 'hello' })).toBe(false);
    });

    it('case sensitive', () => {
      expect(ev('str_contains(x, "Hello")', { x: 'hello' })).toBe(false);
    });

    it('null → null', () => {
      expect(ev('str_contains(x, "a")', {})).toBe(null);
    });
  });

  describe('str_replace', () => {
    it('replaces substring', () => {
      expect(ev('str_replace(x, "world", "there")', { x: 'hello world' })).toBe('hello there');
    });

    it('no match → unchanged', () => {
      expect(ev('str_replace(x, "xyz", "abc")', { x: 'hello' })).toBe('hello');
    });

    it('null → null', () => {
      expect(ev('str_replace(x, "a", "b")', {})).toBe(null);
    });
  });

  describe('str_length', () => {
    it('returns length', () => {
      expect(ev('str_length(x)', { x: 'hello' })).toBe(5);
    });

    it('empty string → null (empty CSV cell = missing data)', () => {
      expect(ev('str_length(x)', { x: '' })).toBe(null);
    });

    it('null → null', () => {
      expect(ev('str_length(x)', {})).toBe(null);
    });
  });

  describe('date_diff', () => {
    it('days between dates', () => {
      expect(ev('date_diff(a, b, "days")', { a: '2024-01-10', b: '2024-01-01' })).toBeCloseTo(9, 0);
    });

    it('months between dates', () => {
      expect(ev('date_diff(a, b, "months")', { a: '2024-06-15', b: '2024-01-15' })).toBe(5);
    });

    it('years between dates', () => {
      expect(ev('date_diff(a, b, "years")', { a: '2024-01-01', b: '2020-01-01' })).toBe(4);
    });

    it('invalid date → null', () => {
      expect(ev('date_diff(a, b, "days")', { a: 'not-a-date', b: '2024-01-01' })).toBe(null);
    });
  });

  describe('date_part', () => {
    it('extracts year', () => {
      expect(ev('date_part(d, "year")', { d: '2024-06-15' })).toBe(2024);
    });

    it('extracts month', () => {
      expect(ev('date_part(d, "month")', { d: '2024-06-15' })).toBe(6);
    });

    it('extracts day', () => {
      expect(ev('date_part(d, "day")', { d: '2024-06-15' })).toBe(15);
    });

    it('extracts weekday', () => {
      // 2024-06-15 is Saturday = 6
      expect(ev('date_part(d, "weekday")', { d: '2024-06-15' })).toBe(6);
    });

    it('extracts quarter', () => {
      expect(ev('date_part(d, "quarter")', { d: '2024-06-15' })).toBe(2);
    });

    it('invalid date → null', () => {
      expect(ev('date_part(d, "year")', { d: 'not-a-date' })).toBe(null);
    });
  });

  describe('date_floor', () => {
    it('floors to month', () => {
      expect(ev('date_floor(d, "month")', { d: '2024-06-15' })).toBe('2024-06-01');
    });

    it('floors to year', () => {
      expect(ev('date_floor(d, "year")', { d: '2024-06-15' })).toBe('2024-01-01');
    });

    it('floors to week', () => {
      // 2024-06-15 is Saturday; floor to previous Sunday = 2024-06-09
      const result = ev('date_floor(d, "week")', { d: '2024-06-15' });
      expect(result).toBe('2024-06-09');
    });
  });

  describe('recode', () => {
    it('maps matching value', () => {
      expect(ev('recode(g, "M", 0, "F", 1)', { g: 'M' })).toBe(0);
    });

    it('maps second value', () => {
      expect(ev('recode(g, "M", 0, "F", 1)', { g: 'F' })).toBe(1);
    });

    it('default for unmatched', () => {
      expect(ev('recode(g, "M", 0, "F", 1, 99)', { g: 'X' })).toBe(99);
    });

    it('no default → null for unmatched', () => {
      expect(ev('recode(g, "M", 0, "F", 1)', { g: 'X' })).toBe(null);
    });

    it('null input → null', () => {
      expect(ev('recode(g, "M", 0)', {})).toBe(null);
    });
  });

  describe('cut', () => {
    it('bins value into labeled category', () => {
      expect(ev('cut(age, [0, 18, 65, 100], ["youth", "adult", "senior"])', { age: 25 })).toBe('adult');
    });

    it('value at boundary (inclusive lower)', () => {
      expect(ev('cut(age, [0, 18, 65, 100], ["youth", "adult", "senior"])', { age: 18 })).toBe('adult');
    });

    it('value below lowest break → null', () => {
      expect(ev('cut(age, [0, 18, 65, 100], ["youth", "adult", "senior"])', { age: -1 })).toBe(null);
    });

    it('value above highest break → null', () => {
      expect(ev('cut(age, [0, 18, 65, 100], ["youth", "adult", "senior"])', { age: 101 })).toBe(null);
    });

    it('auto-labels when labels omitted', () => {
      const result = ev('cut(age, [0, 18, 65, 100])', { age: 25 });
      expect(result).toBe('18-65');
    });
  });
});
