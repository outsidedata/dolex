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
import { findCandidateColumns } from './candidate-matcher.js';
import { askLLM, askLLMWithCorrection } from './llm-selector.js';
import { validateSelection } from './validator.js';
import { buildSQL } from './sql-builder.js';
import { determineChartType } from './chart-detector.js';
import { SessionManager } from './session.js';
export class QueryEngine {
    options;
    sessionManager;
    constructor(options) {
        this.options = {
            model: options?.model ?? 'gemma3:27b',
            ollamaHost: options?.ollamaHost ?? 'http://localhost:11434',
        };
        this.sessionManager = new SessionManager();
    }
    /**
     * Run the full query pipeline: candidates -> LLM selection -> validation -> SQL -> execute -> chart hint.
     *
     * Never throws — returns structured success/error results.
     */
    async query(request, schema, db) {
        const startTime = Date.now();
        // Use request-level model override or engine default
        const llmOptions = {
            ...this.options,
            model: request.model ?? this.options.model,
        };
        // ── Step 1: Find candidate columns ──
        let candidates;
        try {
            candidates = findCandidateColumns(request.query, schema);
        }
        catch (err) {
            return {
                success: false,
                error: { stage: 'candidates', message: err.message, details: err },
            };
        }
        if (candidates.length === 0) {
            return {
                success: false,
                error: {
                    stage: 'candidates',
                    message: 'No candidate columns found matching the query. Try rephrasing.',
                },
            };
        }
        // ── Get session context if this is a follow-up ──
        let sessionContext = null;
        if (request.sessionId && SessionManager.isFollowUp(request.query)) {
            sessionContext = this.sessionManager.getContext(request.sessionId);
        }
        // ── Step 2: LLM selection ──
        let selection;
        let llmRetries = 0;
        let correctionUsed = false;
        try {
            const llmResult = await askLLM(request.query, candidates, schema, llmOptions, sessionContext);
            selection = llmResult.selection;
            llmRetries = llmResult.retries;
        }
        catch (err) {
            return {
                success: false,
                error: { stage: 'llm', message: err.message, details: err },
            };
        }
        // ── Step 3: Validate selection ──
        let validation = validateSelection(selection, schema);
        // ── Step 4: Auto-correction re-prompt if validation failed ──
        if (!validation.valid) {
            try {
                // Serialize the failed selection as the "previous response" for the correction prompt
                const previousResponseContent = JSON.stringify(selection, null, 2);
                const correctionResult = await askLLMWithCorrection(request.query, candidates, schema, validation.errors, previousResponseContent, llmOptions, sessionContext);
                selection = correctionResult.selection;
                correctionUsed = true;
                // Re-validate the corrected selection
                validation = validateSelection(selection, schema);
                if (!validation.valid) {
                    return {
                        success: false,
                        error: {
                            stage: 'validation',
                            message: `Validation failed after correction re-prompt: ${validation.errors.join('; ')}`,
                            details: { selection, errors: validation.errors },
                        },
                    };
                }
            }
            catch (err) {
                return {
                    success: false,
                    error: {
                        stage: 'validation',
                        message: `Validation failed and correction re-prompt errored: ${err.message}. Original errors: ${validation.errors.join('; ')}`,
                        details: { selection, validationErrors: validation.errors, correctionError: err },
                    },
                };
            }
        }
        const finalSelection = validation.corrected;
        // ── Step 5: Build SQL ──
        let sql;
        try {
            sql = buildSQL(finalSelection, schema);
        }
        catch (err) {
            return {
                success: false,
                error: { stage: 'sql_build', message: err.message, details: { selection: finalSelection } },
            };
        }
        // ── Step 6: Execute SQL ──
        let data;
        let columns;
        try {
            data = db.prepare(sql).all();
            columns = data.length > 0 ? Object.keys(data[0]) : [];
        }
        catch (err) {
            return {
                success: false,
                error: { stage: 'sql_execute', message: err.message, details: { sql, selection: finalSelection } },
            };
        }
        // ── Step 7: Determine chart type ──
        let chartTypeHint;
        try {
            chartTypeHint = determineChartType(data, finalSelection);
        }
        catch (err) {
            // Chart detection should never really fail, but be safe
            chartTypeHint = 'bar';
        }
        const executionTimeMs = Date.now() - startTime;
        // ── Record in session for follow-ups ──
        if (request.sessionId) {
            this.sessionManager.addEntry(request.sessionId, {
                query: request.query,
                selection: finalSelection,
                chartTypeHint,
            });
        }
        return {
            success: true,
            result: {
                sql,
                data,
                rowCount: data.length,
                columns,
                selection: finalSelection,
                chartTypeHint,
                executionTimeMs,
            },
        };
    }
    /**
     * Access the session manager for advanced session operations.
     */
    getSessionManager() {
        return this.sessionManager;
    }
}
// ── Re-exports for convenience ──
export { loadSchema, loadCsvToSqlite } from './schema-loader.js';
export { findCandidateColumns, extractFilterHints } from './candidate-matcher.js';
export { askLLM, askLLMWithCorrection } from './llm-selector.js';
export { validateSelection, editDistance } from './validator.js';
export { buildSQL, findJoinColumn } from './sql-builder.js';
export { determineChartType } from './chart-detector.js';
export { SessionManager } from './session.js';
//# sourceMappingURL=index.js.map