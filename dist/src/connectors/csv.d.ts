/**
 * CSV Connector
 *
 * Loads CSV files (single file or directory) into an in-memory SQLite database.
 * Uses papaparse for parsing, better-sqlite3 for in-memory SQL queries.
 * Introspects columns with type inference, sample values, unique/null counts.
 * Detects foreign keys by matching column names across tables.
 */
import type { DataConnector } from './types.js';
export declare const csvConnector: DataConnector;
//# sourceMappingURL=csv.d.ts.map