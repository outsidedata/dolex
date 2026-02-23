/**
 * Row-wise function implementations for the Dolex expression evaluator.
 *
 * Each function receives an array of evaluated arguments and returns a value.
 * Null propagation is handled per-function.
 */
export type RowFunction = (args: any[]) => any;
export declare function isNull(v: any): boolean;
export declare function safeEqual(a: any, b: any): boolean;
export declare const ROW_FUNCTIONS: Record<string, RowFunction>;
//# sourceMappingURL=row-functions.d.ts.map