/**
 * Operation log — ring buffer of recent tool calls for bug reports.
 * Captures sanitized metadata (patterns, data shapes, DSL structure)
 * but never data values, connection strings, or file paths.
 */
const MAX_ENTRIES = 10;
const EMPTY_DSL_STRUCTURE = {
    hasJoin: false, hasFilter: false, hasGroupBy: false,
    hasHaving: false, hasOrderBy: false, hasLimit: false,
    aggregates: [], windows: [],
};
export class OperationLog {
    entries = [];
    log(entry) {
        this.entries.push(entry);
        if (this.entries.length > MAX_ENTRIES) {
            this.entries.shift();
        }
    }
    getAll() {
        return [...this.entries].reverse();
    }
    getLast() {
        return this.entries.at(-1);
    }
    clear() {
        this.entries = [];
    }
    get size() {
        return this.entries.length;
    }
}
export function extractDslStructure(query) {
    if (!query || typeof query !== 'object') {
        return { ...EMPTY_DSL_STRUCTURE, aggregates: [], windows: [] };
    }
    const q = query;
    const aggregates = [];
    const windows = [];
    if (Array.isArray(q.select)) {
        for (const field of q.select) {
            if (field && typeof field === 'object') {
                const f = field;
                if (f.aggregate && typeof f.aggregate === 'string')
                    aggregates.push(f.aggregate);
                if (f.window && typeof f.window === 'string')
                    windows.push(f.window);
            }
        }
    }
    return {
        hasJoin: Array.isArray(q.join) && q.join.length > 0,
        hasFilter: Array.isArray(q.filter) && q.filter.length > 0,
        hasGroupBy: Array.isArray(q.groupBy) && q.groupBy.length > 0,
        hasHaving: Array.isArray(q.having) && q.having.length > 0,
        hasOrderBy: Array.isArray(q.orderBy) && q.orderBy.length > 0,
        hasLimit: q.limit != null,
        aggregates: [...new Set(aggregates)],
        windows: [...new Set(windows)],
    };
}
export const operationLog = new OperationLog();
/** Log an operation, silently ignoring errors so logging never breaks tool handlers. */
export function logOperation(entry) {
    try {
        operationLog.log(entry);
    }
    catch { }
}
//# sourceMappingURL=operation-log.js.map