/**
 * DSL Validator
 *
 * Validates a DslQuery against a table schema before compilation.
 * Returns helpful error messages with fuzzy suggestions for typos.
 */
import type { DataTable, DataSchema, DslQuery } from '../types.js';
export interface ValidationResult {
    ok: boolean;
    error?: string;
}
/** Validate a DSL query against a table's column schema. */
export declare function validateDsl(table: DataTable, query: DslQuery): ValidationResult;
/**
 * Validate a DSL query with join support.
 * Takes the full schema so it can look up joined tables.
 */
export declare function validateDslWithJoins(schema: DataSchema, baseTableName: string, query: DslQuery): ValidationResult;
//# sourceMappingURL=dsl-validator.d.ts.map