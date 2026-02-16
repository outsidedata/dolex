import { classifyColumns } from './classify.js';
import { generateCandidates } from './rules.js';
const CATEGORY_PRIORITY = {
    trend: 1,
    comparison: 2,
    distribution: 3,
    ranking: 4,
    composition: 5,
    relationship: 6,
};
const DEFAULT_MAX_STEPS = 6;
function plural(n, word) {
    return `${n} ${word}${n !== 1 ? 's' : ''}`;
}
export function buildAnalysisPlan(columns, table, sourceName, maxSteps = DEFAULT_MAX_STEPS) {
    const classified = classifyColumns(columns);
    const candidates = generateCandidates(classified, table);
    candidates.sort((a, b) => CATEGORY_PRIORITY[a.category] - CATEGORY_PRIORITY[b.category]);
    // Deduplicate by category: first encountered wins after priority sort
    const seen = new Set();
    const steps = candidates
        .filter(step => {
        if (seen.has(step.category))
            return false;
        seen.add(step.category);
        return true;
    })
        .slice(0, maxSteps);
    // Build summary from role counts
    const roleCounts = { time: 0, dimension: 0, measure: 0 };
    for (const col of classified) {
        if (col.role === 'time')
            roleCounts.time++;
        else if (col.role === 'dimension' || col.role === 'hierarchy')
            roleCounts.dimension++;
        else if (col.role === 'measure')
            roleCounts.measure++;
    }
    const parts = [];
    if (roleCounts.time > 0)
        parts.push(plural(roleCounts.time, 'time column'));
    if (roleCounts.dimension > 0)
        parts.push(plural(roleCounts.dimension, 'dimension'));
    if (roleCounts.measure > 0)
        parts.push(plural(roleCounts.measure, 'measure'));
    const columnDesc = parts.length > 0 ? parts.join(', ') : 'no analyzable columns';
    const analysisWord = steps.length === 1 ? '1 analysis' : `${steps.length} analyses`;
    const summary = `${sourceName}: ${columnDesc} — ${analysisWord} planned`;
    return { summary, steps };
}
//# sourceMappingURL=planner.js.map