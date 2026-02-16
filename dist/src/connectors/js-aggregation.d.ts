/**
 * JS-based aggregation and window function helpers.
 *
 * Used when the SQL dialect doesn't support certain aggregates natively
 * (e.g., median, stddev, percentile on SQLite/MySQL) or window functions.
 * All functions are pure — no side effects or class dependencies.
 */
import type { DslQuery, DslOrderBy } from '../types.js';
import type { ConnectedSource } from './types.js';
export declare function sortPartition(partition: Record<string, any>[], orderBy: DslOrderBy[]): void;
export type DslQueryResult = {
    ok: boolean;
    rows?: Record<string, any>[];
    columns?: string[];
    totalRows?: number;
    truncated?: boolean;
    error?: string;
};
export declare function finalizeRows(rows: Record<string, any>[], query: DslQuery): DslQueryResult;
export declare function executeJsAggregation(source: ConnectedSource, table: string, query: DslQuery, dialect: 'sqlite' | 'postgres' | 'mysql'): Promise<DslQueryResult>;
export declare function executeJsAggregationWithWindows(source: ConnectedSource, table: string, query: DslQuery, dialect: 'sqlite' | 'postgres' | 'mysql'): Promise<DslQueryResult>;
//# sourceMappingURL=js-aggregation.d.ts.map