/**
 * Recursive descent parser for the Dolex expression language.
 *
 * Grammar (precedence low → high):
 *   expr     → logic
 *   logic    → compare (("&&" | "||") compare)*
 *   compare  → add ((">" | ">=" | "<" | "<=" | "==" | "!=") add)*
 *   add      → multiply (("+" | "-") multiply)*
 *   multiply → power (("*" | "/" | "%") power)*
 *   power    → unary ("^" unary)*
 *   unary    → ("-" | "!") unary | call
 *   call     → IDENT "(" args ")" | atom
 *   atom     → NUMBER | STRING | IDENT | BACKTICK_IDENT | "(" expr ")" | "[" elements "]"
 */
import type { AstNode, Token, TokenType } from './types.js';
import { tokenize } from './tokenizer.js';

export class ParseError extends Error {
  constructor(message: string, public pos: number, public source?: string) {
    super(message);
    this.name = 'ParseError';
  }
}

const COMPARE_OPS: ReadonlySet<TokenType> = new Set(['GT', 'GTE', 'LT', 'LTE', 'EQ', 'NEQ']);

const TOKEN_DISPLAY: Partial<Record<TokenType, string>> = {
  RPAREN: ')',
  LPAREN: '(',
  RBRACKET: ']',
  LBRACKET: '[',
  COMMA: ',',
  EOF: 'end of expression',
};

function tokenTypeToString(type: TokenType): string {
  return TOKEN_DISPLAY[type] ?? type;
}

export function parse(input: string): AstNode {
  const tokens = tokenize(input);
  let cursor = 0;

  function peek(): Token {
    return tokens[cursor];
  }

  function advance(): Token {
    return tokens[cursor++];
  }

  function expect(type: TokenType): Token {
    const t = peek();
    if (t.type !== type) {
      throw makeError(`Expected '${tokenTypeToString(type)}' but got '${t.value || t.type}'`, t.pos);
    }
    return advance();
  }

  function match(...types: TokenType[]): Token | null {
    if (types.includes(peek().type)) {
      return advance();
    }
    return null;
  }

  function makeError(message: string, pos: number): ParseError {
    let full = `ParseError: ${message} at position ${pos}`;
    if (input.length > 0) {
      full += `\n  Expression: ${input}\n  ${' '.repeat(14 + pos)}^`;
    }
    return new ParseError(full, pos, input);
  }

  /**
   * Parses a left-associative binary operator level.
   * `operand` parses the next-higher-precedence level.
   * `types` are the token types that match operators at this level.
   */
  function parseBinaryLeft(operand: () => AstNode, ...types: TokenType[]): AstNode {
    let left = operand();
    while (types.includes(peek().type)) {
      const op = advance();
      left = { type: 'binary', op: op.value, left, right: operand() };
    }
    return left;
  }

  function parseCommaList(): AstNode[] {
    const items: AstNode[] = [parseExpression()];
    while (match('COMMA')) {
      items.push(parseExpression());
    }
    return items;
  }

  function parseExpression(): AstNode {
    return parseLogic();
  }

  function parseLogic(): AstNode {
    return parseBinaryLeft(parseCompare, 'AND', 'OR');
  }

  function parseCompare(): AstNode {
    let left = parseAdd();
    while (COMPARE_OPS.has(peek().type)) {
      const op = advance();
      left = { type: 'binary', op: op.value, left, right: parseAdd() };
    }
    return left;
  }

  function parseAdd(): AstNode {
    return parseBinaryLeft(parseMultiply, 'PLUS', 'MINUS');
  }

  function parseMultiply(): AstNode {
    return parseBinaryLeft(parsePower, 'STAR', 'SLASH', 'PERCENT');
  }

  function parsePower(): AstNode {
    const left = parseUnary();
    if (peek().type === 'CARET') {
      advance();
      return { type: 'binary', op: '^', left, right: parsePower() };
    }
    return left;
  }

  function parseUnary(): AstNode {
    const t = peek();
    if (t.type === 'MINUS' || t.type === 'NOT') {
      advance();
      return { type: 'unary', op: t.value, operand: parseUnary() };
    }
    return parseCall();
  }

  function parseCall(): AstNode {
    if (peek().type === 'IDENT' && cursor + 1 < tokens.length && tokens[cursor + 1].type === 'LPAREN') {
      const name = advance();
      advance(); // consume LPAREN
      const args = peek().type !== 'RPAREN' ? parseCommaList() : [];
      expect('RPAREN');
      return { type: 'call', name: name.value, args };
    }
    return parseAtom();
  }

  function parseAtom(): AstNode {
    const t = peek();

    if (t.type === 'NUMBER') {
      advance();
      return { type: 'number', value: Number(t.value) };
    }

    if (t.type === 'STRING') {
      advance();
      return { type: 'string', value: t.value };
    }

    if (t.type === 'IDENT') {
      advance();
      if (t.value === 'true') return { type: 'boolean', value: true };
      if (t.value === 'false') return { type: 'boolean', value: false };
      return { type: 'column', name: t.value };
    }

    if (t.type === 'BACKTICK_IDENT') {
      advance();
      return { type: 'column', name: t.value };
    }

    if (t.type === 'LPAREN') {
      advance();
      const inner = parseExpression();
      expect('RPAREN');
      return inner;
    }

    if (t.type === 'LBRACKET') {
      advance();
      const elements = peek().type !== 'RBRACKET' ? parseCommaList() : [];
      expect('RBRACKET');
      return { type: 'array', elements };
    }

    if (t.type === 'EOF') {
      throw makeError('Unexpected end of expression', t.pos);
    }

    throw makeError(`Unexpected token '${t.value}'`, t.pos);
  }

  const ast = parseExpression();

  if (peek().type !== 'EOF') {
    const t = peek();
    throw makeError(`Unexpected token '${t.value}' after expression`, t.pos);
  }

  return ast;
}
