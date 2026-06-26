import type { QualityFinding } from '../analysis/quality.js';
export interface AcceptResult {
    ok: boolean;
    summary: string;
    fail?: string;
}
interface Handler {
    task: (f: QualityFinding) => string | null;
    accept: (pairs: [string, any][], f: QualityFinding) => AcceptResult;
}
export declare const HANDLERS: Record<string, Handler>;
/** Run the model-authored code over the sample values and apply the issue's
 *  acceptance test. Uses the shared exec (string|null normalized) — the same
 *  executor the MCP tool uses, so there is exactly ONE python runner. */
export declare function validateFix(finding: QualityFinding, code: string, sampleVals: string[]): AcceptResult;
export {};
