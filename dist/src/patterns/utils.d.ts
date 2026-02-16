/**
 * Shared utilities for data shape analysis.
 * Used by the pattern selector to evaluate data characteristics
 * before scoring patterns.
 */
import type { DataColumn, PatternMatchContext } from '../types.js';
/**
 * Detect whether numeric data contains a time-series column.
 * Checks column type and name heuristics.
 */
export declare function hasTimeSeriesColumn(columns: DataColumn[]): boolean;
/**
 * Count unique categorical values in the data for a given column name.
 */
export declare function countCategories(data: Record<string, any>[], columnName: string): number;
/**
 * Count unique series values in the data.
 * A "series" column is typically the second categorical column used for grouping.
 */
export declare function countSeries(data: Record<string, any>[], columns: DataColumn[]): number;
/**
 * Check if any numeric column contains negative values.
 */
export declare function hasNegativeValues(data: Record<string, any>[], columns: DataColumn[]): boolean;
/**
 * Get the min and max values across all numeric columns.
 */
export declare function getValueRange(data: Record<string, any>[], columns: DataColumn[]): {
    min: number;
    max: number;
};
/**
 * Detect hierarchical structure in the data.
 * Looks for parent-child relationships or multiple categorical columns
 * with decreasing cardinality (e.g., region > country > city).
 */
export declare function detectHierarchy(data: Record<string, any>[], columns: DataColumn[]): boolean;
export type IntentCategory = 'comparison' | 'distribution' | 'composition' | 'time' | 'relationship' | 'flow' | 'unknown';
/**
 * Parse user intent string and return the most likely category.
 * Returns all matching categories ranked by keyword match count.
 */
export declare function parseIntent(intent: string): {
    primary: IntentCategory;
    scores: Record<IntentCategory, number>;
};
/**
 * Build a complete PatternMatchContext from raw data, columns, and intent.
 * This is the main entry point for constructing the context object
 * that pattern selection rules evaluate against.
 */
export declare function buildMatchContext(data: Record<string, any>[], columns: DataColumn[], intent: string): PatternMatchContext;
/**
 * Find the first column of a given type from a list of column names
 * using the full DataColumn metadata.
 */
export declare function findColumnByType(columns: DataColumn[], type: DataColumn['type']): DataColumn | undefined;
/**
 * Find all columns of a given type.
 */
export declare function findColumnsByType(columns: DataColumn[], type: DataColumn['type']): DataColumn[];
/**
 * Infer the Vega-Lite field type from a DataColumn type.
 */
export declare function inferFieldType(colType: DataColumn['type']): 'quantitative' | 'nominal' | 'ordinal' | 'temporal';
/**
 * Given an array of column names and full DataColumn metadata,
 * determine the best x, y, color, and size columns.
 * A best-effort heuristic for generateSpec functions.
 */
export declare function inferEncoding(columnNames: string[], columns: DataColumn[]): {
    x: string | null;
    y: string | null;
    color: string | null;
    size: string | null;
};
//# sourceMappingURL=utils.d.ts.map