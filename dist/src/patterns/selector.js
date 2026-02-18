/**
 * Pattern Selection Intelligence.
 *
 * This is the core of the product. Analyzes data shape + user intent,
 * scores every registered pattern, and returns ranked recommendations
 * with reasoning.
 *
 * An LLM will always pick bar/line/pie. We pick bump charts, beeswarms,
 * slope charts, waffles — because the selection rules encode design
 * expertise that probabilistic token generation cannot.
 */
import { registry } from './registry.js';
import { buildMatchContext, parseIntent } from './utils.js';
// ─── SELECTOR ────────────────────────────────────────────────────────────────
/**
 * Select the best visualization pattern(s) for the given data and intent.
 *
 * This is the primary entry point for visualization intelligence.
 * It builds a data shape context, scores all patterns against it,
 * generates specs for the top recommendations, and returns them ranked.
 *
 * @param data - Array of data rows
 * @param columns - Column metadata (types, cardinality, etc.)
 * @param intent - User's description of what they want to see
 * @param options - Optional configuration
 * @returns Ranked recommendations with specs and reasoning
 */
export function selectPattern(data, columns, intent, options) {
    const maxAlternatives = options?.maxAlternatives ?? 3;
    const ctx = buildMatchContext(data, columns, intent);
    const intentResult = parseIntent(intent);
    // Get all patterns, optionally filtered
    let candidates = registry.getAll();
    if (options?.filterCategories?.length) {
        candidates = candidates.filter((p) => options.filterCategories.includes(p.category));
    }
    if (options?.excludePatterns?.length) {
        candidates = candidates.filter((p) => !options.excludePatterns.includes(p.id));
    }
    // Pre-filter by dataRequirements (structural compatibility check).
    // Skip when forcePattern is set — the user explicitly wants that pattern.
    if (!options?.forcePattern) {
        const compatible = registry.getCompatible({
            rowCount: ctx.dataShape.rowCount,
            numericColumnCount: ctx.dataShape.numericColumnCount,
            categoricalColumnCount: ctx.dataShape.categoricalColumnCount,
            dateColumnCount: ctx.dataShape.dateColumnCount,
            hasHierarchy: ctx.dataShape.hasHierarchy,
            hasTimeSeries: ctx.dataShape.hasTimeSeries,
        });
        const compatibleIds = new Set(compatible.map((p) => p.id));
        candidates = candidates.filter((p) => compatibleIds.has(p.id));
    }
    // Score every candidate
    const scored = candidates
        .map((pattern) => scorePattern(pattern, ctx, intentResult))
        .sort((a, b) => b.score - a.score);
    // Generate specs for top N+1 patterns
    const topN = scored.slice(0, maxAlternatives + 1);
    const mergedSpecOptions = { ...options?.specOptions, _intent: intent };
    const recommendations = topN
        .map((sp) => buildRecommendation(sp, data, columns, mergedSpecOptions))
        .filter((r) => r !== null);
    // Ensure we have at least one recommendation
    if (recommendations.length === 0) {
        // Fallback to bar chart
        const fallback = registry.get('bar');
        const colNames = columns.map((c) => c.name);
        recommendations.push({
            pattern: fallback,
            spec: fallback.generateSpec(data, colNames),
            score: 0,
            reasoning: 'Fallback: no pattern scored positively for this data shape.',
        });
    }
    // Handle forcePattern: promote or construct the forced pattern as recommended
    if (options?.forcePattern) {
        const forcedPattern = registry.get(options.forcePattern);
        if (forcedPattern) {
            const existingIdx = recommendations.findIndex((r) => r.pattern.id === options.forcePattern);
            if (existingIdx >= 0) {
                // Already in recommendations — promote to first position
                const [promoted] = recommendations.splice(existingIdx, 1);
                promoted.reasoning = `Forced pattern: ${promoted.reasoning}`;
                recommendations.unshift(promoted);
            }
            else {
                // Not in recommendations — build a new one
                try {
                    const colNames = selectColumnsForPattern(forcedPattern, columns);
                    const spec = forcedPattern.generateSpec(data, colNames, mergedSpecOptions);
                    recommendations.unshift({
                        pattern: forcedPattern,
                        spec,
                        score: 0,
                        reasoning: `Forced pattern: ${forcedPattern.name} selected by caller.`,
                    });
                }
                catch {
                    // generateSpec failed — fall through to normal scoring with a note
                    recommendations[0] = {
                        ...recommendations[0],
                        reasoning: `Forced pattern "${options.forcePattern}" failed spec generation; fell back to scoring. ${recommendations[0].reasoning}`,
                    };
                }
            }
        }
        else {
            // Unknown pattern ID — fall through with a note
            recommendations[0] = {
                ...recommendations[0],
                reasoning: `Unknown forced pattern "${options.forcePattern}"; fell back to scoring. ${recommendations[0].reasoning}`,
            };
        }
    }
    return {
        recommended: recommendations[0],
        alternatives: recommendations.slice(1),
        dataShape: ctx.dataShape,
        intentCategory: intentResult.primary,
    };
}
// ─── SCORING ─────────────────────────────────────────────────────────────────
/**
 * Score a single pattern against the data context.
 * Runs all selection rules, sums weights, and applies category boost.
 */
