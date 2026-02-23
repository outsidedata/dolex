import { describe, it, expect } from 'vitest';
import { parse } from '../../src/transforms/parser.js';
import {
  extractColumnRefs,
  findDependents,
  hasCircularDependency,
  topologicalSort,
} from '../../src/transforms/dependency.js';
import type { TransformRecord } from '../../src/transforms/types.js';

function makeRecord(column: string, expr: string): TransformRecord {
  return { column, expr, type: 'numeric', layer: 'derived', order: 0 };
}

describe('Dependency Analysis', () => {
  describe('extractColumnRefs', () => {
    it('simple column: "age" → ["age"]', () => {
      expect(extractColumnRefs(parse('age'))).toEqual(['age']);
    });

    it('arithmetic: "a + b" → ["a", "b"]', () => {
      expect(extractColumnRefs(parse('a + b')).sort()).toEqual(['a', 'b']);
    });

    it('function: "log(yield)" → ["yield"]', () => {
      expect(extractColumnRefs(parse('log(yield)'))).toEqual(['yield']);
    });

    it('multi-arg function: "row_mean(q1, q2, q3)" → ["q1", "q2", "q3"]', () => {
      expect(extractColumnRefs(parse('row_mean(q1, q2, q3)')).sort()).toEqual(['q1', 'q2', 'q3']);
    });

    it('nested: "log(abs(x))" → ["x"]', () => {
      expect(extractColumnRefs(parse('log(abs(x))'))).toEqual(['x']);
    });

    it('conditional: "if_else(a > 0, b, c)" → ["a", "b", "c"]', () => {
      expect(extractColumnRefs(parse('if_else(a > 0, b, c)')).sort()).toEqual(['a', 'b', 'c']);
    });

    it('no duplicates: "a + a" → ["a"]', () => {
      expect(extractColumnRefs(parse('a + a'))).toEqual(['a']);
    });

    it('backtick: "`First Name`" → ["First Name"]', () => {
      expect(extractColumnRefs(parse('`First Name`'))).toEqual(['First Name']);
    });

    it('column-wise: "zscore(score)" → ["score"]', () => {
      expect(extractColumnRefs(parse('zscore(score)'))).toEqual(['score']);
    });

    it('complex: "(score - col_mean(score)) / col_sd(score)" → ["score"]', () => {
      expect(extractColumnRefs(parse('(score - col_mean(score)) / col_sd(score)'))).toEqual(['score']);
    });
  });

  describe('findDependents', () => {
    it('no dependents', () => {
      const records = [makeRecord('a', 'x + 1'), makeRecord('b', 'y + 1')];
      expect(findDependents('x', records)).toEqual(['a']);
    });

    it('single dependent', () => {
      const records = [makeRecord('b', 'a + 1')];
      expect(findDependents('a', records)).toEqual(['b']);
    });

    it('transitive dependents: a → b → c, dropping a returns [b, c]', () => {
      const records = [
        makeRecord('b', 'a + 1'),
        makeRecord('c', 'b + 1'),
      ];
      expect(findDependents('a', records).sort()).toEqual(['b', 'c']);
    });

    it('multiple dependents of same column', () => {
      const records = [
        makeRecord('b', 'a + 1'),
        makeRecord('c', 'a * 2'),
      ];
      expect(findDependents('a', records).sort()).toEqual(['b', 'c']);
    });
  });

  describe('hasCircularDependency', () => {
    it('no cycle: a depends on source columns only', () => {
      const result = hasCircularDependency('a', 'x + 1', []);
      expect(result.circular).toBe(false);
    });

    it('simple cycle: a → b → a', () => {
      const existing = [makeRecord('b', 'a + 1')];
      const result = hasCircularDependency('a', 'b + 1', existing);
      expect(result.circular).toBe(true);
      expect(result.cycle).toBeDefined();
    });

    it('transitive cycle: a → b → c → a', () => {
      const existing = [
        makeRecord('b', 'a + 1'),
        makeRecord('c', 'b + 1'),
      ];
      const result = hasCircularDependency('a', 'c + 1', existing);
      expect(result.circular).toBe(true);
    });

    it('no cycle: a → b, c → b (shared dependency, not circular)', () => {
      const existing = [makeRecord('b', 'x + 1')];
      const result = hasCircularDependency('c', 'b + 1', existing);
      expect(result.circular).toBe(false);
    });
  });

  describe('topologicalSort', () => {
    it('independent columns: any order OK', () => {
      const records = [makeRecord('a', 'x + 1'), makeRecord('b', 'y + 1')];
      const sorted = topologicalSort(records);
      expect(sorted.length).toBe(2);
    });

    it('a depends on b: b comes first', () => {
      const records = [makeRecord('a', 'b + 1'), makeRecord('b', 'x + 1')];
      const sorted = topologicalSort(records);
      expect(sorted.map(r => r.column)).toEqual(['b', 'a']);
    });

    it('chain: a → b → c: c, b, a order', () => {
      const records = [
        makeRecord('a', 'b + 1'),
        makeRecord('b', 'c + 1'),
        makeRecord('c', 'x + 1'),
      ];
      const sorted = topologicalSort(records);
      expect(sorted.map(r => r.column)).toEqual(['c', 'b', 'a']);
    });

    it('diamond: a → b, a → c, b → d, c → d: d first', () => {
      const records = [
        makeRecord('a', 'b + c'),
        makeRecord('b', 'd + 1'),
        makeRecord('c', 'd + 2'),
        makeRecord('d', 'x + 1'),
      ];
      const sorted = topologicalSort(records);
      const order = sorted.map(r => r.column);
      expect(order.indexOf('d')).toBeLessThan(order.indexOf('b'));
      expect(order.indexOf('d')).toBeLessThan(order.indexOf('c'));
      expect(order.indexOf('b')).toBeLessThan(order.indexOf('a'));
      expect(order.indexOf('c')).toBeLessThan(order.indexOf('a'));
    });

    it('detects cycle and throws', () => {
      const records = [
        makeRecord('a', 'b + 1'),
        makeRecord('b', 'a + 1'),
      ];
      expect(() => topologicalSort(records)).toThrow(/Circular/);
    });
  });
});
