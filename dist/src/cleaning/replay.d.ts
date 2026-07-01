export interface FixRecord {
    column: string;
    issue: string;
    task: string;
    pythonCode: string;
    validated: boolean;
    summary: string;
}
export interface CleanManifest {
    dataset: string;
    createdBy: string;
    createdAt: string;
    fixes: FixRecord[];
}
type Row = Record<string, string>;
export declare function parseCsv(p: string): {
    rows: Row[];
    fields: string[];
};
/** Apply validated fixes to in-memory rows (mutates). When `keepRaw`, also writes a
 *  `<col>_raw` provenance column from the value the fix saw before overwriting `<col>`.
 *  The autoclean loop applies with keepRaw=false (provenance columns re-trigger the healed
 *  findings on re-audit); materialization keeps it for lineage. */
export declare function applyFixesToRows(rows: Row[], fixes: FixRecord[], keepRaw?: boolean): void;
/** Replay validated fixes over a CSV. NO model. `keepRaw` retains `<col>_raw` lineage. */
export declare function applyManifest(rawPath: string, manifest: CleanManifest, keepRaw?: boolean): {
    rows: Row[];
    fields: string[];
};
/** `<base>.cleanfix.json` co-located with the CSV (matches cleanDataset's default outDir). */
export declare function resolveCleanfixPath(csvPath: string): string;
/** Read + shape-validate a cleanfix manifest. Returns null if absent/invalid/empty. */
export declare function readCleanfixManifest(csvPath: string): CleanManifest | null;
export {};
