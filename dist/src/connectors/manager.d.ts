/**
 * Source Manager
 *
 * Manages multiple connected data sources with:
 * - CRUD operations (add/remove/list)
 * - In-memory registry with optional JSON file persistence
 * - Connector lookup by type
 * - Connection caching (lazy connect on first query)
 * - SQL query execution with safety checks
 */
import type { DataSourceConfig, DataSchema } from '../types.js';
import type { ConnectedSource, SourceRegistryEntry, QueryExecutionResult } from './types.js';
export interface SqlQueryResult {
    ok: boolean;
    rows?: Record<string, any>[];
    columns?: string[];
    totalRows?: number;
    truncated?: boolean;
    error?: string;
    /** Advisory SQL-safety diagnostics (e.g. integer-division truncation). The
     *  query still ran; these signal silent-wrong-answer traps so the caller can
     *  re-issue a corrected query. The engine never rewrites the SQL itself. */
    warnings?: string[];
}
/** Classify a connection failure into an actionable kind, so callers can give a specific next step
 *  (install the driver / start the DB / fix credentials) instead of relaying a raw driver string. */
export declare function classifyConnError(msg?: string): 'driver-missing' | 'unreachable' | 'host-not-found' | 'timeout' | 'auth-failed' | 'db-not-found' | 'error';
export declare class SourceManager {
    private registry;
    private connections;
    private pendingConnections;
    private persistPath;
    /**
     * @param persistPath Optional JSON file for persisting the registry.
     *                    Loaded on construction and saved on every mutation.
     */
    constructor(persistPath?: string);
    private loadRegistry;
    private saveRegistry;
    /**
     * Add a data source to the registry.
     * Does NOT connect immediately — connection is lazy on first query or explicit connect().
     */
    add(name: string, config: DataSourceConfig, opts?: {
        verify?: boolean;
    }): Promise<{
        ok: boolean;
        entry?: SourceRegistryEntry;
        error?: string;
        verified?: boolean;
        warning?: string;
    }>;
    /**
     * Update a registered source's config in place (DB moved, password rotated, driver now installed)
     * WITHOUT losing its id — so every existing reference keeps working. `patch` is merged over the
     * stored config; the type is immutable. Any live connection is closed so the next use reconnects.
     */
    update(idOrName: string, patch: Partial<DataSourceConfig>, opts?: {
        verify?: boolean;
    }): Promise<{
        ok: boolean;
        entry?: SourceRegistryEntry;
        error?: string;
        verified?: boolean;
        warning?: string;
    }>;
    /**
     * Connectivity health-check for a REGISTERED source (the return-user's "is my saved DB still
     * reachable?" and an agent's pre-flight). Returns a classified failure so the caller can give an
     * actionable next step rather than a raw driver string.
     */
    testSource(idOrName: string): Promise<{
        ok: boolean;
        error?: string;
        kind?: string;
    }>;
    /**
     * Remove a data source by ID or name. Closes the connection if active.
     */
    remove(idOrName: string): Promise<{
        ok: boolean;
        error?: string;
    }>;
    list(): SourceRegistryEntry[];
    get(idOrName: string): SourceRegistryEntry | undefined;
    connect(idOrName: string): Promise<{
        ok: boolean;
        source?: ConnectedSource;
        error?: string;
    }>;
    disconnect(idOrName: string): Promise<{
        ok: boolean;
        error?: string;
    }>;
    isConnected(idOrName: string): boolean;
    /**
     * Lazily connect and return the source, or an error result.
     */
    private resolveSource;
    getSchema(idOrName: string): Promise<{
        ok: boolean;
        schema?: DataSchema;
        error?: string;
    }>;
    query(idOrName: string, sql: string): Promise<{
        ok: boolean;
        result?: QueryExecutionResult;
        error?: string;
    }>;
    /**
     * Execute a SQL query against a source with safety checks.
     * Only SELECT/WITH queries are allowed. Results are auto-capped at maxRows.
     * Error messages are enriched with available table/column names.
     */
    querySql(idOrName: string, sql: string, maxRows?: number): Promise<SqlQueryResult>;
    /**
     * Run a read-only aggregation pipeline against a document store and return rows + columns,
     * capped to maxRows. The pipeline string is the {collection, pipeline} seam the connector
     * parses. No SQL safety pass (those footguns are SQL-only); Mongo-specific footgun
     * detection is the language-plane work, added later. Never throws (audit-on-load relies on it).
     */
    private queryPipeline;
    /**
     * Advisory SQL-safety pass over a successful query. Best-effort: any failure
     * yields no warnings (never blocks or breaks the query). Gated on a cheap
     * syntactic pre-filter so the type probes only run when a risky term exists.
     */
    private analyzeSqlSafety;
    /**
     * Enrich SQLite error messages with available table/column info.
     */
    private enrichSqlError;
    getAllSchemas(): Promise<{
        sourceId: string;
        sourceName: string;
        schema: DataSchema;
    }[]>;
    closeAll(): Promise<void>;
    destroy(): Promise<void>;
    /**
     * Find a registry entry by ID, name (case-insensitive), or name-derived ID.
     */
    private findEntry;
}
