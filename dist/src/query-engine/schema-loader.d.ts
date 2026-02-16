/**
 * Schema Loader — Loads and analyzes data schemas from SQLite databases.
 *
 * Extracted from loadDataset() and inferColumnType() in the POC.
 * Works with DataSchema/DataTable/DataColumn types from types.ts.
 */
import Database from 'better-sqlite3';
import type { DataSchema, DataColumn, DataSourceInfo } from '../types.js';
/**
 * Infer column type from name, sample values, and cardinality.
 */
export declare function inferColumnType(name: string, samples: string[], uniqueCount: number, totalRows: number): DataColumn['type'];
/**
 * Load a DataSchema from an existing SQLite database.
 *
 * Queries the database for table and column metadata, infers types,
 * and detects foreign keys by column name matching.
 */
export declare function loadSchema(db: Database.Database, source: DataSourceInfo): DataSchema;
/**
 * Load CSV files from a directory into an in-memory SQLite database,
 * then return both the database and its schema.
 *
 * Each CSV file becomes a table (filename without extension, sanitized).
 * Large tables are capped at maxRows for performance.
 */
export declare function loadCsvToSqlite(csvDir: string, source: DataSourceInfo, options?: {
    maxRows?: number;
}): {
    db: Database.Database;
    schema: DataSchema;
};
//# sourceMappingURL=schema-loader.d.ts.map