/**
 * Transform pipeline for the Dolex derived data layer.
 *
 * Orchestrates: parse → validate → evaluate → write → metadata.
 * Handles single and batch transforms, name collisions, shadows, and rollback.
 */
import type Database from 'better-sqlite3';
import type { RowFilter } from '../types.js';
import type { ColumnType, TransformResult } from './types.js';
import { TransformMetadata } from './metadata.js';
export interface TransformInput {
    sourceId: string;
    table: string;
    create: string;
    expr: string;
    type?: ColumnType;
    filter?: RowFilter[];
    partitionBy?: string;
}
export interface BatchTransformInput {
    sourceId: string;
    table: string;
    transforms: {
        create: string;
        expr: string;
    }[];
    type?: ColumnType;
    filter?: RowFilter[];
    partitionBy?: string;
}
export interface TransformOutput {
    created: TransformResult[];
    warnings: string[];
    working_column_count: number;
    derived_column_count: number;
    total_columns: number;
}
export declare function executeSingleTransform(db: Database.Database, metadata: TransformMetadata, input: TransformInput, sourceColumns: string[]): TransformOutput;
export declare function executeBatchTransform(db: Database.Database, metadata: TransformMetadata, input: BatchTransformInput, sourceColumns: string[]): TransformOutput;
//# sourceMappingURL=pipeline.d.ts.map