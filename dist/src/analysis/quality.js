/**
 * Data-quality + footgun heuristics.
 *
 * `auditColumns` runs purely on column profiles (type, stats, top values, null
 * counts) — no data access — so it's cheap and unit-testable. The CLI's `check`
 * command layers a couple of query-based checks (duplicate rows, identical
 * columns) on top.
 *
 * The goal is confidence: surface the things that silently produce wrong or
 * misleading analysis (mixed-type columns, leaked duplicate columns, dead
 * columns, missing-value sentinels) before anyone trusts a chart.
 */
// Only tokens that are almost never a legitimate category. Deliberately EXCLUDES
// ambiguous values like 'na' (Namibia), 'none' (a real color), '-' (a separator)
// to avoid false positives — the worst kind of finding for a trust tool.
const SENTINELS = new Set([
    'n/a', '#n/a', '#n/a!', 'null', '#null!', 'nan',
    '#value!', '#ref!', '#div/0!', '#name?', '#num!',
    '-999', '-9999',
]);
// Magic NUMBERS that are almost always "missing", not real data. Only flagged
// when they also sit outside the column's own distribution (see the numeric
// branch), so a column where one of these is a legitimate value won't trip.
const NUMERIC_SENTINELS = new Set([-999, -9999, -99999, -9998, -8888, 9999, 99999, 999999]);
// How often a non-numeric token must recur in a numeric column before it's a
// string sentinel (coerced to NULL by affinity) rather than a one-off typo.
const COERCED_SENTINEL_MIN = 10;
// Numbers stored as TEXT that SQLite silently coerces wrong. US grouping only —
// "1.200,50" (European) is intentionally NOT matched here (stripping its comma
// would corrupt it); locale-aware parsing is a separate, larger concern.
const THOUSANDS_NUM = /^-?\d{1,3}(,\d{3})+(\.\d+)?$/; // 1,200 / 12,500.50 / -3,000
const CURRENCY_NUM = /^[-+]?[$€£¥]\s?\d[\d,]*(\.\d+)?$/; // $1,200 / €980 / £12,500.50
const PERCENT_NUM = /^[-+]?\d[\d,]*(\.\d+)?\s*%$/; // 45% / 12.5% / 1,200%
const ACCOUNTING_NUM = /^\(\s?[$€£¥]?\s?\d[\d,]*(\.\d+)?\s?\)$/; // (1,234) / ($1,234.50) — parens = negative
// Boolean columns written inconsistently (Yes/Y/1/true vs No/N/0/false).
const BOOL_TRUE = new Set(['true', 't', 'yes', 'y', '1']);
const BOOL_FALSE = new Set(['false', 'f', 'no', 'n', '0']);
const canonBool = (v) => {
    const k = v.trim().toLowerCase();
    return BOOL_TRUE.has(k) ? 'true' : BOOL_FALSE.has(k) ? 'false' : null;
};
// Invisible dirt: leading/trailing whitespace, non-breaking/zero-width spaces,
// smart quotes, BOM — splits otherwise-identical values.
const DIRTY_WS = /^\s|\s$|[\u00A0\u200B\u2018\u2019\u201C\u201D\uFEFF]/; // NBSP, ZWSP, smart quotes, BOM
function isNumericStr(s) {
    const t = s.trim();
    return t !== '' && !Number.isNaN(Number(t));
}
function hasSpecialChars(name) {
    return !/^[A-Za-z0-9_]+$/.test(name);
}
function looksLikeYear(col) {
    if (/(^|[^a-z])(year|yr|fy)([^a-z]|$)/i.test(col.name))
        return true;
    const vals = col.sampleValues ?? [];
    return vals.length > 0 && vals.every((v) => /^(1[89]|20)\d{2}(\.0+)?$/.test(v));
}
function isDatePartName(name) {
    return /(^|_)(month|months|hour|hours|minute|minutes|second|seconds|day|days|week|weeks|time|date)(_|$)/i.test(name);
}
function classifyDateFmt(v) {
    const s = v.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s))
        return 'iso';
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s))
        return 'us';
    if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(s))
        return 'eu';
    if (/^\d{1,2}\s+[A-Za-z]{3,}\s+\d{4}$/.test(s))
        return 'text';
    if (/^[A-Za-z]{3,}\s+\d{1,2},?\s+\d{4}$/.test(s))
        return 'text';
    return null;
}
function detectDateFormats(values) {
    const found = new Set();
    for (const v of values) {
        const f = classifyDateFmt(v);
        if (f)
            found.add(f);
    }
    return found;
}
/** Profile-based data-quality checks for one table's columns. */
export function auditColumns(table, columns, rowCount) {
    const findings = [];
    const add = (severity, column, issue, detail, suggestion) => findings.push({ severity, table, column, issue, detail, suggestion });
    for (const col of columns) {
        const total = col.totalCount || rowCount || 0;
        const nullRatio = total > 0 ? col.nullCount / total : 0;
        const samples = (col.sampleValues ?? []).filter((v) => v !== '' && v != null);
        const nonNull = total - col.nullCount;
        // ── Missing data ──
        if (total > 0 && col.nullCount === total) {
            add('high', col.name, 'all-null', `Column is entirely null (${total} rows) — carries no data.`, 'Drop it, or fix the source if it should have values.');
        }
        else if (nullRatio > 0.5) {
            add('medium', col.name, 'mostly-null', `${Math.round(nullRatio * 100)}% of values are null (${col.nullCount}/${total}).`, 'Aggregates skip nulls; segment-level analysis may be unreliable.');
        }
        else if (nullRatio > 0.2) {
            add('low', col.name, 'some-null', `${Math.round(nullRatio * 100)}% null (${col.nullCount}/${total}).`);
        }
        // ── Constant / no-variance ──
        // Only "constant" if the single value actually fills the column. A sparse
        // flag (e.g. 175 blanks + 2 'Y') has one distinct non-empty value but the
        // blank-vs-value distinction carries information — not a dead column.
        if (nonNull > 0 && col.uniqueCount === 1) {
            const topCount = col.topValues?.[0]?.count;
            const dominates = topCount === undefined ? true : total > 0 && topCount >= total * 0.9;
            if (dominates) {
                add('medium', col.name, 'constant', `Only one distinct value across ${total} rows — zero variance.`, 'Carries no information for comparison or correlation.');
            }
        }
        // ── Type traps (the lexicographic / silent-wrong class) ──
        // Probe sample values AND top values so a numeric-looking head with a mixed
        // tail isn't missed.
        const typeProbe = [...new Set([...samples, ...(col.topValues?.map((t) => String(t.value)) ?? [])])].filter((v) => v !== '' && v != null);
        if ((col.type === 'categorical' || col.type === 'text') && typeProbe.length >= 3) {
            const numeric = typeProbe.filter(isNumericStr);
            const ratio = numeric.length / typeProbe.length;
            if (ratio >= 0.5 && ratio < 1) {
                const nonNumeric = typeProbe.filter((v) => !isNumericStr(v)).slice(0, 3);
                add('high', col.name, 'mixed-type', `Mixed numeric and non-numeric values (e.g. ${nonNumeric.join(', ')}) — column is text.`, 'Numeric MAX/MIN/ORDER BY/comparisons will be lexicographic or wrong. Clean the non-numeric values (often sentinels) or CAST explicitly.');
            }
            else if (ratio === 1 && numeric.some((v) => /^-?0\d/.test(v.trim())) && !isDatePartName(col.name)) {
                const lz = numeric.filter((v) => /^-?0\d/.test(v.trim())).slice(0, 2);
                add('low', col.name, 'numeric-text', `All-numeric values stored as text, with leading zeros (e.g. ${lz.join(', ')}).`, 'Fine for zero-padded codes (zip/SKU); just note numeric sort/compare on it is lexicographic.');
            }
        }
        // ── Affinity trap: a string sentinel hiding in a NUMERIC column ──
        // The inverse of the case above. When a column is mostly numeric, the CSV
        // connector types it `numeric` and coerces non-numeric cells (e.g. "Undrafted")
        // to NULL — so the auditor can't see them in samples/topValues. But that
        // coercion is exactly what silently voids `WHERE col = 'Undrafted'` (it matches
        // ZERO rows), producing a wrong count with no error. The connector reports the
        // dominant coerced token; a RECURRING one (≥ COERCED_SENTINEL_MIN, so a lone
        // typo doesn't trip) is a genuine sentinel, not noise.
        if (col.type === 'numeric' && col.coercedNonNumeric && col.coercedNonNumeric.count >= COERCED_SENTINEL_MIN) {
            const { token, count } = col.coercedNonNumeric;
            add('high', col.name, 'mixed-type', `${count} cells hold a non-numeric value "${token}" that was coerced to NULL because the column is numeric.`, `It is a string sentinel, not a number. \`WHERE ${esc(col.name)} = '${token}'\` matches NOTHING (the value is gone) — count its rows on a TEXT column instead, e.g. another draft_* field, and treat it as missing when aggregating ${col.name}.`);
        }
        // ── Numbers stored as TEXT — thousands separators, a currency symbol, or a
        // percent suffix ("1,200", "$12,500", "45%") ──
        // dolex typed these categorical because the symbol defeats numeric parsing.
        // SQLite then silently coerces them (SUM("$1,200")→0, "1,200"→1, "45%"→45 for
        // AVG but lexicographic for ORDER BY/MAX), so totals/averages/ranking are wrong.
        if ((col.type === 'categorical' || col.type === 'text') && typeProbe.length >= 2) {
            const nt = classifyNumericText(typeProbe);
            if (nt) {
                add('high', col.name, nt.issue, `Values are ${nt.label} stored as text (e.g. ${nt.examples.join(', ')}).`, `${nt.harm} Convert before aggregating: ${nt.fix(esc(col.name))}.`);
            }
        }
        // ── Same category split by case/whitespace ("Billing" vs "billing" vs "Billing ") ──
        // Fragments GROUP BY so the true top category is undercounted and can lose.
        // GUARD: only fire on a plausible GROUPING DIMENSION, not FREE TEXT. The
        // discriminator is VALUE LENGTH, not cardinality (verified on real data: nba
        // COMMENT has 5348 distinct values but avg ~22 chars and IS a real reason-code
        // category whose case/pad split understates the top reason 35% → keep; ecommerce
        // review_comment_message avg ~62 chars is free-text prose → skip). Cardinality is
        // a red herring — a bounded code scheme can have thousands of distinct values.
        // Use sampleValues (variety-picked, representative); topValues skew to short
        // frequent tokens and would mask a free-text column's true length.
        const catPool = [...new Set([...(col.topValues?.map((t) => String(t.value)) ?? []), ...samples])];
        const lenPool = samples.length ? samples : catPool;
        const avgValLen = lenPool.length ? lenPool.reduce((s, v) => s + v.length, 0) / lenPool.length : 0;
        const looksFreeText = avgValLen > 45;
        let dirtyCatFired = false;
        if ((col.type === 'categorical' || col.type === 'text') && (col.topValues?.length ?? 0) >= 2 && !looksFreeText) {
            const seen = new Map();
            let collision;
            for (const raw of catPool) {
                const key = raw.trim().toLowerCase();
                if (key === '')
                    continue;
                const prev = seen.get(key);
                if (prev !== undefined && prev !== raw) {
                    collision = [prev, raw];
                    break;
                }
                if (prev === undefined)
                    seen.set(key, raw);
            }
            if (collision) {
                dirtyCatFired = true;
                // Keep the TRIM(LOWER) remedy (correct for case/whitespace dirt), but when the
                // column is high-cardinality, ADD a caveat that it won't canonicalize
                // model-specific fragments (body: 87 distinct, "granturismo convertible") —
                // REPLACING the remedy would strip it from legit high-card columns (cities).
                // validated in experiments/013-dirty-categories-fragmentation (variant B).
                const frag = (col.uniqueCount ?? 0) > 25
                    ? ` Note ${col.uniqueCount} distinct values — if many are sub-types/model-specific, TRIM(LOWER) won't canonicalize them; map to a controlled vocabulary.`
                    : '';
                add('medium', col.name, 'dirty-categories', `Values differ only by case/whitespace and are counted as separate categories (e.g. "${collision[0]}" vs "${collision[1]}").`, `They split one logical category across rows, distorting counts and the top category. Normalize: GROUP BY TRIM(LOWER(${esc(col.name)})).${frag}`);
            }
        }
        // ── Boolean column written inconsistently (Yes/Y/1 vs No/N/0/true/false) ──
        // Same true/false data in mixed encodings splits filters and groupings. Gate
        // on an ALPHABETIC form present so a pure numeric 1/0 column isn't swept in.
        if ((col.type === 'categorical' || col.type === 'text')) {
            const boolForms = [...new Set(catPool.map((v) => v.trim()).filter((v) => v !== ''))];
            if (boolForms.length >= 2 && boolForms.length <= 8) {
                const canon = boolForms.map(canonBool);
                const allBool = canon.every((c) => c !== null);
                const hasAlpha = boolForms.some((v) => /[a-z]/i.test(v));
                const distinctCanon = new Set(canon).size;
                if (allBool && hasAlpha && boolForms.length > distinctCanon) {
                    add('low', col.name, 'boolean-variants', `Boolean column with inconsistent encodings (e.g. ${boolForms.slice(0, 3).map((v) => `"${v}"`).join(', ')}).`, 'These are the same true/false values written differently — they split filters and GROUP BY. Canonicalize to one form.');
                }
            }
        }
        // ── Invisible dirt: whitespace / non-standard unicode in string values ──
        // Skipped when dirty-categories already fired (its TRIM(LOWER) remedy covers
        // the same column, and the two fixes would otherwise conflict).
        if ((col.type === 'categorical' || col.type === 'text') && !dirtyCatFired) {
            const dirty = catPool.find((v) => v !== '' && DIRTY_WS.test(v));
            if (dirty !== undefined) {
                add('low', col.name, 'dirty-whitespace', `Values carry leading/trailing whitespace or non-standard characters (e.g. ${JSON.stringify(dirty)}).`, 'Invisible differences split otherwise-identical values; TRIM and normalize unicode (NBSP, zero-width, smart quotes).');
            }
        }
        // ── Missing-value sentinels hiding in categorical data ──
        const valuePool = (col.topValues?.map((t) => String(t.value)) ?? []).concat(samples);
        const sentinel = valuePool.find((v) => SENTINELS.has(v.trim().toLowerCase()));
        if (sentinel !== undefined && col.type !== 'numeric') {
            add('medium', col.name, 'sentinel-value', `Contains a likely missing-value sentinel: "${sentinel}".`, 'These read as real categories — they inflate counts and skew group analysis. Treat as null.');
        }
        // ── Numeric outliers + sentinel magic-numbers (the silent-wrong class) ──
        // A magic number (−999, 9999999, …) is treated as a sentinel ONLY when it is
        // also a genuine FAR outlier (beyond the 3×IQR fence) — NOT merely beyond
        // p25/p75 (every min/max is, so that gate was a no-op and would flag a real
        // top value like 99999). Both tails are checked, so a column poisoned at both
        // ends reports both.
        if (col.type === 'numeric' && col.stats) {
            const { min, max, p25, p75 } = col.stats;
            const iqr = p75 - p25;
            const extremes = [];
            if (iqr > 0) {
                if (min < p25 - 3 * iqr)
                    extremes.push(min);
                if (max > p75 + 3 * iqr)
                    extremes.push(max);
            }
            const sentinels = extremes.filter(isSentinelNumber);
            for (const s of sentinels) {
                add('high', col.name, 'sentinel-value', `Extreme value ${fmt(s)} is a classic missing-value sentinel, not real data (a far outlier vs p25–p75 ${fmt(p25)}…${fmt(p75)}).`, 
                // Scope the exclusion: it poisons statistics OF this column, but the row
                // still exists — over-excluding it from total counts gives 99,999 not
                // 100,000. Only filter it when computing this column's own aggregates.
                `When computing a statistic OF ${col.name} (its AVG/SUM/MIN/MAX/MEDIAN), exclude it: WHERE ${esc(col.name)} <> ${s}. It is still a real row — do NOT drop it from total row COUNTs or other columns' analysis.`);
            }
            if (sentinels.length === 0 && extremes.length > 0) {
                add('low', col.name, 'outliers', `Extreme values beyond 3×IQR (range ${fmt(min)}…${fmt(max)}, p25–p75 ${fmt(p25)}…${fmt(p75)}).`, 'Verify they are genuine, not data-entry errors or missing-as-extreme.');
            }
            // Zeros where a measurement should be positive (e.g. diamonds x/y/z = 0).
            if (min === 0 && /(^|_)(x|y|z|width|height|depth|length|weight|price|diameter|size)(_|$)/i.test(col.name)) {
                add('low', col.name, 'suspicious-zero', `Minimum is 0 for a measurement-like column.`, 'A 0 here is often a missing/invalid value rather than a true zero.');
            }
        }
        // ── Identifier masquerading as a category ──
        // Require near-perfect uniqueness on a sizable column so naturally
        // high-variety categoricals (SKUs, composite labels) aren't mislabeled.
        if ((col.type === 'categorical' || col.type === 'text') && total >= 50 && nonNull > 0 && col.uniqueCount / nonNull >= 0.99) {
            add('low', col.name, 'id-like', `Essentially every value is unique (${col.uniqueCount}/${nonNull}) — looks like an identifier, not a category.`, 'Grouping/coloring by it produces one bucket per row.');
        }
        // ── Footgun: column name needs quoting ──
        if (hasSpecialChars(col.name)) {
            add('low', col.name, 'special-char-name', `Name has spaces or special characters.`, 'In --expr use backticks (`' + col.name + '`); in --sql use double quotes ("' + col.name + '").');
        }
        // ── Year columns (informational footgun note) ──
        if (col.type === 'date' && looksLikeYear(col)) {
            add('low', col.name, 'year-column', `Holds 4-digit years, not full dates.`, 'Group by it directly — do not apply month/day date math (strftime) to it.');
        }
        // ── Non-ISO / mixed date formats (time-series footgun) ──
        // Use topValues (frequency-ranked) NOT sampleValues — the first N rows of a CSV
        // are often format-homogeneous (e.g. all ISO), so sampleValues misses the tail.
        if (col.type === 'date' && !looksLikeYear(col)) {
            const topVals = (col.topValues ?? []).map((t) => String(t.value)).filter(Boolean);
            const dateProbe = [...new Set([...samples, ...topVals])].filter(Boolean);
            if (dateProbe.length >= 3) {
                const formats = detectDateFormats(dateProbe);
                if (formats.size >= 2) {
                    // Multiple incompatible formats in the same column — HIGH, and prompt-worthy.
                    // strftime + BETWEEN silently discard non-ISO rows; the model must normalize first.
                    const examples = [];
                    for (const fmt of formats) {
                        const ex = dateProbe.find((v) => classifyDateFmt(v) === fmt);
                        if (ex)
                            examples.push(`"${ex}" (${fmt})`);
                    }
                    add('high', col.name, 'mixed-date-format', `Column has ${formats.size} incompatible date formats: ${examples.join(', ')}.`, `strftime/BETWEEN silently ignore non-ISO rows — ISO rows only are counted. Normalize to YYYY-MM-DD with a clean() function before filtering or aggregating by date.`);
                }
                else {
                    // Single non-ISO format — keep existing MEDIUM advisory (not prompt-worthy,
                    // but surfaced in `dolex check` for awareness).
                    const nonIso = dateProbe.filter((v) => !/^\d{4}-\d{2}-\d{2}/.test(v));
                    if (nonIso.length > 0) {
                        add('medium', col.name, 'non-iso-date', `Looks like dates but not ISO YYYY-MM-DD (e.g. ${nonIso.slice(0, 2).join(', ')}).`, 'Time bucketing (strftime) only parses ISO — non-ISO dates collapse to NULL, so analyze skips the trend. Reformat to YYYY-MM-DD for time-series analysis.');
                    }
                }
            }
        }
    }
    return findings;
}
function fmt(n) {
    if (!Number.isFinite(n))
        return String(n);
    return Number.isInteger(n) ? String(n) : n.toFixed(2);
}
/** True for magic numbers that are almost always "missing" — the curated set
 *  PLUS any repunit-9 of length ≥3 (999, 9999, …, 9999999, and negatives), so a
 *  fixed list can't be evaded by simply using more 9s. */
