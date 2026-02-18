// --- Helpers ----------------------------------------------------------------
export function capitalize(s) {
    return s
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
}
export function pickTimeBucket(col) {
    if (col.uniqueCount > 365)
        return 'day';
    if (col.uniqueCount > 100)
        return 'week';
    if (col.uniqueCount > 24)
        return 'month';
    if (col.uniqueCount > 8)
        return 'quarter';
    return 'month';
}
function findByRole(columns, role) {
    return columns.filter(c => c.role === role);
}
function first(columns, role) {
    return columns.find(c => c.role === role);
}
function sumAlias(measureName) {
    return `total_${measureName}`;
}
function makeStep(category, title, question, intent, rationale, query, table, suggestedPatterns) {
    return { title, question, intent, query, table, suggestedPatterns, rationale, category };
}
const timeTrend = (columns, table) => {
    const timeCol = first(columns, 'time');
    const measureCol = first(columns, 'measure');
    if (!timeCol || !measureCol)
        return null;
    const bucket = pickTimeBucket(timeCol);
    const asName = sumAlias(measureCol.name);
    return makeStep('trend', `${capitalize(measureCol.name)} Over Time`, `How does ${capitalize(measureCol.name)} change over time?`, `Show ${measureCol.name} trend over ${timeCol.name}`, `Time column "${timeCol.name}" paired with measure "${measureCol.name}" suggests a time-series trend analysis.`, {
        select: [timeCol.name, { field: measureCol.name, aggregate: 'sum', as: asName }],
        groupBy: [{ field: timeCol.name, bucket }],
        orderBy: [{ field: timeCol.name, direction: 'asc' }],
    }, table, ['line', 'area', 'sparkline-grid']);
};
const trendByGroup = (columns, table) => {
    const timeCol = first(columns, 'time');
    const measureCol = first(columns, 'measure');
    const dimCol = findByRole(columns, 'dimension').find(d => d.uniqueCount <= 8);
    if (!timeCol || !measureCol || !dimCol)
        return null;
    const bucket = pickTimeBucket(timeCol);
    const asName = sumAlias(measureCol.name);
    return makeStep('trend', `${capitalize(measureCol.name)} Over Time by ${capitalize(dimCol.name)}`, `How does ${capitalize(measureCol.name)} trend over time across different ${capitalize(dimCol.name)} values?`, `Show ${measureCol.name} trend over ${timeCol.name} grouped by ${dimCol.name}`, `Time column "${timeCol.name}" with low-cardinality dimension "${dimCol.name}" (${dimCol.uniqueCount} values) enables grouped trend comparison.`, {
        select: [timeCol.name, dimCol.name, { field: measureCol.name, aggregate: 'sum', as: asName }],
        groupBy: [{ field: timeCol.name, bucket }, dimCol.name],
        orderBy: [{ field: timeCol.name, direction: 'asc' }],
    }, table, ['small-multiples', 'sparkline-grid']);
};
const comparison = (columns, table) => {
    const dimCol = first(columns, 'dimension');
    const measureCol = first(columns, 'measure');
    if (!dimCol || !measureCol)
        return null;
    const asName = sumAlias(measureCol.name);
    const patterns = dimCol.uniqueCount > 10
        ? ['bar', 'lollipop']
        : ['bar', 'lollipop', 'diverging-bar'];
    return makeStep('comparison', `${capitalize(measureCol.name)} by ${capitalize(dimCol.name)}`, `How does ${capitalize(measureCol.name)} compare across ${capitalize(dimCol.name)} values?`, `Compare ${measureCol.name} across ${dimCol.name}`, `Dimension "${dimCol.name}" (${dimCol.uniqueCount} unique values) with measure "${measureCol.name}" enables categorical comparison.`, {
        select: [dimCol.name, { field: measureCol.name, aggregate: 'sum', as: asName }],
        groupBy: [dimCol.name],
        orderBy: [{ field: asName, direction: 'desc' }],
    }, table, patterns);
};
const distribution = (columns, table) => {
    const measureCol = first(columns, 'measure');
    if (!measureCol)
        return null;
    return makeStep('distribution', `Distribution of ${capitalize(measureCol.name)}`, `What is the distribution of ${capitalize(measureCol.name)}?`, `Show distribution of ${measureCol.name}`, `Measure "${measureCol.name}" can be analyzed for its statistical distribution.`, { select: [measureCol.name] }, table, ['histogram', 'violin', 'beeswarm']);
};
const relationship = (columns, table) => {
    const measures = findByRole(columns, 'measure');
    if (measures.length < 2)
        return null;
    const [m1, m2] = measures;
    const dimCol = findByRole(columns, 'dimension').find(d => d.uniqueCount <= 10);
    const selectFields = dimCol
        ? [m1.name, m2.name, dimCol.name]
        : [m1.name, m2.name];
    return makeStep('relationship', `${capitalize(m1.name)} vs ${capitalize(m2.name)}`, `What is the relationship between ${capitalize(m1.name)} and ${capitalize(m2.name)}?`, `Explore relationship between ${m1.name} and ${m2.name}`, `Two measure columns "${m1.name}" and "${m2.name}" enable relationship analysis.${dimCol ? ` Dimension "${dimCol.name}" adds color grouping.` : ''}`, { select: selectFields }, table, ['scatter', 'heatmap']);
};
const ranking = (columns, table) => {
    const dimCol = findByRole(columns, 'dimension').find(d => d.uniqueCount > 10);
    const measureCol = first(columns, 'measure');
    if (!dimCol || !measureCol)
        return null;
    if (measureCol.stats && measureCol.stats.mean !== 0) {
        const cv = Math.abs(measureCol.stats.stddev / measureCol.stats.mean);
        if (cv < 0.1)
            return null;
    }
    const asName = sumAlias(measureCol.name);
    return makeStep('ranking', `Top ${capitalize(dimCol.name)} by ${capitalize(measureCol.name)}`, `Which ${capitalize(dimCol.name)} values rank highest by ${capitalize(measureCol.name)}?`, `Rank top ${dimCol.name} by ${measureCol.name}`, `High-cardinality dimension "${dimCol.name}" (${dimCol.uniqueCount} values) with measure "${measureCol.name}" suits a top-N ranking with limit.`, {
        select: [dimCol.name, { field: measureCol.name, aggregate: 'sum', as: asName }],
        groupBy: [dimCol.name],
        orderBy: [{ field: asName, direction: 'desc' }],
        limit: 15,
    }, table, ['bar', 'lollipop']);
};
const isNullDominant = (col) => col.totalCount > 0 && col.nullCount / col.totalCount > 0.5;
const composition = (columns, table) => {
    const hierarchyCol = first(columns, 'hierarchy');
    const measureCol = first(columns, 'measure');
    const dimCol = findByRole(columns, 'dimension').find(d => !isNullDominant(d));
    if (hierarchyCol && !isNullDominant(hierarchyCol) && dimCol && measureCol) {
        const asName = sumAlias(measureCol.name);
        return makeStep('composition', `${capitalize(measureCol.name)} Composition by ${capitalize(dimCol.name)} and ${capitalize(hierarchyCol.name)}`, `How is ${capitalize(measureCol.name)} distributed across ${capitalize(dimCol.name)} and ${capitalize(hierarchyCol.name)}?`, `Show composition of ${measureCol.name} by ${dimCol.name} and ${hierarchyCol.name}`, `Hierarchy column "${hierarchyCol.name}" with dimension "${dimCol.name}" and measure "${measureCol.name}" enables hierarchical composition analysis.`, {
            select: [dimCol.name, hierarchyCol.name, { field: measureCol.name, aggregate: 'sum', as: asName }],
            groupBy: [dimCol.name, hierarchyCol.name],
        }, table, ['treemap', 'sunburst', 'stacked-bar']);
    }
    if (dimCol && measureCol && dimCol.uniqueCount >= 3 && dimCol.uniqueCount <= 12) {
        const asName = sumAlias(measureCol.name);
        return makeStep('composition', `${capitalize(measureCol.name)} Composition by ${capitalize(dimCol.name)}`, `What share does each ${capitalize(dimCol.name)} contribute to total ${capitalize(measureCol.name)}?`, `Show composition of ${measureCol.name} by ${dimCol.name}`, `Dimension "${dimCol.name}" (${dimCol.uniqueCount} values) with measure "${measureCol.name}" suits part-of-whole composition analysis.`, {
            select: [dimCol.name, { field: measureCol.name, aggregate: 'sum', as: asName }],
            groupBy: [dimCol.name],
        }, table, ['donut', 'waffle', 'treemap']);
    }
    return null;
};
// --- All Rules --------------------------------------------------------------
const ALL_RULES = [
    timeTrend,
    trendByGroup,
    comparison,
    distribution,
    relationship,
    ranking,
    composition,
];
// --- Main Export -------------------------------------------------------------
export function generateCandidates(columns, table) {
    return ALL_RULES.flatMap(rule => {
        const result = rule(columns, table);
        return result ? [result] : [];
    });
}
//# sourceMappingURL=rules.js.map