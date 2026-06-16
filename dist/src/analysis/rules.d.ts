import type { ClassifiedColumn, AnalysisStep } from './types.js';
export declare function capitalize(s: string): string;
export declare function pickTimeBucket(col: ClassifiedColumn): 'day' | 'week' | 'month' | 'quarter' | 'year';
/**
 * A "year" column holds 4-digit years (often as integers/floats), not full
 * dates. Sub-year buckets like strftime('%Y-%m', year) are nonsense on these —
 * SQLite reads a bare number as a Julian day and emits garbage ('-4707-04').
 * Detect by name (year/yr/fy) or by all top values being 4-digit years.
 */
export declare function isYearColumn(col: ClassifiedColumn): boolean;
/**
 * True only if the column's values are ISO-8601 dates (YYYY-MM-DD…). SQLite's
 * strftime parses ONLY ISO format; on slash/text dates ('9/2/1966') it returns
 * NULL for every row, collapsing a trend into one garbage bucket.
 */
export declare function isIsoDateColumn(col: ClassifiedColumn): boolean;
/**
 * Choose the time-bucket label + a SQL expression robust to how the value is
 * stored. Year columns extract the integer year (works for '1980', '1980.0',
 * numeric 1980); ISO dates use strftime. Returns null for a non-ISO, non-year
 * date column — we'd rather skip the trend than ship strftime SQL that silently
 * produces a single NULL bucket summing the whole table.
 */
export declare function timeBucketing(col: ClassifiedColumn): {
    label: string;
    expr: string;
} | null;
export declare function generateCandidates(columns: ClassifiedColumn[], table: string): AnalysisStep[];
