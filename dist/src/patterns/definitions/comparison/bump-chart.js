/**
 * Bump Chart — rank changes over time.
 *
 * Shows how the relative positions of entities change across
 * ordered categories (usually time). Unlike line charts that show
 * absolute values, bump charts show relative ranking, making it
 * easy to spot who rose and who fell.
 */
export const bumpChartPattern = {
    id: 'bump-chart',
    name: 'Bump Chart',
    category: 'comparison',
    description: 'Tracks rank positions of entities over time or ordered categories. Lines connect rankings, and crossings show when one entity overtakes another.',
    bestFor: 'Ranking changes: team standings over seasons, product market share rank, country GDP ranking over decades, leaderboard progression.',
    notFor: 'Absolute values (use line chart), single time point (use bar), too many entities (>12 gets unreadable), non-ordinal x-axis.',
    dataRequirements: {
        minRows: 6,
        maxRows: 200,
        requiredColumns: [
            { type: 'categorical', count: 1, description: 'Entity being ranked (team, country, etc.)' },
            { type: 'numeric', count: 1, description: 'Value used to compute rankings' },
        ],
        minCategories: 3,
        maxCategories: 12,
        requiresTimeSeries: true,
    },
    selectionRules: [
        {
            condition: 'Intent explicitly mentions rank, ranking, position, or standings',
            weight: 90,
            matches: (ctx) => {
                return /\b(rank|ranking|position|standing|leaderboard|leader|place|moved up|moved down|overtake|overtook)\b/i.test(ctx.intent);
            },
        },
        {
            condition: 'Time series data with multiple categories (series) — potential for bump chart',
            weight: 40,
            matches: (ctx) => {
                return (ctx.dataShape.hasTimeSeries &&
                    ctx.dataShape.seriesCount >= 3 &&
                    ctx.dataShape.seriesCount <= 12 &&
                    ctx.dataShape.numericColumnCount >= 1);
            },
        },
        {
            condition: 'Moderate number of entities and time points — sweet spot for bump charts',
            weight: 20,
            matches: (ctx) => {
                const dateCols = ctx.columns.filter((c) => c.type === 'date');
                const timePoints = dateCols.length > 0 ? dateCols[0].uniqueCount : 0;
                return (ctx.dataShape.seriesCount >= 3 &&
                    ctx.dataShape.seriesCount <= 12 &&
                    timePoints >= 3 &&
                    timePoints <= 20);
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
            condition: 'Penalize for too many entities — becomes unreadable',
            weight: -30,
            matches: (ctx) => {
                return ctx.dataShape.seriesCount > 12;
            },
        },
    ],
    generateSpec: (data, columns, options) => {
        const entityCol = columns[0];
        const timeCol = columns.length > 1 ? columns[1] : columns[0];
        const valueCol = columns.length > 2 ? columns[2] : columns.length > 1 ? columns[1] : columns[0];
        // Compute rankings from raw values
        const timeValues = [...new Set(data.map((d) => d[timeCol]))];
        const rankedData = [];
        for (const time of timeValues) {
            const rowsAtTime = data
                .filter((d) => d[timeCol] === time)
                .sort((a, b) => Number(b[valueCol]) - Number(a[valueCol]));
            rowsAtTime.forEach((row, idx) => {
                rankedData.push({
                    ...row,
                    _rank: idx + 1,
                    _timePeriod: time,
                });
            });
        }
        const spec = {
            pattern: 'bump-chart',
            title: options?.title ?? `Ranking of ${entityCol} over ${timeCol}`,
            data: rankedData,
            encoding: {
                x: {
                    field: timeCol,
                    type: 'ordinal',
                    title: timeCol,
                },
                y: {
                    field: '_rank',
                    type: 'quantitative',
                    title: 'Rank',
                    sort: 'ascending',
                },
                color: {
                    field: entityCol,
                    type: 'nominal',
                },
            },
            config: {
                categoryField: entityCol,
                timeField: timeCol,
                valueField: valueCol,
                showLabels: true,
                strokeWidth: options?.strokeWidth ?? 3,
                dotRadius: options?.dotRadius ?? 5,
            },
        };
        return spec;
    },
};
//# sourceMappingURL=bump-chart.js.map