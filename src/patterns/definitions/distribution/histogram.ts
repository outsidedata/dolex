/**
 * Histogram — standard frequency distribution.
 *
 * The baseline distribution chart. Bins continuous values and shows
 * frequency counts. Good for understanding shape, spread, and central
 * tendency of a single numeric variable.
 */

import type { VisualizationPattern, VisualizationSpec } from '../../../types.js';

export const histogramPattern: VisualizationPattern = {
  id: 'histogram',
  name: 'Histogram',
  category: 'distribution',
  description:
    'Bins continuous data into intervals and shows frequency of each bin. Reveals distribution shape: normal, skewed, bimodal, uniform.',
  bestFor:
    'Understanding the shape of a single numeric variable: salary distribution, age distribution, response time distribution.',
  notFor:
    'Categorical data (use bar), very small datasets under 20 rows (use strip plot), comparing distributions across groups (use violin or ridgeline).',

  dataRequirements: {
    minRows: 20,
    requiredColumns: [
      { type: 'numeric', count: 1, description: 'Continuous variable to bin' },
    ],
  },

  selectionRules: [
    {
      condition: 'Single numeric column with enough rows for meaningful bins',
      weight: 50,
      matches: (ctx) => {
        return (
          ctx.dataShape.numericColumnCount >= 1 &&
          ctx.dataShape.rowCount >= 20 &&
          ctx.dataShape.categoricalColumnCount === 0
        );
      },
    },
    {
      condition: 'Intent mentions distribution, frequency, or histogram',
      weight: 40,
      matches: (ctx) => {
        return /\b(distribut|frequenc|histogram|how\s+many|count\s+of|spread|shape)\b/i.test(ctx.intent);
      },
    },
    {
      condition: 'Large dataset benefits from binning',
      weight: 20,
      matches: (ctx) => {
        return ctx.dataShape.rowCount >= 100 && ctx.dataShape.numericColumnCount >= 1;
      },
    },
    {
      condition: 'Penalize when categorical columns present — probably a comparison, not distribution',
      weight: -15,
      matches: (ctx) => {
        return ctx.dataShape.categoricalColumnCount >= 1 && !/distribut/i.test(ctx.intent);
      },
    },
    {
      condition: 'Penalize for very small datasets — strip plot is better',
      weight: -30,
      matches: (ctx) => {
        return ctx.dataShape.rowCount < 20;
      },
    },
  ],

  generateSpec: (data, columns, options) => {
    const valueCol = columns[0];
    const values = data.map((d) => Number(d[valueCol])).filter((v) => !isNaN(v));
    const min = Math.min(...values);
    const max = Math.max(...values);

    // Sturges' formula for bin count
    const binCount = options?.binCount ?? Math.ceil(Math.log2(values.length) + 1);
    const binWidth = (max - min) / binCount;

    // Build bin data
    const bins: Record<string, any>[] = [];
    for (let i = 0; i < binCount; i++) {
      const binStart = min + i * binWidth;
      const binEnd = binStart + binWidth;
      const count = values.filter((v) =>
        i === binCount - 1 ? v >= binStart && v <= binEnd : v >= binStart && v < binEnd
      ).length;
      bins.push({
        binStart,
        binEnd,
        binMid: (binStart + binEnd) / 2,
        binLabel: `${binStart.toFixed(1)}-${binEnd.toFixed(1)}`,
        count,
      });
    }

    const spec: VisualizationSpec = {
      pattern: 'histogram',
      title: options?.title ?? `Distribution of ${valueCol}`,
      data: bins,
      encoding: {
        x: {
          field: 'binMid',
          type: 'quantitative',
          title: valueCol,
        },
        y: {
          field: 'count',
          type: 'quantitative',
          title: 'Frequency',
        },
      },
      config: {
        binCount,
        showMean: options?.showMean ?? true,
        showMedian: options?.showMedian ?? false,
        mean: values.reduce((a, b) => a + b, 0) / values.length,
        median: values.sort((a, b) => a - b)[Math.floor(values.length / 2)],
      },
    };

    return spec;
  },
};
