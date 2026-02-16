/**
 * Chart Detector — Determine chart type from result shape.
 *
 * Extracted from determineChartType() in the POC.
 * Returns a string hint for the visualization layer.
 */
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
export function determineChartType(data, selection) {
    if (!selection.category_column)
        return 'scalar';
    if (data.length === 0)
        return 'scalar';
    if (data.length === 1 && !selection.series_column)
        return 'scalar';
    const categories = [...new Set(data.map(r => r.category))];
    const looksLikeDate = categories.every((c) => /^\d{4}/.test(String(c)));
    // Multi-measure (has value_2)
    if (data.some(r => r.value_2 !== undefined)) {
        return looksLikeDate ? 'multi-line' : 'grouped-bar-dual-axis';
    }
    // Percentage
    if (selection.computed === 'percentage') {
        return selection.series_column ? 'stacked-bar-percentage' : 'pie';
    }
    // Top N per group
    if (selection.top_n_per_group) {
        return looksLikeDate ? 'stacked-line' : 'grouped-bar';
    }
    // Two-dimensional data (has series column)
    if (selection.series_column && data.some(r => r.series)) {
        if (looksLikeDate)
            return 'stacked-line';
        return 'stacked-bar';
    }
    // Check if categories look like dates/years
    if (looksLikeDate && data.length > 3)
        return 'line';
    // Few categories -> pie, many -> bar
    if (data.length <= 6)
        return 'pie';
    if (data.length <= 25)
        return 'bar';
    return 'treemap';
}
//# sourceMappingURL=chart-detector.js.map