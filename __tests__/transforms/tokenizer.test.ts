import { describe, it, expect } from 'vitest';
import { tokenize, TokenizeError } from '../../src/transforms/tokenizer.js';

describe('Tokenizer', () => {
  describe('numbers', () => {
    it('tokenizes integer', () => {
      const tokens = tokenize('42');
      expect(tokens[0]).toEqual({ type: 'NUMBER', value: '42', pos: 0 });
    });

    it('tokenizes decimal', () => {
      const tokens = tokenize('3.14');
      expect(tokens[0]).toEqual({ type: 'NUMBER', value: '3.14', pos: 0 });
    });

    it('tokenizes leading-dot decimal', () => {
      const tokens = tokenize('.5');
      expect(tokens[0]).toEqual({ type: 'NUMBER', value: '.5', pos: 0 });
    });

    it('tokenizes zero', () => {
      const tokens = tokenize('0');
      expect(tokens[0]).toEqual({ type: 'NUMBER', value: '0', pos: 0 });
    });

    it('tokenizes multi-digit integer', () => {
      const tokens = tokenize('12345');
      expect(tokens[0]).toEqual({ type: 'NUMBER', value: '12345', pos: 0 });
    });

    it('does not tokenize negative (unary minus separate)', () => {
      const tokens = tokenize('-5');
      expect(tokens[0].type).toBe('MINUS');
      expect(tokens[1].type).toBe('NUMBER');
      expect(tokens[1].value).toBe('5');
    });
  });

  describe('strings', () => {
    it('tokenizes simple string', () => {
      const tokens = tokenize('"hello"');
      expect(tokens[0]).toEqual({ type: 'STRING', value: 'hello', pos: 0 });
    });

    it('tokenizes string with spaces', () => {
      const tokens = tokenize('"young adult"');
      expect(tokens[0]).toEqual({ type: 'STRING', value: 'young adult', pos: 0 });
    });

    it('tokenizes empty string', () => {
      const tokens = tokenize('""');
      expect(tokens[0]).toEqual({ type: 'STRING', value: '', pos: 0 });
    });

    it('tokenizes string with special characters', () => {
      const tokens = tokenize('"a+b=c"');
      expect(tokens[0]).toEqual({ type: 'STRING', value: 'a+b=c', pos: 0 });
    });

    it('throws on unterminated string', () => {
      expect(() => tokenize('"hello')).toThrow(TokenizeError);
    });

    it('reports correct position for unterminated string', () => {
      try {
        tokenize('x + "hello');
        expect.fail('should throw');
      } catch (e) {
        expect(e).toBeInstanceOf(TokenizeError);
        expect((e as TokenizeError).pos).toBe(4);
      }
    });
  });

  describe('identifiers', () => {
    it('tokenizes simple identifier', () => {
      const tokens = tokenize('age');
      expect(tokens[0]).toEqual({ type: 'IDENT', value: 'age', pos: 0 });
    });

    it('tokenizes identifier with underscores', () => {
      const tokens = tokenize('gad7_1');
      expect(tokens[0]).toEqual({ type: 'IDENT', value: 'gad7_1', pos: 0 });
    });

    it('tokenizes identifier with digits', () => {
      const tokens = tokenize('score2');
      expect(tokens[0]).toEqual({ type: 'IDENT', value: 'score2', pos: 0 });
    });

    it('tokenizes identifier starting with underscore', () => {
      const tokens = tokenize('_temp');
      expect(tokens[0]).toEqual({ type: 'IDENT', value: '_temp', pos: 0 });
    });

    it('tokenizes single-letter identifier', () => {
      const tokens = tokenize('x');
      expect(tokens[0]).toEqual({ type: 'IDENT', value: 'x', pos: 0 });
    });
  });

  describe('backtick identifiers', () => {
    it('tokenizes backtick with spaces', () => {
      const tokens = tokenize('`First Name`');
      expect(tokens[0]).toEqual({ type: 'BACKTICK_IDENT', value: 'First Name', pos: 0 });
    });

    it('tokenizes backtick with dots', () => {
      const tokens = tokenize('`Score.Pre`');
      expect(tokens[0]).toEqual({ type: 'BACKTICK_IDENT', value: 'Score.Pre', pos: 0 });
    });

    it('tokenizes backtick with parens', () => {
      const tokens = tokenize('`Response Time (ms)`');
      expect(tokens[0]).toEqual({ type: 'BACKTICK_IDENT', value: 'Response Time (ms)', pos: 0 });
    });

    it('throws on unterminated backtick', () => {
      expect(() => tokenize('`hello')).toThrow(TokenizeError);
      expect(() => tokenize('`hello')).toThrow(/Unterminated identifier/);
    });
  });

  describe('operators', () => {
    it('tokenizes arithmetic operators: +, -, *, /, %, ^', () => {
      const tokens = tokenize('+ - * / % ^');
      expect(tokens.map(t => t.type)).toEqual(['PLUS', 'MINUS', 'STAR', 'SLASH', 'PERCENT', 'CARET', 'EOF']);
    });

    it('tokenizes comparison operators: >, <, >=, <=, ==, !=', () => {
      const tokens = tokenize('> < >= <= == !=');
      expect(tokens.map(t => t.type)).toEqual(['GT', 'LT', 'GTE', 'LTE', 'EQ', 'NEQ', 'EOF']);
    });

    it('tokenizes logical operators: &&, ||, !', () => {
      const tokens = tokenize('&& || !');
      expect(tokens.map(t => t.type)).toEqual(['AND', 'OR', 'NOT', 'EOF']);
    });

    it('tokenizes single ! (not)', () => {
      const tokens = tokenize('!flag');
      expect(tokens[0]).toEqual({ type: 'NOT', value: '!', pos: 0 });
    });

    it('distinguishes > from >=', () => {
      const tokens = tokenize('>>=');
      expect(tokens[0].type).toBe('GT');
      expect(tokens[1].type).toBe('GTE');
    });

    it('distinguishes < from <=', () => {
      const tokens = tokenize('<<=');
      expect(tokens[0].type).toBe('LT');
      expect(tokens[1].type).toBe('LTE');
    });

    it('distinguishes ! from !=', () => {
      const tokens = tokenize('!a != b');
      expect(tokens[0].type).toBe('NOT');
      expect(tokens[2].type).toBe('NEQ');
    });
  });

  describe('delimiters', () => {
    it('tokenizes parentheses', () => {
      const tokens = tokenize('()');
      expect(tokens[0].type).toBe('LPAREN');
      expect(tokens[1].type).toBe('RPAREN');
    });

    it('tokenizes brackets', () => {
      const tokens = tokenize('[]');
      expect(tokens[0].type).toBe('LBRACKET');
      expect(tokens[1].type).toBe('RBRACKET');
    });

    it('tokenizes comma', () => {
      const tokens = tokenize(',');
      expect(tokens[0].type).toBe('COMMA');
    });
  });

  describe('whitespace', () => {
    it('skips leading whitespace', () => {
      const tokens = tokenize('  42');
      expect(tokens[0]).toEqual({ type: 'NUMBER', value: '42', pos: 2 });
    });

    it('skips trailing whitespace', () => {
      const tokens = tokenize('42  ');
      expect(tokens[0].type).toBe('NUMBER');
      expect(tokens[1].type).toBe('EOF');
    });

    it('skips multiple spaces between tokens', () => {
      const tokens = tokenize('a    +    b');
      expect(tokens.map(t => t.type)).toEqual(['IDENT', 'PLUS', 'IDENT', 'EOF']);
    });

    it('skips tabs and newlines', () => {
      const tokens = tokenize('a\t+\nb');
      expect(tokens.map(t => t.type)).toEqual(['IDENT', 'PLUS', 'IDENT', 'EOF']);
    });
  });

  describe('full expressions', () => {
    it('tokenizes arithmetic: 6 - rse_2', () => {
      const tokens = tokenize('6 - rse_2');
      expect(tokens.map(t => t.type)).toEqual(['NUMBER', 'MINUS', 'IDENT', 'EOF']);
    });

    it('tokenizes function call: log(yield)', () => {
      const tokens = tokenize('log(yield)');
      expect(tokens.map(t => t.type)).toEqual(['IDENT', 'LPAREN', 'IDENT', 'RPAREN', 'EOF']);
      expect(tokens[0].value).toBe('log');
      expect(tokens[2].value).toBe('yield');
    });

    it('tokenizes multi-arg function: row_mean(a, b, c)', () => {
      const tokens = tokenize('row_mean(a, b, c)');
      expect(tokens.map(t => t.type)).toEqual([
        'IDENT', 'LPAREN', 'IDENT', 'COMMA', 'IDENT', 'COMMA', 'IDENT', 'RPAREN', 'EOF',
      ]);
    });

    it('tokenizes nested function: log(abs(x))', () => {
      const tokens = tokenize('log(abs(x))');
      expect(tokens.map(t => t.type)).toEqual([
        'IDENT', 'LPAREN', 'IDENT', 'LPAREN', 'IDENT', 'RPAREN', 'RPAREN', 'EOF',
      ]);
    });

    it('tokenizes conditional: if_else(score > 3, "high", "low")', () => {
      const tokens = tokenize('if_else(score > 3, "high", "low")');
      expect(tokens.map(t => t.type)).toEqual([
        'IDENT', 'LPAREN', 'IDENT', 'GT', 'NUMBER', 'COMMA', 'STRING', 'COMMA', 'STRING', 'RPAREN', 'EOF',
      ]);
    });

    it('tokenizes array: cut(age, [0, 18, 35])', () => {
      const tokens = tokenize('cut(age, [0, 18, 35])');
      expect(tokens.map(t => t.type)).toEqual([
        'IDENT', 'LPAREN', 'IDENT', 'COMMA',
        'LBRACKET', 'NUMBER', 'COMMA', 'NUMBER', 'COMMA', 'NUMBER', 'RBRACKET',
        'RPAREN', 'EOF',
      ]);
    });

    it('tokenizes backtick in function: zscore(`Response Time (ms)`)', () => {
      const tokens = tokenize('zscore(`Response Time (ms)`)');
      expect(tokens.map(t => t.type)).toEqual([
        'IDENT', 'LPAREN', 'BACKTICK_IDENT', 'RPAREN', 'EOF',
      ]);
      expect(tokens[2].value).toBe('Response Time (ms)');
    });

    it('tokenizes complex: (a + b) / 2 * c', () => {
      const tokens = tokenize('(a + b) / 2 * c');
      expect(tokens.map(t => t.type)).toEqual([
        'LPAREN', 'IDENT', 'PLUS', 'IDENT', 'RPAREN', 'SLASH', 'NUMBER', 'STAR', 'IDENT', 'EOF',
      ]);
    });

    it('tokenizes boolean ops: a > 0 && b < 10', () => {
      const tokens = tokenize('a > 0 && b < 10');
      expect(tokens.map(t => t.type)).toEqual([
        'IDENT', 'GT', 'NUMBER', 'AND', 'IDENT', 'LT', 'NUMBER', 'EOF',
      ]);
    });
  });

  describe('errors', () => {
    it('throws on invalid character with position', () => {
      try {
        tokenize('@');
        expect.fail('should throw');
      } catch (e) {
        expect(e).toBeInstanceOf(TokenizeError);
        expect((e as TokenizeError).pos).toBe(0);
      }
    });

    it('every token has correct pos field', () => {
      // "a + b" → positions 0, 2, 4
      const tokens = tokenize('a + b');
      expect(tokens[0].pos).toBe(0);
      expect(tokens[1].pos).toBe(2);
      expect(tokens[2].pos).toBe(4);
    });

    it('EOF token has correct position', () => {
      const tokens = tokenize('abc');
      const eof = tokens[tokens.length - 1];
      expect(eof.type).toBe('EOF');
      expect(eof.pos).toBe(3);
    });
  });
});
