/**
 * SQLite Connector
 *
 * Opens an existing SQLite database file in read-only mode.
 * Introspects schema via PRAGMA table_info / PRAGMA foreign_key_list.
 * Analyzes columns with sample values and type inference from actual data.
 */
import type { DataConnector } from './types.js';
export declare const sqliteConnector: DataConnector;
//# sourceMappingURL=sqlite.d.ts.map