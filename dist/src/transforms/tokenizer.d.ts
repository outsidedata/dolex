/**
 * Expression tokenizer for the Dolex derived data layer.
 *
 * Converts expression strings into token arrays for the parser.
 */
import type { Token } from './types.js';
export declare class TokenizeError extends Error {
    pos: number;
    constructor(message: string, pos: number);
}
export declare function tokenize(input: string): Token[];
//# sourceMappingURL=tokenizer.d.ts.map