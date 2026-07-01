/**
 * Source factory — turn generic frontend arguments (a `--type`, a connection
 * string, or discrete host/port/database fields) into a typed
 * `DataSourceConfig` the `SourceManager` can register and connect.
 *
 * Model-free and dependency-free: it only shapes/validates a config object; it
 * never opens a connection (the connector's `test()`/`connect()` does that).
 * Shared by the CLI `sources add` command; the MCP loader can adopt it later.
 *
 * Backward compatibility: an omitted `--type` with a bare path resolves to CSV,
 * so `dolex sources add <name> <path>` keeps working unchanged.
 */
import type { DataSourceConfig } from '../types.js';
/** Generic, frontend-agnostic inputs a factory resolves into a typed config. */
export interface SourceFactoryArgs {
    /** csv | postgres | mongodb. Omitted ⇒ defaults to 'csv'. */
    type?: string;
    /** CSV: path to a `.csv` file or a directory of CSVs. */
    path?: string;
    /** Connection string: libpq DSN (postgres) or Mongo URI (mongodb). */
    uri?: string;
    host?: string;
    port?: number;
    database?: string;
    user?: string;
    password?: string;
    /** Name of an env var holding the Postgres password (kept out of the registry file). */
    passwordEnv?: string;
    /** Postgres schema to introspect (default: public). */
    schema?: string;
    /** Mongo: restrict introspection to these collections. */
    collections?: string[];
}
/**
 * Resolve generic args into a typed `DataSourceConfig`. Throws an `Error` with
 * an actionable message when required fields are missing or the type is unknown.
 */
export declare function resolveSourceConfig(args: SourceFactoryArgs): DataSourceConfig;
