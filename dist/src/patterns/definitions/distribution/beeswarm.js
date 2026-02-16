/**
 * Beeswarm Plot — individual points, avoids overplotting.
 *
 * Shows every data point while using force-directed positioning
 * to prevent overlap. Reveals distribution shape AND individual
 * values, making outliers and clusters immediately visible.
 */
export const beeswarmPattern = {
    id: 'beeswarm',
    name: 'Beeswarm Plot',
    category: 'distribution',
    description: 'Dots arranged along a single axis, jittered to avoid overlap. Shows individual data points while revealing distribution shape, clusters, and outliers.',
    bestFor: 'Medium-sized datasets (20-500 rows) where individual points matter. Finding outliers, clusters, and gaps. Comparing distributions across a few groups.',
    notFor: 'Very large datasets over 1000 points (too slow/cluttered), very small datasets under 10 (use strip plot).',
    dataRequirements: {
        minRows: 10,
        maxRows: 500,
        requiredColumns: [
            { type: 'numeric', count: 1, description: 'Value to distribute points along' },
        ],
    },
    selectionRules: [
        {
            condition: 'Intent mentions outliers — beeswarm makes every point visible',
            weight: 80,
            matches: (ctx) => {
                return /\b(outlier|individual|point|each|every|anomal|extreme|unusual)\b/i.test(ctx.intent);
            },
        },
        {
            condition: 'Medium dataset size (20-500) — sweet spot for beeswarm',
            weight: 50,
            matches: (ctx) => {
                return ctx.dataShape.rowCount >= 20 && ctx.dataShape.rowCount <= 500;
            },
        },
        {
            condition: 'Distribution with a grouping column (1-5 groups)',
            weight: 40,
            matches: (ctx) => {
                return (ctx.dataShape.numericColumnCount >= 1 &&
                    ctx.dataShape.categoricalColumnCount >= 1 &&
                    ctx.dataShape.categoryCount >= 2 &&
                    ctx.dataShape.categoryCount <= 5);
            },
        },
        {
            condition: 'Penalize for very large datasets — too many points',
            weight: -40,
            matches: (ctx) => {
                return ctx.dataShape.rowCount > 500;
            },
        },
        {
            condition: 'Penalize for time series — not the right chart type',
            weight: -30,
            matches: (ctx) => {
                return ctx.dataShape.hasTimeSeries;
            },
        },
    ],
    generateSpec: (data, columns, options) => {
        const valueCol = columns[0];
        const groupCol = columns.length > 1 ? columns[1] : undefined;
        const spec = {
            pattern: 'beeswarm',
            title: options?.title ?? `Distribution of ${valueCol}${groupCol ? ` by ${groupCol}` : ''}`,
            data,
            encoding: {
                x: {
                    field: valueCol,
                    type: 'quantitative',
                    title: valueCol,
                },
                y: groupCol
                    ? {
                        field: groupCol,
                        type: 'nominal',
                        title: groupCol,
                    }
                    : undefined,
                color: groupCol
                    ? {
                        field: groupCol,
                        type: 'nominal',
                    }
                    : {
                        field: valueCol,
                        type: 'quantitative',
                    },
            },
            config: {
                valueField: valueCol,
                categoryField: groupCol ?? null,
                dotRadius: options?.dotRadius ?? 4,
                showMedianLine: options?.showMedianLine ?? true,
                opacity: options?.opacity ?? 0.7,
            },
        };
        return spec;
    },
};
//# sourceMappingURL=beeswarm.js.map