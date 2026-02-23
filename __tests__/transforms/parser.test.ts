import { describe, it, expect } from 'vitest';
import { parse, ParseError } from '../../src/transforms/parser.js';
import type { AstNode, BinaryOp, FunctionCall, ColumnRef, UnaryOp, ArrayLiteral } from '../../src/transforms/types.js';

// Helpers
import type { NumberLiteral, StringLiteral, BooleanLiteral } from '../../src/transforms/types.js';
function col(name: string): ColumnRef { return { type: 'column', name }; }
function num(value: number): NumberLiteral { return { type: 'number', value }; }
function str(value: string): StringLiteral { return { type: 'string', value }; }
function bool(value: boolean): BooleanLiteral { return { type: 'boolean', value }; }
function bin(op: string, left: AstNode, right: AstNode): BinaryOp { return { type: 'binary', op, left, right }; }
function un(op: string, operand: AstNode): UnaryOp { return { type: 'unary', op, operand }; }
function call(name: string, args: AstNode[]): FunctionCall { return { type: 'call', name, args }; }
function arr(elements: AstNode[]): ArrayLiteral { return { type: 'array', elements }; }

describe('Parser', () => {
  describe('atoms', () => {
    it('parses integer literal', () => {
      expect(parse('42')).toEqual(num(42));
    });

    it('parses decimal literal', () => {
      expect(parse('3.14')).toEqual(num(3.14));
    });

    it('parses leading-dot decimal', () => {
      expect(parse('.5')).toEqual(num(0.5));
    });

    it('parses string literal', () => {
      expect(parse('"hello"')).toEqual(str('hello'));
    });

    it('parses empty string literal', () => {
      expect(parse('""')).toEqual(str(''));
    });

    it('parses simple column reference', () => {
      expect(parse('age')).toEqual(col('age'));
    });

    it('parses backtick column reference', () => {
      expect(parse('`First Name`')).toEqual(col('First Name'));
    });

    it('parses boolean true', () => {
      expect(parse('true')).toEqual(bool(true));
    });

    it('parses boolean false', () => {
      expect(parse('false')).toEqual(bool(false));
    });

    it('parses parenthesized expression', () => {
      expect(parse('(42)')).toEqual(num(42));
    });

    it('parses array literal', () => {
      expect(parse('[1, 2, 3]')).toEqual(arr([num(1), num(2), num(3)]));
    });

    it('parses empty array literal', () => {
      expect(parse('[]')).toEqual(arr([]));
    });
  });

  describe('function calls', () => {
    it('parses zero-arg function', () => {
      expect(parse('now()')).toEqual(call('now', []));
    });

    it('parses single-arg function', () => {
      expect(parse('log(x)')).toEqual(call('log', [col('x')]));
    });

    it('parses multi-arg function', () => {
      expect(parse('row_mean(a, b, c)')).toEqual(call('row_mean', [col('a'), col('b'), col('c')]));
    });

    it('parses nested function calls', () => {
      expect(parse('log(abs(x))')).toEqual(call('log', [call('abs', [col('x')])]));
    });

    it('parses function with literal args', () => {
      expect(parse('round(3.14, 2)')).toEqual(call('round', [num(3.14), num(2)]));
    });

    it('parses function with mixed arg types', () => {
      expect(parse('if_else(x, "yes", "no")')).toEqual(
        call('if_else', [col('x'), str('yes'), str('no')])
      );
    });

    it('parses function with array arg: cut(x, [1,2,3])', () => {
      expect(parse('cut(x, [1, 2, 3])')).toEqual(
        call('cut', [col('x'), arr([num(1), num(2), num(3)])])
      );
    });

    it('parses function with expression args: round(a + b, 2)', () => {
      expect(parse('round(a + b, 2)')).toEqual(
        call('round', [bin('+', col('a'), col('b')), num(2)])
      );
    });

    it('distinguishes function call from column ref', () => {
      expect(parse('x').type).toBe('column');
      expect(parse('x()').type).toBe('call');
    });
  });

  describe('unary operators', () => {
    it('parses negation: -x', () => {
      expect(parse('-x')).toEqual(un('-', col('x')));
    });

    it('parses logical not: !flag', () => {
      expect(parse('!flag')).toEqual(un('!', col('flag')));
    });

    it('parses double negation: --x', () => {
      expect(parse('--x')).toEqual(un('-', un('-', col('x'))));
    });

    it('parses negation of function: -log(x)', () => {
      expect(parse('-log(x)')).toEqual(un('-', call('log', [col('x')])));
    });

    it('parses negation of parenthesized: -(a + b)', () => {
      expect(parse('-(a + b)')).toEqual(un('-', bin('+', col('a'), col('b'))));
    });
  });

  describe('arithmetic operators', () => {
    it('parses addition', () => {
      expect(parse('a + b')).toEqual(bin('+', col('a'), col('b')));
    });

    it('parses subtraction', () => {
      expect(parse('a - b')).toEqual(bin('-', col('a'), col('b')));
    });

    it('parses multiplication', () => {
      expect(parse('a * b')).toEqual(bin('*', col('a'), col('b')));
    });

    it('parses division', () => {
      expect(parse('a / b')).toEqual(bin('/', col('a'), col('b')));
    });

    it('parses modulo', () => {
      expect(parse('a % b')).toEqual(bin('%', col('a'), col('b')));
    });

    it('parses power', () => {
      expect(parse('a ^ b')).toEqual(bin('^', col('a'), col('b')));
    });
  });

  describe('operator precedence', () => {
    it('multiplication before addition: a + b * c', () => {
      expect(parse('a + b * c')).toEqual(
        bin('+', col('a'), bin('*', col('b'), col('c')))
      );
    });

    it('parentheses override precedence: (a + b) * c', () => {
      expect(parse('(a + b) * c')).toEqual(
        bin('*', bin('+', col('a'), col('b')), col('c'))
      );
    });

    it('left-associative addition: a - b + c', () => {
      expect(parse('a - b + c')).toEqual(
        bin('+', bin('-', col('a'), col('b')), col('c'))
      );
    });

    it('left-associative multiplication: a / b * c', () => {
      expect(parse('a / b * c')).toEqual(
        bin('*', bin('/', col('a'), col('b')), col('c'))
      );
    });

    it('unary before binary: -a + b', () => {
      expect(parse('-a + b')).toEqual(
        bin('+', un('-', col('a')), col('b'))
      );
    });

    it('complex nested: (a + b) * c / (d - e)', () => {
      expect(parse('(a + b) * c / (d - e)')).toEqual(
        bin('/', bin('*', bin('+', col('a'), col('b')), col('c')), bin('-', col('d'), col('e')))
      );
    });
  });

  describe('comparison operators', () => {
    it('parses >', () => {
      expect(parse('a > b')).toEqual(bin('>', col('a'), col('b')));
    });

    it('parses >=', () => {
      expect(parse('a >= b')).toEqual(bin('>=', col('a'), col('b')));
    });

    it('parses <', () => {
      expect(parse('a < b')).toEqual(bin('<', col('a'), col('b')));
    });

    it('parses <=', () => {
      expect(parse('a <= b')).toEqual(bin('<=', col('a'), col('b')));
    });

    it('parses ==', () => {
      expect(parse('a == b')).toEqual(bin('==', col('a'), col('b')));
    });

    it('parses !=', () => {
      expect(parse('a != b')).toEqual(bin('!=', col('a'), col('b')));
    });

    it('comparison lower precedence than arithmetic: a + 1 > b', () => {
      expect(parse('a + 1 > b')).toEqual(
        bin('>', bin('+', col('a'), num(1)), col('b'))
      );
    });
  });

  describe('logical operators', () => {
    it('parses &&', () => {
      expect(parse('a && b')).toEqual(bin('&&', col('a'), col('b')));
    });

    it('parses ||', () => {
      expect(parse('a || b')).toEqual(bin('||', col('a'), col('b')));
    });

    it('parses combined: a > 0 && b < 10', () => {
      expect(parse('a > 0 && b < 10')).toEqual(
        bin('&&', bin('>', col('a'), num(0)), bin('<', col('b'), num(10)))
      );
    });

    it('parses chained: a || b || c', () => {
      expect(parse('a || b || c')).toEqual(
        bin('||', bin('||', col('a'), col('b')), col('c'))
      );
    });

    it('logical lower precedence than comparison', () => {
      expect(parse('a > 1 || b < 2')).toEqual(
        bin('||', bin('>', col('a'), num(1)), bin('<', col('b'), num(2)))
      );
    });
  });

  describe('real-world expressions from spec', () => {
    it('6 - rse_2 (reverse code)', () => {
      expect(parse('6 - rse_2')).toEqual(bin('-', num(6), col('rse_2')));
    });

    it('row_mean(gad7_1, gad7_2, gad7_3, gad7_4, gad7_5, gad7_6, gad7_7)', () => {
      const ast = parse('row_mean(gad7_1, gad7_2, gad7_3, gad7_4, gad7_5, gad7_6, gad7_7)');
      expect(ast.type).toBe('call');
      expect((ast as FunctionCall).name).toBe('row_mean');
      expect((ast as FunctionCall).args).toHaveLength(7);
    });

    it('log(yield)', () => {
      expect(parse('log(yield)')).toEqual(call('log', [col('yield')]));
    });

    it('if_else(score > 3, "high", "low")', () => {
      expect(parse('if_else(score > 3, "high", "low")')).toEqual(
        call('if_else', [bin('>', col('score'), num(3)), str('high'), str('low')])
      );
    });

    it('case(age < 18, "minor", age < 65, "adult", "senior")', () => {
      const ast = parse('case(age < 18, "minor", age < 65, "adult", "senior")');
      expect(ast.type).toBe('call');
      expect((ast as FunctionCall).name).toBe('case');
      expect((ast as FunctionCall).args).toHaveLength(5);
    });

    it('(val - col_min(val)) / (col_max(val) - col_min(val))', () => {
      const ast = parse('(val - col_min(val)) / (col_max(val) - col_min(val))');
      expect(ast.type).toBe('binary');
      expect((ast as BinaryOp).op).toBe('/');
    });

    it('cut(age, [0, 18, 35, 65, 100], ["youth", "young_adult", "adult", "senior"])', () => {
      const ast = parse('cut(age, [0, 18, 35, 65, 100], ["youth", "young_adult", "adult", "senior"])');
      expect(ast.type).toBe('call');
      expect((ast as FunctionCall).name).toBe('cut');
      expect((ast as FunctionCall).args).toHaveLength(3);
      expect((ast as FunctionCall).args[1].type).toBe('array');
      expect((ast as FunctionCall).args[2].type).toBe('array');
    });

    it('recode(gender, "M", 0, "F", 1)', () => {
      const ast = parse('recode(gender, "M", 0, "F", 1)');
      expect(ast.type).toBe('call');
      expect((ast as FunctionCall).args).toHaveLength(5);
    });

    it('score - col_mean(score)', () => {
      expect(parse('score - col_mean(score)')).toEqual(
        bin('-', col('score'), call('col_mean', [col('score')]))
      );
    });
  });

  describe('error handling', () => {
    it('throws on unexpected token with position', () => {
      expect(() => parse('a + + b')).toThrow(ParseError);
    });

    it('throws on missing closing paren', () => {
      expect(() => parse('log(x')).toThrow(ParseError);
      expect(() => parse('log(x')).toThrow(/\)/);
    });

    it('throws on missing closing bracket', () => {
      expect(() => parse('[1, 2')).toThrow(ParseError);
    });

    it('throws on trailing tokens', () => {
      expect(() => parse('a b')).toThrow(ParseError);
      expect(() => parse('a b')).toThrow(/Unexpected token/);
    });

    it('throws on empty expression', () => {
      expect(() => parse('')).toThrow(ParseError);
    });

    it('error message includes position indicator', () => {
      try {
        parse('a b');
        expect.fail('should throw');
      } catch (e) {
        expect((e as ParseError).message).toContain('^');
      }
    });

    it('error message includes source expression snippet', () => {
      try {
        parse('log(x');
        expect.fail('should throw');
      } catch (e) {
        expect((e as ParseError).message).toContain('log(x');
      }
    });
  });
});
