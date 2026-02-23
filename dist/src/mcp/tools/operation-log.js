/**
 * Operation log — ring buffer of recent tool calls for bug reports.
 * Captures sanitized metadata (patterns, data shapes, SQL previews)
 * but never data values, connection strings, or file paths.
 */
const MAX_ENTRIES = 10;
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
export const operationLog = new OperationLog();
/** Log an operation, silently ignoring errors so logging never breaks tool handlers. */
export function logOperation(entry) {
    try {
        operationLog.log(entry);
    }
    catch { }
}
//# sourceMappingURL=operation-log.js.map