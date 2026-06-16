const STRONG_ID_NAME = /(?:^id$|_id$|_pk$)/;
const WEAK_ID_NAME = /(?:_number$|_no$|_num$|_idx$|_index$|^index$|_key$|_code$|^#$)/;
function looksLikeNumericId(col) {
    const name = col.name.toLowerCase().replace(/[\s.\-]/g, '_');
    if (STRONG_ID_NAME.test(name))
        return true;
    const highCardinality = col.totalCount > 0 && col.uniqueCount / col.totalCount > 0.5;
    if (WEAK_ID_NAME.test(name) && highCardinality)
        return true;
    // Surrogate / auto-increment key with no id-ish name: every value distinct AND
    // the value range looks like row indices (starts at 0 or 1, max ≈ row count).
    // A real measure (revenue, price, score) has values unrelated to the row count,
    // so its max far exceeds totalCount. Require a SIZABLE table (≥50 rows, matching
    // quality.ts) so a small all-distinct MEASURE — e.g. 12 unique revenues — is
    // never mistaken for an id just because every value happens to be unique.
    const allDistinct = col.totalCount > 0 && col.uniqueCount >= col.totalCount;
    if (allDistinct && col.totalCount >= 50 && col.stats) {
        const { min, max } = col.stats;
        const looksLikeRowIndex = Number.isInteger(min) && Number.isInteger(max) &&
            min >= 0 && min <= 1 &&
            max >= col.totalCount - 1 && max <= col.totalCount + 1;
        if (looksLikeRowIndex)
            return true;
    }
    return false;
}
function classifySingle(col) {
    switch (col.type) {
        case 'id':
            return 'id';
        case 'text':
            return 'text';
        case 'date':
            return 'time';
        case 'numeric':
            // NOTE: do NOT treat "all values distinct" alone as an id — in a small
            // table a legitimate measure (revenue, price) is naturally all-distinct.
            // Identifier detection lives in looksLikeNumericId (name + sequential-key).
            if (looksLikeNumericId(col))
                return 'id';
            return 'measure';
        case 'categorical': {
            if (col.totalCount > 0 && col.uniqueCount / col.totalCount >= 0.8)
                return 'text';
            if (col.uniqueCount <= 50)
                return 'dimension';
            return 'text';
        }
    }
}
function toClassified(col, role) {
    return {
        name: col.name,
        originalType: col.type,
        role,
        uniqueCount: col.uniqueCount,
        nullCount: col.nullCount,
        totalCount: col.totalCount,
        ...(col.stats && { stats: col.stats }),
        ...(col.topValues && { topValues: col.topValues }),
    };
}
export function classifyColumns(columns) {
    const classified = columns.map(c => toClassified(c, classifySingle(c)));
    // Detect hierarchies among dimensions: if one dimension has >2x the unique count
    // of another, the higher-cardinality one is a hierarchy level.
    const dimensions = classified.filter(c => c.role === 'dimension');
    if (dimensions.length >= 2) {
        const sorted = [...dimensions].sort((a, b) => a.uniqueCount - b.uniqueCount);
        for (let i = 1; i < sorted.length; i++) {
            const lower = sorted[i - 1];
            const current = sorted[i];
            if (current.uniqueCount > 2 * lower.uniqueCount) {
                current.role = 'hierarchy';
            }
        }
    }
    return classified;
}
