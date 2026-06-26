/**
 * Data-quality + footgun heuristics.
 *
 * `auditColumns` runs purely on column profiles (type, stats, top values, null
 * counts) — no data access — so it's cheap and unit-testable. The CLI's `check`
 * command layers a couple of query-based checks (duplicate rows, identical
 * columns) on top.
 *
 * The goal is confidence: surface the things that silently produce wrong or
 * misleading analysis (mixed-type columns, leaked duplicate columns, dead
 * columns, missing-value sentinels) before anyone trusts a chart.
 */
import type { DataColumn } from '../types.js';
export type QualitySeverity = 'high' | 'medium' | 'low';
export interface QualityFinding {
    severity: QualitySeverity;
    table: string;
    column?: string;
    issue: string;
    detail: string;
    suggestion?: string;
}
/** Profile-based data-quality checks for one table's columns. */
export declare function auditColumns(table: string, columns: DataColumn[], rowCount: number): QualityFinding[];
export type AuditQueryFn = (sql: string) => Promise<{
    ok: boolean;
    rows?: Record<string, unknown>[];
    error?: string;
}>;
export declare function tableLevelChecks(t: {
    name: string;
    columns: DataColumn[];
    rowCount: number;
}, query: AuditQueryFn): Promise<QualityFinding[]>;
/** The full audit: profile checks + table-level checks, over every table. The ONE
 *  entry point both the CLI `check` command and the analysis loop call. */
export declare function auditDataset(tables: {
    name: string;
    columns: DataColumn[];
    rowCount: number;
}[], query: AuditQueryFn): Promise<QualityFinding[]>;
/** Compact, ACTION-GUIDING summary for injection into an LLM system prompt. Filters
 *  to the silent-wrong-number issues (PROMPT_WORTHY_ISSUES), collapses repeats of
 *  the same issue into ONE line (13 "NULL" sentinel columns → one line, not 13),
 *  and caps tightly. '' if nothing actionable. The full audit still lives in
 *  `session.audit` / `dolex check`. */
export declare function formatAuditForPrompt(findings: QualityFinding[], maxLines?: number): string;
