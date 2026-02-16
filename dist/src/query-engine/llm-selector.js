/**
 * LLM Selector — ONE LLM call to select columns from candidates.
 *
 * Extracted from askLLM() in the POC, with new improvements:
 * - Garbage output detection (non-ASCII, non-JSON responses)
 * - Single retry on garbage
 * - Auto-correction re-prompt for hallucinated columns
 */
const DEFAULT_MODEL = 'gemma3:27b';
const DEFAULT_HOST = 'http://localhost:11434';
const DEFAULT_TEMPERATURE = 1.0;
const DEFAULT_TOP_K = 64;
const DEFAULT_TOP_P = 0.95;
/**
 * Detect garbage output: non-ASCII dominant, no JSON structure, or empty.
 */
function isGarbageOutput(content) {
    if (!content || content.trim().length === 0)
        return true;
    // Check for non-ASCII dominance (e.g., model emitting binary/unicode noise)
    const nonAsciiCount = (content.match(/[^\x00-\x7F]/g) || []).length;
    const totalChars = content.length;
    if (totalChars > 0 && nonAsciiCount / totalChars > 0.3)
        return true;
    // Must contain at least one '{' for JSON
    if (!content.includes('{'))
        return true;
    return false;
}
/**
 * Build the prompt for the LLM. This is the proven prompt structure from the POC.
 */
function buildPrompt(query, candidates, schema, sessionContext) {
    const candidateDesc = candidates
        .map(c => `  - ${c.table}.${c.name} (${c.type}, ${c.uniqueCount} unique values, samples: ${c.sampleValues.slice(0, 3).join(', ')})`)
        .join('\n');
    // Find relevant foreign keys for these tables
    const relevantTables = [...new Set(candidates.map(c => c.table))];
    const relevantFKs = schema.foreignKeys.filter(fk => relevantTables.includes(fk.fromTable) && relevantTables.includes(fk.toTable));
    const fkDesc = relevantFKs.length > 0
        ? `\nTable relationships:\n${relevantFKs.map(fk => `  - ${fk.fromTable}.${fk.fromColumn} -> ${fk.toTable}.${fk.toColumn}`).join('\n')}`
        : '';
    // Session context for conversational follow-ups
    let sessionDesc = '';
    if (sessionContext && sessionContext.previousSelection) {
        const prev = sessionContext.previousSelection;
        sessionDesc = `\n\nPrevious query context (for follow-up reference):
  Previous query: "${sessionContext.previousQuery}"
  Previous selection: category=${prev.category_column ? `${prev.category_column.table}.${prev.category_column.column}` : 'none'}, value=${prev.value_column.table}.${prev.value_column.column}, aggregate=${prev.aggregate}
  If the current query references "that", "those", "the same", or modifies the previous query, use the previous selection as a starting point.\n`;
    }
    return `You are a data assistant. A user asked: "${query}"
${sessionDesc}
Here are the relevant columns from the database:
${candidateDesc}
${fkDesc}

Pick columns to answer the user's question. Respond with ONLY valid JSON, no markdown:

{
  "category_column": {"table": "...", "column": "..."} or null,
  "series_column": {"table": "...", "column": "..."} or null,
  "value_column": {"table": "...", "column": "..."},
  "value_column_2": {"table": "...", "column": "..."} or null,
  "aggregate": "count" | "sum" | "avg" | "min" | "max",
  "aggregate_2": "count" | "sum" | "avg" | "min" | "max" or null,
  "computed": "percentage" | "ratio" | "difference" | null,
  "top_n_per_group": number or null,
  "filters": [{"table": "...", "column": "...", "op": "=", "value": "..."}] or [],
  "sort": "desc" or "asc",
  "limit": number between 5 and 100
}

Rules:
- ONLY use table and column names from the list above. Do not invent columns.
- category_column = X axis (year, team). series_column = groups within each category (driver within year). Use series_column when comparing multiple things over a dimension.
- value_column_2 + aggregate_2: use when the question asks for two different metrics (e.g., "wins AND podiums", "count AND average").
- computed: use "percentage" when the question asks "what percentage", "what share", "what proportion". Use "ratio" for "X per Y" or "rate". Use "difference" for "change" or "compared to".
- top_n_per_group: use when the question says "top N per group" or "best N in each category" (e.g., "top 3 drivers per team").
- If the question mentions a specific name, team, place, or year, add it as a filter. Use exact sample value spelling. Use "=" for exact, "LIKE" for partial.
- Multiple filter values for same column: use "IN" as op with comma-separated values, e.g. {"op": "IN", "value": "Ferrari,McLaren,Red Bull"}`;
}
/**
 * Build a correction re-prompt when validation fails on hallucinated columns.
 */
