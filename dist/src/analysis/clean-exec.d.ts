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
