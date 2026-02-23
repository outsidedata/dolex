/**
 * Row-wise function implementations for the Dolex expression evaluator.
 *
 * Each function receives an array of evaluated arguments and returns a value.
 * Null propagation is handled per-function.
 */
const MS_PER_DAY = 1000 * 60 * 60 * 24;
const MS_PER_HOUR = 1000 * 60 * 60;
export function isNull(v) {
    return v === null || v === undefined || v === '';
}
export function safeEqual(a, b) {
    if ((a === null || a === undefined) && (b === null || b === undefined))
        return true;
    if (a === b)
        return true;
    if (typeof a === 'string' && typeof b === 'number')
        return a !== '' && Number(a) === b;
    if (typeof a === 'number' && typeof b === 'string')
        return b !== '' && a === Number(b);
    return false;
}
function toNum(v) {
    if (typeof v === 'number')
        return v;
    const n = Number(v);
    return isNaN(n) ? NaN : n;
}
function numericValues(args) {
    const result = [];
    for (const v of args) {
        if (isNull(v))
            continue;
        const n = toNum(v);
        if (!isNaN(n))
            result.push(n);
    }
    return result;
}
function parseDate(val) {
    if (isNull(val))
        return null;
    if (val instanceof Date)
        return val;
    const d = new Date(val);
    if (isNaN(d.getTime()))
        return null;
    return d;
}
function toISODate(y, m, d) {
    return new Date(Date.UTC(y, m, d)).toISOString().split('T')[0];
}
export const ROW_FUNCTIONS = {
    // ─── Math ───────────────────────────────────────────────────────────
    log: ([x]) => isNull(x) || x <= 0 ? null : Math.log(x),
    log10: ([x]) => isNull(x) || x <= 0 ? null : Math.log10(x),
    log2: ([x]) => isNull(x) || x <= 0 ? null : Math.log2(x),
    sqrt: ([x]) => isNull(x) || x < 0 ? null : Math.sqrt(x),
    abs: ([x]) => isNull(x) ? null : Math.abs(x),
    round: ([x, n]) => {
        if (isNull(x))
            return null;
        const num = toNum(x);
        if (isNaN(num))
            return null;
        const decimals = n ?? 0;
        if (decimals < 0) {
            const factor = Math.pow(10, -decimals);
            return Math.round(num / factor) * factor;
        }
        return Number(num.toFixed(decimals));
    },
    ceil: ([x]) => isNull(x) ? null : Math.ceil(x),
    floor: ([x]) => isNull(x) ? null : Math.floor(x),
    exp: ([x]) => isNull(x) ? null : Math.exp(x),
    // ─── Row-wise Aggregation ──────────────────────────────────────────
    row_mean: (args) => {
        const vals = numericValues(args);
        return vals.length === 0 ? null : vals.reduce((a, b) => a + b, 0) / vals.length;
    },
    row_sum: (args) => {
        const vals = numericValues(args);
        return vals.length === 0 ? null : vals.reduce((a, b) => a + b, 0);
    },
    row_min: (args) => {
        const vals = numericValues(args);
        return vals.length === 0 ? null : Math.min(...vals);
    },
    row_max: (args) => {
        const vals = numericValues(args);
        return vals.length === 0 ? null : Math.max(...vals);
    },
    row_sd: (args) => {
        const vals = numericValues(args);
        if (vals.length === 0)
            return null;
        if (vals.length === 1)
            return 0;
        const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
        const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / (vals.length - 1);
        return Math.sqrt(variance);
    },
    row_count_null: (args) => args.filter(v => isNull(v)).length,
    row_count_valid: (args) => args.filter(v => !isNull(v)).length,
    // ─── Conditional ───────────────────────────────────────────────────
    if_else: ([cond, trueVal, falseVal]) => cond ? trueVal : falseVal,
    case: (args) => {
        // case(cond1, val1, cond2, val2, ..., default?)
        const hasDefault = args.length % 2 === 1;
        const pairs = hasDefault ? args.length - 1 : args.length;
        for (let i = 0; i < pairs; i += 2) {
            if (args[i])
                return args[i + 1];
        }
        return hasDefault ? args[args.length - 1] : null;
    },
    coalesce: (args) => {
        for (const v of args) {
            if (!isNull(v))
                return v;
        }
        return null;
    },
    is_null: ([x]) => isNull(x),
    fill_null: ([x, val]) => isNull(x) ? val : x,
    null_if: ([x, val]) => safeEqual(x, val) ? null : x,
    in: (args) => {
        const [val, ...list] = args;
        if (isNull(val))
            return false;
        return list.some(v => safeEqual(v, val));
    },
    between: ([val, low, high]) => {
        if (isNull(val))
            return false;
        return val >= low && val <= high;
    },
    // ─── String ────────────────────────────────────────────────────────
    lower: ([x]) => isNull(x) ? null : String(x).toLowerCase(),
    upper: ([x]) => isNull(x) ? null : String(x).toUpperCase(),
    trim: ([x]) => isNull(x) ? null : String(x).trim(),
    concat: (args) => args.map(v => isNull(v) ? '' : String(v)).join(''),
    str_contains: ([x, pattern]) => {
        if (isNull(x))
            return null;
        return String(x).includes(String(pattern));
    },
    str_replace: ([x, find, replace]) => {
        if (isNull(x))
            return null;
        return String(x).split(String(find)).join(String(replace));
    },
    str_length: ([x]) => isNull(x) ? null : String(x).length,
    // ─── Date ──────────────────────────────────────────────────────────
    date_diff: ([d1, d2, unit]) => {
        const t1 = parseDate(d1);
        const t2 = parseDate(d2);
        if (t1 === null || t2 === null)
            return null;
        const diffMs = t1.getTime() - t2.getTime();
        switch (String(unit).toLowerCase()) {
            case 'hours':
            case 'hour':
                return diffMs / MS_PER_HOUR;
            case 'months':
            case 'month':
                return (t1.getUTCFullYear() - t2.getUTCFullYear()) * 12 + (t1.getUTCMonth() - t2.getUTCMonth());
            case 'years':
            case 'year':
                return t1.getUTCFullYear() - t2.getUTCFullYear();
            case 'days':
            case 'day':
            default:
                return diffMs / MS_PER_DAY;
        }
    },
    date_part: ([d, part]) => {
        const date = parseDate(d);
        if (date === null)
            return null;
        switch (String(part).toLowerCase()) {
            case 'year': return date.getUTCFullYear();
            case 'month': return date.getUTCMonth() + 1;
            case 'day': return date.getUTCDate();
            case 'weekday':
            case 'dow':
                return date.getUTCDay();
            case 'quarter': return Math.ceil((date.getUTCMonth() + 1) / 3);
            case 'hour': return date.getUTCHours();
            case 'minute': return date.getUTCMinutes();
            default: return null;
        }
    },
    date_floor: ([d, unit]) => {
        const date = parseDate(d);
        if (date === null)
            return null;
        const y = date.getUTCFullYear();
        const m = date.getUTCMonth();
        const day = date.getUTCDate();
        switch (String(unit).toLowerCase()) {
            case 'year':
                return toISODate(y, 0, 1);
            case 'month':
                return toISODate(y, m, 1);
            case 'week':
                return toISODate(y, m, day - date.getUTCDay());
            case 'day':
            default:
                return toISODate(y, m, day);
        }
    },
    // ─── Recode & Binning ─────────────────────────────────────────────
    recode: (args) => {
        const [val, ...rest] = args;
        if (isNull(val))
            return null;
        const hasDefault = rest.length % 2 === 1;
        const pairs = hasDefault ? rest.length - 1 : rest.length;
        for (let i = 0; i < pairs; i += 2) {
            if (safeEqual(val, rest[i]))
                return rest[i + 1];
        }
        return hasDefault ? rest[rest.length - 1] : null;
    },
    cut: (args) => {
        const [val, breaks, labels] = args;
        if (isNull(val) || !Array.isArray(breaks))
            return null;
        for (let i = 0; i < breaks.length - 1; i++) {
            const isLast = i === breaks.length - 2;
            if (val >= breaks[i] && (isLast ? val <= breaks[i + 1] : val < breaks[i + 1])) {
                if (Array.isArray(labels) && labels[i] !== undefined)
                    return labels[i];
                return `${breaks[i]}-${breaks[i + 1]}`;
            }
        }
        return null;
    },
};
//# sourceMappingURL=row-functions.js.map