/**
 * Resolves a CLI "target" to queryable data.
 *
 * A target is either:
 *   1. an existing `.csv` file or a directory of CSVs → loaded into an
 *      ephemeral in-memory SQLite database (not registered anywhere), or
 *   2. the name/id of a source registered via `dolex sources add` → looked up
 *      in the persistent registry at `~/.dolex/sources.json` (shared with the
 *      MCP server).
 *
 * The `SourceManager` (and its `better-sqlite3` / `papaparse` deps) is imported
 * lazily so commands that never touch a CSV stay dependency-free.
 */
import type { DataColumn, DataSchema } from '../types.js';
import type { SourceManager, SqlQueryResult } from '../connectors/manager.js';
import { dolexHome } from './paths.js';
export { dolexHome };
export interface OpenedSource {
    manager: SourceManager;
    sourceId: string;
    displayName: string;
    schema: DataSchema;
    tables: {
        name: string;
        columns: DataColumn[];
        rowCount: number;
    }[];
    defaultTable: string;
    /** Run a read-only SQL query (capped + safety-checked by SourceManager). */
    query: (sql: string, maxRows?: number) => Promise<SqlQueryResult>;
    /** Release the underlying connection. */
    close: () => Promise<void>;
}
export declare function registryPath(): string;
/** Construct the persistent SourceManager backed by `~/.dolex/sources.json`. */
export declare function persistentManager(): Promise<SourceManager>;
/**
 * Open a target for querying. Throws an Error with a helpful message when the
 * target cannot be resolved or the chosen table does not exist.
 */
export declare function openTarget(target: string, opts?: {
    table?: string;
}): Promise<OpenedSource>;
/**
 * Read a JSON array of row objects from a file path or from stdin (when
 * `fromStdin` is true). Throws on malformed input.
 */
export declare function readInlineRows(filePath: string | undefined, fromStdin: boolean): Promise<Record<string, any>[]>;
