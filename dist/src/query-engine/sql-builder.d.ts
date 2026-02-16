/**
 * SQL Builder — Build SQL from LLMColumnSelection.
 *
 * Extracted from buildSQL() and findJoinColumn() in the POC.
 * Handles all query patterns: simple aggregation, filtering, multi-table joins,
 * window functions, percentages, multi-measure.
 *
 * The _schemaRef global from the POC is eliminated — schema is passed explicitly.
 */
import type { DataSchema, LLMColumnSelection } from '../types.js';
/**
 * Find a shared column between two tables that can serve as a join key.
 *
 * Prefers ID columns (ending in "id") over other shared columns.
 * Schema is passed explicitly (no global state).
 */
export declare function findJoinColumn(table1: string, table2: string, schema: DataSchema): string | null;
/**
 * Build a SQL query from a validated LLMColumnSelection.
 *
 * Handles these query patterns:
 * - Scalar (no category)
 * - Single-dimensional grouping (category only)
 * - Two-dimensional grouping (category + series)
 * - Single-dimensional + two measures
 * - Two-dimensional + two measures
 * - Percentage computed metric
 * - Top N per group (window function with ROW_NUMBER)
 * - Multi-table JOINs
 * - WHERE filters (=, LIKE, IN)
 */
export declare function buildSQL(selection: LLMColumnSelection, schema: DataSchema): string;
//# sourceMappingURL=sql-builder.d.ts.map