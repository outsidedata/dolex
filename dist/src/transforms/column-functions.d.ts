/**
 * Column-wise function implementations for the Dolex expression evaluator.
 *
 * These functions require access to all rows (not just the current row).
 * They are pre-computed before row-wise evaluation begins.
 */
import type { AstNode } from './types.js';
import type { PrecomputedStats } from './evaluator.js';
/** Names of all column-wise functions */
export declare const COLUMN_WISE_FUNCTIONS: Set<string>;
/** Extract all column-wise function calls from an AST */
export declare function findColumnWiseCalls(ast: AstNode): {
    name: string;
    columnName: string;
    extra?: number;
}[];
/** Pre-compute all column-wise stats needed by an AST */
export declare function precompute(ast: AstNode, allRows: Record<string, any>[], partitionBy?: string): PrecomputedStats;
//# sourceMappingURL=column-functions.d.ts.map