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
import type { AstNode } from './types.js';
export declare class ParseError extends Error {
    pos: number;
    source?: string | undefined;
    constructor(message: string, pos: number, source?: string | undefined);
}
export declare function parse(input: string): AstNode;
//# sourceMappingURL=parser.d.ts.map