function scorePattern(pattern, ctx, intentResult) {
    let totalScore = 0;
    const matchedRules = [];
    // Evaluate each selection rule
    for (const rule of pattern.selectionRules) {
        try {
            if (rule.matches(ctx)) {
                totalScore += rule.weight;
                matchedRules.push({ condition: rule.condition, weight: rule.weight });
            }
        }
        catch {
            // Rule threw an error — skip it silently
            // Selection rules must be pure and fast; errors are bugs, not data problems
        }
    }
    // Category alignment boost: if the inferred intent category matches the pattern category
    if (intentResult.primary === pattern.category) {
        const boost = 20;
        totalScore += boost;
        matchedRules.push({
            condition: `Intent category "${intentResult.primary}" matches pattern category`,
            weight: boost,
        });
    }
    // Secondary category alignment: smaller boost for related intent signals
    const intentScore = intentResult.scores[pattern.category] ?? 0;
    if (intentScore > 0 && intentResult.primary !== pattern.category) {
        const secondaryBoost = intentScore * 5;
        totalScore += secondaryBoost;
        matchedRules.push({
            condition: `Secondary intent signal for "${pattern.category}" (${intentScore} keyword matches)`,
            weight: secondaryBoost,
        });
    }
    // Pattern name matching: if the user's intent mentions a pattern by name, boost it strongly
    if (ctx.intent) {
        const intentLower = ctx.intent.toLowerCase();
        const idAsWords = pattern.id.replace(/-/g, ' ');
        const nameLower = pattern.name.toLowerCase();
        const nameRegex = new RegExp(`\\b${idAsWords.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        const nameRegex2 = new RegExp(`\\b${nameLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (nameRegex.test(intentLower) || nameRegex2.test(intentLower)) {
            const boost = 100;
            totalScore += boost;
            matchedRules.push({
                condition: `Intent mentions pattern name "${pattern.name}"`,
                weight: boost,
            });
        }
    }
    // Build human-readable reasoning
    const reasoning = buildReasoning(pattern, matchedRules, totalScore);
    return {
        pattern,
        score: totalScore,
        matchedRules,
        reasoning,
    };
}
/**
 * Build a human-readable reasoning string from matched rules.
 */
function buildReasoning(pattern, matchedRules, totalScore) {
    if (matchedRules.length === 0) {
        return `${pattern.name}: No selection rules matched (score: ${totalScore}).`;
    }
    const positiveRules = matchedRules.filter((r) => r.weight > 0);
    const negativeRules = matchedRules.filter((r) => r.weight < 0);
    const parts = [];
    if (positiveRules.length > 0) {
        const topPositive = positiveRules
            .sort((a, b) => b.weight - a.weight)
            .slice(0, 3)
            .map((r) => r.condition);
        parts.push(topPositive.join('. '));
    }
    if (negativeRules.length > 0) {
        const topNegative = negativeRules
            .sort((a, b) => a.weight - b.weight)
            .slice(0, 2)
            .map((r) => `However: ${r.condition}`);
        parts.push(topNegative.join('. '));
    }
    return `${pattern.name} (score: ${totalScore}): ${parts.join('. ')}.`;
}
// ─── SPEC GENERATION ─────────────────────────────────────────────────────────
/**
 * Generate a VisualizationRecommendation from a scored pattern.
 * Calls the pattern's generateSpec with appropriate column selection.
 */
function buildRecommendation(scored, data, columns, specOptions) {
    try {
        const colNames = selectColumnsForPattern(scored.pattern, columns);
        const spec = scored.pattern.generateSpec(data, colNames, specOptions);
        return {
            pattern: scored.pattern,
            spec,
            score: scored.score,
            reasoning: scored.reasoning,
        };
    }
    catch {
        // If spec generation fails, skip this pattern
        return null;
    }
}
/**
 * Get categorical candidates: true categoricals first, then date columns as fallback.
 * Many non-time patterns (waterfall, treemap, heatmap) can use date columns as categories.
 */
function getCategoricalCandidates(columns) {
    const cats = columns.filter((c) => c.type === 'categorical');
    const dates = columns.filter((c) => c.type === 'date');
    return [...cats, ...dates];
}
/**
 * Sort categorical columns by cardinality (uniqueCount) ascending.
 * Lower cardinality = parent/group level, higher cardinality = child/leaf level.
 */
function sortByCardinality(cols, direction = 'asc') {
    return [...cols].sort((a, b) => direction === 'asc'
        ? (a.uniqueCount ?? 0) - (b.uniqueCount ?? 0)
        : (b.uniqueCount ?? 0) - (a.uniqueCount ?? 0));
}
/**
 * Select the most appropriate columns for a pattern based on its requirements
 * and the available data columns.
 *
 * Uses pattern-specific logic where needed (heatmap, hierarchy patterns,
 * waterfall, flow), with category-level fallback for simpler cases.
 *
 * Key improvements over naive category-level selection:
 * 1. Date columns coerced to categorical for non-time patterns when needed
 * 2. Cardinality-based ordering for multi-categorical patterns (parent before child)
 * 3. Pattern-specific slot assignment (heatmap needs 2 cats, waterfall needs cat+num, etc.)
 * 4. No-duplicate validation
 */
function selectColumnsForPattern(pattern, columns) {
    const dateCols = columns.filter((c) => c.type === 'date');
    const categoricalCols = columns.filter((c) => c.type === 'categorical');
    const numericCols = columns.filter((c) => c.type === 'numeric');
    const result = [];
    // Pattern-specific column selection (overrides category-level logic)
    const patternResult = selectColumnsForSpecificPattern(pattern, columns, dateCols, categoricalCols, numericCols);
    if (patternResult) {
        return deduplicateColumns(patternResult, columns);
    }
    // Category-level fallback
    switch (pattern.category) {
        case 'time': {
            if (dateCols.length > 0)
                result.push(dateCols[0].name);
            if (numericCols.length > 0)
                result.push(numericCols[0].name);
            if (dateCols.length === 0 && numericCols.length > 1)
                result.push(numericCols[1].name);
            if (categoricalCols.length > 0)
                result.push(categoricalCols[0].name);
            break;
        }
        case 'comparison': {
            const catCandidates = getCategoricalCandidates(columns);
            if (catCandidates.length > 0)
                result.push(catCandidates[0].name);
            for (const col of numericCols)
                result.push(col.name);
            if (dateCols.length > 0 && (pattern.id === 'slope-chart' || pattern.id === 'bump-chart')) {
                result.splice(1, 0, dateCols[0].name);
            }
            break;
        }
        case 'distribution': {
            for (const col of numericCols)
                result.push(col.name);
            if (categoricalCols.length > 0)
                result.push(categoricalCols[0].name);
            else if (dateCols.length > 0)
                result.push(dateCols[0].name);
            break;
        }
        case 'composition': {
            const sorted = sortByCardinality(categoricalCols);
            for (const col of sorted)
                result.push(col.name);
            if (numericCols.length > 0)
                result.push(numericCols[0].name);
            break;
        }
        case 'relationship': {
            if (pattern.id === 'connected-scatter') {
                if (dateCols.length > 0)
                    result.push(dateCols[0].name);
                for (const col of numericCols.slice(0, 2))
                    result.push(col.name);
            }
            else if (pattern.id === 'parallel-coordinates' || pattern.id === 'radar') {
                if (categoricalCols.length > 0)
                    result.push(categoricalCols[0].name);
                for (const col of numericCols)
                    result.push(col.name);
            }
            else {
                for (const col of numericCols.slice(0, 2))
                    result.push(col.name);
                if (categoricalCols.length > 0)
                    result.push(categoricalCols[0].name);
                if (numericCols.length > 2)
                    result.push(numericCols[2].name);
            }
            break;
        }
        case 'flow': {
            for (const col of categoricalCols.slice(0, 2))
                result.push(col.name);
            if (numericCols.length > 0)
                result.push(numericCols[0].name);
            break;
        }
        default: {
            for (const col of columns)
                result.push(col.name);
        }
    }
    if (result.length === 0) {
        result.push(columns[0]?.name ?? 'value');
    }
    return deduplicateColumns(result, columns);
}
/**
 * Pattern-specific column selection for patterns that need custom logic
 * beyond what the category-level fallback provides.
 *
 * Returns null to fall through to category-level logic.
 */
function selectColumnsForSpecificPattern(pattern, columns, dateCols, categoricalCols, numericCols) {
    switch (pattern.id) {
        // ── Scatter: 2 numerics + optional categorical for color ────────────
        case 'scatter': {
            if (numericCols.length >= 2) {
                const result = [numericCols[0].name, numericCols[1].name];
                if (categoricalCols.length > 0)
                    result.push(categoricalCols[0].name);
                return result;
            }
            return null;
        }
        // ── Heatmap: 2 categoricals + 1 numeric ──────────────────────────────
        case 'heatmap': {
            const catCandidates = getCategoricalCandidates(columns);
            if (catCandidates.length >= 2 && numericCols.length >= 1) {
                const sorted = sortByCardinality(catCandidates);
                return [sorted[0].name, sorted[1].name, numericCols[0].name];
            }
            return null;
        }
        // ── Hierarchy patterns: categoricals by cardinality + numeric ────────
        case 'treemap':
        case 'circle-pack': {
            const catCandidates = getCategoricalCandidates(columns);
            if (catCandidates.length >= 2 && numericCols.length >= 1) {
                const sorted = sortByCardinality(catCandidates);
                return [...sorted.map((c) => c.name), numericCols[0].name];
            }
            if (catCandidates.length >= 1 && numericCols.length >= 1) {
                return [catCandidates[0].name, numericCols[0].name];
            }
            return null;
        }
        case 'sunburst':
        case 'icicle': {
            const catCandidates = getCategoricalCandidates(columns);
            if (catCandidates.length >= 1 && numericCols.length >= 1) {
                const sorted = sortByCardinality(catCandidates);
                return [...sorted.map((c) => c.name), numericCols[0].name];
            }
            return null;
        }
        // ── Grouped bar: 2 categoricals + 1 numeric, OR 1 categorical + N numerics (wide format)
        case 'grouped-bar': {
            if (categoricalCols.length >= 2 && numericCols.length >= 1) {
                const sorted = sortByCardinality(categoricalCols);
                return [sorted[0].name, sorted[1].name, numericCols[0].name];
            }
            if (categoricalCols.length >= 1 && numericCols.length >= 2) {
                return [categoricalCols[0].name];
            }
            return null;
        }
        // ── Waterfall: 1 categorical-or-date + 1 numeric ─────────────────────
        case 'waterfall': {
            const catCandidates = getCategoricalCandidates(columns);
            if (catCandidates.length >= 1 && numericCols.length >= 1) {
                return [catCandidates[0].name, numericCols[0].name];
            }
            return null;
        }
        // ── Flow patterns: 2 categoricals + 1 numeric ────────────────────────
        case 'sankey':
        case 'alluvial':
        case 'chord': {
            const catCandidates = getCategoricalCandidates(columns);
            if (catCandidates.length >= 2 && numericCols.length >= 1) {
                return [catCandidates[0].name, catCandidates[1].name, numericCols[0].name];
            }
            return null;
        }
        default:
            return null;
    }
}
/**
 * Ensure no column name appears twice in the result.
 * If a duplicate is found, try to substitute with the next unused column of the same type.
 */
function deduplicateColumns(result, columns) {
    const seen = new Set();
    const deduped = [];
    for (const name of result) {
        if (!seen.has(name)) {
            seen.add(name);
            deduped.push(name);
        }
    }
    if (deduped.length === 0) {
        deduped.push(columns[0]?.name ?? 'value');
    }
    return deduped;
}
// ─── CONVENIENCE FUNCTIONS ───────────────────────────────────────────────────
/**
 * Quick recommendation: just return the single best pattern ID and a brief reason.
 * Useful for logging, debugging, or simple integrations.
 */
export function quickRecommend(data, columns, intent) {
    const result = selectPattern(data, columns, intent, { maxAlternatives: 0 });
    return {
        patternId: result.recommended.pattern.id,
        reasoning: result.recommended.reasoning,
    };
}
/**
 * Score a specific pattern against data without generating a spec.
 * Useful for testing individual patterns.
 */
export function scoreSpecificPattern(patternId, data, columns, intent) {
    const pattern = registry.get(patternId);
    if (!pattern)
        return null;
    const ctx = buildMatchContext(data, columns, intent);
    const intentResult = parseIntent(intent);
    const scored = scorePattern(pattern, ctx, intentResult);
    return {
        score: scored.score,
        matchedRules: scored.matchedRules,
        reasoning: scored.reasoning,
    };
}
//# sourceMappingURL=selector.js.map