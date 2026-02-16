/**
 * Chart Detector — Determine chart type from result shape.
 *
 * Extracted from determineChartType() in the POC.
 * Returns a string hint for the visualization layer.
 */
import type { LLMColumnSelection } from '../types.js';
/**
 * Determine the best chart type based on the query result data shape
 * and the LLM selection metadata.
 *
 * Chart type hints returned:
 * - 'scalar'                   — single value, no category
 * - 'pie'                      — few categories (<=6), or percentage without series
 * - 'bar'                      — moderate categories (<=25)
 * - 'treemap'                  — many categories (>25)
 * - 'line'                     — date/year-based categories over time
 * - 'stacked-bar'              — two-dimensional, non-date categories
 * - 'stacked-line'             — two-dimensional, date categories or top_n_per_group
 * - 'stacked-bar-percentage'   — percentage with series column
 * - 'grouped-bar'              — top_n_per_group, non-date
 * - 'multi-line'               — multi-measure, date categories
 * - 'grouped-bar-dual-axis'    — multi-measure, non-date categories
 */
export declare function determineChartType(data: Record<string, any>[], selection: LLMColumnSelection): string;
//# sourceMappingURL=chart-detector.d.ts.map