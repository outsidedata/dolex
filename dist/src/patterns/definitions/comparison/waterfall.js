/**
 * Waterfall Chart — sequential cumulative positive/negative breakdown.
 */
export const waterfallPattern = {
    id: 'waterfall',
    name: 'Waterfall Chart',
    category: 'comparison',
    description: 'Floating bars showing how an initial value is affected by sequential positive and negative intermediate values to reach a final total.',
    bestFor: 'Financial breakdowns (revenue → costs → profit), variance analysis (budget → actuals), bridge charts showing contributing factors.',
    notFor: 'Non-sequential data, simple comparison across categories, time series, part-to-whole.',
    dataRequirements: {
        minRows: 3,
        maxRows: 30,
        requiredColumns: [
            { type: 'categorical', count: 1, description: 'Step labels' },
            { type: 'numeric', count: 1, description: 'Values (positive and negative)' },
        ],
        minCategories: 3,
        maxCategories: 20,
    },
    selectionRules: [
        {
            condition: 'Intent explicitly mentions waterfall or bridge chart',
            weight: 90,
            matches: (ctx) => {
                return /\b(waterfall|bridge\s*chart)\b/i.test(ctx.intent);
            },
        },
        {
            condition: 'Financial breakdown with positive and negative values',
            weight: 55,
            matches: (ctx) => {
                return (ctx.dataShape.categoricalColumnCount >= 1 &&
                    ctx.dataShape.numericColumnCount >= 1 &&
                    ctx.dataShape.hasNegativeValues === true &&
                    /\b(breakdown|contribut|step|cumulative|running|bridge|variance|profit|loss|revenue|cost|budget|actual)\b/i.test(ctx.intent));
            },
        },
        {
            condition: 'Sequential categorical data with mixed positive/negative values',
            weight: 40,
            matches: (ctx) => {
                return (ctx.dataShape.categoricalColumnCount >= 1 &&
                    ctx.dataShape.numericColumnCount >= 1 &&
                    ctx.dataShape.hasNegativeValues === true &&
                    !ctx.dataShape.hasTimeSeries);
            },
        },
        {
            condition: 'Penalize for time series data',
            weight: -30,
            matches: (ctx) => {
                return ctx.dataShape.hasTimeSeries;
            },
        },
        {
            condition: 'Penalize when no negative values — just use bar chart',
            weight: -40,
            matches: (ctx) => {
                return ctx.dataShape.hasNegativeValues !== true;
            },
        },
    ],
    generateSpec: (data, columns, options) => {
        const categoryCol = columns[0];
        const valueCol = columns.length > 1 ? columns[1] : columns[0];
        const spec = {
            pattern: 'waterfall',
            title: options?.title ?? `${valueCol} Waterfall`,
            data,
            encoding: {
                x: { field: categoryCol, type: 'nominal', title: categoryCol },
                y: { field: valueCol, type: 'quantitative', title: valueCol },
            },
            config: {
                categoryField: categoryCol,
                valueField: valueCol,
                totalColumns: ['first', 'last'],
                showConnectors: true,
            },
        };
        return spec;
    },
};
//# sourceMappingURL=waterfall.js.map