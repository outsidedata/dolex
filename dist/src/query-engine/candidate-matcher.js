/**
 * Candidate Matcher — Fuzzy-match user query to candidate columns.
 *
 * Extracted from findCandidateColumns() and extractFilterHints() in the POC.
 * No LLM calls — pure code-based scoring and filtering.
 */
/**
 * Detect likely filter values in the query: proper nouns, years, quoted strings.
 */
export function extractFilterHints(query) {
    const hints = [];
    // Capitalized words that aren't at sentence start (proper nouns: "Hamilton", "Ferrari", "Monaco")
    const words = query.split(/\s+/);
    for (let i = 1; i < words.length; i++) {
        const clean = words[i].replace(/[^a-zA-Z0-9]/g, '');
        if (clean.length >= 3 && clean[0] === clean[0].toUpperCase() && clean[0] !== clean[0].toLowerCase()) {
            hints.push(clean.toLowerCase());
        }
    }
    // Also check first word if it looks like a proper noun (not common words)
    const commonStarters = new Set([
        'show', 'how', 'what', 'which', 'top', 'total', 'average', 'number',
        'count', 'list', 'compare', 'get', 'find',
    ]);
    if (words[0] && !commonStarters.has(words[0].toLowerCase())) {
        const clean = words[0].replace(/[^a-zA-Z0-9]/g, '');
        if (clean.length >= 3 && clean[0] === clean[0].toUpperCase()) {
            hints.push(clean.toLowerCase());
        }
    }
    // Year patterns (4 digits)
    const yearMatches = query.match(/\b(19|20)\d{2}\b/g);
    if (yearMatches)
        hints.push(...yearMatches);
    return [...new Set(hints)];
}
/**
 * Helper to create a flat column list with table context from a DataSchema.
 */
function flattenColumns(schema) {
    const result = [];
    for (const table of schema.tables) {
        for (const col of table.columns) {
            result.push({ ...col, table: table.name });
        }
    }
    return result;
}
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
export function findCandidateColumns(query, schema) {
    const allColumns = flattenColumns(schema);
    const queryWords = query.toLowerCase().split(/\s+/);
    const filterHints = extractFilterHints(query);
    const scored = [];
    // Track which tables have filter value matches
    const filterMatchTables = new Set();
    for (const col of allColumns) {
        let score = 0;
        const colLower = col.name.toLowerCase();
        const tableLower = col.table.toLowerCase();
        const sampleStr = col.sampleValues.join(' ').toLowerCase();
        // Skip pure ID columns for category/value, but keep them for joins
        const isIdCol = col.type === 'id' && col.uniqueCount > 100;
        for (const word of queryWords) {
            if (word.length < 3)
                continue;
            // Direct column name match
            if (colLower.includes(word))
                score += 10;
            // Table name match
            if (tableLower.includes(word))
                score += 5;
            // Sample value match (important for filtering!)
            if (sampleStr.includes(word))
                score += isIdCol ? 1 : 3;
            // Partial match (e.g., "win" matches "wins")
            if (colLower.includes(word.slice(0, -1)) && word.length > 3)
                score += 4;
        }
        // Filter hint matching — high priority (proper nouns, years)
        for (const hint of filterHints) {
            if (sampleStr.includes(hint)) {
                score += 15; // Strong signal — this column contains a value the user mentioned
                filterMatchTables.add(col.table);
            }
            if (colLower.includes(hint))
                score += 8;
        }
        // Bonus for interesting column types
        if (!isIdCol && col.type === 'numeric')
            score += 1;
        if (!isIdCol && col.type === 'categorical' && col.uniqueCount > 2 && col.uniqueCount < 100)
            score += 2;
        if (col.type === 'date')
            score += 1;
        if (score > 0) {
            scored.push({ col, score });
        }
    }
    // Sort by score, take top 20
    scored.sort((a, b) => b.score - a.score);
    const candidates = scored.slice(0, 20).map(s => s.col);
    const candidateKeys = new Set(candidates.map(c => `${c.table}.${c.name}`));
    // Pull in related columns from tables that had filter matches (via foreign keys)
    for (const table of filterMatchTables) {
        for (const fk of schema.foreignKeys) {
            let relatedTable = null;
            if (fk.fromTable === table)
                relatedTable = fk.toTable;
            if (fk.toTable === table)
                relatedTable = fk.fromTable;
            if (relatedTable) {
                // Add useful columns from the related table
                const relatedCols = allColumns.filter(c => c.table === relatedTable &&
                    !candidateKeys.has(`${c.table}.${c.name}`) &&
                    (c.type === 'numeric' || c.type === 'categorical' || c.type === 'date'));
                for (const rc of relatedCols.slice(0, 5)) {
                    candidates.push(rc);
                    candidateKeys.add(`${rc.table}.${rc.name}`);
                }
            }
        }
    }
    // Ensure we have some categoricals and numerics
    if (candidates.filter(c => c.type === 'categorical').length === 0) {
        const goodCats = allColumns.filter(c => c.type === 'categorical' &&
            c.uniqueCount > 2 &&
            c.uniqueCount < 100 &&
            !candidateKeys.has(`${c.table}.${c.name}`));
        for (const gc of goodCats.slice(0, 3)) {
            candidates.push(gc);
        }
    }
    if (candidates.filter(c => c.type === 'numeric').length === 0) {
        const goodNums = allColumns.filter(c => c.type === 'numeric' && !candidateKeys.has(`${c.table}.${c.name}`));
        for (const gn of goodNums.slice(0, 3)) {
            candidates.push(gn);
        }
    }
    return candidates;
}
//# sourceMappingURL=candidate-matcher.js.map