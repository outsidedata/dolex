import { describe, it, expect } from 'vitest';
import { parse } from '../../src/transforms/parser.js';
import { evaluate } from '../../src/transforms/evaluator.js';

function ev(expr: string, row: Record<string, any> = {}) {
  return evaluate(parse(expr), { row });
}

describe('Evaluator: Arithmetic', () => {
  describe('literals', () => {
    it('evaluates number literal', () => {
      expect(ev('42')).toBe(42);
    });

    it('evaluates string literal', () => {
      expect(ev('"hello"')).toBe('hello');
    });

    it('evaluates boolean literal', () => {
      expect(ev('true')).toBe(true);
      expect(ev('false')).toBe(false);
    });
  });

  describe('column references', () => {
    it('reads column from scope', () => {
      expect(ev('age', { age: 25 })).toBe(25);
    });

    it('returns null for missing column', () => {
      expect(ev('age', {})).toBe(null);
    });

    it('reads backtick-quoted column with spaces', () => {
      expect(ev('`First Name`', { 'First Name': 'Alice' })).toBe('Alice');
    });
  });

  describe('addition', () => {
    it('adds two numbers', () => {
      expect(ev('3 + 4')).toBe(7);
    });

    it('adds column and literal', () => {
      expect(ev('age + 1', { age: 25 })).toBe(26);
    });

    it('null propagation: null + 5 = null', () => {
      expect(ev('x + 5', {})).toBe(null);
    });

    it('string concatenation: "a" + "b" = "ab"', () => {
      expect(ev('"a" + "b"')).toBe('ab');
    });
  });

  describe('subtraction', () => {
    it('subtracts two numbers', () => {
      expect(ev('10 - 3')).toBe(7);
    });

    it('reverse-code pattern: 6 - rse_2', () => {
      expect(ev('6 - rse_2', { rse_2: 4 })).toBe(2);
    });

    it('null propagation', () => {
      expect(ev('x - 1', {})).toBe(null);
    });
  });

  describe('multiplication', () => {
    it('multiplies two numbers', () => {
      expect(ev('3 * 4')).toBe(12);
    });

    it('null propagation', () => {
      expect(ev('x * 2', {})).toBe(null);
    });
  });

  describe('division', () => {
    it('divides two numbers', () => {
      expect(ev('10 / 2')).toBe(5);
    });

    it('division by zero returns null', () => {
      expect(ev('10 / 0')).toBe(null);
    });

    it('null propagation', () => {
      expect(ev('x / 2', {})).toBe(null);
    });
  });

  describe('modulo', () => {
    it('computes modulo', () => {
      expect(ev('10 % 3')).toBe(1);
    });

    it('modulo by zero returns null', () => {
      expect(ev('10 % 0')).toBe(null);
    });
  });

  describe('power', () => {
    it('computes power', () => {
      expect(ev('2 ^ 3')).toBe(8);
    });

    it('null propagation', () => {
      expect(ev('x ^ 2', {})).toBe(null);
    });
  });

  describe('operator precedence', () => {
    it('multiplication before addition (end-to-end)', () => {
      expect(ev('2 + 3 * 4')).toBe(14);
    });

    it('parentheses override (end-to-end)', () => {
      expect(ev('(2 + 3) * 4')).toBe(20);
    });

    it('complex expression: (a + b) / 2', () => {
      expect(ev('(a + b) / 2', { a: 10, b: 20 })).toBe(15);
    });
  });

  describe('comparison operators', () => {
    it('equals: 5 == 5', () => {
      expect(ev('5 == 5')).toBe(true);
    });

    it('not equals: 5 != 3', () => {
      expect(ev('5 != 3')).toBe(true);
    });

    it('greater than', () => {
      expect(ev('5 > 3')).toBe(true);
      expect(ev('3 > 5')).toBe(false);
    });

    it('greater than or equal', () => {
      expect(ev('5 >= 5')).toBe(true);
      expect(ev('4 >= 5')).toBe(false);
    });

    it('less than', () => {
      expect(ev('3 < 5')).toBe(true);
    });

    it('less than or equal', () => {
      expect(ev('5 <= 5')).toBe(true);
    });

    it('null comparison returns false (except ==)', () => {
      expect(ev('x > 0', {})).toBe(null);
      // null == null is true via JS loose equality
      expect(ev('x == x', {})).toBe(true);
    });
  });

  describe('logical operators', () => {
    it('and: true && true', () => {
      expect(ev('true && true')).toBe(true);
    });

    it('and: true && false', () => {
      expect(ev('true && false')).toBe(false);
    });

    it('or: true || false', () => {
      expect(ev('true || false')).toBe(true);
    });

    it('not: !true', () => {
      expect(ev('!true')).toBe(false);
    });

    it('combined: a > 0 && b < 10', () => {
      expect(ev('a > 0 && b < 10', { a: 5, b: 3 })).toBe(true);
      expect(ev('a > 0 && b < 10', { a: -1, b: 3 })).toBe(false);
    });
  });

  describe('unary operators', () => {
    it('negation: -5', () => {
      expect(ev('-5')).toBe(-5);
    });

    it('negation of column value', () => {
      expect(ev('-x', { x: 10 })).toBe(-10);
    });

    it('logical not of boolean', () => {
      expect(ev('!flag', { flag: true })).toBe(false);
    });
  });
});
