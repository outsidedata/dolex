import { tokenize } from './tokenizer.js';
export class ParseError extends Error {
    pos;
    source;
    constructor(message, pos, source) {
        super(message);
        this.pos = pos;
        this.source = source;
        this.name = 'ParseError';
    }
}
const COMPARE_OPS = new Set(['GT', 'GTE', 'LT', 'LTE', 'EQ', 'NEQ']);
const TOKEN_DISPLAY = {
    RPAREN: ')',
    LPAREN: '(',
    RBRACKET: ']',
    LBRACKET: '[',
    COMMA: ',',
    EOF: 'end of expression',
};
function tokenTypeToString(type) {
    return TOKEN_DISPLAY[type] ?? type;
}
export function parse(input) {
    const tokens = tokenize(input);
    let cursor = 0;
    function peek() {
        return tokens[cursor];
    }
    function advance() {
        return tokens[cursor++];
    }
    function expect(type) {
        const t = peek();
        if (t.type !== type) {
            throw makeError(`Expected '${tokenTypeToString(type)}' but got '${t.value || t.type}'`, t.pos);
        }
        return advance();
    }
    function match(...types) {
        if (types.includes(peek().type)) {
            return advance();
        }
        return null;
    }
    function makeError(message, pos) {
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
    function parseBinaryLeft(operand, ...types) {
        let left = operand();
        while (types.includes(peek().type)) {
            const op = advance();
            left = { type: 'binary', op: op.value, left, right: operand() };
        }
        return left;
    }
    function parseCommaList() {
        const items = [parseExpression()];
        while (match('COMMA')) {
            items.push(parseExpression());
        }
        return items;
    }
    function parseExpression() {
        return parseLogic();
    }
    function parseLogic() {
        return parseBinaryLeft(parseCompare, 'AND', 'OR');
    }
    function parseCompare() {
        let left = parseAdd();
        while (COMPARE_OPS.has(peek().type)) {
            const op = advance();
            left = { type: 'binary', op: op.value, left, right: parseAdd() };
        }
        return left;
    }
    function parseAdd() {
        return parseBinaryLeft(parseMultiply, 'PLUS', 'MINUS');
    }
    function parseMultiply() {
        return parseBinaryLeft(parsePower, 'STAR', 'SLASH', 'PERCENT');
    }
    function parsePower() {
        const left = parseUnary();
        if (peek().type === 'CARET') {
            advance();
            return { type: 'binary', op: '^', left, right: parsePower() };
        }
        return left;
    }
    function parseUnary() {
        const t = peek();
        if (t.type === 'MINUS' || t.type === 'NOT') {
            advance();
            return { type: 'unary', op: t.value, operand: parseUnary() };
        }
        return parseCall();
    }
    function parseCall() {
        if (peek().type === 'IDENT' && cursor + 1 < tokens.length && tokens[cursor + 1].type === 'LPAREN') {
            const name = advance();
            advance(); // consume LPAREN
            const args = peek().type !== 'RPAREN' ? parseCommaList() : [];
            expect('RPAREN');
            return { type: 'call', name: name.value, args };
        }
        return parseAtom();
    }
    function parseAtom() {
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
            if (t.value === 'true')
                return { type: 'boolean', value: true };
            if (t.value === 'false')
                return { type: 'boolean', value: false };
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
//# sourceMappingURL=parser.js.map