/**
 * Sparkline Grid — many series, compact.
 *
 * Dense grid of tiny line charts (sparklines) without axes,
 * labels, or gridlines. Designed for dashboard-style overviews
 * where you need to scan 10-100 series at once to find patterns.
 */
export const sparklineGridPattern = {
    id: 'sparkline-grid',
    name: 'Sparkline Grid',
    category: 'time',
    description: 'Dense grid of minimal line charts (sparklines), one per series. No axes or labels — just the shape of each trend. Designed for scanning many series at once.',
    bestFor: 'Dashboard overview of 10-100 series: KPI dashboard, all product metrics, all regional trends. Finding which series stand out.',
    notFor: 'Precise value reading (no axes), few series (use line chart or small multiples), non-temporal data.',
    dataRequirements: {
        minRows: 30,
        requiredColumns: [
            { type: 'date', count: 1, description: 'Time axis' },
            { type: 'numeric', count: 1, description: 'Value' },
            { type: 'categorical', count: 1, description: 'Series identifier' },
        ],
        requiresTimeSeries: true,
    },
    selectionRules: [
        {
            condition: 'Very many series (15+) — sparkline grid is the most compact',
            weight: 85,
            matches: (ctx) => {
                return (ctx.dataShape.hasTimeSeries &&
                    ctx.dataShape.seriesCount >= 15 &&
                    ctx.dataShape.numericColumnCount >= 1);
            },
        },
        {
            condition: 'Intent mentions overview, dashboard, or scanning many series',
            weight: 50,
            matches: (ctx) => {
                return /\b(overview|dashboard|all\s+\w+|summary|scan|sparkline|compact|every\s+(product|metric|region))\b/i.test(ctx.intent);
            },
        },
        {
            condition: 'Many series on time data — beyond what small multiples handles well',
            weight: 40,
            matches: (ctx) => {
                return ctx.dataShape.hasTimeSeries && ctx.dataShape.seriesCount > 25;
            },
        },
        {
            condition: 'Penalize for few series — use line chart or small multiples',
            weight: -40,
            matches: (ctx) => {
                return ctx.dataShape.seriesCount < 10;
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
        const seriesValues = [...new Set(data.map((d) => d[seriesCol]))];
        const gridCols = options?.gridCols ?? Math.ceil(Math.sqrt(seriesValues.length));
        // Compute min/max and latest trend direction per series
        const seriesMeta = seriesValues.map((series) => {
            const seriesData = data
                .filter((d) => d[seriesCol] === series)
                .sort((a, b) => (a[timeCol] > b[timeCol] ? 1 : -1));
            const values = seriesData.map((d) => Number(d[valueCol]) || 0);
            const last = values[values.length - 1] ?? 0;
            const secondLast = values[values.length - 2] ?? last;
            return {
                series,
                min: Math.min(...values),
                max: Math.max(...values),
                latest: last,
                trend: last >= secondLast ? 'up' : 'down',
                changePercent: secondLast !== 0 ? ((last - secondLast) / Math.abs(secondLast)) * 100 : 0,
            };
        });
        const spec = {
            pattern: 'sparkline-grid',
            title: options?.title ?? `${valueCol} sparklines by ${seriesCol}`,
            data,
            encoding: {
                x: {
                    field: timeCol,
                    type: 'temporal',
                },
                y: {
                    field: valueCol,
                    type: 'quantitative',
                },
                facet: {
                    field: seriesCol,
                    type: 'nominal',
                },
            },
            config: {
                timeField: timeCol,
                valueField: valueCol,
                seriesField: seriesCol,
                gridCols,
                seriesMeta,
                cellWidth: options?.cellWidth ?? 100,
                cellHeight: options?.cellHeight ?? 30,
                curveType: options?.curveType ?? 'monotone',
                showSeriesLabel: options?.showSeriesLabel ?? true,
                showLatestValue: options?.showLatestValue ?? true,
                showTrendIndicator: options?.showTrendIndicator ?? true,
                highlightMinMax: options?.highlightMinMax ?? false,
                strokeWidth: options?.strokeWidth ?? 1.5,
            },
        };
        return spec;
    },
};
//# sourceMappingURL=sparkline-grid.js.map