/**
 * Validator — Validate LLM selections against schema.
 *
 * Extracted from validateSelection() and editDistance() in the POC.
 * Hard gate + auto-correct with edit distance for minor typos.
 */
/**
 * Levenshtein edit distance between two strings.
 */
export function editDistance(a, b) {
    const m = a.length;
    const n = b.length;
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++)
        dp[i][0] = i;
    for (let j = 0; j <= n; j++)
        dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] =
                a[i - 1] === b[j - 1]
                    ? dp[i - 1][j - 1]
                    : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
    }
    return dp[m][n];
}
/**
 * Build a flat list of {table, column} from the schema for validation lookups.
 */
function schemaColumnsFlat(schema) {
    const result = [];
    for (const table of schema.tables) {
        for (const col of table.columns) {
            result.push({ table: table.name, column: col.name });
        }
    }
    return result;
}
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
export function validateSelection(selection, schema) {
    const errors = [];
    const corrected = JSON.parse(JSON.stringify(selection));
    const flatCols = schemaColumnsFlat(schema);
    function validateCol(ref, label) {
        if (!ref)
            return true; // null is ok for optional fields
        const exact = flatCols.find(c => c.table === ref.table && c.column === ref.column);
        if (exact)
            return true;
        // Try to fix: find closest match
        let bestMatch = null;
        let bestDist = Infinity;
        for (const col of flatCols) {
            const dist = editDistance(`${col.table}.${col.column}`, `${ref.table}.${ref.column}`);
            if (dist < bestDist) {
                bestDist = dist;
                bestMatch = col;
            }
        }
        if (bestMatch && bestDist <= 3) {
            errors.push(`${label}: "${ref.table}.${ref.column}" -> corrected to "${bestMatch.table}.${bestMatch.column}"`);
            ref.table = bestMatch.table;
            ref.column = bestMatch.column;
            return true;
        }
        errors.push(`${label}: "${ref.table}.${ref.column}" not found in schema`);
        return false;
    }
    const catValid = validateCol(corrected.category_column, 'category_column');
    const seriesValid = validateCol(corrected.series_column, 'series_column');
    const valValid = validateCol(corrected.value_column, 'value_column');
    const val2Valid = validateCol(corrected.value_column_2, 'value_column_2');
    for (const f of corrected.filters || []) {
        validateCol(f, 'filter');
    }
    return {
        valid: catValid && seriesValid && valValid && val2Valid,
        errors,
        corrected,
    };
}
//# sourceMappingURL=validator.js.map