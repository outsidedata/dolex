/**
 * JS-based aggregation and window function helpers.
 *
 * Used when SQLite doesn't support certain aggregates natively
 * (e.g., median, stddev, percentile) or window functions.
 * All functions are pure — no side effects or class dependencies.
 */
import { isDslAggregateField, isDslWindowField } from '../types.js';
import { compileDsl, fieldAlias } from './dsl-compiler.js';
const MAX_RESULT_LIMIT = 10000;
// ─── Percentile / Aggregation ────────────────────────────────────────────────
function computePercentile(sorted, p) {
    if (sorted.length === 0)
        return 0;
    if (sorted.length === 1)
        return sorted[0];
    const idx = p * (sorted.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi)
        return sorted[lo];
    const frac = idx - lo;
    return sorted[lo] * (1 - frac) + sorted[hi] * frac;
}
function toSortedNums(values) {
    return values.map(Number).filter(n => !isNaN(n)).sort((a, b) => a - b);
}
function numericSum(nums) {
    return nums.reduce((a, b) => a + b, 0);
}
function jsAggregate(values, aggregate, percentileValue) {
    const nonNull = values.filter(v => v != null);
    if (nonNull.length === 0) {
        return aggregate === 'count' || aggregate === 'count_distinct' ? 0 : null;
    }
    if (aggregate === 'count')
        return nonNull.length;
    if (aggregate === 'count_distinct')
        return new Set(nonNull.map(String)).size;
    if (aggregate === 'min' || aggregate === 'max') {
        const sorted = toSortedNums(nonNull);
        const allNumeric = sorted.length === nonNull.length;
        if (aggregate === 'min') {
            return allNumeric ? sorted[0] : nonNull.map(String).sort()[0];
        }
        return allNumeric ? sorted[sorted.length - 1] : nonNull.map(String).sort().pop();
    }
    const sorted = toSortedNums(nonNull);
    if (sorted.length === 0)
        return null;
    switch (aggregate) {
        case 'sum': return numericSum(sorted);
        case 'avg': return numericSum(sorted) / sorted.length;
        case 'median': return computePercentile(sorted, 0.5);
        case 'p25': return computePercentile(sorted, 0.25);
        case 'p75': return computePercentile(sorted, 0.75);
        case 'percentile': return computePercentile(sorted, percentileValue ?? 0.5);
        case 'stddev': {
            const mean = numericSum(sorted) / sorted.length;
            const variance = sorted.reduce((sum, v) => sum + (v - mean) ** 2, 0) / sorted.length;
            return Math.sqrt(variance);
        }
        default: return null;
    }
}
// ─── Having Filter ───────────────────────────────────────────────────────────
function matchesHavingFilter(row, filter) {
    const val = row[filter.field];
    const cmpVal = filter.value;
    switch (filter.op) {
        case '=': return val == cmpVal;
        case '!=': return val != cmpVal;
        case '>': return Number(val) > Number(cmpVal);
        case '>=': return Number(val) >= Number(cmpVal);
        case '<': return Number(val) < Number(cmpVal);
        case '<=': return Number(val) <= Number(cmpVal);
        case 'in': return Array.isArray(cmpVal) && cmpVal.includes(val);
        case 'not_in': return Array.isArray(cmpVal) && !cmpVal.includes(val);
        case 'between': {
            const n = Number(val);
            return Array.isArray(cmpVal) && n >= Number(cmpVal[0]) && n <= Number(cmpVal[1]);
        }
        case 'is_null': return val == null;
        case 'is_not_null': return val != null;
        default: return true;
    }
}
// ─── Date Bucketing ──────────────────────────────────────────────────────────
function pad2(n) {
    return String(n).padStart(2, '0');
}
function bucketDateFromParsed(d, bucket) {
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1;
    switch (bucket) {
        case 'day':
            return `${year}-${pad2(month)}-${pad2(d.getUTCDate())}`;
        case 'week': {
            const jan1 = new Date(Date.UTC(year, 0, 1));
            const dayOfYear = Math.floor((d.getTime() - jan1.getTime()) / 86400000) + 1;
            const jan1Day = jan1.getUTCDay();
            const weekNum = Math.floor((dayOfYear + (jan1Day === 0 ? 6 : jan1Day - 1) - 1) / 7);
            return `${year}-W${pad2(weekNum)}`;
        }
        case 'month':
            return `${year}-${pad2(month)}`;
        case 'quarter':
            return `${year}-Q${Math.ceil(month / 3)}`;
        case 'year':
            return String(year);
        default:
            return String(d);
    }
}
function bucketDate(dateStr, bucket) {
    const numVal = Number(dateStr);
    if (!isNaN(numVal) && numVal > 1800 && numVal < 2200 && Math.floor(numVal) === numVal) {
        if (bucket === 'year')
            return String(numVal);
        return bucketDateFromParsed(new Date(Date.UTC(numVal, 0, 1)), bucket);
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime()))
        return dateStr;
    return bucketDateFromParsed(d, bucket);
}
// ─── Window Functions ────────────────────────────────────────────────────────
function partitionRows(rows, partitionBy) {
    if (!partitionBy || partitionBy.length === 0)
        return [rows];
    const groups = new Map();
    for (const row of rows) {
        const key = partitionBy.map(f => String(row[f] ?? '')).join('\x00');
        if (!groups.has(key))
            groups.set(key, []);
        groups.get(key).push(row);
    }
    return [...groups.values()];
}
export function sortPartition(partition, orderBy) {
    partition.sort((a, b) => {
        for (const o of orderBy) {
            const av = a[o.field];
            const bv = b[o.field];
            if (av == null && bv == null)
                continue;
            if (av == null)
                return o.direction === 'asc' ? -1 : 1;
            if (bv == null)
                return o.direction === 'asc' ? 1 : -1;
            const na = Number(av);
            const nb = Number(bv);
            const cmp = (!isNaN(na) && !isNaN(nb)) ? na - nb : String(av).localeCompare(String(bv));
            if (cmp !== 0)
                return o.direction === 'asc' ? cmp : -cmp;
        }
        return 0;
    });
}
function applyLagLead(partition, w, direction) {
    const offset = w.offset ?? 1;
    const defaultVal = w.default ?? null;
    for (let i = 0; i < partition.length; i++) {
        const srcIdx = i + (direction * offset);
        partition[i][w.as] = (srcIdx >= 0 && srcIdx < partition.length)
            ? partition[srcIdx][w.field]
            : defaultVal;
    }
}
function applyRank(partition, w, dense) {
    let rank = 1;
    for (let i = 0; i < partition.length; i++) {
        if (i === 0) {
            partition[i][w.as] = 1;
        }
        else {
            const sameAsPrev = w.orderBy.every(o => partition[i][o.field] === partition[i - 1][o.field]);
            if (sameAsPrev) {
                partition[i][w.as] = partition[i - 1][w.as];
            }
            else {
                rank = dense ? partition[i - 1][w.as] + 1 : i + 1;
                partition[i][w.as] = rank;
            }
        }
    }
}
function applyRunning(partition, w, mode) {
    let cumSum = 0;
    for (let i = 0; i < partition.length; i++) {
        const val = Number(partition[i][w.field]);
        cumSum += isNaN(val) ? 0 : val;
        partition[i][w.as] = mode === 'sum' ? cumSum : cumSum / (i + 1);
    }
}
function applyPctOfTotal(partition, w) {
    let total = 0;
    for (const row of partition) {
        const val = Number(row[w.field]);
        total += isNaN(val) ? 0 : val;
    }
    for (const row of partition) {
        const val = Number(row[w.field]);
        row[w.as] = total === 0 ? null : (isNaN(val) ? 0 : val) / total;
    }
}
function jsApplyWindowFunctions(rows, windowFields) {
    const result = rows.map(r => ({ ...r }));
    for (const w of windowFields) {
        const partitions = partitionRows(result, w.partitionBy);
        for (const partition of partitions) {
            if (w.orderBy && w.orderBy.length > 0) {
                sortPartition(partition, w.orderBy);
            }
            switch (w.window) {
                case 'lag':
                    applyLagLead(partition, w, -1);
                    break;
                case 'lead':
                    applyLagLead(partition, w, 1);
                    break;
                case 'rank':
                    applyRank(partition, w, false);
                    break;
                case 'dense_rank':
                    applyRank(partition, w, true);
                    break;
                case 'row_number':
                    for (let i = 0; i < partition.length; i++) {
                        partition[i][w.as] = i + 1;
                    }
                    break;
                case 'running_sum':
                    applyRunning(partition, w, 'sum');
                    break;
                case 'running_avg':
                    applyRunning(partition, w, 'avg');
                    break;
                case 'pct_of_total':
                    applyPctOfTotal(partition, w);
                    break;
            }
        }
    }
    return result;
}
export function finalizeRows(rows, query) {
    if (query.orderBy && query.orderBy.length > 0) {
        sortPartition(rows, query.orderBy);
    }
    const limit = Math.min(query.limit ?? MAX_RESULT_LIMIT, MAX_RESULT_LIMIT);
    const limited = rows.slice(0, limit);
    return {
        ok: true,
        rows: limited,
        columns: limited.length > 0 ? Object.keys(limited[0]) : [],
        totalRows: rows.length,
        truncated: rows.length > limit,
    };
}
// ─── JS Aggregation Query Execution ─────────────────────────────────────────
export async function executeJsAggregation(source, table, query, dialect = 'sqlite') {
    const fieldsNeeded = new Set();
    for (const s of query.select) {
        if (typeof s === 'string')
            fieldsNeeded.add(s);
        else if (isDslAggregateField(s))
            fieldsNeeded.add(s.field);
    }
    const groupBySpecs = query.groupBy ?? [];
    for (const g of groupBySpecs) {
        fieldsNeeded.add(typeof g === 'string' ? g : g.field);
    }
    const rawSql = compileDsl(table, {
        join: query.join,
        select: Array.from(fieldsNeeded),
        filter: query.filter,
    }, dialect, { skipLimit: true });
    const rawResult = await source.executeQuery(rawSql);
    if (rawResult.rows.length === 1 && rawResult.rows[0]?.error) {
        return { ok: false, error: rawResult.rows[0].error };
    }
    const groupKeys = groupBySpecs.map(g => {
        if (typeof g === 'string') {
            const col = fieldAlias(g);
            return { name: col, extract: (row) => String(row[col] ?? '') };
        }
        const col = fieldAlias(g.field);
        const alias = `${g.field.replace('.', '_')}_${g.bucket}`;
        return { name: alias, extract: (row) => bucketDate(String(row[col] ?? ''), g.bucket) };
    });
    const groups = new Map();
    if (groupKeys.length === 0) {
        groups.set('', rawResult.rows);
    }
    else {
        for (const row of rawResult.rows) {
            const key = groupKeys.map(gk => gk.extract(row)).join('\x00');
            if (!groups.has(key))
                groups.set(key, []);
            groups.get(key).push(row);
        }
    }
    let resultRows = [];
    for (const [key, groupRows] of groups) {
        const row = {};
        if (groupKeys.length > 0) {
            const keyParts = key.split('\x00');
            for (let i = 0; i < groupKeys.length; i++) {
                row[groupKeys[i].name] = keyParts[i];
            }
        }
        for (const s of query.select) {
            if (typeof s === 'string') {
                const col = fieldAlias(s);
                if (!(col in row)) {
                    row[col] = groupRows[0]?.[col];
                }
            }
            else if (isDslAggregateField(s)) {
                const col = fieldAlias(s.field);
                row[s.as] = jsAggregate(groupRows.map(r => r[col]), s.aggregate, s.percentile);
            }
        }
        resultRows.push(row);
    }
    if (query.having && query.having.length > 0) {
        resultRows = resultRows.filter(row => query.having.every(h => matchesHavingFilter(row, h)));
    }
    return finalizeRows(resultRows, query);
}
export async function executeJsAggregationWithWindows(source, table, query, dialect = 'sqlite') {
    const windowFields = query.select.filter(isDslWindowField);
    const baseFields = query.select.filter(f => !isDslWindowField(f));
    const baseQuery = {
        join: query.join,
        select: baseFields,
        groupBy: query.groupBy,
        filter: query.filter,
        having: query.having,
    };
    const baseResult = await executeJsAggregation(source, table, baseQuery, dialect);
    if (!baseResult.ok || !baseResult.rows)
        return baseResult;
    const withWindows = jsApplyWindowFunctions(baseResult.rows, windowFields);
    return finalizeRows(withWindows, query);
}
//# sourceMappingURL=js-aggregation.js.map