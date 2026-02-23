/**
 * SQLite column management for the Dolex derived data layer.
 *
 * Adds, overwrites, and drops columns in SQLite tables.
 * Works directly with better-sqlite3 Database instances.
 */
import type Database from 'better-sqlite3';
import type { DataColumn, DataTable } from '../types.js';
export declare class ColumnManager {
    private db;
    constructor(db: Database.Database);
    /** Add a new column to a table with computed values. */
    addColumn(tableName: string, columnName: string, values: any[], type: string): void;
    /** Overwrite an existing column's values. */
    overwriteColumn(tableName: string, columnName: string, values: any[]): void;
    /** Drop a column from a table. */
    dropColumn(tableName: string, columnName: string): void;
    /** Profile a single column and return a DataColumn descriptor. */
    profileColumn(tableName: string, columnName: string, type: string): DataColumn;
    /** Rebuild a DataTable's columns array from the live database. */
    refreshTableSchema(tableName: string, existingTable: DataTable): DataTable;
    /** Get column names for a table from PRAGMA. */
    getColumnNames(tableName: string): string[];
    /** Get all rows from a table. */
    getAllRows(tableName: string): Record<string, any>[];
    /** Get row count. */
    getRowCount(tableName: string): number;
    private validateValueCount;
    private assertColumnExists;
    private assertColumnAbsent;
    private profileNumeric;
    private profileTopValues;
    private writeValues;
}
//# sourceMappingURL=column-manager.d.ts.map