function buildCorrectionPrompt(originalPrompt, validationErrors, previousResponse) {
    return `Your previous response had errors. Here is what went wrong:
${validationErrors.map(e => `  - ${e}`).join('\n')}

Your previous response was:
${previousResponse}

Please fix ONLY the invalid column references. Use ONLY columns from the original list.
Respond with ONLY the corrected JSON, no markdown, no explanation.

For reference, here is the original request:
${originalPrompt}`;
}
/**
 * Make a single LLM call to Ollama.
 */
async function callOllama(prompt, options) {
    const model = options.model || DEFAULT_MODEL;
    const host = options.ollamaHost || DEFAULT_HOST;
    const response = await fetch(`${host}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
            stream: false,
            options: {
                temperature: options.temperature ?? DEFAULT_TEMPERATURE,
                top_k: options.topK ?? DEFAULT_TOP_K,
                top_p: options.topP ?? DEFAULT_TOP_P,
                num_ctx: 4096,
                num_thread: model.includes('27b') ? 16 : undefined,
            },
        }),
    });
    if (!response.ok) {
        throw new Error(`Ollama request failed: ${response.status} ${response.statusText}`);
    }
    const result = await response.json();
    return result.message?.content ?? '';
}
/**
 * Parse the LLM response content into an LLMColumnSelection.
 *
 * Handles:
 * - JSON embedded in markdown code blocks
 * - Flat {table, column} normalization
 * - Missing optional fields
 */
function parseResponse(content) {
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new Error(`No JSON in LLM response: ${content.slice(0, 200)}`);
    }
    const parsed = JSON.parse(jsonMatch[0]);
    // Normalize: LLM sometimes returns flat {table, column} instead of nested structure
    if (parsed.table && parsed.column && !parsed.value_column) {
        return {
            category_column: parsed.category_column || null,
            series_column: parsed.series_column || null,
            value_column: { table: parsed.table, column: parsed.column },
            aggregate: parsed.aggregate || 'count',
            filters: parsed.filters || [],
            sort: parsed.sort || 'desc',
            limit: parsed.limit || 20,
        };
    }
    // Ensure value_column exists
    if (!parsed.value_column) {
        throw new Error(`LLM response missing value_column: ${JSON.stringify(parsed).slice(0, 200)}`);
    }
    // Normalize optional fields
    if (!parsed.series_column)
        parsed.series_column = null;
    if (!parsed.value_column_2)
        parsed.value_column_2 = null;
    if (!parsed.aggregate_2)
        parsed.aggregate_2 = null;
    if (!parsed.computed)
        parsed.computed = null;
    if (!parsed.top_n_per_group)
        parsed.top_n_per_group = null;
    if (!parsed.filters)
        parsed.filters = [];
    if (!parsed.sort)
        parsed.sort = 'desc';
    if (!parsed.limit)
        parsed.limit = 20;
    return parsed;
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
export async function askLLM(query, candidates, schema, options, sessionContext) {
    const opts = options || {};
    const prompt = buildPrompt(query, candidates, schema, sessionContext);
    let retries = 0;
    // First attempt
    let content = await callOllama(prompt, opts);
    // Garbage detection + single retry
    if (isGarbageOutput(content)) {
        retries = 1;
        content = await callOllama(prompt, opts);
        if (isGarbageOutput(content)) {
            throw new Error(`LLM returned garbage output after retry. Content: ${content.slice(0, 200)}`);
        }
    }
    const selection = parseResponse(content);
    return { selection, retries, correctionUsed: false };
}
/**
 * Re-prompt the LLM with a correction when validation found hallucinated columns.
 *
 * Sends a focused prompt with the validation errors, asking the LLM to fix
 * only the invalid references.
 */
export async function askLLMWithCorrection(query, candidates, schema, validationErrors, previousResponseContent, options, sessionContext) {
    const opts = options || {};
    const originalPrompt = buildPrompt(query, candidates, schema, sessionContext);
    const correctionPrompt = buildCorrectionPrompt(originalPrompt, validationErrors, previousResponseContent);
    const content = await callOllama(correctionPrompt, opts);
    if (isGarbageOutput(content)) {
        throw new Error(`LLM returned garbage on correction re-prompt. Content: ${content.slice(0, 200)}`);
    }
    const selection = parseResponse(content);
    return { selection, retries: 0, correctionUsed: true };
}
//# sourceMappingURL=llm-selector.js.map