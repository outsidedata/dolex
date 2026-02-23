/**
 * Connector-specific types for Dolex data source connectors.
 */
import type { DataSourceType, DataSourceConfig, DataSchema } from '../types.js';
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
//# sourceMappingURL=types.d.ts.map