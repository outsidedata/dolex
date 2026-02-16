/**
 * Metric — typographic KPI / big-number display.
 *
 * Headlines dashboards with scalar values, auto-abbreviation (1.2M),
 * delta/trend indicators (↑ 12%), and a multi-metric CSS Grid layout.
 */
export const metricPattern = {
    id: 'metric',
    name: 'Metric',
    category: 'composition',
    description: 'Big-number KPI cards with optional delta/trend indicators. Auto-abbreviates large values and arranges metrics in a responsive CSS Grid.',
    bestFor: 'Dashboard headlines, KPI summaries, scoreboards, single-stat callouts, executive overviews with a handful of key numbers.',
    notFor: 'Many data points (use bar or table), time series trends (use sparkline-grid or line), comparison across many categories.',
    dataRequirements: {
        minRows: 1,
        maxRows: 12,
        requiredColumns: [
            { type: 'categorical', count: 1, description: 'Metric label or name' },
            { type: 'numeric', count: 1, description: 'Metric value' },
        ],
    },
    selectionRules: [
        {
            condition: 'Intent explicitly mentions metric, KPI, scorecard, big number, or headline',
            weight: 95,
            matches: (ctx) => {
                return /\b(metric|kpi|scorecard|big\s*number|headline|stat\s*card|dashboard\s*number)\b/i.test(ctx.intent);
            },
        },
        {
            condition: 'Summary/total intent with very few rows — metric is natural',
            weight: 60,
            matches: (ctx) => {
                return (ctx.dataShape.rowCount <= 6 &&
                    ctx.dataShape.numericColumnCount >= 1 &&
                    /\b(summary|total|overview|snapshot|highlight|key\s*figure)\b/i.test(ctx.intent));
            },
        },
        {
            condition: 'Very few rows (1-4) with a label + value shape',
            weight: 40,
            matches: (ctx) => {
                return (ctx.dataShape.rowCount >= 1 &&
                    ctx.dataShape.rowCount <= 4 &&
                    ctx.dataShape.categoricalColumnCount >= 1 &&
                    ctx.dataShape.numericColumnCount >= 1);
            },
        },
        {
            condition: 'Penalize when many rows — metric is not for lists',
            weight: -50,
            matches: (ctx) => {
                return ctx.dataShape.rowCount > 12;
            },
        },
        {
            condition: 'Penalize time series data — use line/sparkline instead',
            weight: -40,
            matches: (ctx) => {
                return ctx.dataShape.hasTimeSeries || ctx.dataShape.dateColumnCount > 0;
            },
        },
    ],
    generateSpec: (data, columns, options) => {
        const labelCol = columns.find((c) => {
            const sample = data[0]?.[c];
            return typeof sample === 'string' || (typeof sample !== 'number' && isNaN(Number(sample)));
        }) ?? columns[0];
        const valueCol = columns.find((c) => {
            if (c === labelCol)
                return false;
            const sample = data[0]?.[c];
            return typeof sample === 'number' || !isNaN(Number(sample));
        }) ?? columns[1] ?? columns[0];
        // Try to detect a previousValue column
        const numericCols = columns.filter((c) => {
            if (c === labelCol || c === valueCol)
                return false;
            const sample = data[0]?.[c];
            return typeof sample === 'number' || !isNaN(Number(sample));
        });
        const previousValueCol = numericCols[0] ?? null;
        const spec = {
            pattern: 'metric',
            title: options?.title ?? 'Key Metrics',
            data,
            encoding: {
                label: {
                    field: labelCol,
                    type: 'nominal',
                },
                y: {
                    field: valueCol,
                    type: 'quantitative',
                    title: valueCol,
                },
            },
            config: {
                labelField: labelCol,
                valueField: valueCol,
                previousValueField: previousValueCol,
                abbreviate: options?.abbreviate ?? true,
                format: options?.format ?? 'auto',
                prefix: options?.prefix ?? '',
                suffix: options?.suffix ?? '',
                columns: options?.columns ?? 'auto',
            },
        };
        return spec;
    },
};
//# sourceMappingURL=metric.js.map