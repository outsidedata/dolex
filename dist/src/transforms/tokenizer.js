export class TokenizeError extends Error {
    pos;
    constructor(message, pos) {
        super(message);
        this.pos = pos;
        this.name = 'TokenizeError';
    }
}
export function tokenize(input) {
    const tokens = [];
    let i = 0;
    while (i < input.length) {
        const ch = input[i];
        if (isWhitespace(ch)) {
            i++;
            continue;
        }
        if (isDigit(ch) || (ch === '.' && i + 1 < input.length && isDigit(input[i + 1]))) {
            const start = i;
            while (i < input.length && isDigit(input[i]))
                i++;
            if (i < input.length && input[i] === '.') {
                i++;
                while (i < input.length && isDigit(input[i]))
                    i++;
            }
            tokens.push({ type: 'NUMBER', value: input.slice(start, i), pos: start });
            continue;
        }
        if (ch === '"') {
            const start = i;
            i++;
            let str = '';
            while (i < input.length && input[i] !== '"') {
                if (input[i] === '\\' && i + 1 < input.length) {
                    const esc = input[i + 1];
                    str += ESCAPE_MAP[esc] ?? ('\\' + esc);
                    i += 2;
                }
                else {
                    str += input[i];
                    i++;
                }
            }
            if (i >= input.length) {
                throw new TokenizeError(`Unterminated string at position ${start}`, start);
            }
            tokens.push({ type: 'STRING', value: str, pos: start });
            i++;
            continue;
        }
        if (ch === '`') {
            const start = i;
            i++;
            while (i < input.length && input[i] !== '`')
                i++;
            if (i >= input.length) {
                throw new TokenizeError(`Unterminated identifier at position ${start}`, start);
            }
            tokens.push({ type: 'BACKTICK_IDENT', value: input.slice(start + 1, i), pos: start });
            i++;
            continue;
        }
        if (isIdentStart(ch)) {
            const start = i;
            while (i < input.length && isIdentChar(input[i]))
                i++;
            tokens.push({ type: 'IDENT', value: input.slice(start, i), pos: start });
            continue;
        }
        if (i + 1 < input.length) {
            const two = input.slice(i, i + 2);
            const twoCharOp = TWO_CHAR_OPS[two];
            if (twoCharOp) {
                tokens.push({ type: twoCharOp, value: two, pos: i });
                i += 2;
                continue;
            }
        }
        const oneCharOp = ONE_CHAR_OPS[ch];
        if (oneCharOp) {
            tokens.push({ type: oneCharOp, value: ch, pos: i });
            i++;
            continue;
        }
        throw new TokenizeError(`Unexpected character '${ch}' at position ${i}`, i);
    }
    tokens.push({ type: 'EOF', value: '', pos: i });
    return tokens;
}
// ─── Character Classification ────────────────────────────────────────────────
function isWhitespace(ch) {
    return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r';
}
function isDigit(ch) {
    return ch >= '0' && ch <= '9';
}
function isIdentStart(ch) {
    return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_';
}
function isIdentChar(ch) {
    return isIdentStart(ch) || isDigit(ch);
}
// ─── Lookup Tables ───────────────────────────────────────────────────────────
const ESCAPE_MAP = {
    '"': '"',
    '\\': '\\',
    'n': '\n',
    't': '\t',
};
const TWO_CHAR_OPS = {
    '==': 'EQ',
    '!=': 'NEQ',
    '>=': 'GTE',
    '<=': 'LTE',
    '&&': 'AND',
    '||': 'OR',
};
const ONE_CHAR_OPS = {
    '+': 'PLUS',
    '-': 'MINUS',
    '*': 'STAR',
    '/': 'SLASH',
    '%': 'PERCENT',
    '^': 'CARET',
    '>': 'GT',
    '<': 'LT',
    '!': 'NOT',
    '(': 'LPAREN',
    ')': 'RPAREN',
    '[': 'LBRACKET',
    ']': 'RBRACKET',
    ',': 'COMMA',
};
//# sourceMappingURL=tokenizer.js.map