/**
 * Expression evaluator for the Dolex derived data layer.
 *
 * Walks an AST and evaluates it against a row context.
 */
import type { AstNode, ColumnType, TransformStats } from './types.js';
import type { RowFilter } from '../types.js';
export interface EvalContext {
    /** Current row: column name → value */
    row: Record<string, any>;
    /** All rows (for column-wise functions) */
    allRows?: Record<string, any>[];
    /** Partition column (for column-wise functions) */
    partitionBy?: string;
    /** Pre-computed column-wise results */
    precomputed?: PrecomputedStats;
    /** Current row index (for per-row column-wise lookups) */
    rowIndex?: number;
    /** Warnings collector */
    warnings?: string[];
}
export interface PrecomputedStats {
    scalars: Map<string, number>;
    perRow: Map<string, Map<number, number>>;
}
export declare function evaluate(ast: AstNode, ctx: EvalContext): any;
export interface EvalOptions {
    partitionBy?: string;
    filter?: RowFilter[];
}
export interface EvalResult {
    values: any[];
    type: ColumnType;
    warnings: string[];
    stats: TransformStats;
}
export declare function evaluateExpression(expr: string, rows: Record<string, any>[], options?: EvalOptions): EvalResult;
//# sourceMappingURL=evaluator.d.ts.map