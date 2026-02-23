/**
 * Operation log — ring buffer of recent tool calls for bug reports.
 * Captures sanitized metadata (patterns, data shapes, SQL previews)
 * but never data values, connection strings, or file paths.
 */
export interface OperationMeta {
    pattern?: string;
    specId?: string;
    alternativesCount?: number;
    dataShape?: {
        rowCount: number;
        columnCount: number;
        columns: {
            name: string;
            type: string;
        }[];
    };
    sqlPreview?: string;
    sourceType?: string;
    error?: string;
    viewCount?: number;
    filterCount?: number;
    changes?: string[];
}
export interface OperationEntry {
    toolName: string;
    timestamp: number;
    durationMs: number;
    success: boolean;
    meta: OperationMeta;
}
export declare class OperationLog {
    private entries;
    log(entry: OperationEntry): void;
    getAll(): OperationEntry[];
    getLast(): OperationEntry | undefined;
    clear(): void;
    get size(): number;
}
export declare const operationLog: OperationLog;
/** Log an operation, silently ignoring errors so logging never breaks tool handlers. */
export declare function logOperation(entry: OperationEntry): void;
//# sourceMappingURL=operation-log.d.ts.map