function isSentinelNumber(v) {
    if (!Number.isFinite(v))
        return false;
    return NUMERIC_SENTINELS.has(v) || /^9{3,}$/.test(String(Math.abs(v)));
}
/** Classify a categorical column whose values are really numbers wearing a text
 *  costume: thousands separators, a currency symbol, or a percent suffix. Returns
 *  the dominant kind (≥60% of probe values) with a tailored, NON-destructive fix,
 *  or null. Order matters: currency/percent before bare separators. */
function classifyNumericText(probe) {
    const vals = probe.map((v) => v.trim()).filter((v) => v !== '');
    if (vals.length < 2)
        return null;
    const frac = (xs) => xs.length / vals.length;
    // Accounting negatives first — "(1,234)" matches neither currency nor sep, but
    // it IS a number (a negative one), and missing it loses the sign silently.
    const accounting = vals.filter((v) => ACCOUNTING_NUM.test(v));
    if (frac(accounting) >= 0.6)
        return {
            issue: 'numeric-text-parens', label: 'accounting-style negatives', examples: accounting.slice(0, 2),
            harm: 'SQLite reads "(1,234)" as 0 and loses the negative sign — SUM/AVG/ORDER BY are silently wrong.',
            fix: (c) => `CASE WHEN ${c} LIKE '(%' THEN -CAST(REPLACE(REPLACE(REPLACE(${c}, '(', ''), ')', ''), ',', '') AS REAL) ELSE CAST(REPLACE(${c}, ',', '') AS REAL) END`,
        };
    const currency = vals.filter((v) => CURRENCY_NUM.test(v));
    if (frac(currency) >= 0.6) {
        // Tailor the fix to the ACTUAL symbol present → a 2-REPLACE expression the
        // model can reproduce reliably (a blanket 4-deep nest gets its parens garbled).
        const sym = (currency[0].match(/[$€£¥]/) ?? ['$'])[0];
        return {
            issue: 'numeric-text-symbol', label: 'currency amounts', examples: currency.slice(0, 2),
            harm: `SQLite reads "${sym}1,200" as 0 — SUM/AVG/ORDER BY are silently wrong.`,
            fix: (c) => `CAST(REPLACE(REPLACE(${c}, '${sym}', ''), ',', '') AS REAL)`,
        };
    }
    const percent = vals.filter((v) => PERCENT_NUM.test(v));
    if (frac(percent) >= 0.6)
        return {
            issue: 'numeric-text-symbol', label: 'percentages', examples: percent.slice(0, 2),
            harm: 'The "%" makes the value text — ORDER BY/MAX are lexicographic, and it is not a usable number.',
            fix: (c) => `CAST(REPLACE(${c}, '%', '') AS REAL)`,
        };
    const sep = vals.filter((v) => THOUSANDS_NUM.test(v));
    if (sep.length >= 2 && frac(sep) >= 0.6)
        return {
            issue: 'numeric-text-separators', label: 'numbers with thousands separators', examples: sep.slice(0, 2),
            harm: 'SQLite reads "1,200" as 1 — SUM/AVG/ORDER BY are silently wrong.',
            fix: (c) => `CAST(REPLACE(${c}, ',', '') AS REAL)`,
        };
    return null;
}
const MAX_DUP_ROWS_SCAN = 500_000; // skip the full-table distinct scan above this
const MAX_IDENTICAL_PAIRS = 80; // bound the pairwise identical-column comparison
function esc(name) {
    return `"${name.replace(/"/g, '""')}"`;
}
function pct(n, total) {
    return total > 0 ? `${((n / total) * 100).toFixed(1)}%` : '0%';
}
export async function tableLevelChecks(t, query) {
    const out = [];
    // Duplicate rows (skip very large tables to bound cost).
    if (t.rowCount > 0 && t.rowCount <= MAX_DUP_ROWS_SCAN) {
        const res = await query(`SELECT (SELECT COUNT(*) FROM ${esc(t.name)}) - (SELECT COUNT(*) FROM (SELECT DISTINCT * FROM ${esc(t.name)})) AS dups`);
        const dups = res.ok && res.rows && res.rows[0] ? Number(res.rows[0].dups) : NaN;
        if (!res.ok || !Number.isFinite(dups)) {
            out.push({
                severity: 'high', table: t.name, issue: 'check-incomplete',
                detail: `Duplicate-row check could not complete${res.ok ? '' : `: ${res.error}`}.`,
                suggestion: 'The audit is incomplete — do not trust a clean result; re-run.',
            });
        }
        else if (dups > 0) {
            out.push({
                severity: 'medium', table: t.name, issue: 'duplicate-rows',
                detail: `${dups} fully-duplicate row${dups === 1 ? '' : 's'} (${pct(dups, t.rowCount)} of the table).`,
                suggestion: 'Verify these are real repeats, not a double-load or join fan-out. COUNT(*) over-counts; use COUNT(DISTINCT …) or SELECT DISTINCT.',
            });
        }
    }
    // Identical (redundant/leaked) columns: only compare columns that already share
    // type + cardinality + null count, so the pairwise scan stays cheap.
    const groups = new Map();
    for (const c of t.columns) {
        const key = `${c.type}|${c.uniqueCount}|${c.nullCount}`;
        const arr = groups.get(key);
        if (arr)
            arr.push(c);
        else
            groups.set(key, [c]);
    }
    let comparisons = 0;
    for (const group of groups.values()) {
        if (group.length < 2)
            continue;
        for (let i = 0; i < group.length; i++) {
            for (let j = i + 1; j < group.length; j++) {
                if (comparisons++ >= MAX_IDENTICAL_PAIRS)
                    break;
                const a = group[i].name;
                const b = group[j].name;
                const res = await query(`SELECT COUNT(*) AS diff FROM ${esc(t.name)} WHERE ${esc(a)} IS NOT ${esc(b)}`);
                const diff = res.ok && res.rows && res.rows[0] ? Number(res.rows[0].diff) : NaN;
                if (!res.ok || !Number.isFinite(diff)) {
                    out.push({
                        severity: 'high', table: t.name, column: `${a} vs ${b}`, issue: 'check-incomplete',
                        detail: `Could not compare columns "${a}" and "${b}"${res.ok ? '' : `: ${res.error}`}.`,
                        suggestion: 'The audit is incomplete — do not trust a clean result; re-run.',
                    });
                }
                else if (diff === 0) {
                    out.push({
                        severity: 'high', table: t.name, column: `${a} = ${b}`, issue: 'identical-columns',
                        detail: `Columns "${a}" and "${b}" are identical on every row.`,
                        suggestion: 'Redundant or leaked feature — a model/analysis "predicting" one just reads the other. Drop one.',
                    });
                }
            }
        }
    }
    return out;
}
/** The full audit: profile checks + table-level checks, over every table. The ONE
 *  entry point both the CLI `check` command and the analysis loop call. */
