/**
 * Candidate Matcher — Fuzzy-match user query to candidate columns.
 *
 * Extracted from findCandidateColumns() and extractFilterHints() in the POC.
 * No LLM calls — pure code-based scoring and filtering.
 */
import type { DataSchema, DataColumn } from '../types.js';
/**
 * Detect likely filter values in the query: proper nouns, years, quoted strings.
 */
export declare function extractFilterHints(query: string): string[];
/**
 * Find candidate columns from the schema that are relevant to the user's query.
 *
 * Scores columns by:
 * - Direct column name match
 * - Table name match
 * - Sample value match (important for filtering)
 * - Partial match
 * - Filter hint matching (proper nouns, years)
 * - Column type bonuses
 *
 * Also pulls in related columns from tables connected via foreign keys
 * when filter values are found.
 *
 * Returns top candidates (up to ~25-30), ensuring a mix of categoricals and numerics.
 */
export declare function findCandidateColumns(query: string, schema: DataSchema): Array<DataColumn & {
    table: string;
}>;
//# sourceMappingURL=candidate-matcher.d.ts.map