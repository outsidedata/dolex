import type { CleanAuthor } from './author.js';
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
export declare function buildCleanManifest(rawPath: string, author: CleanAuthor, opts?: {
    tries?: number;
    onLog?: (s: string) => void;
    createdBy?: string;
}): Promise<CleanManifest>;
/** Replay validated fixes over a CSV (NON-destructive: keep <col>_raw). NO model. */
export declare function applyManifest(rawPath: string, manifest: CleanManifest): {
    rows: Record<string, string>[];
    fields: string[];
};
/** Full activation: build manifest (via injected author) → materialize cleaned CSV + persist manifest. */
export declare function cleanDataset(rawPath: string, author: CleanAuthor, opts?: {
    outDir?: string;
    onLog?: (s: string) => void;
    createdBy?: string;
}): Promise<{
    cleanedPath: string;
    manifestPath: string;
    manifest: CleanManifest;
}>;
