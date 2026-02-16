/**
 * Validator — Validate LLM selections against schema.
 *
 * Extracted from validateSelection() and editDistance() in the POC.
 * Hard gate + auto-correct with edit distance for minor typos.
 */
import type { DataSchema, LLMColumnSelection } from '../types.js';
export interface ValidationResult {
    valid: boolean;
    errors: string[];
    corrected: LLMColumnSelection;
}
/**
 * Levenshtein edit distance between two strings.
 */
export declare function editDistance(a: string, b: string): number;
/**
 * Validate that LLM-selected columns actually exist in the schema.
 *
 * For each column reference:
 * 1. If exact match found, it passes.
 * 2. If no exact match, find closest match by edit distance.
 *    - If distance <= 3, auto-correct and log the correction.
 *    - If distance > 3, mark as invalid (hallucinated column).
 *
 * Returns { valid, errors, corrected } where `corrected` has any fixable typos resolved.
 */
export declare function validateSelection(selection: LLMColumnSelection, schema: DataSchema): ValidationResult;
//# sourceMappingURL=validator.d.ts.map