// --- Helpers ----------------------------------------------------------------
export function capitalize(s) {
    return s
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
}
/** Escape + quote a SQL identifier so embedded double-quotes can't break out
 *  of (or inject into) the generated query. e.g. order"date → "order""date". */
function q(id) {
    return '"' + String(id).replace(/"/g, '""') + '"';
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
/**
 * A "year" column holds 4-digit years (often as integers/floats), not full
 * dates. Sub-year buckets like strftime('%Y-%m', year) are nonsense on these —
 * SQLite reads a bare number as a Julian day and emits garbage ('-4707-04').
 * Detect by name (year/yr/fy) or by all top values being 4-digit years.
 */
export function isYearColumn(col) {
    if (/(^|[^a-z])(year|yr|fy)([^a-z]|$)/i.test(col.name))
        return true;
    const vals = (col.topValues ?? []).map((t) => String(t.value));
    return vals.length > 0 && vals.every((v) => /^(1[89]|20)\d{2}(\.0+)?$/.test(v));
}
/**
 * True only if the column's values are ISO-8601 dates (YYYY-MM-DD…). SQLite's
 * strftime parses ONLY ISO format; on slash/text dates ('9/2/1966') it returns
 * NULL for every row, collapsing a trend into one garbage bucket.
 */
export function isIsoDateColumn(col) {
    const vals = (col.topValues ?? []).map((t) => String(t.value));
    return vals.length > 0 && vals.every((v) => /^\d{4}-\d{2}-\d{2}([ T]|$)/.test(v));
}
/**
 * Raised when analysis-plan generation is asked to run against a source whose
 * query paradigm the planner can't emit. The planner produces SELECT SQL, so a
 * document store (mongodb → aggregation pipeline) is REFUSED here rather than
 * silently handed SQLite SQL — the caller surfaces `message` as a clean error.
 */
export class PlannerUnsupportedSourceError extends Error {
    sourceType;
    constructor(sourceType, message) {
        super(message);
        this.sourceType = sourceType;
        this.name = 'PlannerUnsupportedSourceError';
    }
}
/**
 * Resolve a registered source's `type` to the SQL flavor the planner emits.
 * The ONE place source-type → planner-dialect is decided, so no call site
 * re-derives it with a `type === 'postgres' ? …` ternary that silently maps an
 * unrecognized (e.g. mongodb) source to SQLite. csv/undefined → sqlite,
 * postgres → postgres; a pipeline source (mongodb) or unknown type THROWS.
 */
export function plannerDialectForSource(type) {
    switch (type) {
        case undefined:
        case 'csv':
            return 'sqlite';
        case 'postgres':
            return 'postgres';
        case 'mongodb':
            throw new PlannerUnsupportedSourceError('mongodb', 'analyze builds SQL analysis plans and cannot plan a MongoDB source ' +
                '(aggregation-pipeline paradigm, not SQL). Query it directly, or drive it through the orchestrator/recon path.');
        default:
            throw new PlannerUnsupportedSourceError(type, `analyze: unknown source type "${type}" — no analysis-plan dialect mapping (expected csv | postgres).`);
    }
}
export function timeBucketing(col, dialect = 'sqlite') {
    if (isYearColumn(col)) {
        const c = q(col.name);
        // A year stored as a number → its integer year as text, guarded to a plausible range.
        // Postgres is type-strict (can't CAST('1980.0' AS INTEGER)), so it numeric-guards first.
        const expr = dialect === 'postgres'
            ? `CASE WHEN (${c})::text ~ '^ *-?[0-9]+([.][0-9]+)? *$' AND (${c})::double precision BETWEEN 1000 AND 2200 THEN floor((${c})::double precision)::int::text END`
            : `CASE WHEN CAST(${c} AS REAL) BETWEEN 1000 AND 2200 THEN CAST(CAST(${c} AS INTEGER) AS TEXT) END`;
        return { label: 'year', expr };
    }
    // Skip only on POSITIVE evidence the dates are non-ISO (top values present and
    // not ISO). Absent top values, assume ISO and bucket as before — a real date
    // column always has top values, so genuine non-ISO data is still caught.
    const vals = (col.topValues ?? []).map((t) => String(t.value));
    if (vals.length > 0 && !isIsoDateColumn(col))
        return null;
    const bucket = pickTimeBucket(col);
    return { label: bucket, expr: sqlTimeBucket(col.name, bucket, dialect) };
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
function sqlTimeBucket(col, bucket, dialect = 'sqlite') {
    const c = q(col);
    if (dialect === 'postgres') {
        const ts = `(${c})::timestamp`;
        switch (bucket) {
            case 'year': return `EXTRACT(YEAR FROM ${ts})::int::text`;
            case 'quarter': return `to_char(${ts}, 'YYYY') || '-Q' || EXTRACT(QUARTER FROM ${ts})::int::text`;
            case 'month': return `to_char(${ts}, 'YYYY-MM')`;
            case 'week': return `to_char(${ts}, 'IYYY-"W"IW')`;
            case 'day': return `to_char(${ts}, 'YYYY-MM-DD')`;
        }
    }
    switch (bucket) {
        case 'year':
            return `CASE WHEN typeof(${c}) = 'integer' AND ${c} BETWEEN 1000 AND 2200 THEN CAST(${c} AS TEXT) ELSE strftime('%Y', ${c}) END`;
        case 'quarter':
            return `strftime('%Y', ${c}) || '-Q' || ((CAST(strftime('%m', ${c}) AS INTEGER) - 1) / 3 + 1)`;
        case 'month':
            return `strftime('%Y-%m', ${c})`;
        case 'week':
            return `strftime('%Y-W%W', ${c})`;
        case 'day':
            return `strftime('%Y-%m-%d', ${c})`;
    }
}
function makeStep(category, title, question, intent, rationale, sql, table, suggestedPatterns) {
    return { title, question, intent, sql, table, suggestedPatterns, rationale, category };
}
const timeTrend = (columns, table, dialect) => {
    const timeCol = first(columns, 'time');
    const measureCol = first(columns, 'measure');
    if (!timeCol || !measureCol)
        return null;
    const tb = timeBucketing(timeCol, dialect);
    if (!tb)
        return null; // date column isn't ISO/year-bucketable — skip rather than ship garbage SQL
    const { label: bucket, expr: bucketExpr } = tb;
    const asName = sumAlias(measureCol.name);
    return makeStep('trend', `${capitalize(measureCol.name)} Over Time`, `How does ${capitalize(measureCol.name)} change over time?`, `Show ${measureCol.name} trend over ${timeCol.name}`, `Time column "${timeCol.name}" paired with measure "${measureCol.name}" suggests a time-series trend analysis.`, `SELECT ${bucketExpr} AS ${q(`${timeCol.name}_${bucket}`)}, SUM(${q(measureCol.name)}) AS ${q(asName)} FROM ${q(table)} GROUP BY 1 ORDER BY 1 ASC`, table, ['line', 'area', 'sparkline-grid']);
};
const trendByGroup = (columns, table, dialect) => {
    const timeCol = first(columns, 'time');
    const measureCol = first(columns, 'measure');
    const dimCol = findByRole(columns, 'dimension').find(d => d.uniqueCount <= 8);
    if (!timeCol || !measureCol || !dimCol)
        return null;
    const tb = timeBucketing(timeCol, dialect);
    if (!tb)
        return null; // non-ISO/non-year date — skip rather than ship garbage SQL
    const { label: bucket, expr: bucketExpr } = tb;
    const asName = sumAlias(measureCol.name);
    return makeStep('trend', `${capitalize(measureCol.name)} Over Time by ${capitalize(dimCol.name)}`, `How does ${capitalize(measureCol.name)} trend over time across different ${capitalize(dimCol.name)} values?`, `Show ${measureCol.name} trend over ${timeCol.name} grouped by ${dimCol.name}`, `Time column "${timeCol.name}" with low-cardinality dimension "${dimCol.name}" (${dimCol.uniqueCount} values) enables grouped trend comparison.`, `SELECT ${bucketExpr} AS ${q(`${timeCol.name}_${bucket}`)}, ${q(dimCol.name)}, SUM(${q(measureCol.name)}) AS ${q(asName)} FROM ${q(table)} GROUP BY 1, ${q(dimCol.name)} ORDER BY 1 ASC`, table, ['small-multiples', 'sparkline-grid']);
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
    return makeStep('comparison', `${capitalize(measureCol.name)} by ${capitalize(dimCol.name)}`, `How does ${capitalize(measureCol.name)} compare across ${capitalize(dimCol.name)} values?`, `Compare ${measureCol.name} across ${dimCol.name}`, `Dimension "${dimCol.name}" (${dimCol.uniqueCount} unique values) with measure "${measureCol.name}" enables categorical comparison.`, `SELECT ${q(dimCol.name)}, SUM(${q(measureCol.name)}) AS ${q(asName)} FROM ${q(table)} GROUP BY ${q(dimCol.name)} ORDER BY ${q(asName)} DESC`, table, patterns);
};
const distribution = (columns, table) => {
    const measureCol = first(columns, 'measure');
    if (!measureCol)
        return null;
    return makeStep('distribution', `Distribution of ${capitalize(measureCol.name)}`, `What is the distribution of ${capitalize(measureCol.name)}?`, `Show distribution of ${measureCol.name}`, `Measure "${measureCol.name}" can be analyzed for its statistical distribution.`, `SELECT ${q(measureCol.name)} FROM ${q(table)}`, table, ['histogram', 'violin', 'beeswarm']);
};
const relationship = (columns, table) => {
    const measures = findByRole(columns, 'measure');
    if (measures.length < 2)
        return null;
    const [m1, m2] = measures;
    const dimCol = findByRole(columns, 'dimension').find(d => d.uniqueCount <= 10);
    const selectCols = dimCol
        ? `${q(m1.name)}, ${q(m2.name)}, ${q(dimCol.name)}`
        : `${q(m1.name)}, ${q(m2.name)}`;
    return makeStep('relationship', `${capitalize(m1.name)} vs ${capitalize(m2.name)}`, `What is the relationship between ${capitalize(m1.name)} and ${capitalize(m2.name)}?`, `Explore relationship between ${m1.name} and ${m2.name}`, `Two measure columns "${m1.name}" and "${m2.name}" enable relationship analysis.${dimCol ? ` Dimension "${dimCol.name}" adds color grouping.` : ''}`, `SELECT ${selectCols} FROM ${q(table)}`, table, ['scatter', 'heatmap']);
};
const ranking = (columns, table) => {
    const dimCol = findByRole(columns, 'dimension').find(d => d.uniqueCount > 10);
    const measureCol = first(columns, 'measure');
    if (!dimCol || !measureCol)
        return null;
    if (measureCol.stats && measureCol.stats.mean !== 0 && measureCol.stats.stddev != null) {
        const cv = Math.abs(measureCol.stats.stddev / measureCol.stats.mean);
        if (cv < 0.1)
            return null;
    }
    const asName = sumAlias(measureCol.name);
    return makeStep('ranking', `Top ${capitalize(dimCol.name)} by ${capitalize(measureCol.name)}`, `Which ${capitalize(dimCol.name)} values rank highest by ${capitalize(measureCol.name)}?`, `Rank top ${dimCol.name} by ${measureCol.name}`, `High-cardinality dimension "${dimCol.name}" (${dimCol.uniqueCount} values) with measure "${measureCol.name}" suits a top-N ranking with limit.`, `SELECT ${q(dimCol.name)}, SUM(${q(measureCol.name)}) AS ${q(asName)} FROM ${q(table)} GROUP BY ${q(dimCol.name)} ORDER BY ${q(asName)} DESC LIMIT 15`, table, ['bar', 'lollipop']);
};
const isNullDominant = (col) => col.totalCount > 0 && col.nullCount / col.totalCount > 0.5;
const composition = (columns, table) => {
    const hierarchyCol = first(columns, 'hierarchy');
    const measureCol = first(columns, 'measure');
    const dimCol = findByRole(columns, 'dimension').find(d => !isNullDominant(d));
    if (hierarchyCol && !isNullDominant(hierarchyCol) && dimCol && measureCol) {
        const asName = sumAlias(measureCol.name);
        return makeStep('composition', `${capitalize(measureCol.name)} Composition by ${capitalize(dimCol.name)} and ${capitalize(hierarchyCol.name)}`, `How is ${capitalize(measureCol.name)} distributed across ${capitalize(dimCol.name)} and ${capitalize(hierarchyCol.name)}?`, `Show composition of ${measureCol.name} by ${dimCol.name} and ${hierarchyCol.name}`, `Hierarchy column "${hierarchyCol.name}" with dimension "${dimCol.name}" and measure "${measureCol.name}" enables hierarchical composition analysis.`, `SELECT ${q(dimCol.name)}, ${q(hierarchyCol.name)}, SUM(${q(measureCol.name)}) AS ${q(asName)} FROM ${q(table)} GROUP BY ${q(dimCol.name)}, ${q(hierarchyCol.name)}`, table, ['treemap', 'sunburst', 'stacked-bar']);
    }
    if (dimCol && measureCol && dimCol.uniqueCount >= 3 && dimCol.uniqueCount <= 12) {
        const asName = sumAlias(measureCol.name);
        return makeStep('composition', `${capitalize(measureCol.name)} Composition by ${capitalize(dimCol.name)}`, `What share does each ${capitalize(dimCol.name)} contribute to total ${capitalize(measureCol.name)}?`, `Show composition of ${measureCol.name} by ${dimCol.name}`, `Dimension "${dimCol.name}" (${dimCol.uniqueCount} values) with measure "${measureCol.name}" suits part-of-whole composition analysis.`, `SELECT ${q(dimCol.name)}, SUM(${q(measureCol.name)}) AS ${q(asName)} FROM ${q(table)} GROUP BY ${q(dimCol.name)}`, table, ['donut', 'waffle', 'treemap']);
    }
    return null;
};
// Period-over-period growth: the change and % change of a measure vs the previous
// time bucket (WoW/MoM/YoY depending on the bucket). Uses LAG; the % change is
// guarded with NULLIF (div-by-zero) and 100.0 (real division) — the SQL-safety
// traps this engine warns about, avoided at the source.
const periodOverPeriod = (columns, table, dialect) => {
    const timeCol = first(columns, 'time');
    const measureCol = first(columns, 'measure');
    if (!timeCol || !measureCol)
        return null;
    const tb = timeBucketing(timeCol, dialect);
    if (!tb)
        return null;
    const { label: bucket, expr: bucketExpr } = tb;
    const period = q(`${timeCol.name}_${bucket}`);
    const total = q(sumAlias(measureCol.name));
    const sql = `WITH t AS (SELECT ${bucketExpr} AS ${period}, SUM(${q(measureCol.name)}) AS ${total} FROM ${q(table)} GROUP BY 1) ` +
        `SELECT ${period}, ${total}, ${total} - LAG(${total}) OVER (ORDER BY ${period}) AS change, ` +
        `ROUND(100.0 * (${total} - LAG(${total}) OVER (ORDER BY ${period})) / NULLIF(LAG(${total}) OVER (ORDER BY ${period}), 0), 1) AS pct_change ` +
        `FROM t ORDER BY ${period} ASC`;
    return makeStep('trend', `${capitalize(measureCol.name)} Growth (period over period)`, `How fast is ${capitalize(measureCol.name)} growing from one ${bucket} to the next?`, `Show ${bucket}-over-${bucket} change and % change in ${measureCol.name}`, `Time column "${timeCol.name}" + measure "${measureCol.name}" supports period-over-period growth (${bucket}). % change is NULLIF-guarded against a zero base.`, sql, table, ['bar', 'line', 'waterfall']);
};
// Seasonality: average a measure by month-of-year ACROSS years, isolating the
// recurring seasonal shape from the long-run trend. Only meaningful with sub-year
// (ISO date) resolution — skipped for year-only columns.
const seasonality = (columns, table, dialect) => {
    const timeCol = first(columns, 'time');
    const measureCol = first(columns, 'measure');
    if (!timeCol || !measureCol)
        return null;
    if (isYearColumn(timeCol))
        return null; // year-only → no within-year season
    const vals = (timeCol.topValues ?? []).map((t) => String(t.value));
    if (vals.length > 0 && !isIsoDateColumn(timeCol))
        return null; // non-ISO date → strftime would NULL
    const c = q(timeCol.name);
    const monthExpr = dialect === 'postgres' ? `to_char((${c})::timestamp, 'MM')` : `strftime('%m', ${c})`;
    const sql = `SELECT ${monthExpr} AS month, AVG(${q(measureCol.name)}) AS ${q(`avg_${measureCol.name}`)} ` +
        `FROM ${q(table)} WHERE ${monthExpr} IS NOT NULL GROUP BY 1 ORDER BY 1 ASC`;
    return makeStep('trend', `${capitalize(measureCol.name)} Seasonality (by month)`, `Does ${capitalize(measureCol.name)} follow a recurring monthly/seasonal pattern?`, `Show average ${measureCol.name} by month of year across all years`, `ISO date "${timeCol.name}" + measure "${measureCol.name}" lets us average by month-of-year to separate seasonality from trend.`, sql, table, ['bar', 'line', 'radar']);
};
// --- All Rules --------------------------------------------------------------
const ALL_RULES = [
    timeTrend,
    trendByGroup,
    periodOverPeriod,
    seasonality,
    comparison,
    distribution,
    relationship,
    ranking,
    composition,
];
// --- Main Export -------------------------------------------------------------
export function generateCandidates(columns, table, dialect = 'sqlite') {
    return ALL_RULES.flatMap(rule => {
        const result = rule(columns, table, dialect);
        return result ? [result] : [];
    });
}
