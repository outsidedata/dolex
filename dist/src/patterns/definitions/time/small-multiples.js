/**
 * Small Multiples — N > 5 series, avoids spaghetti.
 *
 * Instead of overlaying many lines on one chart (spaghetti),
 * creates a grid of individual mini-charts, one per series.
 * Each shares the same axes for easy comparison while keeping
 * individual patterns readable.
 */
export const smallMultiplesPattern = {
    id: 'small-multiples',
    name: 'Small Multiples',
    category: 'time',
    description: 'A grid of small charts, one per series, all sharing the same axes. Avoids the spaghetti problem of overlaying many time series while enabling comparison.',
    bestFor: 'Comparing 5-25 time series: stock prices of multiple companies, temperature by city, sales by product line.',
    notFor: 'Fewer than 4 series (use regular line chart), more than 30 series (use sparkline grid), single series.',
    dataRequirements: {
        minRows: 20,
        requiredColumns: [
            { type: 'date', count: 1, description: 'Shared time axis' },
            { type: 'numeric', count: 1, description: 'Value to plot' },
            { type: 'categorical', count: 1, description: 'Series identifier (one chart per value)' },
        ],
        requiresTimeSeries: true,
    },
    selectionRules: [
        {
            condition: 'Many series (5-25) over time — small multiples avoids spaghetti',
            weight: 80,
            matches: (ctx) => {
                return (ctx.dataShape.hasTimeSeries &&
                    ctx.dataShape.seriesCount >= 5 &&
                    ctx.dataShape.seriesCount <= 25 &&
                    ctx.dataShape.numericColumnCount >= 1);
            },
        },
        {
            condition: 'Intent mentions comparison of many series over time',
            weight: 50,
            matches: (ctx) => {
                return /\b(small\s*multiple|facet|each\s+(country|city|product|company|region|team)|all\s+.*\s+over\s+time|individual\s+trend)\b/i.test(ctx.intent);
            },
        },
        {
            condition: 'More than 5 series detected on time data — line chart will be spaghetti',
            weight: 60,
            matches: (ctx) => {
                return ctx.dataShape.hasTimeSeries && ctx.dataShape.seriesCount > 5;
            },
        },
        {
            condition: 'Penalize for few series — regular line chart works fine',
            weight: -40,
            matches: (ctx) => {
                return ctx.dataShape.seriesCount < 4;
            },
        },
        {
            condition: 'Penalize for no time dimension',
            weight: -50,
            matches: (ctx) => {
                return !ctx.dataShape.hasTimeSeries;
            },
        },
    ],
    generateSpec: (data, columns, options) => {
        const timeCol = columns[0];
        const valueCol = columns.length > 1 ? columns[1] : columns[0];
        const seriesCol = columns.length > 2 ? columns[2] : columns.length > 1 ? columns[1] : columns[0];
        const spec = {
            pattern: 'small-multiples',
            title: options?.title ?? `${valueCol} over ${timeCol} by ${seriesCol}`,
            data,
            encoding: {
                x: {
                    field: timeCol,
                    type: 'temporal',
                    title: timeCol,
                },
                y: {
                    field: valueCol,
                    type: 'quantitative',
                    title: valueCol,
                },
                facet: {
                    field: seriesCol,
                    type: 'nominal',
                    title: seriesCol,
                },
            },
            config: {
                timeField: timeCol,
                valueField: valueCol,
                seriesField: seriesCol,
            },
        };
        return spec;
    },
};
//# sourceMappingURL=small-multiples.js.map