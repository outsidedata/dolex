/**
 * Lollipop Chart — dots on sticks for cleaner ranking.
 *
 * A thin line from baseline to a dot at the data value.
 * Like a bar chart with less ink. Cleaner than bars when
 * there are many categories (10-40) and the dot emphasis
 * makes values easier to read than bar endpoints.
 */
export const lollipopPattern = {
    id: 'lollipop',
    name: 'Lollipop Chart',
    category: 'comparison',
    description: 'Dots on sticks — a thin line from baseline to a dot at the data value. Like a bar chart with less ink, cleaner for many categories.',
    bestFor: 'Ranking and comparison with many categories (10-40). Cleaner than bars when there are many items. Dot emphasis makes values easier to read.',
    notFor: 'Few categories (<5, just use bar), composition or part-to-whole, time series data.',
    dataRequirements: {
        minRows: 3,
        maxRows: 60,
        requiredColumns: [
            { type: 'categorical', count: 1, description: 'Category axis' },
            { type: 'numeric', count: 1, description: 'Value to compare' },
        ],
        minCategories: 3,
        maxCategories: 50,
    },
    selectionRules: [
        {
            condition: 'Intent explicitly mentions lollipop chart',
            weight: 90,
            matches: (ctx) => {
                return /\b(lollipop)\b/i.test(ctx.intent);
            },
        },
        {
            condition: 'Many-category ranking (10-40 categories) — lollipop is cleaner than bars',
            weight: 55,
            matches: (ctx) => {
                return (ctx.dataShape.categoricalColumnCount >= 1 &&
                    ctx.dataShape.numericColumnCount >= 1 &&
                    ctx.dataShape.categoryCount >= 10 &&
                    ctx.dataShape.categoryCount <= 40 &&
                    !ctx.dataShape.hasTimeSeries);
            },
        },
        {
            condition: 'Moderate category count with ranking intent',
            weight: 40,
            matches: (ctx) => {
                return (ctx.dataShape.categoryCount >= 8 &&
                    ctx.dataShape.numericColumnCount >= 1 &&
                    /\b(rank|top|bottom|highest|lowest|most|least|largest|smallest)\b/i.test(ctx.intent));
            },
        },
        {
            condition: 'Default comparison shape — categories with one numeric value',
            weight: 30,
            matches: (ctx) => {
                return (ctx.dataShape.categoricalColumnCount >= 1 &&
                    ctx.dataShape.numericColumnCount >= 1 &&
                    !ctx.dataShape.hasTimeSeries);
            },
        },
        {
            condition: 'Penalize for very few categories — bar chart is simpler',
            weight: -35,
            matches: (ctx) => {
                return ctx.dataShape.categoryCount < 5;
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
            condition: 'Penalize for two numeric columns — connected dot plot is better',
            weight: -20,
            matches: (ctx) => {
                return ctx.dataShape.numericColumnCount === 2;
            },
        },
    ],
    generateSpec: (data, columns, options) => {
        const categoryCol = columns[0];
        const valueCol = columns.length > 1 ? columns[1] : columns[0];
        const spec = {
            pattern: 'lollipop',
            title: options?.title ?? `${valueCol} by ${categoryCol}`,
            data,
            encoding: {
                x: {
                    field: categoryCol,
                    type: 'nominal',
                    title: categoryCol,
                },
                y: {
                    field: valueCol,
                    type: 'quantitative',
                    title: valueCol,
                },
                color: {
                    field: categoryCol,
                    type: 'nominal',
                    scale: {},
                },
            },
            config: {
                categoryField: categoryCol,
                valueField: valueCol,
                orientation: options?.orientation ?? 'horizontal',
                dotRadius: options?.dotRadius ?? 14,
                sorted: options?.sorted ?? true,
                sortBy: options?.sortBy ?? 'value',
                sortOrder: options?.sortOrder ?? 'descending',
            },
        };
        return spec;
    },
};
//# sourceMappingURL=lollipop.js.map