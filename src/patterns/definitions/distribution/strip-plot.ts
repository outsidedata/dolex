/**
 * Strip Plot — small dataset distribution.
 *
 * The simplest distribution plot: just dots along an axis.
 * No binning, no density estimation. For small datasets where
 * every point can be individually seen and each value matters.
 */

import type { VisualizationPattern, VisualizationSpec } from '../../../types.js';

export const stripPlotPattern: VisualizationPattern = {
  id: 'strip-plot',
  name: 'Strip Plot',
  category: 'distribution',
  description:
    'Individual data points plotted along a single axis with minimal jitter. The simplest distribution view for small datasets where every point matters.',
  bestFor:
    'Small datasets (5-50 rows), comparing distributions across groups when sample size is too small for density estimation.',
  notFor:
    'Large datasets over 100 (points overlap — use histogram or beeswarm), complex distribution analysis (use violin).',

  dataRequirements: {
    minRows: 3,
    maxRows: 100,
    requiredColumns: [
      { type: 'numeric', count: 1, description: 'Value to plot' },
    ],
  },

  selectionRules: [
    {
      condition: 'Very small dataset — strip plot shows every point clearly',
      weight: 35,
      matches: (ctx) => {
        return (
          ctx.dataShape.rowCount >= 3 &&
          ctx.dataShape.rowCount <= 50 &&
          ctx.dataShape.numericColumnCount >= 1 &&
          !ctx.dataShape.hasTimeSeries
        );
      },
    },
    {
      condition: 'Distribution intent with small data — too few points for histogram/violin',
      weight: 65,
      matches: (ctx) => {
        return (
          /\b(distribut|spread|point|individual)\b/i.test(ctx.intent) &&
          ctx.dataShape.rowCount < 30
        );
      },
    },
    {
      condition: 'Small sample per group — density estimation would be unreliable',
      weight: 50,
      matches: (ctx) => {
        if (ctx.dataShape.categoryCount === 0) return false;
        const avgPerGroup = ctx.dataShape.rowCount / ctx.dataShape.categoryCount;
        return avgPerGroup < 15 && avgPerGroup >= 3;
      },
    },
    {
      condition: 'Penalize for time/comparison/composition signals — strip-plot is wrong',
      weight: -30,
      matches: (ctx) => {
        return ctx.dataShape.hasTimeSeries ||
          /(compar|rank|trend|over\s*time|composition|proportion)/i.test(ctx.intent);
      },
    },
    {
      condition: 'Penalize for large datasets — too many overlapping points',
      weight: -50,
      matches: (ctx) => {
        return ctx.dataShape.rowCount > 100;
      },
    },
  ],

  generateSpec: (data, columns, options) => {
    const valueCol = columns[0];
    const groupCol = columns.length > 1 ? columns[1] : undefined;

    const spec: VisualizationSpec = {
      pattern: 'strip-plot',
      title: options?.title ?? `${valueCol}${groupCol ? ` by ${groupCol}` : ''}`,
      data,
      encoding: {
        x: {
          field: valueCol,
          type: 'quantitative',
          title: valueCol,
        },
        y: groupCol
          ? {
              field: groupCol,
              type: 'nominal',
              title: groupCol,
            }
          : undefined,
        color: groupCol
          ? {
              field: groupCol,
              type: 'nominal',
            }
          : undefined,
      },
      config: {
        dotRadius: options?.dotRadius ?? 5,
        opacity: options?.opacity ?? 0.8,
      },
    };

    return spec;
  },
};
