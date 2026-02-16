/**
 * Query Engine — Public API that ties the full pipeline together.
 *
 * Pipeline:
 *   1. CODE: Fuzzy-match user query to candidate columns (candidate-matcher)
 *   2. LLM:  ONE call to select columns + aggregate + filters (llm-selector)
 *   3. CODE: Validate column names — hard gate + auto-correct (validator)
 *   4. If validation fails on hallucinated columns, auto-correction re-prompt (llm-selector)
 *   5. CODE: Build SQL from template (sql-builder)
 *   6. CODE: Execute SQL, determine chart type from result shape (chart-detector)
 */
import Database from 'better-sqlite3';
import type { DataSchema, QueryRequest, QueryResult } from '../types.js';
import { SessionManager } from './session.js';
export interface QueryEngineOptions {
    model?: string;
    ollamaHost?: string;
}
export interface QueryError {
    stage: 'candidates' | 'llm' | 'validation' | 'sql_build' | 'sql_execute' | 'chart';
    message: string;
    details?: any;
}
export type QueryEngineResult = {
    success: true;
    result: QueryResult;
} | {
    success: false;
    error: QueryError;
};
export declare class QueryEngine {
    private options;
    private sessionManager;
    constructor(options?: QueryEngineOptions);
    /**
     * Run the full query pipeline: candidates -> LLM selection -> validation -> SQL -> execute -> chart hint.
     *
     * Never throws — returns structured success/error results.
     */
    query(request: QueryRequest, schema: DataSchema, db: Database.Database): Promise<QueryEngineResult>;
    /**
     * Access the session manager for advanced session operations.
     */
    getSessionManager(): SessionManager;
}
export { loadSchema, loadCsvToSqlite } from './schema-loader.js';
export { findCandidateColumns, extractFilterHints } from './candidate-matcher.js';
export { askLLM, askLLMWithCorrection } from './llm-selector.js';
export type { CandidateColumn, LLMSelectorOptions, LLMSelectorResult } from './llm-selector.js';
export { validateSelection, editDistance } from './validator.js';
export type { ValidationResult } from './validator.js';
export { buildSQL, findJoinColumn } from './sql-builder.js';
export { determineChartType } from './chart-detector.js';
export { SessionManager } from './session.js';
export type { SessionContext, SessionEntry } from './session.js';
//# sourceMappingURL=index.d.ts.map