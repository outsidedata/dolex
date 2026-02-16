/**
 * DSL-to-SQL Compiler
 *
 * Translates the declarative query DSL into SQL.
 * Targets SQLite dialect (works for CSV-in-SQLite and SQLite sources).
 * Postgres differences are minimal and handled via dialect parameter.
 *
 * Supports JOIN clauses with dot-notation field references (table.field).
 */
import type { DslQuery } from '../types.js';
/** Check if a DSL query contains aggregate functions that need JS post-processing on SQLite/MySQL. */
export declare function hasJsAggregates(query: DslQuery): boolean;
/** Check if a DSL query contains window function fields. */
export declare function hasWindowFunctions(query: DslQuery): boolean;
/** @deprecated Use hasJsAggregates instead */
export declare const hasPercentileAggregates: typeof hasJsAggregates;
/** Compile a DSL query into a SQL string. */
export declare function compileDsl(table: string, query: DslQuery, dialect?: 'sqlite' | 'postgres' | 'mysql', options?: {
    skipLimit?: boolean;
}): string;
//# sourceMappingURL=dsl-compiler.d.ts.map