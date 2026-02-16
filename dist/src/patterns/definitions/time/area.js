/**
 * Area Chart — volume over time with optional stacking.
 *
 * Like a line chart but with the area below filled, emphasizing
 * magnitude. Stacked variant shows composition changing over time.
 */
export const areaPattern = {
    id: 'area',
    name: 'Area Chart',
    category: 'time',
    description: 'Filled area chart emphasizing volume and magnitude over time. Supports single-series, multi-series overlapping, stacked, and normalized (100%) stacked modes. Multiple interpolation curves: monotone (smooth), linear, step (staircase), curve (smooth rounded), cardinal, catmullRom. Configurable fill opacity.',
    bestFor: 'Showing volume/magnitude over time. Revenue over time, website traffic, cumulative totals. Stacked: market share over time, revenue by product line. Step curve for discrete intervals (e.g. monthly billing). Normalized for proportion tracking.',
    notFor: 'Comparing exact values across many series (overlapping areas obscure), non-temporal data, precise comparisons (use bar).',
    dataRequirements: {
        minRows: 3,
        requiredColumns: [
            { type: 'date', count: 1, description: 'Time axis' },
            { type: 'numeric', count: 1, description: 'Value over time' },
        ],
        requiresTimeSeries: true,
    },
    selectionRules: [
        {
            condition: 'Time series with intent for volume, area, magnitude, or cumulative',
            weight: 55,
            matches: (ctx) => {
                return (ctx.dataShape.hasTimeSeries &&
                    ctx.dataShape.numericColumnCount >= 1 &&
                    /\b(area|volume|magnitude|cumulative|total|fill|stacked\s*area|revenue|traffic|visitors)\b/i.test(ctx.intent));
            },
        },
        {
            condition: 'Stacked composition over time with explicit stacked intent',
            weight: 60,
            matches: (ctx) => {
                return (ctx.dataShape.hasTimeSeries &&
                    ctx.dataShape.seriesCount >= 2 &&
                    ctx.dataShape.seriesCount <= 8 &&
                    /\b(stacked|composition\s+over\s+time|share\s+over\s+time|breakdown\s+over\s+time|proportion)\b/i.test(ctx.intent));
            },
        },
        {
            condition: 'Penalize when no time dimension exists',
            weight: -50,
            matches: (ctx) => {
                return !ctx.dataShape.hasTimeSeries && ctx.dataShape.dateColumnCount === 0;
            },
        },
        {
            condition: 'Penalize for too many series — visual clutter',
            weight: -30,
            matches: (ctx) => {
                return ctx.dataShape.seriesCount > 8;
            },
        },
    ],
    generateSpec: (data, columns, options) => {
        const timeCol = columns[0];
        const valueCol = columns.length > 1 ? columns[1] : columns[0];
        const seriesCol = columns.length > 2 ? columns[2] : undefined;
        const spec = {
            pattern: 'area',
            title: options?.title ?? `${valueCol} over ${timeCol}`,
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
                color: seriesCol
                    ? {
                        field: seriesCol,
                        type: 'nominal',
                        title: seriesCol,
                    }
                    : undefined,
            },
            config: {
                timeField: timeCol,
                valueField: valueCol,
                seriesField: seriesCol ?? null,
                stacked: options?.stacked ?? false,
                normalized: options?.normalized ?? false,
                curve: options?.curve ?? 'monotone',
                opacity: options?.opacity ?? 0.7,
            },
        };
        return spec;
    },
};
//# sourceMappingURL=area.js.map