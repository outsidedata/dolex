/**
 * Heatmap (Matrix) — color-encoded cells on two categorical axes.
 *
 * A grid where rows and columns represent categories, and cell color
 * encodes a numeric value. Best for correlation matrices, cross-tabulation,
 * frequency tables, and any dataset with two categorical + one numeric column.
 */
export const heatmapPattern = {
    id: 'heatmap',
    name: 'Heatmap',
    category: 'relationship',
    description: 'A matrix grid where rows and columns are categories and cell color encodes a numeric value. Reveals patterns, clusters, and outliers in two-dimensional categorical data.',
    bestFor: 'Correlation matrices, cross-tabulation, confusion matrices, frequency tables, skill matrices, attendance grids, any 2D categorical × numeric data.',
    notFor: 'Time series (use calendar-heatmap or line), single categorical axis (use bar), continuous axes (use scatter), more than ~50 categories per axis (unreadable).',
    dataRequirements: {
        minRows: 2,
        maxRows: 2500,
        requiredColumns: [
            { type: 'categorical', count: 2, description: 'Row and column categories' },
            { type: 'numeric', count: 1, description: 'Value for cell color encoding' },
        ],
    },
    selectionRules: [
        {
            condition: 'Intent mentions heatmap, matrix, correlation, cross-tab, or confusion matrix',
            weight: 80,
            matches: (ctx) => {
                return /\b(heatmap|heat\s*map|matrix|correlation|cross[- ]?tab|confusion|crosstab|grid\s*chart)\b/i.test(ctx.intent);
            },
        },
        {
            condition: 'Two categorical columns + one numeric — classic heatmap shape',
            weight: 55,
            matches: (ctx) => {
                return (ctx.dataShape.categoricalColumnCount >= 2 &&
                    ctx.dataShape.numericColumnCount >= 1 &&
                    ctx.dataShape.rowCount >= 4);
            },
        },
        {
            condition: 'Data looks like a matrix: row count ≈ product of two category cardinalities',
            weight: 40,
            matches: (ctx) => {
                if (ctx.dataShape.categoricalColumnCount < 2)
                    return false;
                const cats = ctx.columns.filter(c => c.type === 'categorical');
                if (cats.length < 2)
                    return false;
                const product = cats[0].uniqueCount * cats[1].uniqueCount;
                const ratio = ctx.dataShape.rowCount / product;
                return ratio >= 0.5 && ratio <= 1.5;
            },
        },
        {
            condition: 'Penalize if too many categories per axis (>50) — unreadable',
            weight: -40,
            matches: (ctx) => {
                const cats = ctx.columns.filter(c => c.type === 'categorical');
                return cats.some(c => c.uniqueCount > 50);
            },
        },
        {
            condition: 'Penalize if only one categorical column — bar chart is better',
            weight: -30,
            matches: (ctx) => {
                return ctx.dataShape.categoricalColumnCount < 2;
            },
        },
        {
            condition: 'Penalize if data has time series characteristics — calendar-heatmap or line is better',
            weight: -25,
            matches: (ctx) => {
                return ctx.dataShape.dateColumnCount > 0;
            },
        },
    ],
    generateSpec: (data, columns, options) => {
        const catCols = columns.filter(c => {
            const vals = data.map(d => d[c]);
            const numeric = vals.every((v) => !isNaN(Number(v)) && v !== '' && v !== null);
            return !numeric;
        });
        const numCols = columns.filter(c => !catCols.includes(c));
        // Wide-format detection: 1 categorical + N>1 numeric → melt to long format
        if (catCols.length === 1 && numCols.length > 1) {
            const rowField = catCols[0];
            const colFieldName = 'metric';
            const valueFieldName = 'value';
            const melted = [];
            for (const row of data) {
                for (const numCol of numCols) {
                    melted.push({
                        [rowField]: row[rowField],
                        [colFieldName]: numCol,
                        [valueFieldName]: Number(row[numCol]),
                    });
                }
            }
            return {
                pattern: 'heatmap',
                title: options?.title ?? `${rowField} × Metrics`,
                data: melted,
                encoding: {
                    x: { field: colFieldName, type: 'nominal', title: 'Metric' },
                    y: { field: rowField, type: 'nominal', title: rowField },
                    color: {
                        field: valueFieldName,
                        type: 'quantitative',
                        title: 'Value',
                        palette: options?.palette,
                    },
                },
                config: {
                    rowField,
                    colField: colFieldName,
                    valueField: valueFieldName,
                    showValues: options?.showValues ?? true,
                    sortRows: options?.sortRows,
                    sortCols: options?.sortCols,
                },
            };
        }
        const rowField = catCols[0] || columns[0];
        const colField = catCols[1] || columns[1];
        const valueField = numCols[0] || columns[2];
        const spec = {
            pattern: 'heatmap',
            title: options?.title ?? `${rowField} × ${colField}`,
            data,
            encoding: {
                x: { field: colField, type: 'nominal', title: colField },
                y: { field: rowField, type: 'nominal', title: rowField },
                color: {
                    field: valueField,
                    type: 'quantitative',
                    title: valueField,
                    palette: options?.palette,
                },
            },
            config: {
                rowField,
                colField,
                valueField,
                showValues: options?.showValues ?? true,
                sortRows: options?.sortRows,
                sortCols: options?.sortCols,
            },
        };
        return spec;
    },
};
//# sourceMappingURL=heatmap.js.map