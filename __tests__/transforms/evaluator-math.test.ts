import { describe, it, expect } from 'vitest';
import { parse } from '../../src/transforms/parser.js';
import { evaluate } from '../../src/transforms/evaluator.js';

function ev(expr: string, row: Record<string, any> = {}) {
  return evaluate(parse(expr), { row });
}

describe('Evaluator: Math Functions', () => {
  describe('log', () => {
    it('computes natural log', () => {
      expect(ev('log(x)', { x: Math.E })).toBeCloseTo(1);
    });

    it('log(1) = 0', () => {
      expect(ev('log(x)', { x: 1 })).toBe(0);
    });

    it('log(e) ≈ 1', () => {
      expect(ev('log(x)', { x: Math.E })).toBeCloseTo(1, 10);
    });

    it('log(0) = null', () => {
      expect(ev('log(x)', { x: 0 })).toBe(null);
    });

    it('log(-1) = null', () => {
      expect(ev('log(x)', { x: -1 })).toBe(null);
    });

    it('log(null) = null', () => {
      expect(ev('log(x)', {})).toBe(null);
    });
  });

  describe('log10', () => {
    it('computes base-10 log', () => {
      expect(ev('log10(x)', { x: 1000 })).toBeCloseTo(3);
    });

    it('log10(100) = 2', () => {
      expect(ev('log10(x)', { x: 100 })).toBeCloseTo(2);
    });

    it('log10(0) = null', () => {
      expect(ev('log10(x)', { x: 0 })).toBe(null);
    });
  });

  describe('log2', () => {
    it('computes base-2 log', () => {
      expect(ev('log2(x)', { x: 4 })).toBe(2);
    });

    it('log2(8) = 3', () => {
      expect(ev('log2(x)', { x: 8 })).toBe(3);
    });

    it('log2(0) = null', () => {
      expect(ev('log2(x)', { x: 0 })).toBe(null);
    });
  });

  describe('sqrt', () => {
    it('computes square root', () => {
      expect(ev('sqrt(x)', { x: 9 })).toBe(3);
    });

    it('sqrt(0) = 0', () => {
      expect(ev('sqrt(x)', { x: 0 })).toBe(0);
    });

    it('sqrt(-1) = null', () => {
      expect(ev('sqrt(x)', { x: -1 })).toBe(null);
    });

    it('sqrt(null) = null', () => {
      expect(ev('sqrt(x)', {})).toBe(null);
    });
  });

  describe('abs', () => {
    it('positive number unchanged', () => {
      expect(ev('abs(x)', { x: 5 })).toBe(5);
    });

    it('negative number becomes positive', () => {
      expect(ev('abs(x)', { x: -5 })).toBe(5);
    });

    it('abs(0) = 0', () => {
      expect(ev('abs(x)', { x: 0 })).toBe(0);
    });

    it('abs(null) = null', () => {
      expect(ev('abs(x)', {})).toBe(null);
    });
  });

  describe('round', () => {
    it('rounds to 0 decimals by default', () => {
      expect(ev('round(x)', { x: 3.7 })).toBe(4);
    });

    it('rounds to n decimals', () => {
      expect(ev('round(x, 2)', { x: 3.14159 })).toBe(3.14);
    });

    it('round(null) = null', () => {
      expect(ev('round(x)', {})).toBe(null);
    });
  });

  describe('ceil', () => {
    it('ceiling of positive decimal', () => {
      expect(ev('ceil(x)', { x: 3.2 })).toBe(4);
    });

    it('ceiling of negative decimal', () => {
      expect(ev('ceil(x)', { x: -3.2 })).toBe(-3);
    });

    it('ceil(null) = null', () => {
      expect(ev('ceil(x)', {})).toBe(null);
    });
  });

  describe('floor', () => {
    it('floor of positive decimal', () => {
      expect(ev('floor(x)', { x: 3.7 })).toBe(3);
    });

    it('floor of negative decimal', () => {
      expect(ev('floor(x)', { x: -3.2 })).toBe(-4);
    });

    it('floor(null) = null', () => {
      expect(ev('floor(x)', {})).toBe(null);
    });
  });

  describe('exp', () => {
    it('exp(0) = 1', () => {
      expect(ev('exp(x)', { x: 0 })).toBe(1);
    });

    it('exp(1) ≈ e', () => {
      expect(ev('exp(x)', { x: 1 })).toBeCloseTo(Math.E);
    });

    it('exp(null) = null', () => {
      expect(ev('exp(x)', {})).toBe(null);
    });
  });

  describe('end-to-end composition', () => {
    it('log(abs(x)) with negative input', () => {
      expect(ev('log(abs(x))', { x: -5 })).toBeCloseTo(Math.log(5));
    });
  });
});