export async function auditDataset(tables, query) {
    const findings = [];
    for (const t of tables) {
        findings.push(...auditColumns(t.name, t.columns, t.rowCount));
        findings.push(...(await tableLevelChecks(t, query)));
    }
    return findings;
}
const SEV_RANK = { high: 0, medium: 1, low: 2 };
// Only ACTION-GUIDING issues go into the LLM prompt — the ones that silently
// corrupt a number and have a concrete SQL fix. Advisory findings (mostly-null,
// non-iso-date, constant, outliers, id-like, …) are real and stay in the full
// audit / `dolex check`, but injecting them just bloats the prompt and DISTRACTS
// the model on unrelated questions (measured: f1's 21 mostly-null + 12 non-iso
// findings dragged a clean "most wins" query off its correct answer). Keep this
// list tight — every line added is a line that competes with the user's question.
const PROMPT_WORTHY_ISSUES = new Set([
    'numeric-text-symbol', 'numeric-text-separators', 'mixed-type', // type traps
    'mixed-date-format', // ≥2 incompatible date formats — strftime silently drops non-ISO rows
    'sentinel-value', // missing-value markers that poison aggregates
    'dirty-categories', // case/space splits that change the GROUP BY winner
    'duplicate-rows', // inflate counts
    'identical-columns', // leaked/redundant column
    'check-incomplete', // a check could not run — never hide that
]);
/** Compact, ACTION-GUIDING summary for injection into an LLM system prompt. Filters
 *  to the silent-wrong-number issues (PROMPT_WORTHY_ISSUES), collapses repeats of
 *  the same issue into ONE line (13 "NULL" sentinel columns → one line, not 13),
 *  and caps tightly. '' if nothing actionable. The full audit still lives in
 *  `session.audit` / `dolex check`. */
