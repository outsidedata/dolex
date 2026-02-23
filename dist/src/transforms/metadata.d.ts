import type Database from 'better-sqlite3';
import type { ColumnLayer, TransformRecord } from './types.js';
export declare class TransformMetadata {
    private db;
    constructor(db: Database.Database);
    /** Initialize the metadata table (CREATE TABLE IF NOT EXISTS). */
    init(): void;
    /** Add a transform record. */
    add(tableName: string, record: Omit<TransformRecord, 'order'> & {
        order?: number;
    }): void;
    /** Update a record's layer (working → derived on promote). */
    updateLayer(tableName: string, columnName: string, oldLayer: ColumnLayer, newLayer: ColumnLayer): void;
    /** Remove a record, optionally scoped to a specific layer. */
    remove(tableName: string, columnName: string, layer?: ColumnLayer): void;
    /** Get all records for a table, optionally filtered by layer. Ordered by execution order. */
    list(tableName: string, layer?: ColumnLayer): TransformRecord[];
    /** Get a specific record. Working layer takes precedence over derived. */
    get(tableName: string, columnName: string): TransformRecord | null;
    /** Get the next execution order value for a table. */
    nextOrder(tableName: string): number;
    /** Check if a column exists in any layer. */
    exists(tableName: string, columnName: string): boolean;
    /** Get the layer of a column. Returns null if not found (source column). */
    getLayer(tableName: string, columnName: string): ColumnLayer | null;
    /** Check if a column has a derived record (even if shadowed by working). */
    hasDerived(tableName: string, columnName: string): boolean;
    /** Get the derived record even if shadowed by a working layer override. */
    getDerived(tableName: string, columnName: string): TransformRecord | null;
}
//# sourceMappingURL=metadata.d.ts.map