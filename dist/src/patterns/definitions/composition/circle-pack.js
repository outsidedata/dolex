/**
 * Circle Pack — hierarchical composition with nested circles.
 *
 * Circles where area encodes value. The circular sibling of treemap:
 * same data shape, same color system, different geometry.
 */
export const circlePackPattern = {
    id: 'circle-pack',
    name: 'Circle Pack',
    category: 'composition',
    description: 'Nested circles where area represents value. Shows hierarchical composition with an organic, visually distinct layout. Good alternative to treemap for fewer items.',
    bestFor: 'Hierarchical data with size values: organizational budgets, market cap by sector, product categories. Best with fewer items than treemap since circles waste more space.',
    notFor: 'Many small items (circles waste space vs rectangles), exact value comparisons (hard to compare circle areas), time series.',
    dataRequirements: {
        minRows: 3,
        maxRows: 200,
        requiredColumns: [
            { type: 'categorical', count: 1, description: 'Category labels (or hierarchical groups)' },
            { type: 'numeric', count: 1, description: 'Size value for circle area' },
        ],
        requiresHierarchy: false,
    },
    selectionRules: [
        {
            condition: 'Intent explicitly mentions circle pack or bubble chart',
            weight: 90,
            matches: (ctx) => {
                return /\b(circle\s*pack|packed?\s*circles?|bubble\s*chart|bubble\s*map)\b/i.test(ctx.intent);
            },
        },
        {
            condition: 'Hierarchical data with composition intent — circle pack as alternative to treemap',
            weight: 45,
            matches: (ctx) => {
                return (ctx.dataShape.hasHierarchy &&
                    ctx.dataShape.numericColumnCount >= 1 &&
                    ctx.dataShape.categoricalColumnCount >= 2);
            },
        },
        {
            condition: 'Many categories (10+) with composition intent — circle pack handles moderate scale',
            weight: 35,
            matches: (ctx) => {
                return (ctx.dataShape.categoryCount >= 10 &&
                    ctx.dataShape.numericColumnCount >= 1 &&
                    /\b(compos|proportion|share|breakdown|makeup|size|biggest|largest)\b/i.test(ctx.intent));
            },
        },
        {
            condition: 'Penalize for very few categories — waffle or bar is clearer',
            weight: -30,
            matches: (ctx) => {
                return ctx.dataShape.categoryCount < 4 && !ctx.dataShape.hasHierarchy;
            },
        },
        {
            condition: 'Penalize for too many items — treemap handles scale better',
            weight: -20,
            matches: (ctx) => {
                return ctx.dataShape.categoryCount > 100;
            },
        },
    ],
    generateSpec: (data, columns, options) => {
        const categoryCol = columns[0];
        const valueCol = columns.length > 1 ? columns[1] : columns[0];
        const parentCol = columns.length > 2 ? columns[0] : undefined;
        const childCol = columns.length > 2 ? columns[1] : undefined;
        const sizeCol = columns.length > 2 ? columns[2] : valueCol;
        const spec = {
            pattern: 'circle-pack',
            title: options?.title ?? `${valueCol} composition${parentCol ? ` (${parentCol} > ${childCol})` : ''}`,
            data,
            encoding: {
                size: {
                    field: sizeCol,
                    type: 'quantitative',
                    title: sizeCol,
                },
                color: {
                    field: parentCol ?? categoryCol,
                    type: 'nominal',
                    title: parentCol ?? categoryCol,
                },
                label: {
                    field: childCol ?? categoryCol,
                    type: 'nominal',
                },
            },
            config: {
                categoryField: categoryCol,
                valueField: sizeCol,
                parentField: parentCol ?? null,
                childField: childCol ?? null,
                showLabels: options?.showLabels ?? true,
                showValues: options?.showValues ?? true,
                padding: options?.padding ?? 3,
            },
        };
        return spec;
    },
};
//# sourceMappingURL=circle-pack.js.map