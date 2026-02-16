/**
 * Calendar Heatmap — daily patterns.
 *
 * Shows values mapped onto a calendar grid, revealing day-of-week
 * patterns, seasonal effects, and daily variations. Made famous
 * by GitHub's contribution graph.
 */
export const calendarHeatmapPattern = {
    id: 'calendar-heatmap',
    name: 'Calendar Heatmap',
    category: 'time',
    description: 'Values mapped onto a calendar grid (weeks as columns, days as rows). Color intensity encodes magnitude. Reveals day-of-week effects, seasonal patterns, and anomalous days.',
    bestFor: 'Daily data over months or years: website traffic, sales, commits, exercise, temperature. Finding day-of-week and seasonal patterns.',
    notFor: 'Non-daily data (weekly, monthly — use line), very short time spans (use bar), non-temporal data.',
    dataRequirements: {
        minRows: 30,
        requiredColumns: [
            { type: 'date', count: 1, description: 'Daily date' },
            { type: 'numeric', count: 1, description: 'Value for each day' },
        ],
        requiresTimeSeries: true,
    },
    selectionRules: [
        {
            condition: 'Daily data spanning at least a month — calendar heatmap is ideal',
            weight: 80,
            matches: (ctx) => {
                if (!ctx.dataShape.hasTimeSeries || ctx.dataShape.dateColumnCount === 0)
                    return false;
                const dateCol = ctx.columns.find((c) => c.type === 'date');
                // Need enough unique dates to represent daily data
                return dateCol !== undefined && dateCol.uniqueCount >= 28;
            },
        },
        {
            condition: 'Intent mentions daily patterns, calendar, or day-of-week',
            weight: 60,
            matches: (ctx) => {
                return /\b(daily|calendar|day.of.week|weekday|weekend|heatmap|every\s+day|github|activity|contribution)\b/i.test(ctx.intent);
            },
        },
        {
            condition: 'Large number of time points — calendar is more compact than line for daily data',
            weight: 30,
            matches: (ctx) => {
                return ctx.dataShape.hasTimeSeries && ctx.dataShape.rowCount >= 90;
            },
        },
        {
            condition: 'Penalize for non-daily granularity (few time points suggests monthly/yearly)',
            weight: -40,
            matches: (ctx) => {
                const dateCol = ctx.columns.find((c) => c.type === 'date');
                return dateCol !== undefined && dateCol.uniqueCount < 20;
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
        const dateCol = columns[0];
        const valueCol = columns.length > 1 ? columns[1] : columns[0];
        // Compute value range for color scale
        const values = data.map((d) => Number(d[valueCol])).filter((v) => !isNaN(v));
        const minVal = Math.min(...values);
        const maxVal = Math.max(...values);
        const spec = {
            pattern: 'calendar-heatmap',
            title: options?.title ?? `${valueCol} calendar`,
            data,
            encoding: {
                x: {
                    field: dateCol,
                    type: 'temporal',
                    title: 'Week',
                },
                y: {
                    field: '_dayOfWeek',
                    type: 'ordinal',
                    title: 'Day',
                },
                color: {
                    field: valueCol,
                    type: 'quantitative',
                    scale: {
                        domain: [minVal, maxVal],
                        range: options?.colorRange ?? ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'],
                    },
                    title: valueCol,
                },
            },
            config: {
                timeField: dateCol,
                valueField: valueCol,
                cellSize: options?.cellSize ?? 15,
                cellGap: options?.cellGap ?? 2,
                showMonthLabels: options?.showMonthLabels ?? true,
                showDayLabels: options?.showDayLabels ?? true,
            },
        };
        return spec;
    },
};
//# sourceMappingURL=calendar-heatmap.js.map