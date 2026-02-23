import { parse } from './parser.js';
import { ROW_FUNCTIONS } from './row-functions.js';
import { COLUMN_WISE_FUNCTIONS, precompute } from './column-functions.js';
import { extractColumnRefs } from './dependency.js';
export function evaluate(ast, ctx) {
    switch (ast.type) {
        case 'number':
            return ast.value;
        case 'string':
            return ast.value;
        case 'boolean':
            return ast.value;
        case 'column':
            return ctx.row[ast.name] ?? null;
        case 'array':
            return ast.elements.map(el => evaluate(el, ctx));
        case 'unary':
            return evalUnary(ast.op, evaluate(ast.operand, ctx));
        case 'binary':
            return evalBinary(ast.op, ast.left, ast.right, ctx);
        case 'call':
            return evalCall(ast.name, ast.args, ctx);
    }
}
function evalUnary(op, val) {
    if (val === null || val === undefined)
        return null;
    switch (op) {
        case '-': return -val;
        case '!': return !val;
        default: return null;
    }
}
function evalBinary(op, leftNode, rightNode, ctx) {
    // Short-circuit for logical operators
    if (op === '&&') {
        const left = evaluate(leftNode, ctx);
        if (!left)
            return left;
        return evaluate(rightNode, ctx);
    }
    if (op === '||') {
        const left = evaluate(leftNode, ctx);
        if (left)
            return left;
        return evaluate(rightNode, ctx);
    }
    const left = evaluate(leftNode, ctx);
    const right = evaluate(rightNode, ctx);
    // Equality can handle null — use safe equality (null==undefined, numeric coercion for CSV)
    if (op === '==')
        return safeEqual(left, right);
    if (op === '!=')
        return !safeEqual(left, right);
    // Null propagation for all other ops
    if (left === null || left === undefined || right === null || right === undefined) {
        return null;
    }
    switch (op) {
        case '+': {
            // For string + string where both are numeric, do arithmetic not concatenation.
            // CSV columns are TEXT in SQLite, so "80" + "90" should be 170, not "8090".
            if (typeof left === 'string' || typeof right === 'string') {
                const ln = Number(left), rn = Number(right);
                if (!isNaN(ln) && !isNaN(rn))
                    return ln + rn;
                return String(left) + String(right);
            }
            return toNum(left) + toNum(right);
        }
        case '-': return toNum(left) - toNum(right);
        case '*': return toNum(left) * toNum(right);
        case '/': {
            const r = toNum(right);
            if (r === 0)
                return null;
            return toNum(left) / r;
        }
        case '%': {
            const r = toNum(right);
            if (r === 0)
                return null;
            return toNum(left) % r;
        }
        case '^': return Math.pow(toNum(left), toNum(right));
        case '>': return compareValues(left, right) > 0;
        case '>=': return compareValues(left, right) >= 0;
        case '<': return compareValues(left, right) < 0;
        case '<=': return compareValues(left, right) <= 0;
        default: return null;
    }
}
function evalCall(name, argNodes, ctx) {
    // Check column-wise pre-computed results
    if (ctx.precomputed) {
        // Key matches column-functions.ts: "funcName:columnName" or "funcName:columnName:extra"
        const colArg = argNodes[0];
        const colName = colArg && colArg.type === 'column' ? colArg.name : '';
        const extraArg = name === 'ntile' && argNodes[1]?.type === 'number' ? `:${argNodes[1].value}` : '';
        const key = `${name}:${colName}${extraArg}`;
        if (ctx.precomputed.scalars.has(key)) {
            return ctx.precomputed.scalars.get(key);
        }
        if (ctx.precomputed.perRow.has(key) && ctx.rowIndex !== undefined) {
            const rowMap = ctx.precomputed.perRow.get(key);
            return rowMap.get(ctx.rowIndex) ?? null;
        }
    }
    // Column-wise functions must be pre-computed; return null if not available
    if (COLUMN_WISE_FUNCTIONS.has(name)) {
        return null;
    }
    // Row-wise function
    const fn = ROW_FUNCTIONS[name];
    if (!fn) {
        throw new Error(`Unknown function: ${name}`);
    }
    const args = argNodes.map(a => evaluate(a, ctx));
    return fn(args);
}
function toNum(val) {
    if (typeof val === 'number')
        return val;
    const n = Number(val);
    return isNaN(n) ? 0 : n;
}
function compareValues(left, right) {
    // If either side is a number, do numeric comparison
    if (typeof left === 'number' || typeof right === 'number') {
        const l = toNum(left), r = toNum(right);
        return l < r ? -1 : l > r ? 1 : 0;
    }
    // Both are strings: try numeric coercion first (CSV columns are TEXT)
    if (typeof left === 'string' && typeof right === 'string') {
        const ln = Number(left), rn = Number(right);
        if (!isNaN(ln) && !isNaN(rn) && left !== '' && right !== '') {
            return ln < rn ? -1 : ln > rn ? 1 : 0;
        }
        // Fall through to lexicographic comparison (handles date strings, text)
        return left < right ? -1 : left > right ? 1 : 0;
    }
    // Fallback: coerce to numbers
    const l = toNum(left), r = toNum(right);
    return l < r ? -1 : l > r ? 1 : 0;
}
function safeEqual(a, b) {
    // null/undefined are equal to each other
    if ((a === null || a === undefined) && (b === null || b === undefined))
        return true;
    // Strict equality for same types
    if (a === b)
        return true;
    // Numeric coercion for CSV: string "5" == number 5
    if (typeof a === 'string' && typeof b === 'number')
        return a !== '' && Number(a) === b;
    if (typeof a === 'number' && typeof b === 'string')
        return b !== '' && a === Number(b);
    return false;
}
export function evaluateExpression(expr, rows, options) {
    const ast = parse(expr);
    const warnings = [];
    // Validate column references
    const refs = extractColumnRefs(ast);
    if (rows.length > 0) {
        const available = new Set(Object.keys(rows[0]));
        // Also collect keys from all rows for completeness
        for (const row of rows) {
            for (const k of Object.keys(row))
                available.add(k);
        }
        for (const ref of refs) {
            if (!available.has(ref)) {
                const suggestion = findClosest(ref, [...available]);
                let msg = `Column '${ref}' not found.`;
                if (suggestion)
                    msg += ` Did you mean '${suggestion}'?`;
                msg += ` Available columns: [${[...available].join(', ')}]`;
                throw new Error(msg);
            }
        }
    }
    // Apply filter: mark which rows should be evaluated
    const filterMask = options?.filter ? applyFilter(rows, options.filter) : null;
    // Pre-compute column-wise stats
    const filteredRows = filterMask ? rows.filter((_, i) => filterMask[i]) : rows;
    const pre = precompute(ast, filteredRows, options?.partitionBy);
    // Evaluate each row
    const values = new Array(rows.length);
    let filteredIndex = 0;
    for (let i = 0; i < rows.length; i++) {
        if (filterMask && !filterMask[i]) {
            values[i] = null;
            continue;
        }
        values[i] = evaluate(ast, {
            row: rows[i],
            rowIndex: filteredIndex,
            precomputed: pre,
        });
        filteredIndex++;
    }
    // Compute stats
    const stats = computeStats(values);
    // Infer type
    const type = inferType(ast, values);
    // Generate warnings
    const nullRatio = stats.nulls / stats.rows;
    if (stats.rows > 0 && stats.nulls === stats.rows) {
        warnings.push('All output values are null');
    }
    else if (nullRatio > 0.2) {
        warnings.push(`${Math.round(nullRatio * 100)}% of output values are null (${stats.nulls}/${stats.rows})`);
    }
    if (type === 'numeric' && stats.min !== undefined && stats.max !== undefined && stats.min === stats.max && stats.nulls < stats.rows) {
        warnings.push('Constant output (zero variance)');
    }
    return { values, type, warnings, stats };
}
function findClosest(target, candidates) {
    let best = null;
    let bestDist = Infinity;
    const tLower = target.toLowerCase();
    for (const c of candidates) {
        const d = levenshtein(tLower, c.toLowerCase());
        if (d < bestDist && d <= Math.max(target.length, c.length) * 0.5) {
            bestDist = d;
            best = c;
        }
    }
    return best;
}
function levenshtein(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0));
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = a[i - 1] === b[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
    }
    return dp[m][n];
}
function computeStats(values) {
    let min;
    let max;
    let sum = 0;
    let numCount = 0;
    let nulls = 0;
    for (const v of values) {
        if (v === null || v === undefined || v === '') {
            nulls++;
            continue;
        }
        if (typeof v === 'number' && !isNaN(v)) {
            if (min === undefined || v < min)
                min = v;
            if (max === undefined || v > max)
                max = v;
            sum += v;
            numCount++;
        }
    }
    return {
        min,
        max,
        mean: numCount > 0 ? sum / numCount : undefined,
        nulls,
        rows: values.length,
    };
}
function inferType(ast, values) {
    // Check AST structure first
    const inferred = inferFromAst(ast);
    if (inferred)
        return inferred;
    // Fall back to examining output values
    const nonNull = values.filter(v => v !== null && v !== undefined);
    if (nonNull.length === 0)
        return 'numeric';
    if (nonNull.every(v => typeof v === 'boolean'))
        return 'boolean';
    if (nonNull.every(v => typeof v === 'number'))
        return 'numeric';
    return 'categorical';
}
function inferFromAst(ast) {
    switch (ast.type) {
        case 'number': return 'numeric';
        case 'string': return 'categorical';
        case 'boolean': return 'boolean';
        case 'binary':
            if (['>', '>=', '<', '<=', '==', '!=', '&&', '||'].includes(ast.op))
                return 'boolean';
            if (['+', '-', '*', '/', '%', '^'].includes(ast.op))
                return 'numeric';
            return null;
        case 'unary':
            if (ast.op === '!')
                return 'boolean';
            if (ast.op === '-')
                return 'numeric';
            return null;
        case 'call': {
            const strFns = new Set(['lower', 'upper', 'trim', 'concat', 'str_replace']);
            const boolFns = new Set(['is_null', 'str_contains', 'in', 'between']);
            const dateFns = new Set(['date_floor']);
            const catFns = new Set(['cut']);
            if (strFns.has(ast.name) || catFns.has(ast.name))
                return 'categorical';
            if (boolFns.has(ast.name))
                return 'boolean';
            if (dateFns.has(ast.name))
                return 'date';
            // if_else/case: infer from output branches
            if (ast.name === 'if_else' && ast.args.length >= 3) {
                return inferFromAst(ast.args[1]);
            }
            if (ast.name === 'case' && ast.args.length >= 2) {
                return inferFromAst(ast.args[1]);
            }
            if (ast.name === 'recode')
                return null; // infer from output values
            return 'numeric'; // math/stat functions default to numeric
        }
        default: return null;
    }
}
function filterCompare(val, target) {
    // Numeric coercion for CSV text columns
    if (typeof val === 'string' && typeof target === 'number') {
        const n = Number(val);
        if (!isNaN(n) && val !== '')
            return n < target ? -1 : n > target ? 1 : 0;
    }
    if (typeof val === 'number' && typeof target === 'string') {
        const n = Number(target);
        if (!isNaN(n) && target !== '')
            return val < n ? -1 : val > n ? 1 : 0;
    }
    return val < target ? -1 : val > target ? 1 : 0;
}
function filterEqual(val, target) {
    if ((val === null || val === undefined) && (target === null || target === undefined))
        return true;
    if (val === target)
        return true;
    // Coerce numeric strings to numbers for comparison
    if (typeof val === 'string' && typeof target === 'number')
        return Number(val) === target && val !== '';
    if (typeof val === 'number' && typeof target === 'string')
        return val === Number(target) && target !== '';
    return false;
}
function applyFilter(rows, filters) {
    return rows.map(row => {
        return filters.every(f => {
            const val = row[f.field];
            switch (f.op) {
                case '=': return filterEqual(val, f.value);
                case '!=': return !filterEqual(val, f.value);
                case '>': return filterCompare(val, f.value) > 0;
                case '>=': return filterCompare(val, f.value) >= 0;
                case '<': return filterCompare(val, f.value) < 0;
                case '<=': return filterCompare(val, f.value) <= 0;
                case 'in': return Array.isArray(f.value) && f.value.some(v => filterEqual(val, v));
                case 'not_in': return Array.isArray(f.value) && !f.value.some(v => filterEqual(val, v));
                case 'is_null': return val === null || val === undefined || val === '';
                case 'is_not_null': return val !== null && val !== undefined;
                case 'between': return Array.isArray(f.value) && filterCompare(val, f.value[0]) >= 0 && filterCompare(val, f.value[1]) <= 0;
                default: return true;
            }
        });
    });
}
//# sourceMappingURL=evaluator.js.map