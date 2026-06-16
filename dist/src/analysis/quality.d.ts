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
