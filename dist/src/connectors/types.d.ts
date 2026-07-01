/**
 * Connector-specific types for Dolex data source connectors.
 */
import type { DataSourceType, DataSourceConfig, DataSchema } from '../types.js';
/**
 * Reflect a session-derived column in a connector's cached schema, so downstream consumers
 * (schemaText, describe_data) see it. Shared by the live connectors' applyDerivation
 * (Postgres shadow view / Mongo $set) — idempotent; a no-op if the column already exists.
 */
export declare function registerDerivedColumn(schema: DataSchema, table: string, column: string): void;
/**
 * How a source materializes a derived column, declared by the connector itself
 * so the transform/clean surfaces stay source-agnostic (no getDatabase-truthiness gate).
 *
 * - `sqlite-alter`  — CSV: ALTER TABLE + rowid-keyed UPDATE on the in-memory SQLite db.
 * - `session-temp`  — Postgres: a session-local TEMP TABLE keyed by `id`, exposed to
 *                     arbitrary later queries via a same-named TEMP VIEW on ONE pinned client.
 * - `computed-set`  — Mongo: a `$set` aggregation expression prepended to every incoming pipeline,
 *                     computing the derived field server-side on read. Base collection never written.
 * - `sidecar`       — Mongo alt: a throwaway sidecar collection keyed by `_id`, joined via $lookup
 *                     (used when the derived value is precomputed rather than an expression).
 * - `none`          — the source cannot derive columns.
 */
export type DerivationMaterialization = 'sqlite-alter' | 'session-temp' | 'computed-set' | 'sidecar' | 'none';
/** The row key a derivation joins the derived value back on. */
export type DerivationRowKey = 'rowid' | 'id' | '_id' | null;
/**
 * A connector's self-declared derivation contract. The transform/clean surfaces read this
 * (via `ConnectedSource.derivationCapabilities()`) instead of probing for a raw db handle.
 */
export interface DerivationCapabilities {
    /** Can this source materialize a derived column at all? */
    canDerive: boolean;
    /** How the derived column is materialized. */
    materialization: DerivationMaterialization;
    /** The key column the derived value is joined back on. */
    rowKey: DerivationRowKey;
    /** Is the derived column visible to arbitrary subsequent analyst queries (not just an explicit JOIN)? */
    serverSideQueryable: boolean;
}
/**
 * A data connector knows how to connect to a specific data source type,
 * introspect its schema, and execute queries against it.
 */
export interface DataConnector {
    type: DataSourceType;
    /** Connect and validate the data source, returning a ConnectedSource handle. */
    connect(config: DataSourceConfig): Promise<ConnectedSource>;
    /** Test if a connection config is valid without fully connecting. */
    test(config: DataSourceConfig): Promise<{
        ok: boolean;
        error?: string;
    }>;
}
/**
 * A connected, ready-to-query data source.
 */
export interface ConnectedSource {
    id: string;
    name: string;
    type: DataSourceType;
    /** Get the full schema (tables, columns, foreign keys). */
    getSchema(): Promise<DataSchema>;
    /** Execute a raw SQL query and return columns + rows. */
    executeQuery(sql: string): Promise<QueryExecutionResult>;
    /** Get sample rows from a table, picked for variety. */
    getSampleRows(tableName: string, count?: number): Promise<Record<string, any>[]>;
    /** Get the underlying database handle (only available for SQL-backed connectors). */
    getDatabase?(): any;
    /**
     * Declare how (or whether) this source can materialize a derived column. The source-agnostic
     * transform/clean surfaces gate on this instead of probing `getDatabase`. A connector that does
     * not implement it is treated as non-deriving.
     */
    derivationCapabilities?(): DerivationCapabilities;
    /**
     * Materialize a derived column named `column` on `table` from `expr` — an expression in THIS
     * source's own native language (a SQL expression for a SQL source, a Mongo `$set` aggregation
     * expression for Mongo). The derived column must become visible to arbitrary subsequent
     * `executeQuery` calls WITHOUT mutating the base table/collection (a session-local temp view on
     * Postgres, a prepended `$set` on Mongo). Only implemented by connectors that declare
     * `serverSideQueryable` derivation. Throws on an unsafe/invalid expression.
     */
    applyDerivation?(table: string, column: string, expr: string): Promise<void>;
    /** Invalidate cached schema so the next getSchema() rebuilds from the live database. */
    invalidateSchema?(): void;
    /** Close the connection and free resources. */
    close(): Promise<void>;
}
export interface QueryExecutionResult {
    columns: string[];
    rows: Record<string, any>[];
}
/**
 * Result shape for connector operations that may fail gracefully.
 */
export interface ConnectorResult<T> {
    ok: boolean;
    data?: T;
    error?: string;
}
/**
 * Entry in the source manager registry.
 */
export interface SourceRegistryEntry {
    id: string;
    name: string;
    type: DataSourceType;
    config: DataSourceConfig;
    connectedAt?: string;
}
