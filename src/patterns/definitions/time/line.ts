/**
 * Line Chart — standard time series.
 *
 * The baseline temporal pattern. Connects data points
 * chronologically to show trends, cycles, and change over time.
 * Works best with a single series or 2-5 series.
 */

import type { VisualizationPattern, VisualizationSpec } from '../../../types.js';

export const linePattern: VisualizationPattern = {
  id: 'line',
  name: 'Line Chart',
  category: 'time',
  description:
    'Points connected chronologically by lines. The standard for showing trends, cycles, seasonality, and change over continuous time.',
  bestFor:
    'Single time series or comparing 2-5 series. Showing trends, growth patterns, seasonal effects.',
  notFor:
    'More than 5 series (spaghetti — use small multiples), categorical data (use bar), distribution (use histogram).',

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
      condition: 'Time series data with 1-5 series — line chart is the standard',
      weight: 60,
      matches: (ctx) => {
        return (
          ctx.dataShape.hasTimeSeries &&
          ctx.dataShape.numericColumnCount >= 1 &&
          ctx.dataShape.seriesCount <= 5
        );
      },
    },
    {
      condition: 'Intent mentions trend, over time, or time series',
      weight: 40,
      matches: (ctx) => {
        return /\b(trend|over\s+time|time\s*series|month|year|quarter|growth|decline|trajectory|progress)\b/i.test(
          ctx.intent
        );
      },
    },
    {
      condition: 'Single series with many time points — classic line chart',
      weight: 30,
      matches: (ctx) => {
        return (
          ctx.dataShape.hasTimeSeries &&
          ctx.dataShape.seriesCount <= 1 &&
          ctx.dataShape.rowCount >= 5
        );
      },
    },
    {
      condition: 'Penalize for too many series — spaghetti chart',
      weight: -40,
      matches: (ctx) => {
        return ctx.dataShape.seriesCount > 5 && ctx.dataShape.hasTimeSeries;
      },
    },
    {
      condition: 'Penalize when no time dimension exists',
      weight: -50,
      matches: (ctx) => {
        return !ctx.dataShape.hasTimeSeries && ctx.dataShape.dateColumnCount === 0;
      },
    },
  ],

  generateSpec: (data, columns, options) => {
    const timeCol = columns[0];
    const valueCol = columns.length > 1 ? columns[1] : columns[0];
    const seriesCol = columns.length > 2 ? columns[2] : undefined;

    const spec: VisualizationSpec = {
      pattern: 'line',
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
        showPoints: options?.showPoints ?? (data.length <= 50),
        showArea: options?.showArea ?? false,
        interpolation: options?.interpolation ?? 'monotone',
        strokeWidth: options?.strokeWidth ?? 2,
      },
    };

    return spec;
  },
};
