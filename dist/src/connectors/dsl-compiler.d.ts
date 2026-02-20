/**
 * DSL-to-SQL Compiler
 *
 * Translates the declarative query DSL into SQL targeting SQLite dialect.
 * Supports JOIN clauses with dot-notation field references (table.field).
 */
import type { DslQuery } from '../types.js';
/**
 * Convert dot-notation field to a flat alias: "table.col" → "table_col", plain fields unchanged.
 */
export declare function fieldAlias(field: string): string;
/** Check if a DSL query contains aggregate functions that need JS post-processing on SQLite. */
export declare function hasJsAggregates(query: DslQuery): boolean;
/** Check if a DSL query contains window function fields. */
export declare function hasWindowFunctions(query: DslQuery): boolean;
/** @deprecated Use hasJsAggregates instead */
export declare const hasPercentileAggregates: typeof hasJsAggregates;
/** Compile a DSL query into a SQL string. */
export declare function compileDsl(table: string, query: DslQuery, dialect?: 'sqlite', options?: {
    skipLimit?: boolean;
}): string;
//# sourceMappingURL=dsl-compiler.d.ts.map