/**
 * Source Manager
 *
 * Manages multiple connected data sources with:
 * - CRUD operations (add/remove/list)
 * - In-memory registry with optional JSON file persistence
 * - Connector lookup by type
 * - Connection caching (lazy connect on first query)
 * - Cross-source query routing by name
 */
import type { DataSourceConfig, DataSchema, DslQuery } from '../types.js';
import type { ConnectedSource, SourceRegistryEntry, QueryExecutionResult } from './types.js';
import type { DslQueryResult } from './js-aggregation.js';
export type { DslQueryResult } from './js-aggregation.js';
export declare class SourceManager {
    private registry;
    private connections;
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
    add(name: string, config: DataSourceConfig): Promise<{
        ok: boolean;
        entry?: SourceRegistryEntry;
        error?: string;
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
     * Consolidates the repeated connect-or-fail pattern used by getSchema/query/queryDsl.
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
     * Execute a DSL query against a specific source table.
     * Validates against schema, compiles to SQL (or JS aggregation fallback),
     * executes, and returns rows.
     */
    queryDsl(idOrName: string, table: string, dslQuery: DslQuery): Promise<DslQueryResult>;
    /**
     * Validate a DSL query against the source schema. Returns an error message
     * if validation fails, or null if the query is valid.
     */
    private validateDslQuery;
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
//# sourceMappingURL=manager.d.ts.map