export function formatAuditForPrompt(findings, maxLines = 5) {
    const worthy = findings
        .filter((f) => f.severity !== 'low' && PROMPT_WORTHY_ISSUES.has(f.issue))
        .sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity]);
    if (worthy.length === 0)
        return '';
    // Group by issue, preserving severity-sorted order, to collapse repeats.
    const byIssue = new Map();
    for (const f of worthy) {
        const arr = byIssue.get(f.issue);
        if (arr)
            arr.push(f);
        else
            byIssue.set(f.issue, [f]);
    }
    const lines = [];
    for (const [, group] of byIssue) {
        if (lines.length >= maxLines)
            break;
        const f = group[0];
        const sev = `[${f.severity.toUpperCase()}]`;
        if (group.length === 1) {
            lines.push(`• ${sev} ${f.column ? f.column + ': ' : ''}${f.detail}${f.suggestion ? ' → ' + f.suggestion : ''}`);
        }
        else {
            // Collapse: one line for the shared issue + the shared fix. Count and noun
            // are driven by the COLUMN-BEARING findings (a column-less finding like
            // duplicate-rows must not be counted as a "column" or padded into "+N more").
            const ids = group.map((g) => g.column).filter((c) => Boolean(c));
            const suffix = f.suggestion ? ' → ' + f.suggestion : '';
            if (ids.length > 0) {
                const more = ids.length > 6 ? `, +${ids.length - 6} more` : '';
                lines.push(`• ${sev} ${ids.length} columns with ${f.issue} (${ids.slice(0, 6).join(', ')}${more})${suffix}`);
            }
            else {
                lines.push(`• ${sev} ${group.length} ${f.issue} findings${suffix}`);
            }
        }
    }
    const shown = lines.length;
    const issuesTotal = byIssue.size;
    if (issuesTotal > shown)
        lines.push(`• …and ${issuesTotal - shown} more issue type(s).`);
    return lines.join('\n');
}
