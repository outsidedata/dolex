/**
 * LLM Selector — ONE LLM call to select columns from candidates.
 *
 * Extracted from askLLM() in the POC, with new improvements:
 * - Garbage output detection (non-ASCII, non-JSON responses)
 * - Single retry on garbage
 * - Auto-correction re-prompt for hallucinated columns
 */
import type { DataSchema, DataColumn, LLMColumnSelection } from '../types.js';
import type { SessionContext } from './session.js';
/** Flat column descriptor with table context, used as LLM candidate input. */
export type CandidateColumn = DataColumn & {
    table: string;
};
export interface LLMSelectorOptions {
    model?: string;
    ollamaHost?: string;
    temperature?: number;
    topK?: number;
    topP?: number;
}
export interface LLMSelectorResult {
    selection: LLMColumnSelection;
    retries: number;
    correctionUsed: boolean;
}
/**
 * Ask the LLM to select columns from candidates to answer the user's query.
 *
 * Pipeline:
 * 1. Build prompt from candidates + schema
 * 2. Call Ollama
 * 3. If garbage output, retry once with same prompt
 * 4. Parse JSON response
 * 5. Return selection (validation happens separately in validator.ts)
 *
 * For auto-correction after validation failure, use askLLMWithCorrection().
 */
export declare function askLLM(query: string, candidates: CandidateColumn[], schema: DataSchema, options?: LLMSelectorOptions, sessionContext?: SessionContext | null): Promise<LLMSelectorResult>;
/**
 * Re-prompt the LLM with a correction when validation found hallucinated columns.
 *
 * Sends a focused prompt with the validation errors, asking the LLM to fix
 * only the invalid references.
 */
export declare function askLLMWithCorrection(query: string, candidates: CandidateColumn[], schema: DataSchema, validationErrors: string[], previousResponseContent: string, options?: LLMSelectorOptions, sessionContext?: SessionContext | null): Promise<LLMSelectorResult>;
//# sourceMappingURL=llm-selector.d.ts.map