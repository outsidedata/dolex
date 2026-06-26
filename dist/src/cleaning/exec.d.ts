/** Thrown when the static screen rejects model code (banned import/call/dunder) or the
 *  code defines no clean(). Callers (MCP/CLI) surface the message; the autonomous author
 *  loop turns it into validation feedback so the model retries with safe code. */
export declare class CleanRejected extends Error {
    constructor(reason: string);
}
export declare function pythonAvailable(): boolean;
export declare function runPythonClean(code: string, values: (string | null)[]): {
    cleaned: (string | null)[];
    errors: number;
};
export interface CleanStats {
    rows: number;
    errors: number;
    changed: number;
    nulledFromValue: number;
    distinctBefore: number;
    distinctAfter: number;
}
export declare function cleanStats(raw: (string | null)[], cleaned: (string | null)[]): CleanStats;
export declare function safetyVerdict(raw: (string | null)[], cleaned: (string | null)[], errors: number): {
    ok: boolean;
    reason?: string;
};
export declare function previewSample(raw: (string | null)[], cleaned: (string | null)[], n: number): {
    before: string | null;
    after: string | null;
}[];
export declare function applyCleanColumn(db: any, table: string, newColumn: string, rowids: number[], cleaned: (string | null)[]): void;
