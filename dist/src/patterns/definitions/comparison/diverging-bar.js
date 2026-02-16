/**
 * Diverging Bar Chart — differences from a baseline or zero.
 *
 * Excels when values span positive and negative, or when comparing
 * deviations from an average/target. The visual encoding of direction
 * (left vs right, or up vs down) makes differences instantly readable.
 */
export const divergingBarPattern = {
    id: 'diverging-bar',
    name: 'Diverging Bar Chart',
    category: 'comparison',
    description: 'Horizontal bars extending left and right from a central baseline. Shows positive and negative deviations clearly.',
    bestFor: 'Data with positive and negative values, profit/loss, above/below average, sentiment scores, change from baseline.',
    notFor: 'All-positive data without a meaningful midpoint. Use standard bar instead.',
    dataRequirements: {
        minRows: 3,
        maxRows: 40,
        requiredColumns: [
            { type: 'categorical', count: 1, description: 'Category labels' },
            { type: 'numeric', count: 1, description: 'Value with positive and negative range' },
        ],
        minCategories: 3,
    },
    selectionRules: [
        {
            condition: 'Data contains negative values — diverging bar is ideal',
            weight: 70,
            matches: (ctx) => {
                return (ctx.dataShape.hasNegativeValues &&
                    ctx.dataShape.categoricalColumnCount >= 1 &&
                    ctx.dataShape.numericColumnCount >= 1);
            },
        },
        {
            condition: 'Intent mentions difference, change, deviation, or baseline',
            weight: 50,
            matches: (ctx) => {
                return /\b(differ|change|deviat|baseline|target|above|below|gain|loss|profit|deficit|surplus|sentiment|positive|negative)\b/i.test(ctx.intent);
            },
        },
        {
            condition: 'Value range spans zero with meaningful spread on both sides',
            weight: 30,
            matches: (ctx) => {
                const { min, max } = ctx.dataShape.valueRange;
                return min < 0 && max > 0 && Math.abs(min) > max * 0.2 && Math.abs(max) > Math.abs(min) * 0.2;
            },
        },
        {
            condition: 'Penalize when no negative values exist',
            weight: -40,
            matches: (ctx) => {
                return !ctx.dataShape.hasNegativeValues;
            },
        },
    ],
    generateSpec: (data, columns, options) => {
        const categoryCol = columns[0];
        const valueCol = columns.length > 1 ? columns[1] : columns[0];
        const spec = {
            pattern: 'diverging-bar',
            title: options?.title ?? `${valueCol} deviation by ${categoryCol}`,
            data,
            encoding: {
                x: {
                    field: valueCol,
                    type: 'quantitative',
                    title: valueCol,
                },
                y: {
                    field: categoryCol,
                    type: 'nominal',
                    title: categoryCol,
                    sort: null,
                },
                color: {
                    field: valueCol,
                    type: 'quantitative',
                    scale: {
                        domain: [
                            Math.min(...data.map((d) => Number(d[valueCol]) || 0)),
                            0,
                            Math.max(...data.map((d) => Number(d[valueCol]) || 0)),
                        ],
                        range: ['#d73027', '#f7f7f7', '#1a9850'],
                    },
                },
            },
            config: {
                orientation: 'horizontal',
                showLabels: true,
            },
        };
        return spec;
    },
};
//# sourceMappingURL=diverging-bar.js.map