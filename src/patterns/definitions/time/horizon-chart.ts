import type { VisualizationPattern, VisualizationSpec } from '../../../types.js';

export const horizonChartPattern: VisualizationPattern = {
  id: 'horizon-chart',
  name: 'Horizon Chart',
  category: 'time',
  description:
    'Ultra-compact time series that folds the y-axis into color bands, layering positive values and mirroring negatives. Shows many series in very little vertical space.',
  bestFor:
    'Dashboard monitoring of 10-50+ time series simultaneously. Server metrics, stock prices, sensor readings. When you need to spot anomalies across many series at once.',
  notFor:
    'Precise value reading, unfamiliar audiences (requires learning), fewer than 5 series.',

  dataRequirements: {
    minRows: 10,
    requiredColumns: [
      { type: 'date', count: 1, description: 'Time axis' },
      { type: 'numeric', count: 1, description: 'Value to visualize' },
      { type: 'categorical', count: 1, description: 'Series identifier (10-50 series)' },
    ],
    requiresTimeSeries: true,
  },

  selectionRules: [
    {
      condition: 'Explicit horizon chart intent',
      weight: 80,
      matches: (ctx) => {
        return /\bhorizon\b/i.test(ctx.intent);
      },
    },
    {
      condition: 'Many-series time monitoring with compact or dense intent',
      weight: 55,
      matches: (ctx) => {
        return (
          ctx.dataShape.hasTimeSeries &&
          ctx.dataShape.seriesCount >= 10 &&
          ctx.dataShape.numericColumnCount >= 1 &&
          /\b(compact|dense|monitor|overview|dashboard|anomal|many\s*series|all\s*series|sensor|server|metric)\b/i.test(ctx.intent)
        );
      },
    },
    {
      condition: 'Large number of time series (10+) without specific intent',
      weight: 35,
      matches: (ctx) => {
        return (
          ctx.dataShape.hasTimeSeries &&
          ctx.dataShape.seriesCount >= 10 &&
          ctx.dataShape.numericColumnCount >= 1
        );
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
      condition: 'Penalize for too few series — use line chart instead',
      weight: -40,
      matches: (ctx) => {
        return ctx.dataShape.seriesCount < 5;
      },
    },
  ],

  generateSpec: (data, columns, options) => {
    const dateCol = columns[0];
    const valueCol = columns.length > 1 ? columns[1] : columns[0];
    const seriesCol = columns.length > 2 ? columns[2] : undefined;

    const spec: VisualizationSpec = {
      pattern: 'horizon-chart',
      title: options?.title ?? `${valueCol} across series`,
      data,
      encoding: {
        x: {
          field: dateCol,
          type: 'temporal',
          title: dateCol,
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
        timeField: dateCol,
        valueField: valueCol,
        seriesField: seriesCol ?? null,
        bands: options?.bands ?? 3,
        mode: options?.mode ?? 'mirror',
      },
    };

    return spec;
  },
};
