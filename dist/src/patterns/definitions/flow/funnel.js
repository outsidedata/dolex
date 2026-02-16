/**
 * Funnel Chart — sequential conversion/dropout visualization.
 */
export const funnelPattern = {
    id: 'funnel',
    name: 'Funnel Chart',
    category: 'flow',
    description: 'Tapered bars showing progressive narrowing through sequential stages — conversions, pipelines, dropout rates.',
    bestFor: 'Conversion funnels, sales pipelines, hiring funnels, dropout analysis. 3-8 sequential stages with decreasing values.',
    notFor: 'Non-sequential data, bidirectional flows (use Sankey), data without progressive reduction.',
    dataRequirements: {
        minRows: 3,
        maxRows: 8,
        requiredColumns: [
            { type: 'categorical', count: 1, description: 'Stage names (ordered)' },
            { type: 'numeric', count: 1, description: 'Count/value per stage' },
        ],
        minCategories: 3,
        maxCategories: 8,
    },
    selectionRules: [
        {
            condition: 'Intent explicitly mentions funnel or conversion',
            weight: 90,
            matches: (ctx) => /\b(funnel|conversion\s*(rate|funnel)?|pipeline|dropout|drop.?off)\b/i.test(ctx.intent),
        },
        {
            condition: 'Sequential stages with decreasing values',
            weight: 50,
            matches: (ctx) => {
                return ctx.dataShape.categoricalColumnCount >= 1 &&
                    ctx.dataShape.numericColumnCount >= 1 &&
                    ctx.dataShape.categoryCount >= 3 &&
                    ctx.dataShape.categoryCount <= 8;
            },
        },
        {
            condition: 'Penalize for too many stages',
            weight: -40,
            matches: (ctx) => ctx.dataShape.categoryCount > 8,
        },
        {
            condition: 'Penalize for time series data',
            weight: -30,
            matches: (ctx) => ctx.dataShape.hasTimeSeries,
        },
    ],
    generateSpec: (data, columns, options) => {
        const categoryCol = columns[0];
        const valueCol = columns.length > 1 ? columns[1] : columns[0];
        return {
            pattern: 'funnel',
            title: options?.title ?? 'Conversion Funnel',
            data,
            encoding: {
                x: { field: valueCol, type: 'quantitative' },
                y: { field: categoryCol, type: 'nominal' },
                color: { field: categoryCol, type: 'nominal' },
            },
            config: {
                categoryField: categoryCol,
                valueField: valueCol,
                showConversionRates: options?.showConversionRates ?? true,
                style: options?.style ?? 'tapered',
            },
        };
    },
};
//# sourceMappingURL=funnel.js.map