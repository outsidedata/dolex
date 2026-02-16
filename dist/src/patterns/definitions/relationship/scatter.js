/**
 * Scatter Plot — two variables.
 *
 * The standard for showing the relationship between two numeric
 * variables. Position encodes both values, revealing correlations,
 * clusters, and outliers.
 */
export const scatterPattern = {
    id: 'scatter',
    name: 'Scatter Plot',
    category: 'relationship',
    description: 'Each point represents one observation, positioned by two numeric variables. Reveals correlations, clusters, outliers, and the shape of relationships.',
    bestFor: 'Exploring the relationship between two numeric variables: height vs weight, price vs quantity, score vs study hours.',
    notFor: 'Categorical data (use bar), time series (use line unless comparing two metrics), single variable (use histogram).',
    dataRequirements: {
        minRows: 10,
        requiredColumns: [
            { type: 'numeric', count: 2, description: 'Two variables to compare' },
        ],
    },
    selectionRules: [
        {
            condition: 'Two numeric columns — scatter is the natural choice for relationships',
            weight: 60,
            matches: (ctx) => {
                return (ctx.dataShape.numericColumnCount >= 2 &&
                    !ctx.dataShape.hasTimeSeries &&
                    ctx.dataShape.categoricalColumnCount <= 1);
            },
        },
        {
            condition: 'Intent mentions correlation, relationship, or scatter',
            weight: 50,
            matches: (ctx) => {
                return /\b(correlat|relationship|scatter|association|regress|predict|x\s+vs\s+y|versus)\b/i.test(ctx.intent);
            },
        },
        {
            condition: 'Enough data points for a meaningful scatter (10+)',
            weight: 20,
            matches: (ctx) => {
                return ctx.dataShape.rowCount >= 10 && ctx.dataShape.numericColumnCount >= 2;
            },
        },
        {
            condition: 'Optional categorical column for color grouping',
            weight: 15,
            matches: (ctx) => {
                return (ctx.dataShape.numericColumnCount >= 2 &&
                    ctx.dataShape.categoricalColumnCount === 1 &&
                    ctx.dataShape.categoryCount <= 10);
            },
        },
        {
            condition: 'Penalize for time series — use line or connected scatter',
            weight: -30,
            matches: (ctx) => {
                return ctx.dataShape.hasTimeSeries;
            },
        },
        {
            condition: 'Penalize for single numeric column',
            weight: -40,
            matches: (ctx) => {
                return ctx.dataShape.numericColumnCount < 2;
            },
        },
    ],
    generateSpec: (data, columns, options) => {
        const xCol = columns[0];
        const yCol = columns.length > 1 ? columns[1] : columns[0];
        const colorCol = columns.length > 2 ? columns[2] : undefined;
        const sizeCol = options?.sizeField
            ? columns.find(c => c === options.sizeField)
            : undefined;
        const spec = {
            pattern: 'scatter',
            title: options?.title ?? `${yCol} vs ${xCol}`,
            data,
            encoding: {
                x: {
                    field: xCol,
                    type: 'quantitative',
                    title: xCol,
                },
                y: {
                    field: yCol,
                    type: 'quantitative',
                    title: yCol,
                },
                color: colorCol
                    ? {
                        field: colorCol,
                        type: 'nominal',
                        title: colorCol,
                    }
                    : undefined,
                size: sizeCol
                    ? {
                        field: sizeCol,
                        type: 'quantitative',
                        title: sizeCol,
                        range: options?.sizeRange ?? [3, 20],
                    }
                    : undefined,
            },
            config: {
                xField: xCol,
                yField: yCol,
                colorField: colorCol ?? null,
                sizeField: sizeCol ?? null,
                dotRadius: options?.dotRadius ?? 5,
                opacity: options?.opacity ?? 0.7,
                showTrendLine: options?.showTrendLine ?? false,
                showRegressionLine: options?.showRegressionLine ?? false,
                jitter: options?.jitter ?? 0,
            },
        };
        return spec;
    },
};
//# sourceMappingURL=scatter.js.map